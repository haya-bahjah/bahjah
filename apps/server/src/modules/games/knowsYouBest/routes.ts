import { Router } from 'express';
import { prisma } from '../../../db/prisma';
import { requireAuth } from '../../auth/middleware';
import { isRoomMember, RoomError } from '../../rooms/service';
import {
  defaultKnowsYouBestConfig,
  getKnowsYouBestRoomConfig,
  replaceCustomPrompts,
  saveKnowsYouBestRoomConfig,
  type KnowsYouBestRoomConfig,
} from './config';
import { KYB_BUILTIN_CATEGORIES } from './promptBank';
import { knowsYouBestConfigSchema, knowsYouBestCustomPromptsSchema } from './validation';
import { syncCustomSetToPack } from '../questionPackSync';

export const knowsYouBestRouter = Router();

knowsYouBestRouter.get('/categories', requireAuth, (_req, res) => {
  res.json({ categories: KYB_BUILTIN_CATEGORIES });
});

async function loadRoomForConfig(code: string, userId: string) {
  const room = await prisma.room.findUnique({ where: { code }, select: { hostId: true, gameType: true, status: true } });
  if (!room) {
    throw new RoomError('ROOM_NOT_FOUND', 'No room with that code.', 404);
  }
  if (room.gameType !== 'knows_you_best') {
    throw new RoomError('WRONG_GAME_TYPE', 'This room is not a Knows You Best room.', 400);
  }
  const member = await isRoomMember(code, userId);
  if (!member) {
    throw new RoomError('NOT_A_MEMBER', 'Join this room before viewing its config.', 403);
  }
  return room;
}

knowsYouBestRouter.get('/rooms/:code/config', requireAuth, async (req, res, next) => {
  const code = req.params.code.toUpperCase();
  try {
    const room = await loadRoomForConfig(code, req.userId!);
    const isHost = room.hostId === req.userId;
    const config = (await getKnowsYouBestRoomConfig(code)) ?? defaultKnowsYouBestConfig();

    if (!isHost) {
      res.json({ config, isHost: false });
      return;
    }

    const customPrompts = config.useCustomQuestions
      ? await prisma.knowsYouBestCustomPrompt.findMany({ where: { roomCode: code } })
      : [];

    res.json({
      config,
      isHost: true,
      customPrompts: customPrompts.map((p) => ({ text: p.text, textAr: p.textAr })),
    });
  } catch (err) {
    if (err instanceof RoomError) {
      res.status(err.status).json({ error: { code: err.code, message: err.message } });
      return;
    }
    next(err);
  }
});

knowsYouBestRouter.patch('/rooms/:code/config', requireAuth, async (req, res, next) => {
  const code = req.params.code.toUpperCase();
  const parsed = knowsYouBestConfigSchema.safeParse(req.body);
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

    const config: KnowsYouBestRoomConfig = parsed.data;
    await saveKnowsYouBestRoomConfig(code, config);
    res.json({ config });
  } catch (err) {
    if (err instanceof RoomError) {
      res.status(err.status).json({ error: { code: err.code, message: err.message } });
      return;
    }
    next(err);
  }
});

knowsYouBestRouter.put('/rooms/:code/custom-questions', requireAuth, async (req, res, next) => {
  const code = req.params.code.toUpperCase();
  const parsed = knowsYouBestCustomPromptsSchema.safeParse(req.body);
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

    await replaceCustomPrompts(code, parsed.data.prompts);

    if (parsed.data.packName) {
      await syncCustomSetToPack(req.userId!, 'knows-you-best', parsed.data.packName, parsed.data.prompts);
    }

    res.json({ customPrompts: parsed.data.prompts });
  } catch (err) {
    if (err instanceof RoomError) {
      res.status(err.status).json({ error: { code: err.code, message: err.message } });
      return;
    }
    next(err);
  }
});
