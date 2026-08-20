import type { RoomMemberSummary } from '@bahjah/shared';
import { GameActionError, type GameEngine, type GameEngineContext, type GameEngineResult } from '../engine';
import {
  clearKnowsYouBestRoomConfig,
  defaultKnowsYouBestConfig,
  getKnowsYouBestRoomConfig,
  resolveKnowsYouBestPool,
  type KnowsYouBestRoomConfig,
} from './config';
import type { KnowsYouBestPrompt } from './promptBank';

const ANSWER_SECONDS = 45;
const GUESS_SECONDS = 40;
const REVEAL_SECONDS = 8;
const POINTS_PER_CORRECT_GUESS = 100;
const PERFECT_ROUND_BONUS = 100;
const FAST_GUESS_BONUS = 25;

interface RoundScore {
  correctCount: number;
  need: number;
  base: number;
  perfectBonus: number;
  fastBonus: number;
  total: number;
}

interface FinalStats {
  totalCorrect: number;
  perfectRounds: number;
  accuracyPct: number;
  topGuesser: { userId: string; count: number } | null;
}

interface KnowsYouBestData {
  // Full resolved prompts for this room's playthrough, decided once at
  // createInitialState -- not looked up by id from the global bank later,
  // since that cache doesn't include this room's custom prompts (mirrors
  // trivia's TriviaData.questions for the same reason).
  prompts: KnowsYouBestPrompt[];
  totalRounds: number;
  roundIndex: number;
  // Baked in once at start from the room's config -- unlike trivia/mafia
  // this is a per-room choice, not a fixed-per-game-type constant, and
  // ctx.config is only ever populated at createInitialState time (see
  // rooms/socket.ts), so every later phase reads this instead of re-asking
  // the config store.
  hostPlays: boolean;
  currentPrompt?: { id: string; category: string; text: string; textAr?: string };
  phaseEndsAt?: number;
  // 'answering': userId -> their private answer text. Never sent to
  // clients as-is (see toClientView) until the round moves past guessing.
  answers?: Record<string, string>;
  // 'guessing': the display order for this round, generated once when
  // answering resolves. Index in this array is the only identifier clients
  // see for an answer until reveal.
  shuffledAuthorOrder?: string[];
  // 'guessing': guesserUserId -> { answerIndex(as string) -> guessedUserId }
  guesses?: Record<string, Record<string, string>>;
  // 'guessing': guesserUserId -> epoch ms of the action that completed
  // their full set of guesses, used for the fast-submission bonus.
  guessCompletedAt?: Record<string, number>;
  lastRoundScores?: Record<string, RoundScore>;
  lastRoundReveal?: Array<{ authorUserId: string; text: string }>;
  scores: Record<string, number>;
  // Cumulative across the whole game, for final results (doc: total
  // correct matches, perfect rounds, accuracy%, "who guessed you correctly
  // the most").
  correctGuessTotal: Record<string, number>;
  guessesMadeTotal: Record<string, number>;
  perfectRoundCount: Record<string, number>;
  // authorUserId -> guesserUserId -> how many times that guesser correctly
  // identified this author's answer, accumulated every round.
  guessedMeCorrectlyBy: Record<string, Record<string, number>>;
  // Computed once, only present once phase === 'finished'.
  finalStats?: Record<string, FinalStats>;
  winnerUserIds?: string[];
}

// Guesses are submitted as one atomic batch (the whole matching board at
// once), not one action per connection -- game:action calls do a
// read-modify-write against Redis (see rooms/socket.ts), so firing several
// in quick succession from the same client races: a later call can read
// state saved before an earlier call's write lands, silently dropping it.
// A single 'guessAll' action per submit sidesteps that entirely.
type KnowsYouBestAction = { type: 'answer'; text: string } | { type: 'guessAll'; guesses: Record<string, string> };

