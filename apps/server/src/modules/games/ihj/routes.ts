import { Router } from 'express';
import { prisma } from '../../../db/prisma';
import { requireAuth } from '../../auth/middleware';
import { isRoomMember, RoomError } from '../../rooms/service';
import { getIhjCategoriesSync, getIhjLettersSync } from './bank';
import { defaultIhjConfig, getIhjRoomConfig, resolveIhjCategories, saveIhjRoomConfig, type IhjRoomConfig } from './config';
import { ihjConfigSchema } from './validation';

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
    res.json({ config, categories: resolveIhjCategories(config), isHost: room.hostId === req.userId });
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
    const config: IhjRoomConfig = parsed.data;
    await saveIhjRoomConfig(code, config);
    res.json({ config, categories: resolveIhjCategories(config) });
  } catch (err) {
    if (err instanceof RoomError) {
      res.status(err.status).json({ error: { code: err.code, message: err.message } });
      return;
    }
    next(err);
  }
});
