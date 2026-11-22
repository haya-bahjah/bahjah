import express, { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../../db/prisma';
import { requireAuth } from '../../auth/middleware';
import { createRoom, getRoomSummary, isRoomMember, RoomError } from '../../rooms/service';
import { getConnectedUserIds } from '../../rooms/presence';
import { loadGameState } from '../state';
import { detailsSchema, MAX_QUESTIONS, problems, type Question } from './model';
import { getSession, saveSession } from './session';

// مجلسك (Your Gatherings): the host's game builder, launching a session,
// pictures (theme images and guests' photo answers), notes for the honoree,
// and the album.
export const majlisakRouter = Router();

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_GAMES = 50;
const imageBody = express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: MAX_IMAGE_BYTES });

function fail(res: Response, next: NextFunction, err: unknown) {
  if (err instanceof RoomError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }
  next(err);
}
const bad = (res: Response, message: string, code = 'VALIDATION_ERROR') => res.status(400).json({ error: { code, message } });

// The picture's own bytes decide its type, not the header it came with.
function sniff(buf: Buffer): string | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length > 12 && buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP') return 'image/webp';
  return null;
}

type GameRow = Awaited<ReturnType<typeof prisma.majlisakGame.findFirst>>;
function gameJson(g: NonNullable<GameRow>) {
  return {
    id: g.id,
    title: g.title,
    occasion: g.occasion,
    honoree: g.honoree,
    description: g.description,
    language: g.language,
    themeId: g.themeId,
    themeImageId: g.themeImageId,
    questions: g.questions as unknown as Question[],
    status: g.status,
    albumToken: g.albumToken,
    updatedAt: g.updatedAt,
    problems: problems({ title: g.title, honoree: g.honoree, questions: g.questions as unknown as Question[] }),
  };
}

async function ownGame(id: string, userId: string) {
  const g = await prisma.majlisakGame.findUnique({ where: { id } });
  if (!g || g.hostId !== userId) throw new RoomError('GAME_NOT_FOUND', 'No game with that id.', 404);
  return g;
}

// --- My games ------------------------------------------------------------------
majlisakRouter.get('/games', requireAuth, async (req, res, next) => {
  try {
    const rows = await prisma.majlisakGame.findMany({ where: { hostId: req.userId! }, orderBy: { updatedAt: 'desc' }, take: MAX_GAMES });
    res.json({ games: rows.map((g) => ({ id: g.id, title: g.title, honoree: g.honoree, themeId: g.themeId, themeImageId: g.themeImageId, status: g.status, questions: (g.questions as unknown[]).length, updatedAt: g.updatedAt })) });
  } catch (err) {
    fail(res, next, err);
  }
});

majlisakRouter.post('/games', requireAuth, async (req, res, next) => {
  const parsed = detailsSchema.safeParse(req.body ?? {});
  if (!parsed.success) return bad(res, parsed.error.issues[0]?.message ?? 'Invalid input.');
  try {
    const count = await prisma.majlisakGame.count({ where: { hostId: req.userId! } });
    if (count >= MAX_GAMES) throw new RoomError('TOO_MANY', `At most ${MAX_GAMES} games.`, 409);
    const d = parsed.data;
    const g = await prisma.majlisakGame.create({
      data: {
        hostId: req.userId!,
        title: d.title ?? '',
        occasion: d.occasion ?? 'graduation',
        honoree: d.honoree ?? '',
        description: d.description ?? '',
        language: d.language ?? 'ar',
        themeId: d.themeId ?? d.occasion ?? 'graduation',
        themeImageId: d.themeImageId ?? null,
        questions: (d.questions ?? []) as unknown as object,
      },
    });
    res.status(201).json({ game: gameJson(g) });
  } catch (err) {
    fail(res, next, err);
  }
});

majlisakRouter.get('/games/:id', requireAuth, async (req, res, next) => {
  try {
    res.json({ game: gameJson(await ownGame(req.params.id, req.userId!)) });
  } catch (err) {
    fail(res, next, err);
  }
});

