import { Router } from 'express';
import { prisma } from '../../../db/prisma';
import { requireAuth } from '../../auth/middleware';
import { isRoomMember, RoomError } from '../../rooms/service';
import {
  getTriviaRoomConfig,
  replaceCustomQuestions,
  resolveTriviaPool,
  saveTriviaRoomConfig,
  type TriviaRoomConfig,
} from './config';
import { getBankCategoriesSync } from './questionBank';
import { triviaConfigSchema } from './validation';
import { syncCustomSetToPack } from '../questionPackSync';

export const triviaRouter = Router();

const MIN_POOL_SIZE = 10;

triviaRouter.get('/categories', requireAuth, (_req, res) => {
  res.json({ categories: getBankCategoriesSync() });
});

async function loadRoomForConfig(code: string, userId: string) {
  const room = await prisma.room.findUnique({ where: { code }, select: { hostId: true, gameType: true, status: true } });
  if (!room) {
    throw new RoomError('ROOM_NOT_FOUND', 'No room with that code.', 404);
  }
  if (room.gameType !== 'trivia') {
    throw new RoomError('WRONG_GAME_TYPE', 'This room is not a trivia room.', 400);
  }
  const member = await isRoomMember(code, userId);
  if (!member) {
    throw new RoomError('NOT_A_MEMBER', 'Join this room before viewing its config.', 403);
  }
  return room;
}

triviaRouter.get('/rooms/:code/config', requireAuth, async (req, res, next) => {
  const code = req.params.code.toUpperCase();
  try {
    const room = await loadRoomForConfig(code, req.userId!);
    const isHost = room.hostId === req.userId;
    const config = await getTriviaRoomConfig(code);
    const poolSize = config ? (await resolveTriviaPool(code, config)).length : 0;

    if (!isHost) {
      res.json({ config, poolSize, isHost: false });
      return;
    }

    const customQuestions = config && config.customCategories.length > 0
      ? await prisma.triviaCustomQuestion.findMany({ where: { roomCode: code, category: { in: config.customCategories } } })
      : [];
    const customCategories = (config?.customCategories ?? []).map((name) => ({
      name,
      questions: customQuestions
        .filter((q) => q.category === name)
        .map((q) => ({ prompt: q.prompt, choices: q.choices, correctIndex: q.correctIndex })),
    }));

    res.json({ config, poolSize, isHost: true, customCategories });
  } catch (err) {
    if (err instanceof RoomError) {
      res.status(err.status).json({ error: { code: err.code, message: err.message } });
      return;
    }
    next(err);
  }
});

triviaRouter.patch('/rooms/:code/config', requireAuth, async (req, res, next) => {
  const code = req.params.code.toUpperCase();
  const parsed = triviaConfigSchema.safeParse(req.body);
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

    const { difficulty, categories, customCategories } = parsed.data;
    const names = customCategories.map((c) => c.name);
    const duplicateName = names.find((name, i) => names.indexOf(name) !== i);
    if (duplicateName) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: `Duplicate custom category name: "${duplicateName}".` } });
      return;
    }

    await replaceCustomQuestions(code, customCategories);
    const config: TriviaRoomConfig = { difficulty, categories, customCategories: names };
    const pool = await resolveTriviaPool(code, config);
    if (pool.length < MIN_POOL_SIZE) {
      res.status(400).json({
        error: {
          code: 'INSUFFICIENT_QUESTIONS',
          message: `Only ${pool.length} question${pool.length === 1 ? '' : 's'} available at this difficulty/category selection — need at least ${MIN_POOL_SIZE}. Pick more categories or add custom questions.`,
        },
      });
      return;
    }

    await saveTriviaRoomConfig(code, config);

    // Auto-save each named custom category into the host's "My Games" so
    // they can replay it later without retyping -- see questionPackSync.ts
    // for the size/guest-host rules.
    await Promise.all(
      customCategories.map((c) => syncCustomSetToPack(req.userId!, 'trivia', c.name, c.questions))
    );

    res.json({ config, poolSize: pool.length });
  } catch (err) {
    if (err instanceof RoomError) {
      res.status(err.status).json({ error: { code: err.code, message: err.message } });
      return;
    }
    next(err);
  }
});
