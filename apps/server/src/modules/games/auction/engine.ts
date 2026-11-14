import type { RoomMemberSummary } from '@bahjah/shared';
import { GameActionError, type GameEngine, type GameEngineContext, type GameEngineResult, hostPlays, tablePlayers } from '../engine';
import type { AuctionCategory } from './categoryBank';
import {
  clearAuctionRoomConfig,
  defaultAuctionConfig,
  getAuctionRoomConfig,
  resolveAuctionPool,
  type AuctionLanguage,
  type AuctionRoomConfig,
} from './config';
import { normalizeAnswer } from '../normalize';

// A round of مزاد: a category goes up, every player types as many answers as
// they can against the clock, the host strikes anything that should not
// count, and the lot is SOLD to whoever named the most. Everyone scores their
// own count; the top count also takes a bonus.

// The category reveal: the lot's name drawn huge over one tiny figure. Long
// enough to read from across a room, short enough that nobody starts typing
// before the clock does.
const REVEAL_SECONDS = 3;
// The result: counts rise one by one like bids, then SOLD! to the top count.
// The standings between lots follow. Both move on by themselves; the host can
// skip either.
const RESULTS_SECONDS = 12;
// A phones-only room's review: there is no host to end it, so it ends when
// everyone has pressed Done -- or on this clock, so one player who has put
// their phone down cannot hold the lot open.
const REVIEW_SECONDS = 75;
const STANDINGS_SECONDS = 6;
// What winning the lot is worth on top of the winner's own count.
const WIN_BONUS = 5;
// The longest answer kept, and the most answers one player can send in a
// round -- far beyond anything a minute allows, but a box someone pastes a
// novel into should not grow without bound.
const MAX_ANSWER_LENGTH = 60;
const MAX_ANSWERS_PER_ROUND = 200;

interface RoundResult {
  categoryName: string;
  categoryNameAr: string;
  // Each player's valid count for the lot, after the host's review.
  counts: Record<string, number>;
  // The top count, and who reached it (more than one on a tie). Empty when
  // nobody counted anything: the lot goes unsold.
  topCount: number;
  winnerUserIds: string[];
  // What each player scored this lot: their count, plus the bonus for a winner.
  awarded: Record<string, number>;
}

interface FinalStats {
  // Lots this player won outright or shared on a tie.
  lotsWon: number;
  // Their best count in a single lot, and their valid answers over the game.
  bestCount: number;
  totalAnswers: number;
}

// One thing a player typed. Kept in submission order because the screens show
// the list filling up as they go, and the host reviews it in that order.
interface AuctionAnswer {
  text: string;
  // Something this player had already said this lot. Kept on their list
  // rather than refused -- refusing mid-sprint costs more than it saves -- but
  // never counted, and drawn struck through. Another player writing the same
  // thing does not matter: each list stands on its own.
  duplicate: boolean;
  // The host ruled it out. Everything starts counted: the host's job is to
  // strike the wrong ones, not to approve every right one. In a phones-only
  // room, where the host is a player and nobody referees, it is the table's
  // ruling instead: see strikeVotes.
  rejected: boolean;
  // Phones-only rooms: the other players who voted to strike this answer.
  // It is struck once more than half of the other players present have
  // (applyStrikeMajority). The author has no vote on their own list.
  strikeVotes?: string[];
}

interface AuctionData {
  // Every category this room will auction, drawn once up front. Redacted
  // from clients so later rounds are not visible in round one.
  categories: AuctionCategory[];
  totalRounds: number;
  roundIndex: number;
  currentCategory?: { id: string; name: string; nameAr: string };
  // The language the lots are shown in on every screen. Games started
  // before it existed have none and play in English.
  language?: AuctionLanguage;
  // The players, in seating order, fixed for the whole game.
  order: string[];
  // How long everyone gets to write, copied out of the room's config at the
  // start: ctx.config is only populated for createInitialState.
  answerSeconds: number;
  // 'writing' onward: what each player has typed this lot, in order.
  answers?: Record<string, AuctionAnswer[]>;
  // Players who pressed "I'm done" this lot. Once everyone still here has,
  // the writing ends early.
  doneUserIds?: string[];
  // Phones-only rooms, 'judging': who has pressed Done on the review.
  reviewDoneUserIds?: string[];
  lastRound?: RoundResult;
  scores: Record<string, number>;
  lotsWon: Record<string, number>;
  bestCount: Record<string, number>;
  totalAnswers: Record<string, number>;
  finalStats?: Record<string, FinalStats>;
  phaseEndsAt?: number;
  winnerUserIds?: string[];
}

