import type { GameType } from '@bahjah/shared';
import { prisma } from '../../db/prisma';
import { fromPrismaGameType } from '../rooms/mappers';

// The host's game night recap: every game they hosted that finished in the
// last RECAP_WINDOW_HOURS, folded into one overall leaderboard plus a wall of
// awards. Nothing is stored for it -- a "night" is simply that window counted
// back from the moment the host opens the recap, and it is rebuilt from the
// history rows (and the highlights saved on them) every time.

export const RECAP_WINDOW_HOURS = 6;

// Overall standings are by finishing place in each game, never raw points:
// a Mafia win is worth 1 and a Trivia game runs into the thousands, so adding
// scores would just crown whoever played the most Trivia.
const PLACE_POINTS = [5, 3, 2];
const PLAYED_POINTS = 1;

type Highlights = Record<string, Record<string, number>>;

interface StoredResult {
  userId: string;
  displayName: string;
  score: number;
  isWinner: boolean;
}

export interface RecapGame {
  id: string;
  gameType: GameType;
  roomCode: string;
  playedAt: string;
  playerCount: number;
  winners: Array<{ userId: string; displayName: string }>;
}

export interface RecapPlayer {
  userId: string;
  displayName: string;
  avatar: string | null;
  isBot: boolean;
  rank: number;
  points: number;
  wins: number;
  podiums: number;
  gamesPlayed: number;
}

export type RecapAwardKey =
  | 'mvp'
  | 'fastest'
  | 'brainiac'
  | 'hot-streak'
  | 'best-liar'
  | 'lie-detector'
  | 'mind-reader'
  | 'open-book'
  | 'original'
  | 'quick-draw'
  | 'big-bidder'
  | 'mastermind'
  | 'survivor';

export interface RecapAward {
  key: RecapAwardKey;
  // The game the award was earned in; null for the night-wide ones.
  gameType: GameType | null;
  // More than one on a tie.
  userIds: string[];
  // The number the award was decided on, in the unit the key implies
  // (points, milliseconds, a count). `of` is the denominator where the award
  // reads as "x of y" -- correct answers out of questions asked.
  value: number;
  of?: number;
}

export interface Recap {
  windowHours: number;
  since: string;
  until: string;
  games: RecapGame[];
  players: RecapPlayer[];
  awards: RecapAward[];
}

function asResults(value: unknown): StoredResult[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (r): r is StoredResult =>
      !!r && typeof r === 'object' && typeof (r as StoredResult).userId === 'string' && typeof (r as StoredResult).score === 'number'
  );
}

function asHighlights(value: unknown): Highlights {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: Highlights = {};
  for (const [userId, stats] of Object.entries(value as Record<string, unknown>)) {
    if (!stats || typeof stats !== 'object') continue;
    const clean: Record<string, number> = {};
    for (const [k, v] of Object.entries(stats as Record<string, unknown>)) {
      if (typeof v === 'number' && Number.isFinite(v)) clean[k] = v;
    }
    out[userId] = clean;
  }
  return out;
}

// Place 1 is the winner(s) (or the top score), with ties sharing a place.
// Mafia is a team game: the winning side all take first and everyone else
// simply played -- its 1/0 score has no 2nd or 3rd to hand out. A player who
// finished on zero without winning scored nothing to be placed on, which
// also keeps a game everybody lost from handing all of them first.
export function placementPoints(gameType: GameType, results: StoredResult[]): Map<string, { points: number; place: number | null }> {
  const out = new Map<string, { points: number; place: number | null }>();
  for (const r of results) {
    let place: number | null = null;
    if (r.isWinner) {
      place = 1;
    } else if (gameType !== 'mafia' && r.score > 0) {
      place = 1 + results.filter((o) => o.isWinner || o.score > r.score).length;
    }
    const points = place !== null && place <= PLACE_POINTS.length ? PLACE_POINTS[place - 1] : PLAYED_POINTS;
    out.set(r.userId, { points, place });
  }
  return out;
}

