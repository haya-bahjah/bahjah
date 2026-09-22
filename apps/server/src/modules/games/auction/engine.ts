import type { RoomMemberSummary } from '@bahjah/shared';
import { GameActionError, type GameEngine, type GameEngineContext, type GameEngineResult } from '../engine';
import type { AuctionCategory } from './categoryBank';
import {
  clearAuctionRoomConfig,
  defaultAuctionConfig,
  getAuctionRoomConfig,
  resolveAuctionPool,
  type AuctionRoomConfig,
} from './config';
import { normalizeAnswer } from '../normalize';

const COUNTDOWN_SECONDS = 3;
// The "SOLD!" beat. Short on purpose: it is the hinge between "I can do more"
// and "now prove it", and it only works if it lands as a moment rather than
// as a screen the room waits out.
const SOLD_SECONDS = 3;

// The floor on an opening bid. One or two answers is not an auction, and a
// category the spec requires to have fifty reasonable answers can always
// carry three.
const MIN_OPENING_BID = 3;

interface RoundResult {
  categoryName: string;
  categoryNameAr: string;
  winnerUserId: string;
  bid: number;
  validCount: number;
  success: boolean;
  awarded: number;
}

interface FinalStats {
  successfulAuctions: number;
  auctionsWon: number;
  highestSuccessfulBid: number;
}

// One thing the winner typed. Kept in submission order because the screen
// shows the list filling up as they go, and the host judges it in that order.
interface AuctionAnswer {
  text: string;
  // Something they had already said this round. Kept on the list rather than
  // refused -- refusing mid-sprint costs more than it saves -- but never
  // counted, and drawn struck through.
  duplicate: boolean;
  // The host ruled it out. Everything starts accepted: the host's job is to
  // strike the wrong ones, not to approve every right one.
  rejected: boolean;
}

interface AuctionData {
  // Every category this room will auction, drawn once up front. Redacted
  // from clients so later rounds are not visible in round one.
  categories: AuctionCategory[];
  totalRounds: number;
  roundIndex: number;
  currentCategory?: { id: string; name: string; nameAr: string };
  // The seating order the rotation runs in, fixed for the whole game so the
  // turn moves predictably rather than jumping about.
  order: string[];
  // How long the winner gets to answer, copied out of the room's config at
  // the start: ctx.config is only populated for createInitialState, so a
  // tick that read it back would always see the default instead.
  answerSeconds: number;
  // Which seat opens the bidding. Moves on by one every round, which is the
  // spec's way of sharing the first-mover advantage out.
  openerIndex: number;
  // 'bidding': who is still in. A player leaves this list by passing, or by
  // dropping their connection -- the auction has no clock, so a player who
  // is gone has to stop being waited for or the round never ends.
  activeBidders?: string[];
  passedBidders?: string[];
  turnUserId?: string;
  currentBid?: { amount: number; userId: string };
  // Set once the auction is sold, and for the rest of the round.
  winnerUserId?: string;
  winningBid?: number;
  // 'answering' onward: what the winner has typed, in order.
  answers?: AuctionAnswer[];
  lastRound?: RoundResult;
  // 'results': who has pressed Next.
  continueUserIds?: string[];
  scores: Record<string, number>;
  successfulAuctions: Record<string, number>;
  auctionsWon: Record<string, number>;
  highestSuccessfulBid: Record<string, number>;
  finalStats?: Record<string, FinalStats>;
  phaseEndsAt?: number;
  winnerUserIds?: string[];
}

interface AuctionClientView {
  totalRounds: number;
  roundIndex: number;
  currentCategory?: { id: string; name: string; nameAr: string };
  order: string[];
  activeBidders?: string[];
  passedBidders?: string[];
  turnUserId?: string;
  currentBid?: { amount: number; userId: string };
  minBid?: number;
  winnerUserId?: string;
  winningBid?: number;
  answers?: AuctionAnswer[];
  answerSeconds?: number;
  lastRound?: RoundResult;
  continueUserIds?: string[];
  scores: Record<string, number>;
  finalStats?: Record<string, FinalStats>;
  phaseEndsAt?: number;
  winnerUserIds?: string[];
}