interface AuctionClientView {
  totalRounds: number;
  roundIndex: number;
  currentCategory?: { id: string; name: string; nameAr: string };
  language: AuctionLanguage;
  order: string[];
  answerSeconds: number;
  // While the lot is being written: everyone's live count, and only the
  // viewer's own list. From the host's review on: every list.
  counts?: Record<string, number>;
  answers?: Record<string, AuctionAnswer[]>;
  doneUserIds?: string[];
  reviewDoneUserIds?: string[];
  winBonus: number;
  lastRound?: RoundResult;
  scores: Record<string, number>;
  finalStats?: Record<string, FinalStats>;
  phaseEndsAt?: number;
  // The server's clock when this view was sent. phaseEndsAt is a server
  // time; a phone whose own clock runs fast or slow would otherwise count to
  // zero early and sit frozen until the next lot arrives, or be cut off
  // mid-count (auction-ui.js syncs its countdowns to this).
  serverNow: number;
  winnerUserIds?: string[];
}

type AuctionAction =
  | { type: 'answer'; text: string }
  | { type: 'finishAnswering' }
  // The host's rulings on one player's list, and the tap that ends the review.
  | { type: 'toggleAnswer'; userId: string; index: number }
  | { type: 'confirmJudging' }
  // Phones-only rooms: the table's review in place of the host's. A player
  // votes to strike (or takes back their vote on) an answer on somebody
  // else's list, and presses Done when they have read every list.
  | { type: 'voteStrike'; userId: string; index: number }
  | { type: 'finishReview' }
  // The host moving the room on from a result or the standings early.
  | { type: 'advance' };

// Who bids: everyone but the host in a TV room, where the host runs the
// auction from the big screen; everyone, the host too, in a phones-only room.
function playableMembers(ctx: GameEngineContext): RoomMemberSummary[] {
  return tablePlayers(ctx);
}

// The table's ruling on every answer, in a phones-only room: struck when more
// than half of the other players still here voted it out. Recomputed from the
// votes each time, so a player who leaves changes the bar rather than leaving
// a stale ruling behind. A list whose author is the only one left keeps
// everything.
function applyStrikeMajority(ctx: GameEngineContext, data: AuctionData): AuctionData {
  const present = connectedIds(ctx);
  const answers = Object.fromEntries(
    Object.entries(data.answers ?? {}).map(([authorId, list]) => {
      const voters = data.order.filter((id) => id !== authorId && present.has(id));
      return [
        authorId,
        list.map((a) => {
          const votes = (a.strikeVotes ?? []).filter((v) => voters.includes(v));
          return { ...a, rejected: voters.length > 0 && votes.length * 2 > voters.length };
        }),
      ];
    })
  );
  return { ...data, answers };
}

// The review ends once everyone still here has pressed Done.
function maybeReviewDone(ctx: GameEngineContext, data: AuctionData): GameEngineResult<AuctionData> | null {
  const present = [...connectedIds(ctx)].filter((id) => data.order.includes(id));
  const done = new Set(data.reviewDoneUserIds ?? []);
  if (present.length > 0 && present.every((id) => done.has(id))) return resolveRound(applyStrikeMajority(ctx, data));
  return null;
}

function connectedIds(ctx: GameEngineContext): Set<string> {
  return new Set(playableMembers(ctx).filter((m) => m.connected).map((m) => m.userId));
}

function validCount(answers: AuctionAnswer[] | undefined): number {
  return (answers ?? []).filter((a) => !a.duplicate && !a.rejected).length;
}

function countsOf(data: AuctionData): Record<string, number> {
  return Object.fromEntries(data.order.map((id) => [id, validCount(data.answers?.[id])]));
}

function startRound(data: AuctionData, roundIndex: number): GameEngineResult<AuctionData> {
  if (roundIndex >= data.categories.length) return finish(data, roundIndex);

  const category = data.categories[roundIndex];
  const phaseEndsAt = Date.now() + REVEAL_SECONDS * 1000;
  return {
    phase: 'reveal',
    data: {
      ...data,
      roundIndex,
      currentCategory: { id: category.id, name: category.name, nameAr: category.nameAr },
      answers: undefined,
      doneUserIds: undefined,
      reviewDoneUserIds: undefined,
      lastRound: undefined,
      phaseEndsAt,
    },
    nextTickAt: phaseEndsAt,
  };
}

function openWriting(data: AuctionData): GameEngineResult<AuctionData> {
  const phaseEndsAt = Date.now() + data.answerSeconds * 1000;
  return {
    phase: 'writing',
    data: { ...data, answers: Object.fromEntries(data.order.map((id) => [id, []])), doneUserIds: [], phaseEndsAt },
    nextTickAt: phaseEndsAt,
  };
}

