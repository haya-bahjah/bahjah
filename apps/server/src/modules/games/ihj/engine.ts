import type { RoomMemberSummary } from '@bahjah/shared';
import { GameActionError, type GameEngine, type GameEngineContext, type GameEngineResult } from '../engine';
import { normalizeAnswer } from '../normalize';
import { drawLetters, type IhjCategory, type IhjLetter } from './bank';
import {
  clearIhjRoomConfig,
  defaultIhjConfig,
  getIhjRoomConfig,
  resolveIhjCategories,
  type IhjRoomConfig,
} from './config';

const COUNTDOWN_SECONDS = 3;
// The leaderboard beat between rounds. It runs itself rather than waiting on
// another round of taps: the room has just agreed the scores, and asking them
// to press Next twice in a row to see the same numbers again is a tax.
const STANDINGS_SECONDS = 6;

// The spec's scoring. Nothing else scores: a blank is worth nothing, and so is
// an answer the player themselves marks wrong.
const POINTS_UNIQUE = 10;
const POINTS_SHARED = 5;

// One answer, as it stands on the scoring board.
interface IhjAnswer {
  // Exactly what they typed, kept for display -- §9 asks for the player's own
  // spelling to survive normalisation.
  text: string;
  // What the system worked out by normalising every answer in the column:
  // nobody else wrote this, somebody else did, or the box was empty.
  verdict: 'unique' | 'shared' | 'blank';
  // Who else landed on the same word. Drawn on the board so a five is
  // obviously a five rather than an unexplained halving.
  sharedWith: string[];
  // The player's own ruling on their own answer. Absent means they have not
  // touched it and the system's verdict stands; false means they have struck
  // it themselves, which is the only way a word the system accepted scores
  // zero. This is the whole of §10's self-scoring.
  ownedValid?: boolean;
}

interface RoundScore {
  perCategory: number[];
  total: number;
}

interface FinalStats {
  uniqueAnswers: number;
  sharedAnswers: number;
  blanks: number;
  bestRound: number;
}

interface IhjData {
  // Every letter this room will play, drawn once up front and never sent to a
  // client: knowing round four's letter during round one is a head start.
  letters: IhjLetter[];
  categories: IhjCategory[];
  totalRounds: number;
  roundIndex: number;
  answerSeconds: number;
  currentLetter?: string;
  // 'answering': userId -> their five answers, in category order. Private
  // until the round closes -- §7 is explicit that nobody sees another
  // player's answers before submitting their own.
  drafts?: Record<string, string[]>;
  submitted?: string[];
  // 'scoring' onward: userId -> the marked board for this round.
  board?: Record<string, IhjAnswer[]>;
  lastRoundScores?: Record<string, RoundScore>;
  // 'scoring': who has pressed Next. Scores are only final once everybody
  // has, which is what makes the marking a room decision rather than one
  // player's.
  continueUserIds?: string[];
  scores: Record<string, number>;
  uniqueCounts: Record<string, number>;
  sharedCounts: Record<string, number>;
  blankCounts: Record<string, number>;
  bestRoundScore: Record<string, number>;
  finalStats?: Record<string, FinalStats>;
  phaseEndsAt?: number;
  winnerUserIds?: string[];
}

interface IhjClientView {
  totalRounds: number;
  roundIndex: number;
  categories: Array<{ id: string; name: string }>;
  currentLetter?: string;
  // 'answering': only ever this viewer's own draft, plus how many players are
  // already in. Never anybody else's text.
  myDraft?: string[];
  mySubmitted?: boolean;
  submittedCount?: number;
  playerCount?: number;
  // 'scoring' onward: the whole board, which is public by then.
  board?: Record<string, IhjAnswer[]>;
  lastRoundScores?: Record<string, RoundScore>;
  continueUserIds?: string[];
  scores: Record<string, number>;
  finalStats?: Record<string, FinalStats>;
  phaseEndsAt?: number;
  winnerUserIds?: string[];
}

type IhjAction =
  // Sent as one batch rather than per box: game:action does a read-modify-
  // write against Redis, so several in flight at once can drop each other.
  | { type: 'submit'; answers: string[] }
  // A player striking one of their own answers on the scoring board, or
  // putting it back.
  | { type: 'mark'; index: number; valid: boolean }
  | { type: 'continue' }
  | { type: 'advance' };