// Saving goes back to draft only when it would change what guests play; a
// published game keeps its status, and the change applies to the next session.
majlisakRouter.patch('/games/:id', requireAuth, async (req, res, next) => {
  const parsed = detailsSchema.safeParse(req.body ?? {});
  if (!parsed.success) return bad(res, parsed.error.issues[0]?.message ?? 'Invalid input.');
  try {
    await ownGame(req.params.id, req.userId!);
    const d = parsed.data;
    if (d.questions) {
      const ids = new Set(d.questions.map((q) => q.id));
      if (ids.size !== d.questions.length) return bad(res, 'Two questions share an id.');
    }
    if (d.themeImageId) {
      const img = await prisma.majlisakImage.findUnique({ where: { id: d.themeImageId }, select: { ownerId: true, kind: true } });
      if (!img || img.ownerId !== req.userId || img.kind !== 'theme') return bad(res, 'That image is not yours.');
    }
    const g = await prisma.majlisakGame.update({
      where: { id: req.params.id },
      data: { ...d, ...(d.questions ? { questions: d.questions as unknown as object } : {}) },
    });
    res.json({ game: gameJson(g) });
  } catch (err) {
    fail(res, next, err);
  }
});

majlisakRouter.post('/games/:id/publish', requireAuth, async (req, res, next) => {
  try {
    const g = await ownGame(req.params.id, req.userId!);
    const list = problems({ title: g.title, honoree: g.honoree, questions: g.questions as unknown as Question[] });
    if (list.length) {
      res.status(409).json({ error: { code: 'NOT_READY', message: 'Finish the game before publishing.' }, problems: list });
      return;
    }
    const updated = await prisma.majlisakGame.update({ where: { id: g.id }, data: { status: 'published' } });
    res.json({ game: gameJson(updated) });
  } catch (err) {
    fail(res, next, err);
  }
});

// Opens a session: a room with a snapshot of the game as it is now.
majlisakRouter.post('/games/:id/launch', requireAuth, async (req, res, next) => {
  try {
    const g = await ownGame(req.params.id, req.userId!);
    const questions = g.questions as unknown as Question[];
    const list = problems({ title: g.title, honoree: g.honoree, questions });
    if (list.length) {
      res.status(409).json({ error: { code: 'NOT_READY', message: 'Finish the game before launching it.' }, problems: list });
      return;
    }
    if (g.status !== 'published') await prisma.majlisakGame.update({ where: { id: g.id }, data: { status: 'published' } });
    const room = await createRoom(req.userId!, 'majlisak', 'tv');
    await saveSession(room.code, {
      gameId: g.id,
      title: g.title,
      honoree: g.honoree,
      occasion: g.occasion,
      language: g.language as 'ar' | 'en' | 'both',
      themeId: g.themeId,
      themeImageId: g.themeImageId,
      questions: questions.slice(0, MAX_QUESTIONS),
      hostPlays: Boolean(req.body && req.body.hostPlays),
    });
    res.status(201).json({ room: await getRoomSummary(room.code, await getConnectedUserIds(room.code)) });
  } catch (err) {
    fail(res, next, err);
  }
});

// --- A session's public face and "Host plays too" ------------------------------
const roomCode = (req: Request) => String(req.params.code).toUpperCase();

majlisakRouter.get('/rooms/:code/session', requireAuth, async (req, res, next) => {
  try {
    const code = roomCode(req);
    if (!(await isRoomMember(code, req.userId!))) throw new RoomError('NOT_A_MEMBER', 'Join this room first.', 403);
    const s = await getSession(code);
    if (!s) throw new RoomError('NOT_LAUNCHED', 'This session has no game.', 404);
    // What the lobby and the waiting screens need -- never the questions.
    res.json({ session: { title: s.title, honoree: s.honoree, occasion: s.occasion, language: s.language, themeId: s.themeId, themeImageId: s.themeImageId, hostPlays: s.hostPlays, questions: s.questions.length } });
  } catch (err) {
    fail(res, next, err);
  }
});