// Time is up (or everyone is done): the host reviews every list. A lot where
// nobody wrote anything has nothing to review and goes straight to its result.
// In a phones-only room the table reviews instead (see applyStrikeMajority),
// on a clock of its own.
function closeWriting(ctx: GameEngineContext, data: AuctionData): GameEngineResult<AuctionData> {
  const anything = Object.values(data.answers ?? {}).some((list) => list.length > 0);
  if (!anything) return resolveRound(data);
  if (hostPlays(ctx)) {
    const phaseEndsAt = Date.now() + REVIEW_SECONDS * 1000;
    return { phase: 'judging', data: { ...data, reviewDoneUserIds: [], phaseEndsAt }, nextTickAt: phaseEndsAt };
  }
  return { phase: 'judging', data: { ...data, phaseEndsAt: undefined } };
}

// Once every player still in the room has pressed "I'm done", there is no
// point waiting out the clock.
function maybeEveryoneDone(ctx: GameEngineContext, data: AuctionData): GameEngineResult<AuctionData> | null {
  const present = [...connectedIds(ctx)].filter((id) => data.order.includes(id));
  const done = new Set(data.doneUserIds ?? []);
  if (present.length > 0 && present.every((id) => done.has(id))) return closeWriting(ctx, data);
  return null;
}

// Scores the lot from the reviewed lists and moves to its result.
function resolveRound(data: AuctionData): GameEngineResult<AuctionData> {
  const category = data.currentCategory;
  const counts = countsOf(data);
  const topCount = Math.max(0, ...Object.values(counts));
  const winnerUserIds = topCount > 0 ? data.order.filter((id) => counts[id] === topCount) : [];
  const awarded = Object.fromEntries(
    data.order.map((id) => [id, (counts[id] ?? 0) + (winnerUserIds.includes(id) ? WIN_BONUS : 0)])
  );

  const scores = { ...data.scores };
  const lotsWon = { ...data.lotsWon };
  const bestCount = { ...data.bestCount };
  const totalAnswers = { ...data.totalAnswers };
  for (const id of data.order) {
    scores[id] = (scores[id] ?? 0) + awarded[id];
    totalAnswers[id] = (totalAnswers[id] ?? 0) + counts[id];
    bestCount[id] = Math.max(bestCount[id] ?? 0, counts[id]);
    if (winnerUserIds.includes(id)) lotsWon[id] = (lotsWon[id] ?? 0) + 1;
  }

  const phaseEndsAt = Date.now() + RESULTS_SECONDS * 1000;
  return {
    phase: 'results',
    data: {
      ...data,
      scores,
      lotsWon,
      bestCount,
      totalAnswers,
      lastRound: {
        categoryName: category?.name ?? '',
        categoryNameAr: category?.nameAr ?? '',
        counts,
        topCount,
        winnerUserIds,
        awarded,
      },
      phaseEndsAt,
    },
    nextTickAt: phaseEndsAt,
  };
}

// After a result: the standings between lots, or the final screen after the
// last one.
function afterResults(data: AuctionData): GameEngineResult<AuctionData> {
  if (data.roundIndex + 1 >= data.totalRounds) return finish(data, data.roundIndex + 1);
  const phaseEndsAt = Date.now() + STANDINGS_SECONDS * 1000;
  return { phase: 'standings', data: { ...data, phaseEndsAt }, nextTickAt: phaseEndsAt };
}

function finish(data: AuctionData, roundIndex: number): GameEngineResult<AuctionData> {
  const topScore = Math.max(0, ...Object.values(data.scores));
  const winnerUserIds = Object.entries(data.scores)
    .filter(([, score]) => score === topScore && topScore > 0)
    .map(([userId]) => userId);
  const finalStats: Record<string, FinalStats> = Object.fromEntries(
    Object.keys(data.scores).map((userId) => [
      userId,
      {
        lotsWon: data.lotsWon[userId] ?? 0,
        bestCount: data.bestCount[userId] ?? 0,
        totalAnswers: data.totalAnswers[userId] ?? 0,
      },
    ])
  );
  return {
    phase: 'finished',
    data: {
      ...data,
      roundIndex: Math.min(roundIndex, data.totalRounds - 1),
      currentCategory: undefined,
      answers: undefined,
      doneUserIds: undefined,
      phaseEndsAt: undefined,
      winnerUserIds,
      finalStats,
    },
  };
}

