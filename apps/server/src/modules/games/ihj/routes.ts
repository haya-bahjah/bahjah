import { randomUUID } from 'crypto';
import { Router } from 'express';
import { prisma } from '../../../db/prisma';
import { requireAuth } from '../../auth/middleware';
import { isRoomMember, RoomError } from '../../rooms/service';
import { getIhjCategoriesSync, getIhjLettersSync } from './bank';
import { normalizeAnswer } from '../normalize';
import { withRoomLock } from '../roomLock';
import {
  defaultIhjConfig,
  getIhjRoomConfig,
  pickCategory,
  resolveIhjCategories,
  roomCategories,
  saveIhjRoomConfig,
  type IhjRoomConfig,
} from './config';
import { ihjConfigSchema, ihjProposalDecisionSchema, ihjProposalSchema } from './validation';

// Enough for a room to have its say without one phone filling the host's
// sheet: a few waiting per player, and a ceiling on the room.
const MAX_PENDING_PER_PLAYER = 3;
const MAX_PROPOSALS_PER_ROOM = 30;

// Config writes are read-modify-write on one Redis key, and a player's
// proposal can land while the host is saving settings, so they queue per
// room. Not the game-state lock: a busy lobby should not hold up a game.
const configLock = <T>(code: string, fn: () => Promise<T>) => withRoomLock(`ihj-config:${code}`, fn);

// What every config response carries: the saved settings, the five that
// will be played, and everything this room can pick from.
function configPayload(config: IhjRoomConfig) {
  return {
    config,
    categories: resolveIhjCategories(config),
    allCategories: roomCategories(config),
    proposals: config.proposals ?? [],
  };
}

export const ihjRouter = Router();

ihjRouter.get('/categories', requireAuth, (_req, res) => {
  res.json({ categories: getIhjCategoriesSync(), letterCount: getIhjLettersSync().length });
});

async function loadRoomForConfig(code: string, userId: string) {
  const room = await prisma.room.findUnique({ where: { code }, select: { hostId: true, gameType: true, status: true } });
  if (!room) throw new RoomError('ROOM_NOT_FOUND', 'No room with that code.', 404);
  if (room.gameType !== 'insan_hayawan_jamad') {
    throw new RoomError('WRONG_GAME_TYPE', 'This room is not an إنسان حيوان جماد room.', 400);
  }
  const member = await isRoomMember(code, userId);
  if (!member) throw new RoomError('NOT_A_MEMBER', 'Join this room before viewing its config.', 403);
  return room;
}

ihjRouter.get('/rooms/:code/config', requireAuth, async (req, res, next) => {
  const code = req.params.code.toUpperCase();
  try {
    const room = await loadRoomForConfig(code, req.userId!);
    const config = (await getIhjRoomConfig(code)) ?? defaultIhjConfig();
    // Resolved rather than raw, so the panel shows the five that will
    // actually be played even when the room has never been configured.
    res.json({ ...configPayload(config), isHost: room.hostId === req.userId });
  } catch (err) {
    if (err instanceof RoomError) {
      res.status(err.status).json({ error: { code: err.code, message: err.message } });
      return;
    }
    next(err);
  }
});

ihjRouter.patch('/rooms/:code/config', requireAuth, async (req, res, next) => {
  const code = req.params.code.toUpperCase();
  const parsed = ihjConfigSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input.' } });
    return;
  }
  try {
    const room = await loadRoomForConfig(code, req.userId!);
    if (room.hostId !== req.userId) {
      res.status(403).json({ error: { code: 'NOT_HOST', message: 'Only the host can configure the game.' } });
      return;
    }
    if (room.status !== 'lobby') {
      res.status(409).json({ error: { code: 'INVALID_STATUS', message: 'This room has already started or ended.' } });
      return;
    }
    // Merged over what is saved: the settings sheet sends rounds, timer and
    // picks, and must not wipe the room's own categories or its proposals.
    const config = await configLock(code, async () => {
      const next: IhjRoomConfig = { ...((await getIhjRoomConfig(code)) ?? defaultIhjConfig()), ...parsed.data };
      await saveIhjRoomConfig(code, next);
      return next;
    });
    res.json(configPayload(config));
  } catch (err) {
    if (err instanceof RoomError) {
      res.status(err.status).json({ error: { code: err.code, message: err.message } });
      return;
    }
    next(err);
  }
});

