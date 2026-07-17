import type { RoomMemberSummary } from '@bahjah/shared';
import { GameActionError, type GameEngine, type GameEngineContext, type GameEngineResult } from '../engine';
import { clearTriviaRoomConfig, defaultTriviaConfig, getTriviaRoomConfig, resolveTriviaPool, type TriviaRoomConfig } from './config';
import type { TriviaQuestion } from './questionBank';

const QUESTION_SECONDS = 15;
const REVEAL_SECONDS = 6;
const COUNTDOWN_SECONDS = 3;
const TOTAL_ROUNDS = 10;

const POINTS_CORRECT = 100;
const MAX_SPEED_BONUS = 50;
const STREAK_BONUS_PER_STEP = 10;
const MAX_STREAK_BONUS = 50;

interface TriviaPublicQuestion {
  id: string;
  category: string;
  prompt: string;
  promptAr?: string;
  choices: string[];
  choicesAr?: string[];
}

interface RoundScore {
  correct: boolean;
  base: number;
  speedBonus: number;
  streakBonus: number;
  total: number;
  streak: number;
}

interface PendingAnswer {
  choiceIndex: number;
  answeredAt: number;
}

interface FinalStats {
  correctCount: number;
  speedPct: number;
}

interface TriviaData {
  // Full resolved questions (including correctIndex) for this room's
  // playthrough, decided once at createInitialState so every later phase
  // is self-contained -- no re-reading the global bank or room config by
  // id, which matters once custom (per-room) questions are in the mix.
  questions: TriviaQuestion[];
  totalRounds: number;
  roundIndex: number;
  currentQuestion?: TriviaPublicQuestion;
  correctIndex?: number;
  // userId -> answer, only present (and only sent to clients) during the
  // 'question' phase, cleared once the round resolves.
  pendingAnswers?: Record<string, PendingAnswer>;
  lastRoundScores?: Record<string, RoundScore>;
  scores: Record<string, number>;
  streaks: Record<string, number>;
  // Cumulative across the whole game, for the finished-phase personal stats
  // (doc: "Correct: 18/20", speed percentage). correctCounts/answeredRoundsCount
  // are keyed by userId; speedFractionSum sums the same 0..1 "how much time was
  // left when they answered" fraction already used for the speed bonus, over
  // every round they answered (correct or not) -- see resolveRound.
  correctCounts: Record<string, number>;
  answeredRoundsCount: Record<string, number>;
  speedFractionSum: Record<string, number>;
  // Computed once, only present once phase === 'finished'.
  finalStats?: Record<string, FinalStats>;
  phaseEndsAt?: number;
  questionStartedAt?: number;
  winnerUserIds?: string[];
}

interface TriviaAnswerAction {
  type: 'answer';
  choiceIndex: number;
}

function toPublicQuestion(question: TriviaQuestion): TriviaPublicQuestion {
  return {
    id: question.id,
    category: question.category,
    prompt: question.prompt,
    promptAr: question.promptAr,
    choices: question.choices,
    choicesAr: question.choicesAr,
  };
}

function pickQuestions(pool: TriviaQuestion[], count: number): TriviaQuestion[] {
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, pool.length));
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

// The host creates/monitors/controls trivia but never plays -- everywhere
// gameplay is scored/counted/answered, only real players should be
// considered. ctx.members still includes the host (correct for the lobby
// roster), so every scoring/threshold/seeding site filters through this.
function playableMembers(ctx: GameEngineContext): RoomMemberSummary[] {
  return ctx.members.filter((m) => !m.isHost);
}

function startRound(data: TriviaData, roundIndex: number): GameEngineResult<TriviaData> {
  if (roundIndex >= data.questions.length) {
    const topScore = Math.max(0, ...Object.values(data.scores));
    const winnerUserIds = Object.entries(data.scores)
      .filter(([, score]) => score === topScore && topScore > 0)
      .map(([userId]) => userId);
    const finalStats: Record<string, FinalStats> = Object.fromEntries(
      Object.keys(data.scores).map((userId) => {
        const answered = data.answeredRoundsCount[userId] ?? 0;
        const speedPct = answered > 0 ? Math.round((100 * (data.speedFractionSum[userId] ?? 0)) / answered) : 0;
        return [userId, { correctCount: data.correctCounts[userId] ?? 0, speedPct }];
      })
    );
    return {
      phase: 'finished',
      data: {
        ...data,
        roundIndex,
        currentQuestion: undefined,
        correctIndex: undefined,
        pendingAnswers: undefined,
        lastRoundScores: undefined,
        phaseEndsAt: undefined,
        questionStartedAt: undefined,
        winnerUserIds,
        finalStats,
      },
    };
  }

  const question = data.questions[roundIndex];
  const now = Date.now();
  const phaseEndsAt = now + QUESTION_SECONDS * 1000;
  return {
    phase: 'question',
    data: {
      ...data,
      roundIndex,
      currentQuestion: toPublicQuestion(question),
      correctIndex: undefined,
      pendingAnswers: {},
      lastRoundScores: undefined,
      phaseEndsAt,
      questionStartedAt: now,
    },
    nextTickAt: phaseEndsAt,
  };
}

