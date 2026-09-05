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
  // Every prompt the room could draw on, kept whole because the difficulty is
  // not chosen until the host picks it on the category screen -- after
  // createInitialState has already run. `prompts` below is the slice actually
  // played, filled in at that point.
  bank: KnowsYouBestPrompt[];
  // The difficulty the host picked, once they have. Absent during 'category'.
  category?: string;
  // 'category': the difficulty the room's controller is currently leaning
  // toward, before they commit to it. Held in state rather than on their phone
  // so the TV and everyone else's phone can show the same tentative pick --
  // the whole point of the two-step is that the room gets to object to it
  // while it is still changeable.
  pendingCategory?: string;
  // Full resolved prompts for this room's playthrough, decided once at
  // createInitialState -- not looked up by id from the global bank later,
  // since that cache doesn't include this room's custom prompts (mirrors
  // trivia's TriviaData.questions for the same reason).
  prompts: KnowsYouBestPrompt[];
  totalRounds: number;
  roundIndex: number;
  currentPrompt?: { id: string; category: string; text: string; textAr?: string };
  phaseEndsAt?: number;
  // 'answering': userId -> their private answer text. Never sent to
  // clients as-is (see toClientView) until the round moves past guessing.
  answers?: Record<string, string>;
  // 'guessing': the display order for this round, generated once when
  // answering resolves. Index in this array is the only identifier clients
  // see for an answer until reveal.
  shuffledAuthorOrder?: string[];
  // Always true from the moment guessing starts: matching is not optional and
  // is not something the host opens. Kept as state so the TV and the phones
  // read the same flag rather than each deciding for itself, and so a room
  // mid-round when this shipped still carries a value.
  matchingOpen?: boolean;
  // 'guessing': guesserUserId -> { answerIndex(as string) -> guessedUserId }
  guesses?: Record<string, Record<string, string>>;
  // 'guessing': guesserUserId -> epoch ms of the action that completed
  // their full set of guesses, used for the fast-submission bonus.
  guessCompletedAt?: Record<string, number>;
  lastRoundScores?: Record<string, RoundScore>;
  // Per answer: its author, and how the room's guesses landed on it.
  // The two guess fields are optional only so a room already mid-round when
  // this shipped keeps rendering; every round resolved since carries them.
  lastRoundReveal?: Array<{
    authorUserId: string;
    text: string;
    correctGuesserIds?: string[];
    wrongGuesses?: Array<{ guesserUserId: string; guessedUserId: string }>;
  }>;
  // 'reveal': who has pressed Next. The round ends when everyone has, so
  // nobody is dragged off the results before they have read them.
  continueUserIds?: string[];
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
// 'advance' and 'skipToFinale' are the host's room controls, not play: the
// design's TV carries SHOW THE TRUTH / ROUND n / SKIP TO FINALE, so the room
// moves on when everyone has finished reading rather than waiting out a timer
// nobody is watching. They resolve exactly what the tick would have resolved,
// so an early advance and a timeout land on identical state.
type KnowsYouBestAction =
  | { type: 'answer'; text: string }
  | { type: 'guessAll'; guesses: Record<string, string> }
  | { type: 'advance' }
  | { type: 'continue' }
  | { type: 'skipToFinale' }
  // Two steps, not one. 'previewCategory' puts a difficulty up on the TV
  // without starting anything, so the room can see what the controller is
  // about to choose and say something; 'pickCategory' is the commit that draws
  // the prompts and opens round 1. A client that only sends 'pickCategory'
  // still works -- the preview is an extra step in front, not a prerequisite.
  | { type: 'previewCategory'; category: string }
  | { type: 'pickCategory'; category: string };