// Adds up one game type's highlights per player over every game of that type
// in the night. Every stat is a count, so summing is right for all but the
// "best in one go" ones, which take the max.
const MAX_STATS = new Set(['bestStreak', 'bestCount', 'bestRound']);

function sumHighlights(entries: Array<{ highlights: Highlights }>): Highlights {
  const out: Highlights = {};
  for (const { highlights } of entries) {
    for (const [userId, stats] of Object.entries(highlights)) {
      const acc = (out[userId] ??= {});
      for (const [k, v] of Object.entries(stats)) {
        acc[k] = MAX_STATS.has(k) ? Math.max(acc[k] ?? 0, v) : (acc[k] ?? 0) + v;
      }
    }
  }
  return out;
}

// The player(s) with the best value. `eligible` filters out bots and anyone
// who didn't do enough for the number to mean anything; `min` is the least a
// winner must reach (no "Best liar" for fooling nobody).
function best(
  stats: Highlights,
  value: (s: Record<string, number>) => number,
  opts: { eligible: (userId: string, s: Record<string, number>) => boolean; min?: number; lowerIsBetter?: boolean }
): { userIds: string[]; value: number } | null {
  let top: number | null = null;
  let userIds: string[] = [];
  for (const [userId, s] of Object.entries(stats)) {
    if (!opts.eligible(userId, s)) continue;
    const v = value(s);
    if (!Number.isFinite(v)) continue;
    if (opts.min !== undefined && v < opts.min) continue;
    const better = top === null || (opts.lowerIsBetter ? v < top : v > top);
    if (better) {
      top = v;
      userIds = [userId];
    } else if (v === top) {
      userIds.push(userId);
    }
  }
  return top === null ? null : { userIds, value: top };
}

function gameAwards(gameType: GameType, stats: Highlights, eligible: (userId: string) => boolean): RecapAward[] {
  const awards: RecapAward[] = [];
  const add = (key: RecapAwardKey, found: { userIds: string[]; value: number } | null, of?: number) => {
    if (found) awards.push({ key, gameType, userIds: found.userIds, value: found.value, ...(of !== undefined ? { of } : {}) });
  };
  const isEligible = eligible;

  switch (gameType) {
    case 'trivia': {
      // Fastest only counts someone who answered at least half of what they
      // were asked: one lucky snap answer isn't a fast player.
      add(
        'fastest',
        best(stats, (s) => (s.answered > 0 ? Math.round(s.answerMs / s.answered) : NaN), {
          eligible: (id, s) => isEligible(id) && s.answered >= Math.max(3, Math.ceil((s.rounds ?? 0) / 2)),
          lowerIsBetter: true,
        })
      );
      const brainiac = best(stats, (s) => s.correct ?? 0, { eligible: isEligible, min: 1 });
      if (brainiac) {
        // Players can have faced different numbers of questions (one sat a
        // game out), so the denominator is the winner's own.
        const of = Math.max(...brainiac.userIds.map((id) => stats[id]?.rounds ?? 0));
        add('brainiac', brainiac, of || undefined);
      }
      add('hot-streak', best(stats, (s) => s.bestStreak ?? 0, { eligible: isEligible, min: 3 }));
      break;
    }
    case 'fabrication':
      add('best-liar', best(stats, (s) => s.playersFooled ?? 0, { eligible: isEligible, min: 1 }));
      add('lie-detector', best(stats, (s) => s.correctVotes ?? 0, { eligible: isEligible, min: 1 }));
      break;
    case 'knows-you-best':
      add('mind-reader', best(stats, (s) => s.correctGuesses ?? 0, { eligible: isEligible, min: 1 }));
      add('open-book', best(stats, (s) => s.timesGuessed ?? 0, { eligible: isEligible, min: 1 }));
      break;
    case 'insan-hayawan-jamad':
      add('original', best(stats, (s) => s.unique ?? 0, { eligible: isEligible, min: 1 }));
      add('quick-draw', best(stats, (s) => s.stops ?? 0, { eligible: isEligible, min: 1 }));
      break;
    case 'auction':
      add('big-bidder', best(stats, (s) => s.bestCount ?? 0, { eligible: isEligible, min: 1 }));
      break;
    case 'mafia':
      add('mastermind', best(stats, (s) => s.mafiaWins ?? 0, { eligible: isEligible, min: 1 }));
      add('survivor', best(stats, (s) => s.survivedWins ?? 0, { eligible: isEligible, min: 1 }));
      break;
    default:
      break;
  }
  return awards;
}

