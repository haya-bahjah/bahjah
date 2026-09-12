import { prisma } from '../../db/prisma';
import { redis } from '../../db/redis';

// The internal numbers: signups, games played, who is playing right now, and
// what has been paid for. Read-only and admin-gated (see middleware.ts).
//
// Everything here is counted in the database rather than tracked as events,
// so there is no analytics pipeline to keep healthy and no second source of
// truth to drift. The cost of that is the obvious one: these are the numbers
// the product's own tables can answer, not behavioural analytics. "How many
// people opened the pricing page" is not in here, because nothing records it.

const DAY_MS = 24 * 60 * 60 * 1000;

export interface AnalyticsSummary {
  generatedAt: string;
  users: {
    total: number;
    // Real accounts only -- guests are anonymous QR joiners, and practice
    // bots are furniture. Counting either as a signup would flatter the
    // number without meaning anything.
    signups: number;
    guests: number;
    bots: number;
    newLast24h: number;
    newLast7d: number;
    newLast30d: number;
    marketingOptIn: number;
  };
  access: {
    // Accounts whose paid window is open right now, however they got it.
    activeNow: number;
    onDayPass: number;
    onMonthly: number;
    // Inside the 6-hour free trial, and never having paid.
    trialing: number;
    // Have played at some point but hold no access now.
    lapsed: number;
  };
  revenue: {
    // Money actually taken, in halalas, from payments Moyasar reported paid.
    paidTotalHalalas: number;
    paidCount: number;
    dayPassCount: number;
    monthlyCount: number;
    last30dHalalas: number;
    // Attempts that never became money, so a spike in failures is visible.
    failedCount: number;
  };
  promos: {
    code: string;
    redemptions: number;
    last24h: number;
  }[];
  games: {
    totalPlayed: number;
    last24h: number;
    last7d: number;
    byType: { gameType: string; played: number }[];
    // The busiest single day on record, and the busiest hour, so "highest
    // game play rate" has an actual figure behind it.
    busiestDay: { day: string; played: number } | null;
    busiestHour: { hour: string; played: number } | null;
    playedPerDayLast14: { day: string; played: number }[];
  };
  live: {
    // Right now, from Redis presence and the rooms table.
    roomsInProgress: number;
    roomsInLobby: number;
    playersInRooms: number;
    // Connected people across every live room -- the closest thing to
    // "currently playing" the server actually knows.
    connectedNow: number;
    byType: { gameType: string; rooms: number }[];
  };
}

// Presence is per-room in Redis (rooms/presence.ts writes
// bahjah:presence:<code> as a hash of userId -> connection count). Counting
// live players means asking those keys, not the database -- a member row
// says somebody joined, not that their phone is still on.
async function countConnected(codes: string[]): Promise<number> {
  if (codes.length === 0) return 0;
  let total = 0;
  // Pipelined: one round trip for the lot rather than one per room.
  const pipeline = redis.pipeline();
  for (const code of codes) pipeline.hlen(`bahjah:presence:${code}`);
  const results = await pipeline.exec();
  for (const entry of results ?? []) {
    const [err, value] = entry as [Error | null, unknown];
    if (!err && typeof value === 'number') total += value;
  }
  return total;
}

