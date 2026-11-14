import { randomUUID } from 'crypto';
import { Router, type NextFunction, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../../db/prisma';
import { requireAuth } from '../../auth/middleware';
import { isRoomMember, RoomError } from '../../rooms/service';
import { withRoomLock } from '../roomLock';
import {
  getConfig,
  MAX_COUNT,
  MAX_CUSTOM,
  MAX_SIDE_SECONDS,
  MAX_STATEMENT_LENGTH,
  MIN_COUNT,
  MIN_SIDE_SECONDS,
  saveConfig,
  SIDE_SECONDS_STEP,
  type ForOrAgainstConfig,
} from './config';
import { STATEMENT_CATEGORIES } from './statements';

// The host's session setup (wireframe 01): statement source, categories,
// their own statements, how many, time per team, and whether players may
// change sides in the final vote.
const configSchema = z.object({
  source: z.enum(['packs', 'mine', 'both']).optional(),
  categories: z.array(z.enum(STATEMENT_CATEGORIES as [string, ...string[]])).max(STATEMENT_CATEGORIES.length).optional(),
  count: z.number().int().min(MIN_COUNT).max(MAX_COUNT).optional(),
  sideSeconds: z
    .number()
    .int()
    .min(MIN_SIDE_SECONDS)
    .max(MAX_SIDE_SECONDS)
    .refine((n) => n % SIDE_SECONDS_STEP === 0, { message: `Time per team moves in steps of ${SIDE_SECONDS_STEP} seconds.` })
    .optional(),
  allowSwitch: z.boolean().optional(),
});

// A statement is read out on the big screen, so it gets a nickname's rules:
// no markup, no control characters, and short.
const statementSchema = z.object({
  text: z
    .string()
    .trim()
    .min(3, 'Write a statement.')
    .max(MAX_STATEMENT_LENGTH, `Keep it under ${MAX_STATEMENT_LENGTH} characters.`)
    .refine((s) => !/[<>]/.test(s) && !/[\u0000-\u001F\u007F]/.test(s), { message: 'Plain text only.' }),
});

export const forOrAgainstRouter = Router();

const lock = <T>(code: string, fn: () => Promise<T>) => withRoomLock(`foa-config:${code}`, fn);

async function loadRoom(code: string, userId: string) {
  const room = await prisma.room.findUnique({ where: { code }, select: { hostId: true, gameType: true, status: true } });
  if (!room) throw new RoomError('ROOM_NOT_FOUND', 'No room with that code.', 404);
  if (room.gameType !== 'for_or_against') throw new RoomError('WRONG_GAME_TYPE', 'This room is not a For or Against room.', 400);
  if (!(await isRoomMember(code, userId))) throw new RoomError('NOT_A_MEMBER', 'Join this room first.', 403);
  return room;
}

async function loadHostLobby(code: string, userId: string) {
  const room = await loadRoom(code, userId);
  if (room.hostId !== userId) throw new RoomError('NOT_HOST', 'Only the host can set up the game.', 403);
  if (room.status !== 'lobby') throw new RoomError('INVALID_STATUS', 'This room has already started or ended.', 409);
  return room;
}

function fail(res: Response, next: NextFunction, err: unknown) {
  if (err instanceof RoomError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }
  next(err);
}

const payload = (config: ForOrAgainstConfig) => ({ config, categories: STATEMENT_CATEGORIES });

forOrAgainstRouter.get('/rooms/:code/config', requireAuth, async (req, res, next) => {
  const code = req.params.code.toUpperCase();
  try {
    const room = await loadRoom(code, req.userId!);
    res.json({ ...payload(await getConfig(code)), isHost: room.hostId === req.userId });
  } catch (err) {
    fail(res, next, err);
  }
});

forOrAgainstRouter.patch('/rooms/:code/config', requireAuth, async (req, res, next) => {
  const code = req.params.code.toUpperCase();
  const parsed = configSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input.' } });
    return;
  }
  try {
    await loadHostLobby(code, req.userId!);
    const config = await lock(code, async () => {
      const next = { ...(await getConfig(code)), ...parsed.data } as ForOrAgainstConfig;
      await saveConfig(code, next);
      return next;
    });
    res.json(payload(config));
  } catch (err) {
    fail(res, next, err);
  }
});

forOrAgainstRouter.post('/rooms/:code/statements', requireAuth, async (req, res, next) => {
  const code = req.params.code.toUpperCase();
  const parsed = statementSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input.' } });
    return;
  }
  try {
    await loadHostLobby(code, req.userId!);
    const config = await lock(code, async () => {
      const current = await getConfig(code);
      if (current.custom.length >= MAX_CUSTOM) throw new RoomError('TOO_MANY', `At most ${MAX_CUSTOM} statements of your own.`, 409);
      // Writing one of your own means you want it played.
      const source = current.source === 'packs' ? 'both' : current.source;
      const next = { ...current, source, custom: [...current.custom, { id: `mine-${randomUUID()}`, text: parsed.data.text }] } as ForOrAgainstConfig;
      await saveConfig(code, next);
      return next;
    });
    res.status(201).json(payload(config));
  } catch (err) {
    fail(res, next, err);
  }
});

forOrAgainstRouter.delete('/rooms/:code/statements/:id', requireAuth, async (req, res, next) => {
  const code = req.params.code.toUpperCase();
  try {
    await loadHostLobby(code, req.userId!);
    const config = await lock(code, async () => {
      const current = await getConfig(code);
      const next = { ...current, custom: current.custom.filter((c) => c.id !== req.params.id) };
      await saveConfig(code, next);
      return next;
    });
    res.json(payload(config));
  } catch (err) {
    fail(res, next, err);
  }
});
