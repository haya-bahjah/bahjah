import { Router } from 'express';
import { prisma } from '../../db/prisma';
import { requireAuth } from '../auth/middleware';
import { fromPrismaGameType } from '../rooms/mappers';

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
