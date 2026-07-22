import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma';
import { requireAuth } from '../auth/middleware';
import { createRoomRateLimit } from '../../middleware/rateLimit';
import { requireActiveAccess } from '../payments/access';
import { fromPrismaGameType, toPrismaGameType } from '../rooms/mappers';
import { createRoom, getRoomSummary } from '../rooms/service';
import { getConnectedUserIds } from '../rooms/presence';
import { replaceCustomQuestions, saveTriviaRoomConfig, type TriviaCustomCategoryInput } from './trivia/config';
import { replaceCustomPrompts, saveKnowsYouBestRoomConfig, type KnowsYouBestCustomPromptInput } from './knowsYouBest/config';

export const dashboardRouter = Router();

const choiceSchema = z.string().trim().min(1).max(120);

const triviaItemSchema = z.object({
  prompt: z.string().trim().min(1).max(300),
  choices: z.tuple([choiceSchema, choiceSchema, choiceSchema, choiceSchema]),
  correctIndex: z.number().int().min(0).max(3),
});

const kybItemSchema = z.object({
  text: z.string().trim().min(1).max(300),
  textAr: z.string().trim().min(1).max(300).nullable().optional(),
});

// Trivia packs need >= 10 items so a room hosted from one always clears the
// same MIN_POOL_SIZE gate the lobby config UI enforces (trivia/routes.ts).
// KYB packs need >= 3 so they clear knowsYouBestConfigSchema's totalRounds
// minimum once mapped 1:1 onto rounds in the /packs/:id/host handler below.
const createPackSchema = z.discriminatedUnion('gameType', [
  z.object({
    gameType: z.literal('trivia'),
    name: z.string().trim().min(1).max(40),
    items: z.array(triviaItemSchema).min(10).max(30),
  }),
  z.object({
    gameType: z.literal('knows-you-best'),
    name: z.string().trim().min(1).max(40),
    items: z.array(kybItemSchema).min(3).max(20),
  }),
]);

const pinsSchema = z.object({
  gameTypes: z.array(z.enum(['trivia', 'mafia', 'knows-you-best'])).max(3),
});

function packSummary(pack: { id: string; gameType: string; name: string; items: unknown; createdAt: Date }) {
  return {
    id: pack.id,
    gameType: fromPrismaGameType(pack.gameType as Parameters<typeof fromPrismaGameType>[0]),
    name: pack.name,
    itemCount: Array.isArray(pack.items) ? pack.items.length : 0,
    createdAt: pack.createdAt,
  };
}

dashboardRouter.get('/pins', requireAuth, async (req, res, next) => {
  try {
    const pins = await prisma.pinnedGame.findMany({ where: { userId: req.userId! } });
    res.json({ gameTypes: pins.map((p) => fromPrismaGameType(p.gameType)) });
  } catch (err) {
    next(err);
  }
});

dashboardRouter.put('/pins', requireAuth, async (req, res, next) => {
  const parsed = pinsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input.' } });
    return;
  }
  try {
    const gameTypes = [...new Set(parsed.data.gameTypes)];
    await prisma.$transaction([
      prisma.pinnedGame.deleteMany({ where: { userId: req.userId! } }),
      ...(gameTypes.length > 0
        ? [
            prisma.pinnedGame.createMany({
              data: gameTypes.map((g) => ({ userId: req.userId!, gameType: toPrismaGameType(g) })),
            }),
          ]
        : []),
    ]);
    res.json({ gameTypes });
  } catch (err) {
    next(err);
  }
});

dashboardRouter.get('/packs', requireAuth, async (req, res, next) => {
  try {
    const packs = await prisma.questionPack.findMany({
      where: { userId: req.userId! },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ packs: packs.map(packSummary) });
  } catch (err) {
    next(err);
  }
});

dashboardRouter.get('/packs/:id', requireAuth, async (req, res, next) => {
  try {
    const pack = await prisma.questionPack.findUnique({ where: { id: req.params.id } });
    if (!pack || pack.userId !== req.userId) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Pack not found.' } });
      return;
    }
    res.json({ pack: { ...packSummary(pack), items: pack.items } });
  } catch (err) {
    next(err);
  }
});

dashboardRouter.post('/packs', requireAuth, async (req, res, next) => {
  const parsed = createPackSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input.' } });
    return;
  }
  try {
    const { gameType, name, items } = parsed.data;
    const pack = await prisma.questionPack.create({
      data: { userId: req.userId!, gameType: toPrismaGameType(gameType), name, items },
    });
    res.status(201).json({ pack: packSummary(pack) });
  } catch (err) {
    next(err);
  }
});

dashboardRouter.delete('/packs/:id', requireAuth, async (req, res, next) => {
  try {
    const pack = await prisma.questionPack.findUnique({ where: { id: req.params.id } });
    if (!pack || pack.userId !== req.userId) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Pack not found.' } });
      return;
    }
    await prisma.questionPack.delete({ where: { id: pack.id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Creates a fresh room of the pack's game type and immediately loads the
// pack's items as that room's (only) custom category/prompts, so the host
// lands in the normal lobby with their saved questions already active --
// they can still tweak config from there like any other room.
dashboardRouter.post('/packs/:id/host', requireAuth, requireActiveAccess, createRoomRateLimit, async (req, res, next) => {
  try {
    const pack = await prisma.questionPack.findUnique({ where: { id: req.params.id } });
    if (!pack || pack.userId !== req.userId) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Pack not found.' } });
      return;
    }
    const gameType = fromPrismaGameType(pack.gameType);
    if (gameType !== 'trivia' && gameType !== 'knows-you-best') {
      res.status(400).json({ error: { code: 'UNSUPPORTED_GAME_TYPE', message: 'This game type does not support saved packs.' } });
      return;
    }

    const room = await createRoom(req.userId!, gameType);

    if (gameType === 'trivia') {
      const items = pack.items as unknown as TriviaCustomCategoryInput['questions'];
      await replaceCustomQuestions(room.code, [{ name: pack.name, questions: items }]);
      await saveTriviaRoomConfig(room.code, { difficulty: 'medium', categories: [], customCategories: [pack.name] });
    } else {
      const items = pack.items as unknown as KnowsYouBestCustomPromptInput[];
      await replaceCustomPrompts(room.code, items);
      await saveKnowsYouBestRoomConfig(room.code, {
        totalRounds: Math.min(10, Math.max(3, items.length)),
        hostPlays: false,
        categories: [],
        useCustomQuestions: true,
      });
    }

    const summary = await getRoomSummary(room.code, await getConnectedUserIds(room.code));
    res.status(201).json({ room: summary });
  } catch (err) {
    next(err);
  }
});
