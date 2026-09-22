import { Router } from 'express';
import { prisma } from '../../../db/prisma';
import { requireAuth } from '../../auth/middleware';
import { isRoomMember, RoomError } from '../../rooms/service';
import { getAuctionCategoriesSync } from './categoryBank';
import {
  defaultAuctionConfig,
  getAuctionRoomConfig,
  resolveAuctionPool,
  saveAuctionRoomConfig,
  type AuctionRoomConfig,
} from './config';
import { auctionConfigSchema } from './validation';

export const auctionRouter = Router();

auctionRouter.get('/categories', requireAuth, (_req, res) => {
  res.json({ categories: getAuctionCategoriesSync() });
});

async function loadRoomForConfig(code: string, userId: string) {
  const room = await prisma.room.findUnique({ where: { code }, select: { hostId: true, gameType: true, status: true } });
  if (!room) throw new RoomError('ROOM_NOT_FOUND', 'No room with that code.', 404);
  if (room.gameType !== 'auction') throw new RoomError('WRONG_GAME_TYPE', 'This room is not an Auction room.', 400);
  const member = await isRoomMember(code, userId);
  if (!member) throw new RoomError('NOT_A_MEMBER', 'Join this room before viewing its config.', 403);
  return room;
}

auctionRouter.get('/rooms/:code/config', requireAuth, async (req, res, next) => {
  const code = req.params.code.toUpperCase();
  try {
    const room = await loadRoomForConfig(code, req.userId!);
    const config = (await getAuctionRoomConfig(code)) ?? defaultAuctionConfig();
    res.json({ config, poolSize: resolveAuctionPool(config).length, isHost: room.hostId === req.userId });
  } catch (err) {
    if (err instanceof RoomError) {
      res.status(err.status).json({ error: { code: err.code, message: err.message } });
      return;
    }
    next(err);
  }
});

auctionRouter.patch('/rooms/:code/config', requireAuth, async (req, res, next) => {
  const code = req.params.code.toUpperCase();
  const parsed = auctionConfigSchema.safeParse(req.body);
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
    const config: AuctionRoomConfig = parsed.data;
    await saveAuctionRoomConfig(code, config);
    res.json({ config, poolSize: resolveAuctionPool(config).length });
  } catch (err) {
    if (err instanceof RoomError) {
      res.status(err.status).json({ error: { code: err.code, message: err.message } });
      return;
    }
    next(err);
  }
});