export const auctionEngine: GameEngine<AuctionData, AuctionAction> = {
  gameType: 'auction',

  async loadConfig(code) {
    const stored = await getAuctionRoomConfig(code);
    const config: AuctionRoomConfig = stored ?? defaultAuctionConfig();
    return { config, pool: resolveAuctionPool(config) };
  },

  createInitialState(ctx) {
    const loaded = ctx.config as { config: AuctionRoomConfig; pool: AuctionCategory[] } | undefined;
    const config = loaded?.config ?? defaultAuctionConfig();
    const pool = loaded?.pool ?? [];
    const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, config.rounds);
    const players = playableMembers(ctx);
    const zeroed = (): Record<string, number> => Object.fromEntries(players.map((m) => [m.userId, 0]));
    return startRound(
      {
        categories: shuffled,
        totalRounds: shuffled.length,
        roundIndex: -1,
        language: config.language === 'ar' ? 'ar' : 'en',
        order: players.map((m) => m.userId),
        answerSeconds: config.answerSeconds,
        scores: zeroed(),
        lotsWon: zeroed(),
        bestCount: zeroed(),
        totalAnswers: zeroed(),
      },
      0
    );
  },

  applyAction(ctx, phase, data, userId, action) {
    const member = ctx.members.find((m) => m.userId === userId);
    if (!member) throw new GameActionError('NOT_A_MEMBER', 'You are not in this room.');

    // --- The host's controls -------------------------------------------------
    if (action.type === 'toggleAnswer' || action.type === 'confirmJudging' || action.type === 'advance') {
      if (!member.isHost) throw new GameActionError('NOT_HOST', 'Only the host can do that.');
      // A host who bids does not referee: in a phones-only room the table
      // rules on the lists (voteStrike) and ends the review (finishReview).
      if (hostPlays(ctx) && action.type !== 'advance') {
        throw new GameActionError('HOST_PLAYS', 'You are bidding in this room, so the table reviews the lists together.');
      }

      if (action.type === 'advance') {
        if (phase === 'results') return afterResults(data);
        if (phase === 'standings') return startRound(data, data.roundIndex + 1);
        throw new GameActionError('INVALID_PHASE', 'There is nothing to move on from right now.');
      }
      if (phase !== 'judging') throw new GameActionError('INVALID_PHASE', 'There are no lists to review right now.');
      if (action.type === 'confirmJudging') return resolveRound(data);

      const list = [...(data.answers?.[action.userId] ?? [])];
      const row = list[action.index];
      if (!row) throw new GameActionError('INVALID_ACTION', 'That answer is not on the list.');
      // A repeat is not the host's to overrule: it was already counted once.
      if (row.duplicate) throw new GameActionError('INVALID_ACTION', 'That one was already said.');
      list[action.index] = { ...row, rejected: !row.rejected };
      return { phase, data: { ...data, answers: { ...data.answers, [action.userId]: list } } };
    }

    if (member.isHost && !hostPlays(ctx)) {
      throw new GameActionError('HOST_CANNOT_PLAY', 'The host runs the auction -- you do not play in it.');
    }

    // --- The table's review (phones-only rooms) ------------------------------
    if (action.type === 'voteStrike' || action.type === 'finishReview') {
      if (!hostPlays(ctx)) throw new GameActionError('NOT_SUPPORTED', 'The host reviews the lists in this room.');
      if (phase !== 'judging') throw new GameActionError('INVALID_PHASE', 'There are no lists to review right now.');
      if (!data.order.includes(userId)) throw new GameActionError('NOT_A_PLAYER', 'You joined after this game started.');

      if (action.type === 'finishReview') {
        const reviewDoneUserIds = [...new Set([...(data.reviewDoneUserIds ?? []), userId])];
        const next = { ...data, reviewDoneUserIds };
        return maybeReviewDone(ctx, next) ?? { phase, data: next, nextTickAt: data.phaseEndsAt };
      }

      if (action.userId === userId) throw new GameActionError('OWN_ANSWER', 'You do not vote on your own list.');
      const list = [...(data.answers?.[action.userId] ?? [])];
      const row = list[action.index];
      if (!row) throw new GameActionError('INVALID_ACTION', 'That answer is not on the list.');
      if (row.duplicate) throw new GameActionError('INVALID_ACTION', 'That one was already said.');
      const votes = row.strikeVotes ?? [];
      list[action.index] = {
        ...row,
        strikeVotes: votes.includes(userId) ? votes.filter((v) => v !== userId) : [...votes, userId],
      };
      const next = applyStrikeMajority(ctx, { ...data, answers: { ...data.answers, [action.userId]: list } });
      return { phase, data: next, nextTickAt: data.phaseEndsAt };
    }

    // --- Writing -------------------------------------------------------------
    if (action.type === 'answer' || action.type === 'finishAnswering') {
      if (phase !== 'writing') throw new GameActionError('INVALID_PHASE', 'The clock is not running right now.');
      if (!data.order.includes(userId)) throw new GameActionError('NOT_A_PLAYER', 'You joined after this game started.');

      if (action.type === 'finishAnswering') {
        const doneUserIds = [...new Set([...(data.doneUserIds ?? []), userId])];
        const next = { ...data, doneUserIds };
        return maybeEveryoneDone(ctx, next) ?? { phase, data: next, nextTickAt: data.phaseEndsAt };
      }

      const text = String(action.text ?? '').trim().slice(0, MAX_ANSWER_LENGTH);
      if (!text) throw new GameActionError('INVALID_ACTION', 'Type an answer first.');
      const mine = [...(data.answers?.[userId] ?? [])];
      if (mine.length >= MAX_ANSWERS_PER_ROUND) throw new GameActionError('INVALID_ACTION', 'That is plenty for one lot.');
      const key = normalizeAnswer(text);
      const duplicate = mine.some((a) => normalizeAnswer(a.text) === key);
      mine.push({ text, duplicate, rejected: false });
      return { phase, data: { ...data, answers: { ...data.answers, [userId]: mine } }, nextTickAt: data.phaseEndsAt };
    }

    throw new GameActionError('INVALID_ACTION', 'Unknown action.');
  },

  tick(ctx, phase, data) {
    if (phase === 'reveal') return openWriting(data);
    // The clock running out ends the writing for everyone.
    if (phase === 'writing') return closeWriting(ctx, data);
    // A phones-only room's review runs on a clock; the host's review does not
    // (it has no phaseEndsAt, so this is never reached for one).
    if (phase === 'judging' && hostPlays(ctx)) return resolveRound(applyStrikeMajority(ctx, data));
    if (phase === 'results') return afterResults(data);
    if (phase === 'standings') return startRound(data, data.roundIndex + 1);
    return { phase, data };
  },

  // A player who drops keeps what they had typed; it is reviewed like
  // everyone else's. Their leaving can only end the writing early, when
  // everyone still here has already said they are done.
  onPresenceChange(ctx, phase, data) {
    if (phase === 'writing') {
      const closed = maybeEveryoneDone(ctx, data);
      if (closed) return closed;
    }
    if (phase === 'judging' && hostPlays(ctx)) {
      // Somebody leaving moves the bar for a strike, and may mean everyone
      // still here is done.
      const reruled = applyStrikeMajority(ctx, data);
      return maybeReviewDone(ctx, reruled) ?? { phase, data: reruled, nextTickAt: data.phaseEndsAt };
    }
    return { phase, data };
  },

  async cleanup(code) {
    await clearAuctionRoomConfig(code);
  },

  toClientView(_ctx, phase, data, viewerUserId): AuctionClientView {
    // While the lot is being written, nobody sees anyone else's answers -- only
    // how many they have. From the host's review on, every list is public:
    // that is the review.
    const writing = phase === 'writing';
    const answers = data.answers
      ? writing
        ? { [viewerUserId]: data.answers[viewerUserId] ?? [] }
        : data.answers
      : undefined;
    return {
      totalRounds: data.totalRounds,
      roundIndex: data.roundIndex,
      currentCategory: data.currentCategory,
      language: data.language === 'ar' ? 'ar' : 'en',
      order: data.order,
      answerSeconds: data.answerSeconds,
      counts: data.answers ? countsOf(data) : undefined,
      answers,
      doneUserIds: data.doneUserIds,
      reviewDoneUserIds: data.reviewDoneUserIds,
      winBonus: WIN_BONUS,
      lastRound: data.lastRound,
      scores: data.scores,
      finalStats: data.finalStats,
      phaseEndsAt: data.phaseEndsAt,
      serverNow: Date.now(),
      winnerUserIds: data.winnerUserIds,
    };
  },

  getFinalResults(data) {
    const winners = new Set(data.winnerUserIds ?? []);
    return Object.entries(data.scores).map(([userId, score]) => ({
      userId,
      score,
      isWinner: winners.has(userId),
    }));
  },

  getHighlights(data) {
    return Object.fromEntries(
      Object.keys(data.scores).map((userId) => [
        userId,
        {
          lotsWon: data.lotsWon[userId] ?? 0,
          bestCount: data.bestCount[userId] ?? 0,
          totalAnswers: data.totalAnswers[userId] ?? 0,
        },
      ])
    );
  },
};