export async function buildAnalytics(): Promise<AnalyticsSummary> {
  const now = new Date();
  const since = (ms: number) => new Date(now.getTime() - ms);

  const [
    totalUsers, guests, bots, new24, new7, new30, marketing,
    activeNow, onDayPass, onMonthly,
    paidPayments, failedPayments,
    promoRows,
    totalGames, games24, games7, gamesByType, recentGames,
    roomsInProgress, roomsInLobby, liveRooms, membersInLive,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isGuest: true, isBot: false } }),
    prisma.user.count({ where: { isBot: true } }),
    prisma.user.count({ where: { isGuest: false, isBot: false, createdAt: { gte: since(DAY_MS) } } }),
    prisma.user.count({ where: { isGuest: false, isBot: false, createdAt: { gte: since(7 * DAY_MS) } } }),
    prisma.user.count({ where: { isGuest: false, isBot: false, createdAt: { gte: since(30 * DAY_MS) } } }),
    prisma.user.count({ where: { isGuest: false, isBot: false, marketingOptIn: true } }),

    prisma.user.count({ where: { paidUntil: { gt: now } } }),
    prisma.user.count({ where: { paidUntil: { gt: now }, plan: 'day_pass' } }),
    prisma.user.count({ where: { paidUntil: { gt: now }, plan: 'monthly' } }),

    prisma.payment.findMany({
      where: { status: 'paid' },
      select: { amount: true, plan: true, createdAt: true },
    }),
    prisma.payment.count({ where: { status: { in: ['failed', 'voided'] } } }),

    prisma.promoRedemption.findMany({ select: { code: true, createdAt: true } }),

    prisma.gameHistoryEntry.count(),
    prisma.gameHistoryEntry.count({ where: { playedAt: { gte: since(DAY_MS) } } }),
    prisma.gameHistoryEntry.count({ where: { playedAt: { gte: since(7 * DAY_MS) } } }),
    prisma.gameHistoryEntry.groupBy({ by: ['gameType'], _count: { _all: true } }),
    // Enough history to fill the 14-day chart and find the busiest day/hour.
    prisma.gameHistoryEntry.findMany({ select: { playedAt: true }, orderBy: { playedAt: 'desc' }, take: 20000 }),

    prisma.room.count({ where: { status: 'in_progress' } }),
    prisma.room.count({ where: { status: 'lobby' } }),
    prisma.room.findMany({ where: { status: { in: ['lobby', 'in_progress'] } }, select: { code: true, gameType: true } }),
    prisma.roomMember.count({ where: { room: { status: 'in_progress' } } }),
  ]);

  const signups = totalUsers - guests - bots;

  const paidTotalHalalas = paidPayments.reduce((sum, p) => sum + p.amount, 0);
  const last30dHalalas = paidPayments
    .filter((p) => p.createdAt.getTime() >= since(30 * DAY_MS).getTime())
    .reduce((sum, p) => sum + p.amount, 0);

  // Day and hour buckets, in UTC. Deliberately not localised: a dashboard
  // read from two timezones should not disagree with itself about which day
  // was busiest.
  const dayKey = (d: Date) => d.toISOString().slice(0, 10);
  const hourKey = (d: Date) => `${d.toISOString().slice(0, 13)}:00Z`;

  const perDay = new Map<string, number>();
  const perHour = new Map<string, number>();
  for (const row of recentGames) {
    perDay.set(dayKey(row.playedAt), (perDay.get(dayKey(row.playedAt)) ?? 0) + 1);
    perHour.set(hourKey(row.playedAt), (perHour.get(hourKey(row.playedAt)) ?? 0) + 1);
  }
  const peak = (m: Map<string, number>) => {
    let best: { key: string; n: number } | null = null;
    for (const [key, n] of m) if (!best || n > best.n) best = { key, n };
    return best;
  };
  const busiestDay = peak(perDay);
  const busiestHour = peak(perHour);

  // Fourteen days ending today, including the quiet ones -- a chart that
  // skips empty days makes a gap look like a busy stretch.
  const playedPerDayLast14: { day: string; played: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const day = dayKey(since(i * DAY_MS));
    playedPerDayLast14.push({ day, played: perDay.get(day) ?? 0 });
  }

  const promoTotals = new Map<string, { redemptions: number; last24h: number }>();
  for (const row of promoRows) {
    const entry = promoTotals.get(row.code) ?? { redemptions: 0, last24h: 0 };
    entry.redemptions += 1;
    if (row.createdAt.getTime() >= since(DAY_MS).getTime()) entry.last24h += 1;
    promoTotals.set(row.code, entry);
  }

  const roomsByType = new Map<string, number>();
  for (const room of liveRooms) roomsByType.set(room.gameType, (roomsByType.get(room.gameType) ?? 0) + 1);

  const connectedNow = await countConnected(liveRooms.map((r) => r.code));

  // Everyone who has ever been paid up, minus everyone who is now -- a rough
  // churn signal that costs one more count rather than a history table.
  const everPaid = await prisma.user.count({ where: { paidUntil: { not: null } } });

  return {
    generatedAt: now.toISOString(),
    users: {
      total: totalUsers,
      signups,
      guests,
      bots,
      newLast24h: new24,
      newLast7d: new7,
      newLast30d: new30,
      marketingOptIn: marketing,
    },
    access: {
      activeNow,
      onDayPass,
      onMonthly,
      trialing: await prisma.user.count({
        where: {
          isGuest: false,
          isBot: false,
          paidUntil: null,
          createdAt: { gte: new Date(now.getTime() - 6 * 60 * 60 * 1000) },
        },
      }),
      lapsed: Math.max(0, everPaid - activeNow),
    },
    revenue: {
      paidTotalHalalas,
      paidCount: paidPayments.length,
      dayPassCount: paidPayments.filter((p) => p.plan === 'day_pass').length,
      monthlyCount: paidPayments.filter((p) => p.plan === 'monthly').length,
      last30dHalalas,
      failedCount: failedPayments,
    },
    promos: [...promoTotals.entries()]
      .map(([code, v]) => ({ code, ...v }))
      .sort((a, b) => b.redemptions - a.redemptions),
    games: {
      totalPlayed: totalGames,
      last24h: games24,
      last7d: games7,
      byType: gamesByType
        .map((g) => ({ gameType: g.gameType, played: g._count._all }))
        .sort((a, b) => b.played - a.played),
      busiestDay: busiestDay ? { day: busiestDay.key, played: busiestDay.n } : null,
      busiestHour: busiestHour ? { hour: busiestHour.key, played: busiestHour.n } : null,
      playedPerDayLast14,
    },
    live: {
      roomsInProgress,
      roomsInLobby,
      playersInRooms: membersInLive,
      connectedNow,
      byType: [...roomsByType.entries()]
        .map(([gameType, rooms]) => ({ gameType, rooms }))
        .sort((a, b) => b.rooms - a.rooms),
    },
  };
}