majlisakRouter.patch('/rooms/:code/session', requireAuth, async (req, res, next) => {
  const parsed = z.object({ hostPlays: z.boolean() }).safeParse(req.body ?? {});
  if (!parsed.success) return bad(res, 'Invalid input.');
  try {
    const code = roomCode(req);
    const room = await prisma.room.findUnique({ where: { code }, select: { hostId: true, status: true } });
    if (!room) throw new RoomError('ROOM_NOT_FOUND', 'No room with that code.', 404);
    if (room.hostId !== req.userId) throw new RoomError('NOT_HOST', 'Only the host can change that.', 403);
    if (room.status !== 'lobby') throw new RoomError('INVALID_STATUS', 'The game has already started.', 409);
    const s = await getSession(code);
    if (!s) throw new RoomError('NOT_LAUNCHED', 'This session has no game.', 404);
    await saveSession(code, { ...s, hostPlays: parsed.data.hostPlays });
    res.json({ session: { hostPlays: parsed.data.hostPlays } });
  } catch (err) {
    fail(res, next, err);
  }
});

// --- Pictures ------------------------------------------------------------------
// A host's own theme picture. Served to anyone holding its id: the id is a
// random uuid, and guests' phones need it to draw the theme.
majlisakRouter.post('/images', requireAuth, imageBody, async (req, res, next) => {
  try {
    const buf = req.body as Buffer;
    if (!Buffer.isBuffer(buf) || !buf.length) return bad(res, 'Choose a JPG or PNG picture.');
    const mime = sniff(buf);
    if (!mime) return bad(res, 'Choose a JPG or PNG picture.');
    const img = await prisma.majlisakImage.create({ data: { ownerId: req.userId!, kind: 'theme', mime, data: buf } });
    res.status(201).json({ id: img.id });
  } catch (err) {
    fail(res, next, err);
  }
});

majlisakRouter.get('/images/:id', async (req, res, next) => {
  try {
    if (!/^[0-9a-f-]{36}$/.test(req.params.id)) return res.status(404).end();
    const img = await prisma.majlisakImage.findUnique({ where: { id: req.params.id } });
    if (!img || img.kind !== 'theme') return res.status(404).end();
    res.setHeader('Content-Type', img.mime);
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.send(Buffer.from(img.data));
  } catch (err) {
    fail(res, next, err);
  }
});

// A guest's photo answer, uploaded while the photo question is open. The
// answer itself (its id) then goes in through the game like any other.
majlisakRouter.post('/rooms/:code/photos', requireAuth, imageBody, async (req, res, next) => {
  try {
    const code = roomCode(req);
    if (!(await isRoomMember(code, req.userId!))) throw new RoomError('NOT_A_MEMBER', 'Join this room first.', 403);
    const state = await loadGameState(code);
    const data = state?.data as { questions?: Question[]; index?: number; gameId?: string } | undefined;
    const q = data?.questions?.[data.index ?? 0];
    if (!state || state.phase !== 'question' || !q || q.format !== 'photo') throw new RoomError('ROUND_LOCKED', 'Photos are closed for now.', 409);
    const buf = req.body as Buffer;
    if (!Buffer.isBuffer(buf) || !buf.length) return bad(res, 'Choose a photo.');
    const mime = sniff(buf);
    if (!mime) return bad(res, 'Choose a JPG or PNG photo.');
    const me = await prisma.user.findUnique({ where: { id: req.userId! }, select: { fullName: true } });
    const img = await prisma.majlisakImage.create({
      data: { ownerId: req.userId!, gameId: data?.gameId ?? null, kind: 'photo', mime, data: buf, roomCode: code, questionId: q.id, authorName: me?.fullName ?? '' },
    });
    res.status(201).json({ id: img.id });
  } catch (err) {
    fail(res, next, err);
  }
});