function playableMembers(ctx: GameEngineContext): RoomMemberSummary[] {
  return ctx.members.filter((m) => !m.isHost);
}

function connectedPlayers(ctx: GameEngineContext): RoomMemberSummary[] {
  return playableMembers(ctx).filter((m) => m.connected);
}

function startRound(ctx: GameEngineContext, data: IhjData, roundIndex: number): GameEngineResult<IhjData> {
  if (roundIndex >= data.letters.length) return finish(data, roundIndex);
  const phaseEndsAt = Date.now() + data.answerSeconds * 1000;
  return {
    phase: 'answering',
    data: {
      ...data,
      roundIndex,
      currentLetter: data.letters[roundIndex].letter,
      drafts: {},
      submitted: [],
      board: undefined,
      lastRoundScores: undefined,
      continueUserIds: undefined,
      phaseEndsAt,
    },
    nextTickAt: phaseEndsAt,
  };
}

function finish(data: IhjData, roundIndex: number): GameEngineResult<IhjData> {
  const topScore = Math.max(0, ...Object.values(data.scores));
  const winnerUserIds = Object.entries(data.scores)
    .filter(([, score]) => score === topScore && topScore > 0)
    .map(([userId]) => userId);
  const finalStats: Record<string, FinalStats> = Object.fromEntries(
    Object.keys(data.scores).map((userId) => [
      userId,
      {
        uniqueAnswers: data.uniqueCounts[userId] ?? 0,
        sharedAnswers: data.sharedCounts[userId] ?? 0,
        blanks: data.blankCounts[userId] ?? 0,
        bestRound: data.bestRoundScore[userId] ?? 0,
      },
    ])
  );
  return {
    phase: 'finished',
    data: {
      ...data,
      roundIndex,
      currentLetter: undefined,
      drafts: undefined,
      submitted: undefined,
      board: undefined,
      continueUserIds: undefined,
      phaseEndsAt: undefined,
      winnerUserIds,
      finalStats,
    },
  };
}

// Closes the writing phase and builds the board. Every answer in a column is
// normalised (§9) and compared with every other, so "الإسكندرية" and
// "الاسكندريه" are one answer and both players get five rather than ten each.
function buildBoard(ctx: GameEngineContext, data: IhjData): GameEngineResult<IhjData> {
  const players = playableMembers(ctx);
  const drafts = data.drafts ?? {};
  const board: Record<string, IhjAnswer[]> = {};

  for (let col = 0; col < data.categories.length; col += 1) {
    // Who wrote what in this column, keyed by the normalised form.
    const byKey = new Map<string, string[]>();
    for (const member of players) {
      const text = (drafts[member.userId] ?? [])[col] ?? '';
      const key = normalizeAnswer(text);
      if (!key) continue;
      byKey.set(key, [...(byKey.get(key) ?? []), member.userId]);
    }
    for (const member of players) {
      const text = ((drafts[member.userId] ?? [])[col] ?? '').trim();
      const key = normalizeAnswer(text);
      const sharers = key ? (byKey.get(key) ?? []).filter((id) => id !== member.userId) : [];
      const answer: IhjAnswer = {
        text,
        verdict: !key ? 'blank' : sharers.length > 0 ? 'shared' : 'unique',
        sharedWith: sharers,
      };
      board[member.userId] = [...(board[member.userId] ?? []), answer];
    }
  }

  return { phase: 'scoring', data: { ...data, board, continueUserIds: [], phaseEndsAt: undefined } };
}

function maybeCloseAnswering(ctx: GameEngineContext, data: IhjData): GameEngineResult<IhjData> {
  const present = connectedPlayers(ctx);
  const submitted = data.submitted ?? [];
  const everyoneIn = present.length > 0 && present.every((m) => submitted.includes(m.userId));
  if (!everyoneIn) return { phase: 'answering', data, nextTickAt: data.phaseEndsAt };
  return buildBoard(ctx, data);
}

