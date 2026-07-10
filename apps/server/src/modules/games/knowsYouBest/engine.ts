import { GameActionError, type GameEngine, type GameEngineContext, type GameEngineResult } from '../engine';
import { getPromptBankSync, type KnowsYouBestPrompt } from './promptBank';

const ANSWER_SECONDS = 45;
const GUESS_SECONDS = 40;
const REVEAL_SECONDS = 8;
const TOTAL_ROUNDS = 5;
const POINTS_PER_CORRECT_GUESS = 1;

interface KnowsYouBestData {
  promptIds: string[];
  totalRounds: number;
  roundIndex: number;
  currentPrompt?: { id: string; category: string; text: string };
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
  lastRoundScores?: Record<string, number>;
  lastRoundReveal?: Array<{ authorUserId: string; text: string }>;
  scores: Record<string, number>;
}

type KnowsYouBestAction = { type: 'answer'; text: string } | { type: 'guess'; answerIndex: number; guessedUserId: string };

interface KnowsYouBestClientView {
  totalRounds: number;
  roundIndex: number;
  currentPrompt?: { id: string; category: string; text: string };
  phaseEndsAt?: number;
  scores: Record<string, number>;
  lastRoundScores?: Record<string, number>;
  lastRoundReveal?: Array<{ authorUserId: string; text: string }>;
  // 'answering'
  myAnswered?: boolean;
  myAnswerText?: string;
  answeredCount?: number;
  // 'guessing'
  answers?: Array<{ index: number; text: string }>;
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

function pickPrompts(count: number): KnowsYouBestPrompt[] {
  const bank = getPromptBankSync();
  return shuffle(bank).slice(0, Math.min(count, bank.length));
}

function startRound(data: KnowsYouBestData, roundIndex: number): GameEngineResult<KnowsYouBestData> {
  if (roundIndex >= data.promptIds.length) {
    return {
      phase: 'finished',
      data: {
        ...data,
        roundIndex,
        currentPrompt: undefined,
        answers: undefined,
        shuffledAuthorOrder: undefined,
        guesses: undefined,
        lastRoundScores: undefined,
        lastRoundReveal: undefined,
        phaseEndsAt: undefined,
      },
    };
  }

  const bank = getPromptBankSync();
  const prompt = bank.find((p) => p.id === data.promptIds[roundIndex]);
  if (!prompt) return startRound(data, roundIndex + 1);

  const phaseEndsAt = Date.now() + ANSWER_SECONDS * 1000;
  return {
    phase: 'answering',
    data: {
      ...data,
      roundIndex,
      currentPrompt: { id: prompt.id, category: prompt.category, text: prompt.text },
      answers: {},
      shuffledAuthorOrder: undefined,
      guesses: undefined,
      lastRoundScores: undefined,
      lastRoundReveal: undefined,
      phaseEndsAt,
    },
    nextTickAt: phaseEndsAt,
  };
}

function resolveAnswering(ctx: GameEngineContext, data: KnowsYouBestData): GameEngineResult<KnowsYouBestData> {
  const answers = data.answers ?? {};
  // Only players who actually answered get included — silence isn't
  // penalized beyond not being guessable.
  const authorsWithAnswers = ctx.members.map((m) => m.userId).filter((userId) => typeof answers[userId] === 'string');
  const shuffledAuthorOrder = shuffle(authorsWithAnswers);

  const phaseEndsAt = Date.now() + GUESS_SECONDS * 1000;
  return {
    phase: 'guessing',
    data: { ...data, shuffledAuthorOrder, guesses: {}, phaseEndsAt },
    nextTickAt: phaseEndsAt,
  };
}

function resolveGuessing(ctx: GameEngineContext, data: KnowsYouBestData): GameEngineResult<KnowsYouBestData> {
  const order = data.shuffledAuthorOrder ?? [];
  const answers = data.answers ?? {};
  const guesses = data.guesses ?? {};
  const scores = { ...data.scores };
  const lastRoundScores: Record<string, number> = {};

  for (const guesserId of Object.keys(guesses)) {
    let correct = 0;
    for (const [indexStr, guessedUserId] of Object.entries(guesses[guesserId])) {
      const trueAuthor = order[Number(indexStr)];
      if (trueAuthor && trueAuthor !== guesserId && guessedUserId === trueAuthor) correct++;
    }
    if (correct > 0) {
      const delta = correct * POINTS_PER_CORRECT_GUESS;
      lastRoundScores[guesserId] = delta;
      scores[guesserId] = (scores[guesserId] ?? 0) + delta;
    }
  }

  const lastRoundReveal = order.map((authorUserId) => ({ authorUserId, text: answers[authorUserId] ?? '' }));

  const phaseEndsAt = Date.now() + REVEAL_SECONDS * 1000;
  return {
    phase: 'reveal',
    data: { ...data, lastRoundScores, lastRoundReveal, scores, phaseEndsAt },
    nextTickAt: phaseEndsAt,
  };
}

function maybeResolveAnswering(ctx: GameEngineContext, data: KnowsYouBestData): GameEngineResult<KnowsYouBestData> {
  const answers = data.answers ?? {};
  if (ctx.members.every((m) => typeof answers[m.userId] === 'string')) {
    return resolveAnswering(ctx, data);
  }
  return { phase: 'answering', data, nextTickAt: data.phaseEndsAt };
}

function maybeResolveGuessing(ctx: GameEngineContext, data: KnowsYouBestData): GameEngineResult<KnowsYouBestData> {
  const order = data.shuffledAuthorOrder ?? [];
  const guesses = data.guesses ?? {};
  const everyoneDone = ctx.members.every((m) => {
    const need = order.filter((authorId) => authorId !== m.userId).length;
    return Object.keys(guesses[m.userId] ?? {}).length >= need;
  });
  if (everyoneDone) return resolveGuessing(ctx, data);
  return { phase: 'guessing', data, nextTickAt: data.phaseEndsAt };
}

export const knowsYouBestEngine: GameEngine<KnowsYouBestData, KnowsYouBestAction> = {
  gameType: 'knows-you-best',

  createInitialState(ctx) {
    const prompts = pickPrompts(TOTAL_ROUNDS);
    const initial: KnowsYouBestData = {
      promptIds: prompts.map((p) => p.id),
      totalRounds: prompts.length,
      roundIndex: -1,
      scores: Object.fromEntries(ctx.members.map((m) => [m.userId, 0])),
    };
    return startRound(initial, 0);
  },

  applyAction(ctx, phase, data, userId, action) {
    if (phase === 'answering') {
      if (!action || action.type !== 'answer') throw new GameActionError('INVALID_ACTION', 'Unrecognized action.');
      const text = action.text?.trim();
      if (!text) throw new GameActionError('INVALID_ACTION', 'Answer cannot be empty.');
      if (text.length > 280) throw new GameActionError('INVALID_ACTION', 'Answer is too long.');
      if (data.answers?.[userId] !== undefined) throw new GameActionError('ALREADY_ACTED', "You've already answered this round.");
      return maybeResolveAnswering(ctx, { ...data, answers: { ...data.answers, [userId]: text } });
    }

    if (phase === 'guessing') {
      if (!action || action.type !== 'guess') throw new GameActionError('INVALID_ACTION', 'Unrecognized action.');
      const order = data.shuffledAuthorOrder ?? [];
      const { answerIndex, guessedUserId } = action;
      if (typeof answerIndex !== 'number' || answerIndex < 0 || answerIndex >= order.length) {
        throw new GameActionError('INVALID_TARGET', 'Invalid answer index.');
      }
      if (order[answerIndex] === userId) {
        throw new GameActionError('INVALID_TARGET', "You can't guess on your own answer.");
      }
      if (!ctx.members.some((m) => m.userId === guessedUserId)) {
        throw new GameActionError('INVALID_TARGET', 'Invalid guess target.');
      }
      const mine = data.guesses?.[userId] ?? {};
      const nextGuesses = { ...data.guesses, [userId]: { ...mine, [String(answerIndex)]: guessedUserId } };
      return maybeResolveGuessing(ctx, { ...data, guesses: nextGuesses });
    }

    throw new GameActionError('INVALID_PHASE', 'No actions are accepted right now.');
  },

  tick(ctx, phase, data) {
    if (phase === 'answering') return resolveAnswering(ctx, data);
    if (phase === 'guessing') return resolveGuessing(ctx, data);
    if (phase === 'reveal') return startRound(data, data.roundIndex + 1);
    return { phase, data };
  },

  toClientView(ctx, phase, data, viewerUserId): KnowsYouBestClientView {
    const view: KnowsYouBestClientView = {
      totalRounds: data.totalRounds,
      roundIndex: data.roundIndex,
      currentPrompt: data.currentPrompt,
      phaseEndsAt: data.phaseEndsAt,
      scores: data.scores,
      lastRoundScores: data.lastRoundScores,
      lastRoundReveal: data.lastRoundReveal,
    };

    if (phase === 'answering') {
      const answers = data.answers ?? {};
      view.myAnswered = typeof answers[viewerUserId] === 'string';
      view.myAnswerText = answers[viewerUserId];
      view.answeredCount = Object.keys(answers).length;
    }

    if (phase === 'guessing') {
      const order = data.shuffledAuthorOrder ?? [];
      const answers = data.answers ?? {};
      view.answers = order.map((authorId, index) => ({ index, text: answers[authorId] ?? '' }));
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
};
