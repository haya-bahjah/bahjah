import { Router } from 'express';
import { prisma } from '../../db/prisma';
import { requireAuth } from '../auth/middleware';
import { fromPrismaGameType } from '../rooms/mappers';
import { buildRecap } from './recap';

export const historyRouter = Router();

const PAGE_SIZE = 20;

historyRouter.get('/history', requireAuth, async (req, res, next) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  try {
    const [entries, total] = await Promise.all([
      prisma.gameHistoryEntry.findMany({
        where: { hostId: req.userId! },
        orderBy: { playedAt: 'desc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      prisma.gameHistoryEntry.count({ where: { hostId: req.userId! } }),
    ]);
    res.json({
      entries: entries.map((e) => ({ ...e, gameType: fromPrismaGameType(e.gameType) })),
      total,
      page,
      pageSize: PAGE_SIZE,
    });
  } catch (err) {
    next(err);
  }
});

// The host's game night recap: every game they hosted in the last few hours
// (see recap.ts), as one leaderboard and a set of awards. Host-only, like the
// history above -- it is always the signed-in user's own games.
historyRouter.get('/recap', requireAuth, async (req, res, next) => {
  try {
    res.json({ recap: await buildRecap(req.userId!) });
  } catch (err) {
    next(err);
  }
});
