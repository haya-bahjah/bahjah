import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../../db/prisma';
import { requireAuth } from '../../auth/middleware';
import { getEventById } from '../../events/registry';
import { getConnectedUserIds } from '../../rooms/presence';
import { createRoom, getRoomSummary, RoomError, uniqueDisplayName } from '../../rooms/service';
import { clearSchedule } from '../scheduler';
import { clearGameState } from '../state';
import { getRoomDef, ROOMS, FIRST_ROOM, type RoomId } from './content';
import { getSaudiHomeRooms, HAYAKOM_RESULTS, pickableRooms, resultsBucket, riyadhDay, saveSaudiHomeRooms } from './config';

export const saudiHomeRouter = Router();

function sendError(res: import('express').Response, err: unknown, next: import('express').NextFunction) {
  if (err instanceof RoomError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }
  next(err);
}

async function loadHostedRoom(code: string, userId: string) {
  const room = await prisma.room.findUnique({ where: { code } });
  if (!room || room.gameType !== 'saudi_home') throw new RoomError('ROOM_NOT_FOUND', 'No room with that code.', 404);
  if (room.hostId !== userId) throw new RoomError('NOT_HOST', 'Only the host can do that.', 403);
  return room;
}

// The rooms the host may pick in the lobby, and what is currently picked.
// Public on purpose: the list is the same for every room and holds nothing
// about who is playing.
saudiHomeRouter.get('/rooms/:code/route', async (req, res, next) => {
  try {
    const code = req.params.code.toUpperCase();
    res.json({
      first: { id: FIRST_ROOM, ...getRoomDef(FIRST_ROOM) },
      pool: ROOMS.filter((r) => r.active && r.id !== FIRST_ROOM),
      picked: await getSaudiHomeRooms(code),
    });
  } catch (err) {
    sendError(res, err, next);
  }
});

const routeSchema = z.object({ rooms: z.array(z.string()).max(4) });

// The host's hand-picked route. Fewer than four picked rooms are topped up at
// random when the game starts; an empty list means fully random.
saudiHomeRouter.put('/rooms/:code/route', requireAuth, async (req, res, next) => {
  const parsed = routeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Pick up to four rooms.' } });
    return;
  }
  try {
    const code = req.params.code.toUpperCase();
    const room = await loadHostedRoom(code, req.userId!);
    if (room.status !== 'lobby') throw new RoomError('INVALID_STATUS', 'The game has already started.', 409);
    const valid = pickableRooms();
    const rooms = parsed.data.rooms.filter((id, i, all): id is RoomId => valid.includes(id as RoomId) && all.indexOf(id) === i);
    await saveSaudiHomeRooms(code, rooms);
    res.json({ picked: rooms });
  } catch (err) {
    sendError(res, err, next);
  }
});

// A fresh room for the next group at the same event, hosted by the same
// screen, so the operator never has to go back to the event link. The old
// room is closed so any phone still on it is told the game is over.
saudiHomeRouter.post('/rooms/:code/new-group', requireAuth, async (req, res, next) => {
  try {
    const code = req.params.code.toUpperCase();
    const old = await loadHostedRoom(code, req.userId!);
    // An event's room hands on to another of that event's; a Hayakom room
    // (no event) hands on to another ordinary, paid one.
    if (old.eventId && !getEventById(old.eventId)) throw new RoomError('EVENT_NOT_FOUND', 'This event link is not active.', 404);
    const fresh = await createRoom(req.userId!, 'saudi-home', 'tv', old.eventId);
    const picked = await getSaudiHomeRooms(code);
    if (picked.length > 0) await saveSaudiHomeRooms(fresh.code, picked);
    if (old.status !== 'ended') {
      clearSchedule(code);
      await clearGameState(code);
      await prisma.room.update({ where: { id: old.id }, data: { status: 'ended', endedAt: new Date() } });
    }
    const summary = await getRoomSummary(fresh.code, await getConnectedUserIds(fresh.code));
    res.status(201).json({ room: summary });
  } catch (err) {
    sendError(res, err, next);
  }
});