interface KnowsYouBestClientView {
  totalRounds: number;
  roundIndex: number;
  // 'category': the difficulties the host can pick between, and their pick
  // once made. The whole room sees this so the phones can say who is choosing.
  categoryChoices?: string[];
  category?: string;
  // The controller's tentative pick, before they confirm it. Sent to the whole
  // room on purpose: this is what lets a player see "Hard" go up on the TV and
  // say something before it becomes the game.
  pendingCategory?: string;
  currentPrompt?: { id: string; category: string; text: string; textAr?: string };
  phaseEndsAt?: number;
  scores: Record<string, number>;
  lastRoundScores?: Record<string, RoundScore>;
  // Per answer: its author, and how the room's guesses landed on it.
  // The two guess fields are optional only so a room already mid-round when
  // this shipped keeps rendering; every round resolved since carries them.
  lastRoundReveal?: Array<{
    authorUserId: string;
    text: string;
    correctGuesserIds?: string[];
    wrongGuesses?: Array<{ guesserUserId: string; guessedUserId: string }>;
  }>;
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
  // True for the whole guessing phase -- matching starts as soon as the last
  // answer is in. Drives both the TV screen and the phones.
  matchingOpen?: boolean;
  // Who has finished matching, so the TV can light one chip per done player
  // the same way `answeredUserIds` does for the answering phase. Ids only --
  // nothing about *what* they guessed, which stays private until the reveal.
  guessedUserIds?: string[];
  // 'reveal': the Next gate. Everyone gets a button and the room moves on
  // once all of them have pressed it.
  continuedUserIds?: string[];
  continuedCount?: number;
  iContinued?: boolean;
  totalPlayers?: number;
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

// Two answers that read the same ARE the same answer. When several players all
// type "Yes", the board still shows one card per player -- they are their
// authors' cards and stay labelled that way at reveal -- but a match is judged
// on what the card says, not on which of the identical cards a player happened
// to grab. Naming anyone who wrote that exact text is correct; naming someone
// who wrote something else is wrong, as it always was.
//
// The comparison forgives exactly what a phone keyboard varies -- surrounding
// space, runs of whitespace, capitalisation, and Unicode composition (so a
// precomposed Arabic letter matches its decomposed twin) -- and nothing else.
// Punctuation and spelling still separate two answers.
function normaliseAnswer(text: string): string {
  return text.normalize('NFKC').replace(/\s+/gu, ' ').trim().toLowerCase();
}

// Undefined never equals undefined here: two players who never answered are not
// holding the same answer, they are holding no answer, and nothing on the board
// should match them.
function sameAnswer(a: string | undefined, b: string | undefined): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  return normaliseAnswer(a) === normaliseAnswer(b);
}

// Did `guesserId` correctly place the card authored by `authorId` on
// `guessedUserId`? Shared by scoring and by the reveal payload so the points a
// player is given and the verdict they are shown can never disagree.
function isCorrectGuess(
  answers: Record<string, string>,
  guesserId: string,
  authorId: string,
  guessedUserId: string
): boolean {
  // Naming yourself is never a read of the room -- you already know what you
  // wrote -- so it stays wrong even when your answer matches the card's.
  if (guessedUserId === guesserId) return false;
  return sameAnswer(answers[guessedUserId], answers[authorId]);
}

function pickPrompts(pool: KnowsYouBestPrompt[], count: number): KnowsYouBestPrompt[] {
  return shuffle(pool).slice(0, Math.min(count, pool.length));
}

// Who is at the table. On a phone room the creator plays; on a TV room their
// screen is a passive display, so they are filtered out. rooms/service.ts
// decides this once and passes it down, so the engine and the lobby cannot
// disagree about the player count.
function playableMembers(ctx: GameEngineContext): RoomMemberSummary[] {
  return ctx.displayMode === 'phone' ? ctx.members : ctx.members.filter((m) => !m.isHost);
}