type AuctionAction =
  | { type: 'bid'; amount: number }
  | { type: 'pass' }
  | { type: 'answer'; text: string }
  | { type: 'finishAnswering' }
  // The host's rulings on the winner's list, and the tap that ends judging.
  | { type: 'toggleAnswer'; index: number }
  | { type: 'confirmJudging' }
  | { type: 'continue' }
  | { type: 'advance' };

function playableMembers(ctx: GameEngineContext): RoomMemberSummary[] {
  return ctx.members.filter((m) => !m.isHost);
}

function connectedIds(ctx: GameEngineContext): Set<string> {
  return new Set(playableMembers(ctx).filter((m) => m.connected).map((m) => m.userId));
}

// The next seat after `fromUserId` that is still bidding and is not the
// player whose bid is currently on top -- the spec's rule that you cannot
// raise yourself; somebody else has to raise first.
function nextTurn(data: AuctionData, fromUserId: string | undefined): string | undefined {
  const active = data.activeBidders ?? [];
  const topBidder = data.currentBid?.userId;
  const eligible = active.filter((id) => id !== topBidder);
  if (eligible.length === 0) return undefined;

  const order = data.order;
  const start = fromUserId ? order.indexOf(fromUserId) : -1;
  for (let step = 1; step <= order.length; step += 1) {
    const candidate = order[(start + step + order.length) % order.length];
    if (eligible.includes(candidate)) return candidate;
  }
  return undefined;
}

function startRound(ctx: GameEngineContext, data: AuctionData, roundIndex: number): GameEngineResult<AuctionData> {
  if (roundIndex >= data.categories.length) return finish(data, roundIndex);

  const category = data.categories[roundIndex];
  const present = connectedIds(ctx);
  // The rotation is the room's seating order, minus anybody who is not here
  // to bid. A player who reconnects mid-round joins the next one.
  const active = data.order.filter((id) => present.has(id));
  const openerIndex = data.order.length > 0 ? roundIndex % data.order.length : 0;
  // The opener is the seat whose turn it is to start; if they are not here,
  // the turn moves on to the next player who is.
  let opener = data.order[openerIndex];
  if (!active.includes(opener)) {
    opener = active[0];
  }

  return {
    phase: 'bidding',
    data: {
      ...data,
      roundIndex,
      currentCategory: { id: category.id, name: category.name, nameAr: category.nameAr },
      openerIndex,
      activeBidders: active,
      passedBidders: [],
      turnUserId: opener,
      currentBid: undefined,
      winnerUserId: undefined,
      winningBid: undefined,
      answers: undefined,
      lastRound: undefined,
      continueUserIds: undefined,
      // Bidding has no clock: it ends when every other player has passed.
      phaseEndsAt: undefined,
    },
  };
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
        successfulAuctions: data.successfulAuctions[userId] ?? 0,
        auctionsWon: data.auctionsWon[userId] ?? 0,
        highestSuccessfulBid: data.highestSuccessfulBid[userId] ?? 0,
      },
    ])
  );
  return {
    phase: 'finished',
    data: {
      ...data,
      roundIndex,
      currentCategory: undefined,
      activeBidders: undefined,
      passedBidders: undefined,
      turnUserId: undefined,
      currentBid: undefined,
      answers: undefined,
      continueUserIds: undefined,
      phaseEndsAt: undefined,
      winnerUserIds,
      finalStats,
    },
  };
}

// Sold: everybody except the top bidder has passed (or gone).
function sell(data: AuctionData): GameEngineResult<AuctionData> {
  const bid = data.currentBid;
  if (!bid) {
    // Nothing was ever bid -- only reachable if the opener disconnected
    // before bidding. Treated as a round nobody won rather than a stall.
    return {
      phase: 'sold',
      data: { ...data, winnerUserId: undefined, winningBid: undefined, phaseEndsAt: Date.now() + SOLD_SECONDS * 1000 },
      nextTickAt: Date.now() + SOLD_SECONDS * 1000,
    };
  }
  const phaseEndsAt = Date.now() + SOLD_SECONDS * 1000;
  return {
    phase: 'sold',
    data: {
      ...data,
      winnerUserId: bid.userId,
      winningBid: bid.amount,
      turnUserId: undefined,
      phaseEndsAt,
    },
    nextTickAt: phaseEndsAt,
  };
}