// A photo, for the game's host (signed in) or through the album link.
async function sendPhoto(res: Response, id: string, gameId: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return res.status(404).end();
  const img = await prisma.majlisakImage.findUnique({ where: { id } });
  if (!img || img.kind !== 'photo' || img.gameId !== gameId) return res.status(404).end();
  res.setHeader('Content-Type', img.mime);
  res.setHeader('Cache-Control', 'private, max-age=3600');
  return res.send(Buffer.from(img.data));
}

// --- Notes for the honoree -------------------------------------------------------
majlisakRouter.post('/rooms/:code/notes', requireAuth, async (req, res, next) => {
  const parsed = z.object({ text: z.string().trim().min(1).max(300) }).safeParse(req.body ?? {});
  if (!parsed.success) return bad(res, 'Write a short note.');
  if (/[<>]/.test(parsed.data.text)) return bad(res, 'Plain text only.');
  try {
    const code = roomCode(req);
    if (!(await isRoomMember(code, req.userId!))) throw new RoomError('NOT_A_MEMBER', 'Join this room first.', 403);
    const s = await getSession(code);
    if (!s) throw new RoomError('NOT_LAUNCHED', 'This session has no game.', 404);
    const me = await prisma.user.findUnique({ where: { id: req.userId! }, select: { fullName: true } });
    const existing = await prisma.majlisakNote.count({ where: { roomCode: code, userId: req.userId! } });
    if (existing >= 3) throw new RoomError('TOO_MANY', 'That is plenty of notes — thank you!', 409);
    await prisma.majlisakNote.create({ data: { gameId: s.gameId, roomCode: code, userId: req.userId!, authorName: me?.fullName ?? '', text: parsed.data.text } });
    res.status(201).json({ ok: true });
  } catch (err) {
    fail(res, next, err);
  }
});

// --- The album -------------------------------------------------------------------
async function albumJson(g: NonNullable<GameRow>, base: string) {
  const photos = await prisma.majlisakImage.findMany({ where: { gameId: g.id, kind: 'photo' }, orderBy: { createdAt: 'asc' }, select: { id: true, authorName: true, questionId: true, createdAt: true } });
  const notes = await prisma.majlisakNote.findMany({ where: { gameId: g.id }, orderBy: { createdAt: 'asc' }, select: { id: true, authorName: true, text: true, createdAt: true } });
  const prompts = new Map((g.questions as unknown as Question[]).map((q) => [q.id, q.prompt]));
  return {
    title: g.title,
    honoree: g.honoree,
    occasion: g.occasion,
    themeId: g.themeId,
    themeImageId: g.themeImageId,
    photos: photos.map((p) => ({ id: p.id, author: p.authorName, prompt: prompts.get(p.questionId ?? '') ?? '', createdAt: p.createdAt, url: `${base}/photos/${p.id}` })),
    notes,
  };
}

majlisakRouter.get('/games/:id/album', requireAuth, async (req, res, next) => {
  try {
    const g = await ownGame(req.params.id, req.userId!);
    res.json({ album: { ...(await albumJson(g, `/api/games/majlisak/album/${g.albumToken}`)), token: g.albumToken } });
  } catch (err) {
    fail(res, next, err);
  }
});

majlisakRouter.get('/album/:token', async (req, res, next) => {
  try {
    if (!/^[0-9a-f-]{36}$/.test(req.params.token)) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'No album here.' } });
    const g = await prisma.majlisakGame.findUnique({ where: { albumToken: req.params.token } });
    if (!g) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'No album here.' } });
    res.setHeader('Cache-Control', 'no-store');
    res.json({ album: await albumJson(g, `/api/games/majlisak/album/${g.albumToken}`) });
  } catch (err) {
    fail(res, next, err);
  }
});

majlisakRouter.get('/album/:token/photos/:id', async (req, res, next) => {
  try {
    if (!/^[0-9a-f-]{36}$/.test(req.params.token)) return res.status(404).end();
    const g = await prisma.majlisakGame.findUnique({ where: { albumToken: req.params.token }, select: { id: true } });
    if (!g) return res.status(404).end();
    await sendPhoto(res, req.params.id, g.id);
  } catch (err) {
    fail(res, next, err);
  }
});