function sendError(res: import('express').Response, next: import('express').NextFunction, err: unknown) {
  if (err instanceof RoomError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }
  next(err);
}

// Anybody in the room can propose a category while it is still in the lobby.
// The host's own proposal needs nobody's approval, so it goes straight in.
ihjRouter.post('/rooms/:code/proposals', requireAuth, async (req, res, next) => {
  const code = req.params.code.toUpperCase();
  const parsed = ihjProposalSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input.' } });
    return;
  }
  try {
    const room = await loadRoomForConfig(code, req.userId!);
    if (room.status !== 'lobby') throw new RoomError('INVALID_STATUS', 'This room has already started or ended.', 409);
    const user = await prisma.user.findUnique({ where: { id: req.userId! }, select: { fullName: true } });
    const isHost = room.hostId === req.userId;
    const name = parsed.data.name;

    const config = await configLock(code, async () => {
      const current = (await getIhjRoomConfig(code)) ?? defaultIhjConfig();
      const proposals = current.proposals ?? [];
      const key = normalizeAnswer(name);
      const taken =
        roomCategories(current).some((c) => normalizeAnswer(c.name) === key) ||
        proposals.some((p) => p.status === 'pending' && normalizeAnswer(p.name) === key);
      if (taken) throw new RoomError('ALREADY_PROPOSED', 'That category is already on the list.', 409);
      if (proposals.length >= MAX_PROPOSALS_PER_ROOM) {
        throw new RoomError('TOO_MANY_PROPOSALS', 'This room has proposed enough categories.', 409);
      }
      if (proposals.filter((p) => p.status === 'pending' && p.byUserId === req.userId).length >= MAX_PENDING_PER_PLAYER) {
        throw new RoomError('TOO_MANY_PROPOSALS', 'Wait for the host to answer your other proposals first.', 409);
      }

      const proposal = {
        id: randomUUID(),
        name,
        byUserId: req.userId!,
        byName: user?.fullName ?? '',
        status: isHost ? ('approved' as const) : ('pending' as const),
      };
      let next: IhjRoomConfig = { ...current, proposals: [...proposals, proposal] };
      if (isHost) next = approve(next, proposal.id, name);
      await saveIhjRoomConfig(code, next);
      return next;
    });
    res.status(201).json(configPayload(config));
  } catch (err) {
    sendError(res, next, err);
  }
});

// An approved proposal becomes one of the room's categories and is picked
// straight away -- approving it is the host saying "play this".
function approve(config: IhjRoomConfig, proposalId: string, name: string): IhjRoomConfig {
  const id = `custom-${proposalId}`;
  const customCategories = [...(config.customCategories ?? []), { id, name }];
  const withCategory = { ...config, customCategories };
  return { ...withCategory, categoryIds: pickCategory(withCategory, id) };
}

ihjRouter.patch('/rooms/:code/proposals/:id', requireAuth, async (req, res, next) => {
  const code = req.params.code.toUpperCase();
  const parsed = ihjProposalDecisionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input.' } });
    return;
  }
  try {
    const room = await loadRoomForConfig(code, req.userId!);
    if (room.hostId !== req.userId) throw new RoomError('NOT_HOST', 'Only the host decides on proposals.', 403);
    if (room.status !== 'lobby') throw new RoomError('INVALID_STATUS', 'This room has already started or ended.', 409);
    const config = await configLock(code, async () => {
      const current = (await getIhjRoomConfig(code)) ?? defaultIhjConfig();
      const proposal = (current.proposals ?? []).find((p) => p.id === req.params.id);
      if (!proposal) throw new RoomError('NOT_FOUND', 'That proposal is not in this room.', 404);
      // Deciding twice is a no-op, so a double tap cannot add a category twice.
      if (proposal.status !== 'pending') return current;
      const status = parsed.data.approve ? ('approved' as const) : ('rejected' as const);
      let next: IhjRoomConfig = {
        ...current,
        proposals: (current.proposals ?? []).map((p) => (p.id === proposal.id ? { ...p, status } : p)),
      };
      if (parsed.data.approve) next = approve(next, proposal.id, proposal.name);
      await saveIhjRoomConfig(code, next);
      return next;
    });
    res.json(configPayload(config));
  } catch (err) {
    sendError(res, next, err);
  }
});