function maybeSell(data: AuctionData): GameEngineResult<AuctionData> {
  const active = data.activeBidders ?? [];
  const topBidder = data.currentBid?.userId;
  const stillBidding = active.filter((id) => id !== topBidder);
  if (stillBidding.length > 0) return { phase: 'bidding', data };
  return sell(data);
}

// The answer phase, or straight to the round's result if the auction ended
// with nobody holding it.
function openAnswering(ctx: GameEngineContext, data: AuctionData, answerSeconds: number): GameEngineResult<AuctionData> {
  if (!data.winnerUserId) return resolveRound(data, []);
  const phaseEndsAt = Date.now() + answerSeconds * 1000;
  return {
    phase: 'answering',
    data: { ...data, answers: [], phaseEndsAt },
    nextTickAt: phaseEndsAt,
  };
}

function openJudging(data: AuctionData): GameEngineResult<AuctionData> {
  return { phase: 'judging', data: { ...data, phaseEndsAt: undefined } };
}

// Scores the round from the host's rulings and moves to the results screen.
function resolveRound(data: AuctionData, answers: AuctionAnswer[]): GameEngineResult<AuctionData> {
  const category = data.currentCategory;
  const winnerUserId = data.winnerUserId;
  const bid = data.winningBid ?? 0;
  const validCount = answers.filter((a) => !a.duplicate && !a.rejected).length;
  // The whole of the spec's scoring: make the bid and it is worth exactly
  // what was bid; fall short and it is worth nothing.
  const success = Boolean(winnerUserId) && validCount >= bid && bid > 0;
  const awarded = success ? bid : 0;

  const scores = { ...data.scores };
  const successfulAuctions = { ...data.successfulAuctions };
  const auctionsWon = { ...data.auctionsWon };
  const highestSuccessfulBid = { ...data.highestSuccessfulBid };

  if (winnerUserId) {
    auctionsWon[winnerUserId] = (auctionsWon[winnerUserId] ?? 0) + 1;
    if (success) {
      scores[winnerUserId] = (scores[winnerUserId] ?? 0) + awarded;
      successfulAuctions[winnerUserId] = (successfulAuctions[winnerUserId] ?? 0) + 1;
      highestSuccessfulBid[winnerUserId] = Math.max(highestSuccessfulBid[winnerUserId] ?? 0, bid);
    }
  }

  return {
    phase: 'results',
    data: {
      ...data,
      answers,
      scores,
      successfulAuctions,
      auctionsWon,
      highestSuccessfulBid,
      lastRound: {
        categoryName: category?.name ?? '',
        categoryNameAr: category?.nameAr ?? '',
        winnerUserId: winnerUserId ?? '',
        bid,
        validCount,
        success,
        awarded,
      },
      continueUserIds: [],
      phaseEndsAt: undefined,
    },
  };
}