// What one marked answer is worth. A player's own strike beats the system's
// verdict; nothing else does.
function valueOf(answer: IhjAnswer): number {
  if (answer.ownedValid === false) return 0;
  if (answer.verdict === 'blank') return 0;
  return answer.verdict === 'unique' ? POINTS_UNIQUE : POINTS_SHARED;
}

function scoreRound(ctx: GameEngineContext, data: IhjData): GameEngineResult<IhjData> {
  const board = data.board ?? {};
  const scores = { ...data.scores };
  const uniqueCounts = { ...data.uniqueCounts };
  const sharedCounts = { ...data.sharedCounts };
  const blankCounts = { ...data.blankCounts };
  const bestRoundScore = { ...data.bestRoundScore };
  const lastRoundScores: Record<string, RoundScore> = {};

  for (const member of playableMembers(ctx)) {
    const answers = board[member.userId] ?? [];
    const perCategory = answers.map(valueOf);
    const total = perCategory.reduce((sum, n) => sum + n, 0);
    scores[member.userId] = (scores[member.userId] ?? 0) + total;
    bestRoundScore[member.userId] = Math.max(bestRoundScore[member.userId] ?? 0, total);
    for (const answer of answers) {
      if (answer.ownedValid === false || answer.verdict === 'blank') {
        blankCounts[member.userId] = (blankCounts[member.userId] ?? 0) + 1;
      } else if (answer.verdict === 'unique') {
        uniqueCounts[member.userId] = (uniqueCounts[member.userId] ?? 0) + 1;
      } else {
        sharedCounts[member.userId] = (sharedCounts[member.userId] ?? 0) + 1;
      }
    }
    lastRoundScores[member.userId] = { perCategory, total };
  }

  const phaseEndsAt = Date.now() + STANDINGS_SECONDS * 1000;
  return {
    phase: 'standings',
    data: { ...data, scores, uniqueCounts, sharedCounts, blankCounts, bestRoundScore, lastRoundScores, phaseEndsAt },
    nextTickAt: phaseEndsAt,
  };
}

function maybeCloseScoring(ctx: GameEngineContext, data: IhjData): GameEngineResult<IhjData> {
  const present = connectedPlayers(ctx);
  const continued = data.continueUserIds ?? [];
  const everyoneIn = present.length > 0 && present.every((m) => continued.includes(m.userId));
  if (!everyoneIn) return { phase: 'scoring', data };
  return scoreRound(ctx, data);
}