// The game's name for a room, for the join screen a phone shows before the
// player is in it: a private event's own title, or Hayakom for a room opened
// from the games suite. Public, like the route list above.
saudiHomeRouter.get('/rooms/:code/title', async (req, res, next) => {
  try {
    const code = req.params.code.toUpperCase();
    const room = await prisma.room.findUnique({ where: { code }, select: { gameType: true, eventId: true } });
    if (!room || room.gameType !== 'saudi_home') throw new RoomError('ROOM_NOT_FOUND', 'No room with that code.', 404);
    res.json({ title: getEventById(room.eventId)?.title ?? { en: 'Hayakom', ar: 'حياكم' } });
  } catch (err) {
    sendError(res, err, next);
  }
});

// The name a player would join under, so the join screen can say so before
// they press Join ("There is already a Sara here, so you will appear as
// Sara2"). Names are already on the big screen, so this reveals nothing new.
saudiHomeRouter.get('/rooms/:code/name', async (req, res, next) => {
  try {
    const code = req.params.code.toUpperCase();
    const wanted = String(req.query.name ?? '').trim().slice(0, 24);
    if (!wanted) {
      res.json({ name: '' });
      return;
    }
    res.json({ name: await uniqueDisplayName(code, wanted) });
  } catch (err) {
    sendError(res, err, next);
  }
});

// The event's leaderboard for today, across every group that has played.
// Display names only.
saudiHomeRouter.get('/rooms/:code/today', async (req, res, next) => {
  try {
    const code = req.params.code.toUpperCase();
    const room = await prisma.room.findUnique({ where: { code }, select: { eventId: true, gameType: true } });
    if (!room || room.gameType !== 'saudi_home') {
      throw new RoomError('ROOM_NOT_FOUND', 'No room with that code.', 404);
    }
    const day = riyadhDay();
    const rows = await prisma.saudiHomeResult.findMany({
      where: { eventId: resultsBucket(room.eventId), day, score: { gt: 0 } },
      orderBy: [{ score: 'desc' }, { correctTimeMs: 'asc' }, { createdAt: 'asc' }],
      take: 10,
      select: { displayName: true, score: true },
    });
    res.json({ day, leaderboard: rows.map((r, i) => ({ rank: i + 1, name: r.displayName, score: r.score })) });
  } catch (err) {
    sendError(res, err, next);
  }
});

// A player's public result page. No account needed; nothing about anyone
// else in the game is returned.
saudiHomeRouter.get('/results/:token', async (req, res, next) => {
  try {
    const row = await prisma.saudiHomeResult.findUnique({ where: { shareToken: req.params.token } });
    if (!row) throw new RoomError('RESULT_NOT_FOUND', 'This result link is not valid.', 404);
    await prisma.saudiHomeResult.update({ where: { id: row.id }, data: { views: { increment: 1 } } });
    const event = getEventById(row.eventId);
    res.json({
      result: {
        name: row.displayName,
        score: row.score,
        rank: row.rank,
        playerCount: row.playerCount,
        correctCount: row.correctCount,
        questionCount: row.questionCount,
        champion: row.rank === 1 && row.score > 0,
        day: row.day,
        eventTitle:
          event?.title ??
          (row.eventId === HAYAKOM_RESULTS ? { en: 'Hayakom', ar: 'حياكم' } : { en: 'Welcome to a Saudi Home', ar: 'حياكم في بيت سعودي' }),
      },
    });
  } catch (err) {
    sendError(res, err, next);
  }
});

// Counts a press of a Share button, for the event's numbers.
saudiHomeRouter.post('/results/:token/share', async (req, res, next) => {
  try {
    await prisma.saudiHomeResult.updateMany({ where: { shareToken: req.params.token }, data: { shares: { increment: 1 } } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