function maybeAdvanceResults(ctx: GameEngineContext, data: AuctionData): GameEngineResult<AuctionData> {
  const present = playableMembers(ctx).filter((m) => m.connected);
  const continued = data.continueUserIds ?? [];
  const everyoneIn = present.length > 0 && present.every((m) => continued.includes(m.userId));
  if (!everyoneIn) return { phase: 'results', data };
  return startRound(ctx, data, data.roundIndex + 1);
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
    const phaseEndsAt = Date.now() + COUNTDOWN_SECONDS * 1000;
    return {
      phase: 'countdown',
      data: {
        categories: shuffled,
        totalRounds: shuffled.length,
        roundIndex: -1,
        order: players.map((m) => m.userId),
        answerSeconds: config.answerSeconds,
        openerIndex: 0,
        scores: zeroed(),
        successfulAuctions: zeroed(),
        auctionsWon: zeroed(),
        highestSuccessfulBid: zeroed(),
        phaseEndsAt,
      },
      nextTickAt: phaseEndsAt,
    };
  },

  applyAction(ctx, phase, data, userId, action) {
    const member = ctx.members.find((m) => m.userId === userId);
    if (!member) throw new GameActionError('NOT_A_MEMBER', 'You are not in this room.');

    // --- The host's controls -------------------------------------------------
    if (action.type === 'toggleAnswer' || action.type === 'confirmJudging' || action.type === 'advance') {
      if (!member.isHost) throw new GameActionError('NOT_HOST', 'Only the host can do that.');

      if (action.type === 'advance') {
        if (phase !== 'results') throw new GameActionError('INVALID_PHASE', 'There is nothing to move on from right now.');
        return startRound(ctx, data, data.roundIndex + 1);
      }
      if (phase !== 'judging') throw new GameActionError('INVALID_PHASE', 'There is no list to rule on right now.');

      const answers = [...(data.answers ?? [])];
      if (action.type === 'toggleAnswer') {
        const row = answers[action.index];
        if (!row) throw new GameActionError('INVALID_ACTION', 'That answer is not on the list.');
        // A duplicate is not the host's to overrule: it was already counted
        // once, and counting it twice is the one thing the spec rules out.
        if (row.duplicate) throw new GameActionError('INVALID_ACTION', 'That one was already said.');
        answers[action.index] = { ...row, rejected: !row.rejected };
        return { phase, data: { ...data, answers } };
      }
      return resolveRound(data, answers);
    }

    if (member.isHost) {
      throw new GameActionError('HOST_CANNOT_PLAY', 'The host runs the auction -- you do not bid in it.');
    }

    // --- Bidding -------------------------------------------------------------
    if (action.type === 'bid' || action.type === 'pass') {
      if (phase !== 'bidding') throw new GameActionError('INVALID_PHASE', 'The auction is not open right now.');
      if (data.turnUserId !== userId) throw new GameActionError('NOT_YOUR_TURN', 'It is not your turn to bid.');

      if (action.type === 'pass') {
        // The opener has nothing to pass on -- there is no bid on the table
        // yet, and a round where nobody ever bids has no auction in it.
        if (!data.currentBid) throw new GameActionError('MUST_OPEN', 'You open the bidding — name a number.');
        const active = (data.activeBidders ?? []).filter((id) => id !== userId);
        const passed = [...(data.passedBidders ?? []), userId];
        const next = { ...data, activeBidders: active, passedBidders: passed };
        const sold = maybeSell(next);
        if (sold.phase === 'sold') return sold;
        return { phase: 'bidding', data: { ...next, turnUserId: nextTurn(next, userId) } };
      }

      const amount = Math.floor(Number(action.amount));
      if (!Number.isFinite(amount)) throw new GameActionError('INVALID_ACTION', 'That is not a number.');
      const floor = data.currentBid ? data.currentBid.amount + 1 : MIN_OPENING_BID;
      if (amount < floor) {
        throw new GameActionError(
          'BID_TOO_LOW',
          data.currentBid ? `You have to beat ${data.currentBid.amount}.` : `Open at ${MIN_OPENING_BID} or more.`
        );
      }
      const next = { ...data, currentBid: { amount, userId } };
      // The raise moves the turn on to the next player who is still in and
      // is not the new top bidder.
      const turn = nextTurn(next, userId);
      if (!turn) return sell(next);
      return { phase: 'bidding', data: { ...next, turnUserId: turn } };
    }

    // --- The answer phase ----------------------------------------------------
    if (action.type === 'answer' || action.type === 'finishAnswering') {
      if (phase !== 'answering') throw new GameActionError('INVALID_PHASE', 'The answer phase is not open.');
      if (data.winnerUserId !== userId) throw new GameActionError('NOT_YOUR_TURN', 'This round belongs to whoever won the auction.');

      if (action.type === 'finishAnswering') return openJudging(data);

      const text = action.text.trim();
      if (!text) throw new GameActionError('INVALID_ACTION', 'Type an answer first.');
      const answers = [...(data.answers ?? [])];
      const key = normalizeAnswer(text);
      const duplicate = answers.some((a) => normalizeAnswer(a.text) === key);
      answers.push({ text, duplicate, rejected: false });
      return { phase, data: { ...data, answers }, nextTickAt: data.phaseEndsAt };
    }

    if (action.type === 'continue') {
      if (phase !== 'results') throw new GameActionError('INVALID_PHASE', 'There is nothing to continue from right now.');
      const continued = data.continueUserIds ?? [];
      if (continued.includes(userId)) return { phase, data };
      return maybeAdvanceResults(ctx, { ...data, continueUserIds: [...continued, userId] });
    }

    throw new GameActionError('INVALID_ACTION', 'Unknown action.');
  },

  tick(ctx, phase, data) {
    if (phase === 'countdown') return startRound(ctx, data, 0);
    if (phase === 'sold') return openAnswering(ctx, data, data.answerSeconds);
    // The answer clock running out ends the sprint and hands the list to the
    // host, exactly as pressing "I'm done" would.
    if (phase === 'answering') return openJudging(data);
    return { phase, data };
  },

  // Bidding has no clock, so who is present is the only thing that can end a
  // stalled auction: a player who drops is out of the rotation, and if that
  // leaves one bid standing the lot is sold. The answer phase has the
  // spec's other disconnect rule -- if the winner goes, the round fails
  // rather than waiting for answers that are not coming.
  onPresenceChange(ctx, phase, data) {
    const present = connectedIds(ctx);

    if (phase === 'bidding') {
      const active = (data.activeBidders ?? []).filter((id) => present.has(id));
      if (active.length === (data.activeBidders ?? []).length) return { phase, data };
      const dropped = (data.activeBidders ?? []).filter((id) => !present.has(id));
      const next = {
        ...data,
        activeBidders: active,
        passedBidders: [...(data.passedBidders ?? []), ...dropped],
      };
      const sold = maybeSell(next);
      if (sold.phase === 'sold') return sold;
      // If the turn belonged to somebody who has gone, move it on.
      const turnStillHere = next.turnUserId && active.includes(next.turnUserId) && next.turnUserId !== next.currentBid?.userId;
      return { phase: 'bidding', data: turnStillHere ? next : { ...next, turnUserId: nextTurn(next, next.turnUserId) } };
    }

    if (phase === 'answering' && data.winnerUserId && !present.has(data.winnerUserId)) {
      // Their list stands as far as it got, and is judged like any other --
      // which for a player who left mid-sprint almost always means the bid
      // is not met and the round is worth nothing.
      return openJudging(data);
    }

    if (phase === 'results') return maybeAdvanceResults(ctx, data);
    return { phase, data };
  },

  async cleanup(code) {
    await clearAuctionRoomConfig(code);
  },

  toClientView(ctx, phase, data): AuctionClientView {
    // Only one thing here is secret, and it is not much: the categories the
    // later rounds will use. Everything else about an auction is public by
    // design -- the bidding is the game, and the answers are read out loud.
    return {
      totalRounds: data.totalRounds,
      roundIndex: data.roundIndex,
      currentCategory: data.currentCategory,
      order: data.order,
      activeBidders: data.activeBidders,
      passedBidders: data.passedBidders,
      turnUserId: data.turnUserId,
      currentBid: data.currentBid,
      minBid: data.currentBid ? data.currentBid.amount + 1 : MIN_OPENING_BID,
      winnerUserId: data.winnerUserId,
      winningBid: data.winningBid,
      answers: data.answers,
      lastRound: data.lastRound,
      continueUserIds: data.continueUserIds,
      scores: data.scores,
      finalStats: data.finalStats,
      phaseEndsAt: data.phaseEndsAt,
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
};