export const ihjEngine: GameEngine<IhjData, IhjAction> = {
  gameType: 'insan-hayawan-jamad',

  async loadConfig(code) {
    const stored = await getIhjRoomConfig(code);
    const config: IhjRoomConfig = stored ?? defaultIhjConfig();
    return { config, categories: resolveIhjCategories(config) };
  },

  createInitialState(ctx) {
    const loaded = ctx.config as { config: IhjRoomConfig; categories: IhjCategory[] } | undefined;
    const config = loaded?.config ?? defaultIhjConfig();
    const categories = loaded?.categories ?? [];
    const letters = drawLetters(config.rounds);
    const players = playableMembers(ctx);
    const zeroed = (): Record<string, number> => Object.fromEntries(players.map((m) => [m.userId, 0]));
    const phaseEndsAt = Date.now() + COUNTDOWN_SECONDS * 1000;
    return {
      phase: 'countdown',
      data: {
        letters,
        categories,
        totalRounds: letters.length,
        roundIndex: -1,
        answerSeconds: config.answerSeconds,
        scores: zeroed(),
        uniqueCounts: zeroed(),
        sharedCounts: zeroed(),
        blankCounts: zeroed(),
        bestRoundScore: zeroed(),
        phaseEndsAt,
      },
      nextTickAt: phaseEndsAt,
    };
  },

  applyAction(ctx, phase, data, userId, action) {
    const member = ctx.members.find((m) => m.userId === userId);
    if (!member) throw new GameActionError('NOT_A_MEMBER', 'You are not in this room.');

    if (action.type === 'advance') {
      if (!member.isHost) throw new GameActionError('NOT_HOST', 'Only the host can move the room on.');
      if (phase !== 'scoring') throw new GameActionError('INVALID_PHASE', 'There is nothing to move on from right now.');
      return scoreRound(ctx, data);
    }

    if (member.isHost) {
      throw new GameActionError('HOST_CANNOT_PLAY', 'The host runs the board -- you do not write answers.');
    }

    if (action.type === 'submit') {
      if (phase !== 'answering') throw new GameActionError('INVALID_PHASE', 'The round is not open.');
      if ((data.submitted ?? []).includes(userId)) {
        throw new GameActionError('ALREADY_ANSWERED', 'Your answers are already in.');
      }
      // Trimmed to the number of categories and padded out, so a short or a
      // long array from an old client still lines up with the board.
      const answers = data.categories.map((_, i) => String((action.answers ?? [])[i] ?? '').slice(0, 60));
      const drafts = { ...(data.drafts ?? {}), [userId]: answers };
      const submitted = [...(data.submitted ?? []), userId];
      return maybeCloseAnswering(ctx, { ...data, drafts, submitted });
    }

    if (action.type === 'mark') {
      if (phase !== 'scoring') throw new GameActionError('INVALID_PHASE', 'There is nothing to mark right now.');
      const mine = (data.board ?? {})[userId];
      if (!mine) throw new GameActionError('INVALID_ACTION', 'You have no answers on this board.');
      const row = mine[action.index];
      if (!row) throw new GameActionError('INVALID_ACTION', 'That answer is not on the board.');
      // A blank is not a judgement call -- there is nothing there to argue
      // about, and letting it be marked valid would be a way to score ten for
      // an empty box.
      if (row.verdict === 'blank') throw new GameActionError('INVALID_ACTION', 'That box was empty.');
      const updated = [...mine];
      updated[action.index] = { ...row, ownedValid: action.valid };
      return { phase, data: { ...data, board: { ...(data.board ?? {}), [userId]: updated } } };
    }

    if (action.type === 'continue') {
      if (phase !== 'scoring') throw new GameActionError('INVALID_PHASE', 'There is nothing to continue from right now.');
      const continued = data.continueUserIds ?? [];
      if (continued.includes(userId)) return { phase, data };
      return maybeCloseScoring(ctx, { ...data, continueUserIds: [...continued, userId] });
    }

    throw new GameActionError('INVALID_ACTION', 'Unknown action.');
  },

  tick(ctx, phase, data) {
    if (phase === 'countdown') return startRound(ctx, data, 0);
    // The clock running out submits whatever is in the boxes, which is §7's
    // automatic submission: a player who typed four answers and ran out of
    // time keeps those four.
    if (phase === 'answering') return buildBoard(ctx, data);
    if (phase === 'standings') return startRound(ctx, data, data.roundIndex + 1);
    return { phase, data };
  },

  // Writing and marking both end when everyone present has acted, so both
  // have to be looked at again when who is present changes -- §13's "never
  // blocked waiting indefinitely for one player".
  onPresenceChange(ctx, phase, data) {
    if (phase === 'answering') return maybeCloseAnswering(ctx, data);
    if (phase === 'scoring') return maybeCloseScoring(ctx, data);
    return { phase, data };
  },

  async cleanup(code) {
    await clearIhjRoomConfig(code);
  },

  toClientView(ctx, phase, data, viewerUserId): IhjClientView {
    const view: IhjClientView = {
      totalRounds: data.totalRounds,
      roundIndex: data.roundIndex,
      categories: data.categories.map((c) => ({ id: c.id, name: c.name })),
      currentLetter: data.currentLetter,
      lastRoundScores: data.lastRoundScores,
      scores: data.scores,
      finalStats: data.finalStats,
      phaseEndsAt: data.phaseEndsAt,
      winnerUserIds: data.winnerUserIds,
      playerCount: playableMembers(ctx).length,
    };

    if (phase === 'answering') {
      // The one secret this game has, and it lasts sixty seconds: what other
      // people are typing. A viewer gets their own draft back (so a
      // reconnecting phone is not empty) and a count of who is done.
      view.myDraft = (data.drafts ?? {})[viewerUserId];
      view.mySubmitted = (data.submitted ?? []).includes(viewerUserId);
      view.submittedCount = (data.submitted ?? []).length;
    }

    if (phase === 'scoring' || phase === 'standings') {
      view.board = data.board;
      view.continueUserIds = data.continueUserIds;
    }

    return view;
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
