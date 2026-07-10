import { GameActionError, type GameEngine, type GameEngineContext, type GameEngineResult } from '../engine';
import { getQuestionBankSync, type TriviaQuestion } from './questionBank';

const QUESTION_SECONDS = 15;
const REVEAL_SECONDS = 6;
const TOTAL_ROUNDS = 8;
const POINTS_CORRECT = 100;

interface TriviaPublicQuestion {
  id: string;
  category: string;
  prompt: string;
  choices: string[];
}

interface TriviaData {
  questionIds: string[];
  totalRounds: number;
  roundIndex: number;
  currentQuestion?: TriviaPublicQuestion;
  correctIndex?: number;
  // userId -> choiceIndex, only present (and only sent to clients) during
  // the 'question' phase, cleared once the round resolves. See the Phase 4
  // summary for the known limitation this implies (see project notes).
  pendingAnswers?: Record<string, number>;
  lastRoundScores?: Record<string, number>;
  scores: Record<string, number>;
  phaseEndsAt?: number;
}

interface TriviaAnswerAction {
  type: 'answer';
  choiceIndex: number;
}

function toPublicQuestion(question: TriviaQuestion): TriviaPublicQuestion {
  return { id: question.id, category: question.category, prompt: question.prompt, choices: question.choices };
}

function pickQuestions(count: number): TriviaQuestion[] {
  const bank = getQuestionBankSync();
  const shuffled = [...bank].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, bank.length));
}

function startRound(data: TriviaData, roundIndex: number): GameEngineResult<TriviaData> {
  if (roundIndex >= data.questionIds.length) {
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
      },
    };
  }

  const bank = getQuestionBankSync();
  const question = bank.find((q) => q.id === data.questionIds[roundIndex]);
  if (!question) {
    // Shouldn't happen (ids come from the same bank snapshot), but degrade
    // gracefully rather than crash the room.
    return startRound(data, roundIndex + 1);
  }

  const phaseEndsAt = Date.now() + QUESTION_SECONDS * 1000;
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
    },
    nextTickAt: phaseEndsAt,
  };
}

function resolveRound(ctx: GameEngineContext, data: TriviaData): GameEngineResult<TriviaData> {
  const bank = getQuestionBankSync();
  const question = bank.find((q) => q.id === data.questionIds[data.roundIndex]);
  const pendingAnswers = data.pendingAnswers ?? {};
  const scores = { ...data.scores };
  const lastRoundScores: Record<string, number> = {};

  if (question) {
    for (const member of ctx.members) {
      if (pendingAnswers[member.userId] === question.correctIndex) {
        lastRoundScores[member.userId] = POINTS_CORRECT;
        scores[member.userId] = (scores[member.userId] ?? 0) + POINTS_CORRECT;
      }
    }
  }

  const phaseEndsAt = Date.now() + REVEAL_SECONDS * 1000;
  return {
    phase: 'reveal',
    data: {
      ...data,
      correctIndex: question?.correctIndex,
      pendingAnswers: undefined,
      lastRoundScores,
      scores,
      phaseEndsAt,
    },
    nextTickAt: phaseEndsAt,
  };
}

export const triviaEngine: GameEngine<TriviaData, TriviaAnswerAction> = {
  gameType: 'trivia',

  createInitialState(ctx) {
    const questions = pickQuestions(TOTAL_ROUNDS);
    const initial: TriviaData = {
      questionIds: questions.map((q) => q.id),
      totalRounds: questions.length,
      roundIndex: -1,
      scores: Object.fromEntries(ctx.members.map((m) => [m.userId, 0])),
    };
    return startRound(initial, 0);
  },

  applyAction(ctx, phase, data, userId, action) {
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

    const nextPending = { ...pendingAnswers, [userId]: choiceIndex };
    if (Object.keys(nextPending).length >= ctx.members.length) {
      return resolveRound(ctx, { ...data, pendingAnswers: nextPending });
    }

    return { phase, data: { ...data, pendingAnswers: nextPending }, nextTickAt: data.phaseEndsAt };
  },

  tick(ctx, phase, data) {
    if (phase === 'question') return resolveRound(ctx, data);
    if (phase === 'reveal') return startRound(data, data.roundIndex + 1);
    return { phase, data };
  },
};
