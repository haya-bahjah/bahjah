import { Router, type NextFunction, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../../db/prisma';
import { requireAuth } from '../../auth/middleware';
import { isRoomMember, RoomError } from '../../rooms/service';
import { withRoomLock } from '../roomLock';
import {
  getConfig,
  MAX_COUNT,
  MAX_SECONDS,
  MIN_COUNT,
  MIN_SECONDS,
  PACK_CHOICES,
  packSize,
  POINTS,
  saveConfig,
  SECONDS_STEP,
  type WhoAmIConfig,
} from './config';

// The host's session setup (wireframe 01): pack, reveal mode, seconds per
// clue, how many identities, and whether the host runs the game from the TV.
const configSchema = z.object({
  pack: z.enum(PACK_CHOICES as [string, ...string[]]).optional(),
  reveal: z.enum(['timed', 'host']).optional(),
  seconds: z
    .number()
    .int()
    .min(MIN_SECONDS)
    .max(MAX_SECONDS)
    .refine((n) => n % SECONDS_STEP === 0, { message: `Seconds per clue move in steps of ${SECONDS_STEP}.` })
    .optional(),
  count: z.number().int().min(MIN_COUNT).max(MAX_COUNT).optional(),
  hostOnTv: z.boolean().optional(),
});

export const whoAmIRouter = Router();

async function loadRoom(code: string, userId: string) {
  const room = await prisma.room.findUnique({ where: { code }, select: { hostId: true, gameType: true, status: true } });
  if (!room) throw new RoomError('ROOM_NOT_FOUND', 'No room with that code.', 404);
  if (room.gameType !== 'who_am_i') throw new RoomError('WRONG_GAME_TYPE', 'This room is not a Who Am I? room.', 400);
  if (!(await isRoomMember(code, userId))) throw new RoomError('NOT_A_MEMBER', 'Join this room first.', 403);
  return room;
}

function fail(res: Response, next: NextFunction, err: unknown) {
  if (err instanceof RoomError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }
  next(err);
}

const payload = (config: WhoAmIConfig) => ({
  config,
  packs: PACK_CHOICES.map((id) => ({ id, size: packSize(id) })),
  points: POINTS,
});

whoAmIRouter.get('/rooms/:code/config', requireAuth, async (req, res, next) => {
  const code = req.params.code.toUpperCase();
  try {
    const room = await loadRoom(code, req.userId!);
    res.json({ ...payload(await getConfig(code)), isHost: room.hostId === req.userId });
  } catch (err) {
    fail(res, next, err);
  }
});

whoAmIRouter.patch('/rooms/:code/config', requireAuth, async (req, res, next) => {
  const code = req.params.code.toUpperCase();
  const parsed = configSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input.' } });
    return;
  }
  try {
    const room = await loadRoom(code, req.userId!);
    if (room.hostId !== req.userId) throw new RoomError('NOT_HOST', 'Only the host can set up the game.', 403);
    // Fixed once the game starts; moving the controls mid-game is a game
    // action (see engine.ts, 'hostOnTv').
    if (room.status !== 'lobby') throw new RoomError('INVALID_STATUS', 'This room has already started.', 409);
    const config = await withRoomLock(`wai-config:${code}`, async () => {
      const next = { ...(await getConfig(code)), ...parsed.data } as WhoAmIConfig;
      await saveConfig(code, next);
      return next;
    });
    res.json(payload(config));
  } catch (err) {
    fail(res, next, err);
  }
});