interface KnowsYouBestClientView {
  totalRounds: number;
  roundIndex: number;
  hostPlays: boolean;
  currentPrompt?: { id: string; category: string; text: string; textAr?: string };
  phaseEndsAt?: number;
  scores: Record<string, number>;
  lastRoundScores?: Record<string, RoundScore>;
  lastRoundReveal?: Array<{ authorUserId: string; text: string }>;
  winnerUserIds?: string[];
  finalStats?: Record<string, FinalStats>;
  // 'answering'
  myAnswered?: boolean;
  myAnswerText?: string;
  answeredCount?: number;
  // Who has submitted, so the TV can light one chip per finished player
  // instead of only a count. Deliberately ids only -- never the answer text,
  // which stays private until the guessing phase shuffles it.
  answeredUserIds?: string[];
  // 'guessing'
  answers?: Array<{ index: number; text: string }>;
  // The set of players who actually answered this round, in a *separate*
  // shuffle from `answers` above -- so the client can render exactly one
  // name chip per answer (no orphaned chip for someone who stayed silent)
  // without the two arrays' shared index order leaking who wrote what.
  authorIds?: string[];
  myAnswerIndex?: number;
  myGuesses?: Record<string, string>;
  guessedCount?: number;
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function pickPrompts(pool: KnowsYouBestPrompt[], count: number): KnowsYouBestPrompt[] {
  return shuffle(pool).slice(0, Math.min(count, pool.length));
}

// The host is a spectator/monitor by default in this game ("does not
// participate unless they choose to join") -- unlike trivia (always
// excluded) or mafia (always included), whether to filter the host out is
// a per-room choice baked into data.hostPlays at start.
function playableMembers(members: RoomMemberSummary[], hostPlays: boolean): RoomMemberSummary[] {
  return hostPlays ? members : members.filter((m) => !m.isHost);
}

function startRound(data: KnowsYouBestData, roundIndex: number): GameEngineResult<KnowsYouBestData> {
  if (roundIndex >= data.prompts.length) {
    const topScore = Math.max(0, ...Object.values(data.scores));
    const winnerUserIds = Object.entries(data.scores)
      .filter(([, score]) => score === topScore && topScore > 0)
      .map(([userId]) => userId);

    const finalStats: Record<string, FinalStats> = Object.fromEntries(
      Object.keys(data.scores).map((userId) => {
        const totalCorrect = data.correctGuessTotal[userId] ?? 0;
        const guessesMade = data.guessesMadeTotal[userId] ?? 0;
        const perfectRounds = data.perfectRoundCount[userId] ?? 0;
        const accuracyPct = guessesMade > 0 ? Math.round((100 * totalCorrect) / guessesMade) : 0;
        const guessers = data.guessedMeCorrectlyBy[userId] ?? {};
        let topGuesser: { userId: string; count: number } | null = null;
        for (const [guesserId, count] of Object.entries(guessers)) {
          if (!topGuesser || count > topGuesser.count) topGuesser = { userId: guesserId, count };
        }
        return [userId, { totalCorrect, perfectRounds, accuracyPct, topGuesser }];
      })
    );

    return {
      phase: 'finished',
      data: {
        ...data,
        roundIndex,
        currentPrompt: undefined,
        answers: undefined,
        shuffledAuthorOrder: undefined,
        guesses: undefined,
        guessCompletedAt: undefined,
        lastRoundScores: undefined,
        lastRoundReveal: undefined,
        phaseEndsAt: undefined,
        winnerUserIds,
        finalStats,
      },
    };
  }

  const prompt = data.prompts[roundIndex];
  const phaseEndsAt = Date.now() + ANSWER_SECONDS * 1000;
  return {
    phase: 'answering',
    data: {
      ...data,
      roundIndex,
      currentPrompt: { id: prompt.id, category: prompt.category, text: prompt.text, textAr: prompt.textAr },
      answers: {},
      shuffledAuthorOrder: undefined,
      guesses: undefined,
      guessCompletedAt: undefined,
      lastRoundScores: undefined,
      lastRoundReveal: undefined,
      phaseEndsAt,
    },
    nextTickAt: phaseEndsAt,
  };
}

function resolveAnswering(ctx: GameEngineContext, data: KnowsYouBestData): GameEngineResult<KnowsYouBestData> {
  const answers = data.answers ?? {};
  const players = playableMembers(ctx.members, data.hostPlays);
  // Only players who actually answered get included -- silence isn't
  // penalized beyond not being guessable.
  const authorsWithAnswers = players.map((m) => m.userId).filter((userId) => typeof answers[userId] === 'string');
  const shuffledAuthorOrder = shuffle(authorsWithAnswers);

  const phaseEndsAt = Date.now() + GUESS_SECONDS * 1000;
  return {
    phase: 'guessing',
    data: { ...data, shuffledAuthorOrder, guesses: {}, guessCompletedAt: {}, phaseEndsAt },
    nextTickAt: phaseEndsAt,
  };
}

function resolveGuessing(ctx: GameEngineContext, data: KnowsYouBestData): GameEngineResult<KnowsYouBestData> {
  const order = data.shuffledAuthorOrder ?? [];
  const answers = data.answers ?? {};
  const guesses = data.guesses ?? {};
  const guessCompletedAt = data.guessCompletedAt ?? {};
  const scores = { ...data.scores };
  const correctGuessTotal = { ...data.correctGuessTotal };
  const guessesMadeTotal = { ...data.guessesMadeTotal };
  const perfectRoundCount = { ...data.perfectRoundCount };
  const guessedMeCorrectlyBy: Record<string, Record<string, number>> = Object.fromEntries(
    Object.entries(data.guessedMeCorrectlyBy).map(([authorId, guessers]) => [authorId, { ...guessers }])
  );
  const lastRoundScores: Record<string, RoundScore> = {};
  const guessWindowMs = GUESS_SECONDS * 1000;

  for (const guesserId of Object.keys(guesses)) {
    const mine = guesses[guesserId];
    const need = order.filter((authorId) => authorId !== guesserId).length;
    let correct = 0;
    for (const [indexStr, guessedUserId] of Object.entries(mine)) {
      const trueAuthor = order[Number(indexStr)];
      if (trueAuthor && trueAuthor !== guesserId && guessedUserId === trueAuthor) {
        correct++;
        guessedMeCorrectlyBy[trueAuthor] = guessedMeCorrectlyBy[trueAuthor] ?? {};
        guessedMeCorrectlyBy[trueAuthor][guesserId] = (guessedMeCorrectlyBy[trueAuthor][guesserId] ?? 0) + 1;
      }
    }

    guessesMadeTotal[guesserId] = (guessesMadeTotal[guesserId] ?? 0) + Object.keys(mine).length;
    correctGuessTotal[guesserId] = (correctGuessTotal[guesserId] ?? 0) + correct;

    const base = correct * POINTS_PER_CORRECT_GUESS;
    const isPerfect = need > 0 && correct === need;
    const perfectBonus = isPerfect ? PERFECT_ROUND_BONUS : 0;
    if (isPerfect) perfectRoundCount[guesserId] = (perfectRoundCount[guesserId] ?? 0) + 1;

    const completedAt = guessCompletedAt[guesserId];
    const remainingFraction = completedAt && data.phaseEndsAt ? clamp01((data.phaseEndsAt - completedAt) / guessWindowMs) : 0;
    const fastBonus = correct > 0 && remainingFraction > 0.5 ? FAST_GUESS_BONUS : 0;

    const total = base + perfectBonus + fastBonus;
    if (total > 0) {
      scores[guesserId] = (scores[guesserId] ?? 0) + total;
    }
    lastRoundScores[guesserId] = { correctCount: correct, need, base, perfectBonus, fastBonus, total };
  }

  const lastRoundReveal = order.map((authorUserId) => ({ authorUserId, text: answers[authorUserId] ?? '' }));

  const phaseEndsAt = Date.now() + REVEAL_SECONDS * 1000;
  return {
    phase: 'reveal',
    data: {
      ...data,
      lastRoundScores,
      lastRoundReveal,
      scores,
      correctGuessTotal,
      guessesMadeTotal,
      perfectRoundCount,
      guessedMeCorrectlyBy,
      phaseEndsAt,
    },
    nextTickAt: phaseEndsAt,
  };
}

function maybeResolveAnswering(ctx: GameEngineContext, data: KnowsYouBestData): GameEngineResult<KnowsYouBestData> {
  const answers = data.answers ?? {};
  const players = playableMembers(ctx.members, data.hostPlays);
  if (players.every((m) => typeof answers[m.userId] === 'string')) {
    return resolveAnswering(ctx, data);
  }
  return { phase: 'answering', data, nextTickAt: data.phaseEndsAt };
}

function maybeResolveGuessing(ctx: GameEngineContext, data: KnowsYouBestData): GameEngineResult<KnowsYouBestData> {
  const order = data.shuffledAuthorOrder ?? [];
  const guesses = data.guesses ?? {};
  const players = playableMembers(ctx.members, data.hostPlays);
  const everyoneDone = players.every((m) => {
    const need = order.filter((authorId) => authorId !== m.userId).length;
    return Object.keys(guesses[m.userId] ?? {}).length >= need;
  });
  if (everyoneDone) return resolveGuessing(ctx, data);
  return { phase: 'guessing', data, nextTickAt: data.phaseEndsAt };
}

export const knowsYouBestEngine: GameEngine<KnowsYouBestData, KnowsYouBestAction> = {
  gameType: 'knows-you-best',

  async loadConfig(code) {
    const stored = await getKnowsYouBestRoomConfig(code);
    const config: KnowsYouBestRoomConfig = stored ?? defaultKnowsYouBestConfig();
    const pool = await resolveKnowsYouBestPool(code, config);
    return { config, pool };
  },

  createInitialState(ctx) {
    const loaded = ctx.config as { config: KnowsYouBestRoomConfig; pool: KnowsYouBestPrompt[] } | undefined;
    const config = loaded?.config ?? defaultKnowsYouBestConfig();
    const pool = loaded?.pool ?? [];
    const prompts = pickPrompts(pool, config.totalRounds);
    const players = playableMembers(ctx.members, config.hostPlays);
    const initial: KnowsYouBestData = {
      prompts,
      totalRounds: prompts.length,
      roundIndex: -1,
      hostPlays: config.hostPlays,
      scores: Object.fromEntries(players.map((m) => [m.userId, 0])),
      correctGuessTotal: Object.fromEntries(players.map((m) => [m.userId, 0])),
      guessesMadeTotal: Object.fromEntries(players.map((m) => [m.userId, 0])),
      perfectRoundCount: Object.fromEntries(players.map((m) => [m.userId, 0])),
      guessedMeCorrectlyBy: Object.fromEntries(players.map((m) => [m.userId, {}])),
    };
    return startRound(initial, 0);
  },

  applyAction(ctx, phase, data, userId, action) {
    const member = ctx.members.find((m) => m.userId === userId);
    if (member?.isHost && !data.hostPlays) {
      throw new GameActionError('HOST_CANNOT_PLAY', 'The host is spectating this game -- turn on "I want to play too" in the lobby before starting to join in.');
    }

    if (phase === 'answering') {
      if (!action || action.type !== 'answer') throw new GameActionError('INVALID_ACTION', 'Unrecognized action.');
      const text = action.text?.trim();
      if (!text) throw new GameActionError('INVALID_ACTION', 'Answer cannot be empty.');
      if (text.length > 280) throw new GameActionError('INVALID_ACTION', 'Answer is too long.');
      if (data.answers?.[userId] !== undefined) throw new GameActionError('ALREADY_ACTED', "You've already answered this round.");
      return maybeResolveAnswering(ctx, { ...data, answers: { ...data.answers, [userId]: text } });
    }

    if (phase === 'guessing') {
      if (!action || action.type !== 'guessAll' || !action.guesses || typeof action.guesses !== 'object') {
        throw new GameActionError('INVALID_ACTION', 'Unrecognized action.');
      }
      const order = data.shuffledAuthorOrder ?? [];
      const validTargets = playableMembers(ctx.members, data.hostPlays);
      const entries = Object.entries(action.guesses);
      for (const [indexStr, guessedUserId] of entries) {
        const answerIndex = Number(indexStr);
        if (!Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex >= order.length) {
          throw new GameActionError('INVALID_TARGET', 'Invalid answer index.');
        }
        if (order[answerIndex] === userId) {
          throw new GameActionError('INVALID_TARGET', "You can't guess on your own answer.");
        }
        if (!validTargets.some((m) => m.userId === guessedUserId)) {
          throw new GameActionError('INVALID_TARGET', 'Invalid guess target.');
        }
      }

      const mine = data.guesses?.[userId] ?? {};
      const need = order.filter((authorId) => authorId !== userId).length;
      const wasComplete = Object.keys(mine).length >= need;
      const nextMine = { ...mine, ...action.guesses };
      const nowComplete = Object.keys(nextMine).length >= need;
      const guessCompletedAt = data.guessCompletedAt ?? {};
      const nextGuessCompletedAt = !wasComplete && nowComplete ? { ...guessCompletedAt, [userId]: Date.now() } : guessCompletedAt;
      const nextGuesses = { ...data.guesses, [userId]: nextMine };
      return maybeResolveGuessing(ctx, { ...data, guesses: nextGuesses, guessCompletedAt: nextGuessCompletedAt });
    }

    throw new GameActionError('INVALID_PHASE', 'No actions are accepted right now.');
  },

  tick(ctx, phase, data) {
    if (phase === 'answering') return resolveAnswering(ctx, data);
    if (phase === 'guessing') return resolveGuessing(ctx, data);
    if (phase === 'reveal') return startRound(data, data.roundIndex + 1);
    return { phase, data };
  },

  async cleanup(code) {
    await clearKnowsYouBestRoomConfig(code);
  },

  toClientView(ctx, phase, data, viewerUserId): KnowsYouBestClientView {
    const view: KnowsYouBestClientView = {
      totalRounds: data.totalRounds,
      roundIndex: data.roundIndex,
      hostPlays: data.hostPlays,
      currentPrompt: data.currentPrompt,
      phaseEndsAt: data.phaseEndsAt,
      scores: data.scores,
      lastRoundScores: data.lastRoundScores,
      lastRoundReveal: data.lastRoundReveal,
      winnerUserIds: data.winnerUserIds,
      finalStats: data.finalStats,
    };

    if (phase === 'answering') {
      const answers = data.answers ?? {};
      view.myAnswered = typeof answers[viewerUserId] === 'string';
      view.myAnswerText = answers[viewerUserId];
      view.answeredCount = Object.keys(answers).length;
      view.answeredUserIds = Object.keys(answers).filter((id) => typeof answers[id] === 'string');
    }

    if (phase === 'guessing') {
      const order = data.shuffledAuthorOrder ?? [];
      const answers = data.answers ?? {};
      view.answers = order.map((authorId, index) => ({ index, text: answers[authorId] ?? '' }));
      view.authorIds = shuffle(order);
      const myIndex = order.indexOf(viewerUserId);
      if (myIndex >= 0) view.myAnswerIndex = myIndex;
      view.myGuesses = data.guesses?.[viewerUserId] ?? {};
      const guesses = data.guesses ?? {};
      view.guessedCount = Object.keys(guesses).filter((guesserId) => {
        const need = order.filter((authorId) => authorId !== guesserId).length;
        return Object.keys(guesses[guesserId] ?? {}).length >= need;
      }).length;
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