// The player running the room -- the only one whose room controls are
// accepted. Falls back to the first player when the context predates the
// field, which keeps a room that was mid-game across a deploy playable.
function controllerId(ctx: GameEngineContext): string | null {
  if (ctx.controllerId !== undefined) return ctx.controllerId;
  const players = playableMembers(ctx);
  return players.length > 0 ? players[0].userId : null;
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
        continueUserIds: [],
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
      continueUserIds: [],
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
  const players = playableMembers(ctx);
  // Only players who actually answered get included -- silence isn't
  // penalized beyond not being guessable.
  const authorsWithAnswers = players.map((m) => m.userId).filter((userId) => typeof answers[userId] === 'string');
  const shuffledAuthorOrder = shuffle(authorsWithAnswers);

  const phaseEndsAt = Date.now() + GUESS_SECONDS * 1000;
  return {
    phase: 'guessing',
    data: { ...data, shuffledAuthorOrder, guesses: {}, guessCompletedAt: {}, matchingOpen: true, phaseEndsAt },
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
      if (!trueAuthor || trueAuthor === guesserId) continue;
      if (!isCorrectGuess(answers, guesserId, trueAuthor, guessedUserId)) continue;
      correct++;
      // Credited to the person actually named, not to the card's author. On a
      // round with duplicate answers those differ, and "who read you right" is
      // a claim about the player the guesser pointed at. The one-player-per-
      // answer rule in applyAction stops the same name being credited twice.
      guessedMeCorrectlyBy[guessedUserId] = guessedMeCorrectlyBy[guessedUserId] ?? {};
      guessedMeCorrectlyBy[guessedUserId][guesserId] = (guessedMeCorrectlyBy[guessedUserId][guesserId] ?? 0) + 1;
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

  // Who pinned this answer on the right person, and who pinned it on the
  // wrong one. Scores alone only tell a player how they themselves did, which
  // left the room reading "here's who said what" with no idea whether anybody
  // had actually worked it out -- so each answer now carries its own verdict.
  // The author never guesses their own answer, so they never appear here.
  const lastRoundReveal = order.map((authorUserId, index) => {
    const correctGuesserIds: string[] = [];
    const wrongGuesses: Array<{ guesserUserId: string; guessedUserId: string }> = [];
    for (const guesserId of Object.keys(guesses)) {
      if (guesserId === authorUserId) continue;
      const guessedUserId = guesses[guesserId]?.[String(index)];
      if (!guessedUserId) continue;
      if (isCorrectGuess(answers, guesserId, authorUserId, guessedUserId)) correctGuesserIds.push(guesserId);
      else wrongGuesses.push({ guesserUserId: guesserId, guessedUserId });
    }
    return { authorUserId, text: answers[authorUserId] ?? '', correctGuesserIds, wrongGuesses };
  });

  // No clock on the results screen: the room reads who got what for as long
  // as it wants, and the host moves everyone on. phaseEndsAt is left unset so
  // nothing schedules a tick to advance out from under them.
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
      continueUserIds: [],
      phaseEndsAt: undefined,
    },
  };
}

function maybeResolveAnswering(ctx: GameEngineContext, data: KnowsYouBestData): GameEngineResult<KnowsYouBestData> {
  const answers = data.answers ?? {};
  const players = playableMembers(ctx);
  if (players.every((m) => typeof answers[m.userId] === 'string')) {
    return resolveAnswering(ctx, data);
  }
  return { phase: 'answering', data, nextTickAt: data.phaseEndsAt };
}