function resolveRound(ctx: GameEngineContext, data: TriviaData): GameEngineResult<TriviaData> {
  const question = data.questions[data.roundIndex];
  const pendingAnswers = data.pendingAnswers ?? {};
  const scores = { ...data.scores };
  const streaks = { ...data.streaks };
  const correctCounts = { ...data.correctCounts };
  const answeredRoundsCount = { ...data.answeredRoundsCount };
  const speedFractionSum = { ...data.speedFractionSum };
  const lastRoundScores: Record<string, RoundScore> = {};
  const questionMs = QUESTION_SECONDS * 1000;
  const phaseEndsAt = data.phaseEndsAt ?? Date.now();

  for (const member of playableMembers(ctx)) {
    const answer = pendingAnswers[member.userId];
    const isCorrect = Boolean(question && answer && answer.choiceIndex === question.correctIndex);

    if (answer) {
      const remainingFraction = clamp01((phaseEndsAt - answer.answeredAt) / questionMs);
      answeredRoundsCount[member.userId] = (answeredRoundsCount[member.userId] ?? 0) + 1;
      speedFractionSum[member.userId] = (speedFractionSum[member.userId] ?? 0) + remainingFraction;

      if (isCorrect) {
        const speedBonus = Math.round(MAX_SPEED_BONUS * remainingFraction);
        const nextStreak = (streaks[member.userId] ?? 0) + 1;
        streaks[member.userId] = nextStreak;
        const streakBonus = Math.min(MAX_STREAK_BONUS, STREAK_BONUS_PER_STEP * (nextStreak - 1));
        const total = POINTS_CORRECT + speedBonus + streakBonus;

        scores[member.userId] = (scores[member.userId] ?? 0) + total;
        correctCounts[member.userId] = (correctCounts[member.userId] ?? 0) + 1;
        lastRoundScores[member.userId] = { correct: true, base: POINTS_CORRECT, speedBonus, streakBonus, total, streak: nextStreak };
        continue;
      }
    }

    streaks[member.userId] = 0;
    lastRoundScores[member.userId] = { correct: false, base: 0, speedBonus: 0, streakBonus: 0, total: 0, streak: 0 };
  }

  const revealEndsAt = Date.now() + REVEAL_SECONDS * 1000;
  return {
    phase: 'reveal',
    data: {
      ...data,
      correctIndex: question?.correctIndex,
      pendingAnswers: undefined,
      lastRoundScores,
      scores,
      correctCounts,
      answeredRoundsCount,
      speedFractionSum,
      streaks,
      phaseEndsAt: revealEndsAt,
      questionStartedAt: undefined,
    },
    nextTickAt: revealEndsAt,
  };
}

export const triviaEngine: GameEngine<TriviaData, TriviaAnswerAction> = {
  gameType: 'trivia',

  async loadConfig(code) {
    const stored = await getTriviaRoomConfig(code);
    const config: TriviaRoomConfig = stored ?? defaultTriviaConfig();
    const pool = await resolveTriviaPool(code, config);
    return { config, pool };
  },

  createInitialState(ctx) {
    const loaded = ctx.config as { config: TriviaRoomConfig; pool: TriviaQuestion[] } | undefined;
    const pool = loaded?.pool ?? [];
    const questions = pickQuestions(pool, TOTAL_ROUNDS);
    const players = playableMembers(ctx);
    const initial: TriviaData = {
      questions,
      totalRounds: questions.length,
      roundIndex: -1,
      scores: Object.fromEntries(players.map((m) => [m.userId, 0])),
      streaks: Object.fromEntries(players.map((m) => [m.userId, 0])),
      correctCounts: Object.fromEntries(players.map((m) => [m.userId, 0])),
      answeredRoundsCount: Object.fromEntries(players.map((m) => [m.userId, 0])),
      speedFractionSum: Object.fromEntries(players.map((m) => [m.userId, 0])),
    };
    const phaseEndsAt = Date.now() + COUNTDOWN_SECONDS * 1000;
    return { phase: 'countdown', data: { ...initial, phaseEndsAt }, nextTickAt: phaseEndsAt };
  },

  applyAction(ctx, phase, data, userId, action) {
    const member = ctx.members.find((m) => m.userId === userId);
    if (member?.isHost) {
      throw new GameActionError('HOST_CANNOT_PLAY', 'The host does not answer questions -- you are monitoring this round.');
    }
    if (phase !== 'question') {
      throw new GameActionError('INVALID_PHASE', 'No question is open for answers right now.');
    }
    if (!action || action.type !== 'answer') {
      throw new GameActionError('INVALID_ACTION', 'Unrecognized trivia action.');
    }
    const question = data.currentQuestion;
    const { choiceIndex } = action;
    if (!question || typeof choiceIndex !== 'number' || choiceIndex < 0 || choiceIndex >= question.choices.length) {
      throw new GameActionError('INVALID_ACTION', 'Invalid answer choice.');
    }
    const pendingAnswers = data.pendingAnswers ?? {};
    if (pendingAnswers[userId] !== undefined) {
      throw new GameActionError('ALREADY_ANSWERED', "You've already answered this question.");
    }

    const nextPending = { ...pendingAnswers, [userId]: { choiceIndex, answeredAt: Date.now() } };
    if (Object.keys(nextPending).length >= playableMembers(ctx).length) {
      return resolveRound(ctx, { ...data, pendingAnswers: nextPending });
    }

    return { phase, data: { ...data, pendingAnswers: nextPending }, nextTickAt: data.phaseEndsAt };
  },

  tick(ctx, phase, data) {
    if (phase === 'countdown') return startRound(data, 0);
    if (phase === 'question') return resolveRound(ctx, data);
    if (phase === 'reveal') return startRound(data, data.roundIndex + 1);
    return { phase, data };
  },

  async cleanup(code) {
    await clearTriviaRoomConfig(code);
  },
};