export async function buildRecap(hostId: string, now = new Date()): Promise<Recap> {
  const since = new Date(now.getTime() - RECAP_WINDOW_HOURS * 60 * 60 * 1000);
  const rows = await prisma.gameHistoryEntry.findMany({
    where: { hostId, playedAt: { gte: since, lte: now } },
    orderBy: { playedAt: 'asc' },
  });

  const entries = rows.map((row) => ({
    id: row.id,
    gameType: fromPrismaGameType(row.gameType),
    roomCode: row.roomCode,
    playedAt: row.playedAt,
    results: asResults(row.results),
    highlights: asHighlights(row.highlights),
  }));

  const players = new Map<string, Omit<RecapPlayer, 'avatar' | 'isBot' | 'rank'>>();
  for (const entry of entries) {
    const placed = placementPoints(entry.gameType, entry.results);
    for (const r of entry.results) {
      const p = players.get(r.userId) ?? { userId: r.userId, displayName: r.displayName, points: 0, wins: 0, podiums: 0, gamesPlayed: 0 };
      // Rows are oldest first, so this ends on the name they last played under.
      p.displayName = r.displayName || p.displayName;
      const { points, place } = placed.get(r.userId)!;
      p.points += points;
      p.gamesPlayed += 1;
      if (r.isWinner) p.wins += 1;
      if (place !== null && place <= 3) p.podiums += 1;
      players.set(r.userId, p);
    }
  }

  const users = await prisma.user.findMany({
    where: { id: { in: [...players.keys()] } },
    select: { id: true, avatar: true, isBot: true },
  });
  const userById = new Map(users.map((u) => [u.id, u]));

  const sorted = [...players.values()].sort(
    (a, b) => b.points - a.points || b.wins - a.wins || b.podiums - a.podiums || a.displayName.localeCompare(b.displayName)
  );
  const ranked: RecapPlayer[] = sorted.map((p) => ({
    ...p,
    avatar: userById.get(p.userId)?.avatar ?? null,
    isBot: userById.get(p.userId)?.isBot ?? false,
    // Shared rank on equal points and wins: the alphabetical order above is
    // only so a tie always lists the same way.
    rank: 1 + sorted.filter((o) => o.points > p.points || (o.points === p.points && o.wins > p.wins)).length,
  }));

  const isBot = (userId: string) => userById.get(userId)?.isBot ?? false;
  const eligible = (userId: string) => players.has(userId) && !isBot(userId);

  const awards: RecapAward[] = [];
  const humans = ranked.filter((p) => !p.isBot);
  if (humans.length > 0 && humans[0].points > 0) {
    const topPoints = humans[0].points;
    const topWins = humans[0].wins;
    awards.push({
      key: 'mvp',
      gameType: null,
      userIds: humans.filter((p) => p.points === topPoints && p.wins === topWins).map((p) => p.userId),
      value: topPoints,
    });
  }
  // One set of awards per game type, in the order the night first played it.
  const typesInOrder = [...new Set(entries.map((e) => e.gameType))];
  for (const gameType of typesInOrder) {
    const stats = sumHighlights(entries.filter((e) => e.gameType === gameType));
    awards.push(...gameAwards(gameType, stats, eligible));
  }

  return {
    windowHours: RECAP_WINDOW_HOURS,
    since: since.toISOString(),
    until: now.toISOString(),
    games: entries.map((e) => ({
      id: e.id,
      gameType: e.gameType,
      roomCode: e.roomCode,
      playedAt: e.playedAt.toISOString(),
      playerCount: e.results.length,
      winners: e.results.filter((r) => r.isWinner).map((r) => ({ userId: r.userId, displayName: r.displayName })),
    })),
    players: ranked,
    awards,
  };
}