function maybeResolveGuessing(ctx: GameEngineContext, data: KnowsYouBestData): GameEngineResult<KnowsYouBestData> {
  const order = data.shuffledAuthorOrder ?? [];
  const guesses = data.guesses ?? {};
  const players = playableMembers(ctx);
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
    const players = playableMembers(ctx);
    const initial: KnowsYouBestData = {
      bank: pool,
      prompts: [],
      totalRounds: config.totalRounds,
      roundIndex: -1,
      scores: Object.fromEntries(players.map((m) => [m.userId, 0])),
      correctGuessTotal: Object.fromEntries(players.map((m) => [m.userId, 0])),
      guessesMadeTotal: Object.fromEntries(players.map((m) => [m.userId, 0])),
      perfectRoundCount: Object.fromEntries(players.map((m) => [m.userId, 0])),
      guessedMeCorrectlyBy: Object.fromEntries(players.map((m) => [m.userId, {}])),
    };
    // The game opens on the category screen, not on round 1: the host picks a
    // difficulty on the TV first, and that pick decides which prompts play.
    return { phase: 'category', data: initial };
  },

  applyAction(ctx, phase, data, userId, action) {
    const member = ctx.members.find((m) => m.userId === userId);

    // The host's room controls. These are separate from play -- the host
    // answers and matches like everyone else, and additionally moves the room
    // on between rounds.
    if (
      action &&
      (action.type === 'advance' ||
        action.type === 'skipToFinale' ||
        action.type === 'previewCategory' ||
        action.type === 'pickCategory')
    ) {
      if (userId !== controllerId(ctx)) {
        throw new GameActionError('NOT_HOST', 'Only the player running the room can move it on.');
      }
      if (action.type === 'previewCategory' || action.type === 'pickCategory') {
        if (phase !== 'category') {
          throw new GameActionError('INVALID_PHASE', 'The difficulty has already been chosen.');
        }
        const picked = data.bank.filter((p) => p.category === action.category);
        if (picked.length === 0) {
          throw new GameActionError('INVALID_TARGET', 'No questions for that difficulty.');
        }
        // Putting a card up on the TV starts nothing and is freely revisable:
        // the controller can move between the three as often as the room
        // argues about it, and the phase does not change until they confirm.
        if (action.type === 'previewCategory') {
          return { phase: 'category', data: { ...data, pendingCategory: action.category } };
        }
        // The pick decides the playthrough: filter the bank down to it, then
        // draw this room's rounds and open round 1.
        const prompts = pickPrompts(picked, data.totalRounds);
        return startRound(
          { ...data, category: action.category, pendingCategory: undefined, prompts, totalRounds: prompts.length },
          0
        );
      }
      if (action.type === 'skipToFinale') {
        // startRound past the last round is what produces the finished phase,
        // so jumping to totalRounds ends the game the same way playing it out
        // would have.
        return startRound(data, data.totalRounds);
      }
      if (phase === 'answering') return resolveAnswering(ctx, data);
      if (phase === 'guessing') return resolveGuessing(ctx, data);
      if (phase === 'reveal') return startRound(data, data.roundIndex + 1);
      throw new GameActionError('INVALID_PHASE', 'Nothing to advance right now.');
    }

    // Everyone presses Next on the results screen and the room moves on when
    // the last of them has -- so nobody is pulled off the results while they
    // are still reading who got what. The controller's 'advance' above stays
    // as an override for a room stalled by someone who walked away.
    if (action && action.type === 'continue') {
      if (phase !== 'reveal') {
        throw new GameActionError('INVALID_PHASE', 'There is nothing to continue from right now.');
      }
      const players = playableMembers(ctx);
      if (!players.some((m) => m.userId === userId)) {
        throw new GameActionError('NOT_A_PLAYER', 'Only players can move the round on.');
      }
      const already = data.continueUserIds ?? [];
      if (already.includes(userId)) {
        return { phase, data };
      }
      const next = [...already, userId];
      if (next.length >= players.length) {
        return startRound({ ...data, continueUserIds: next }, data.roundIndex + 1);
      }
      return { phase, data: { ...data, continueUserIds: next } };
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
      const validTargets = playableMembers(ctx);
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
      // Matching is once per round. Without this, a player whose board was
      // re-rendered could submit a second, third, fourth set and quietly
      // overwrite their own answers after seeing how the room was going.
      if (wasComplete) {
        throw new GameActionError('ALREADY_ACTED', "You've already matched this round.");
      }
      const nextMine = { ...mine, ...action.guesses };
      // One player per answer. The board has enforced this since it was built
      // -- dropping a name on a second card lifts it off the first -- but it
      // only became load-bearing once identical answers started matching each
      // other: without it, a round where two players both wrote "Yes" could be
      // swept by naming the same person for both cards, which is not a read of
      // the room and would hand out a perfect-round bonus for free.
      const named = Object.values(nextMine);
      if (new Set(named).size !== named.length) {
        throw new GameActionError('INVALID_TARGET', 'Each player can only be matched to one answer.');
      }
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
      currentPrompt: data.currentPrompt,
      phaseEndsAt: data.phaseEndsAt,
      scores: data.scores,
      lastRoundScores: data.lastRoundScores,
      lastRoundReveal: data.lastRoundReveal,
      winnerUserIds: data.winnerUserIds,
      finalStats: data.finalStats,
      category: data.category,
      pendingCategory: data.pendingCategory,
      // Only the difficulties this room's bank can actually fill, so the TV
      // never offers a card that would come back empty.
      categoryChoices: [...new Set(data.bank.map((prompt) => prompt.category))],
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
      view.guessedUserIds = Object.keys(guesses).filter((guesserId) => {
        const need = order.filter((authorId) => authorId !== guesserId).length;
        return Object.keys(guesses[guesserId] ?? {}).length >= need;
      });
      view.guessedCount = view.guessedUserIds.length;
      view.matchingOpen = data.matchingOpen === true;
    }

    if (phase === 'reveal') {
      const continued = data.continueUserIds ?? [];
      view.continuedUserIds = continued;
      view.continuedCount = continued.length;
      view.iContinued = continued.includes(viewerUserId);
      view.totalPlayers = playableMembers(ctx).length;
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
