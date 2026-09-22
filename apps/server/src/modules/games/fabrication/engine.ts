import type { RoomMemberSummary } from '@bahjah/shared';
import { GameActionError, type GameEngine, type GameEngineContext, type GameEngineResult } from '../engine';
import {
  clearFabricationRoomConfig,
  defaultFabricationConfig,
  getFabricationRoomConfig,
  resolveFabricationPool,
  type FabricationRoomConfig,
} from './config';
import { normalizeAnswer } from '../normalize';
import type { FabricationQuestion } from './questionBank';

// The spec's recommended timings. Reading is deliberately its own short phase
// rather than the opening seconds of the fabrication window: everyone should
// meet the fact at the same moment, and a player who starts typing while
// others are still reading has taken the round's best fabrication with them.
const QUESTION_SECONDS = 15;
const FABRICATION_SECONDS = 60;
const VOTING_SECONDS = 30;
const COUNTDOWN_SECONDS = 3;

// The whole scoring system, per the spec: two for finding the truth, two for
// every player your lie caught. Both paths are worth the same on purpose --
// knowing the fact and fooling the room are meant to be equally viable.
const POINTS_CORRECT_VOTE = 2;
const POINTS_PER_FOOLED = 2;

// The letters the voting board is labelled with. The real answer is dealt
// into this list like any other option, so the letters carry no information.
const OPTION_KEYS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'];

interface FabricationPublicQuestion {
  id: string;
  category: string;
  prompt: string;
  promptAr: string;
}

// One row on the voting board. `authorUserIds` is empty for the real answer
// and holds every player who submitted this text otherwise -- identical
// fabrications are merged into one option (the spec's §10 choice), because
// two rows reading "42" side by side is a worse board than one row both
// liars are credited for.
interface FabricationOption {
  key: string;
  text: string;
  isTruth: boolean;
  authorUserIds: string[];
}

interface RoundScore {
  votedCorrectly: boolean;
  fooledCount: number;
  votePoints: number;
  foolPoints: number;
  total: number;
}

interface FinalStats {
  correctVotes: number;
  timesFooled: number;
  playersFooled: number;
}

interface FabricationData {
  // Every question this room will be asked, drawn once up front. Never sent
  // to a client: it holds every answer of every future round, which is the
  // exact mistake the engine interface warns about.
  questions: FabricationQuestion[];
  totalRounds: number;
  roundIndex: number;
  currentQuestion?: FabricationPublicQuestion;
  // The round's truth. Held here rather than looked up by id so the reveal
  // is self-contained, and stripped from every client view until the reveal
  // phase -- this is the one value the whole game is built on not leaking.
  answer?: string;
  answerAr?: string;
  source?: string;
  sourceUrl?: string;
  // 'fabrication': userId -> the lie they typed. Private until voting opens,
  // and even then only as anonymous, shuffled option text.
  fabrications?: Record<string, string>;
  // 'voting' onward: the board, in the order it is displayed. Shuffled once
  // when voting opens so every client shows the same order.
  options?: FabricationOption[];
  // 'voting': userId -> the option key they locked in.
  votes?: Record<string, string>;
  lastRoundScores?: Record<string, RoundScore>;
  // 'reveal': who has pressed Next. The round ends when everyone present has,
  // so the room reads the reveal at its own pace -- the spec asks for a
  // controlled transition here rather than a clock.
  continueUserIds?: string[];
  scores: Record<string, number>;
  correctVoteCounts: Record<string, number>;
  timesFooledCounts: Record<string, number>;
  playersFooledCounts: Record<string, number>;
  finalStats?: Record<string, FinalStats>;
  phaseEndsAt?: number;
  winnerUserIds?: string[];
}

// What a player is allowed to see. The shape deliberately has no `questions`
// and no `answer` outside the reveal, and no `fabrications` map at all --
// during voting the board is the only view of other people's lies, and it is
// anonymous.
interface FabricationClientView {
  totalRounds: number;
  roundIndex: number;
  currentQuestion?: FabricationPublicQuestion;
  // Only ever populated once phase === 'reveal'.
  answer?: string;
  answerAr?: string;
  source?: string;
  sourceUrl?: string;
  submittedCount?: number;
  votedCount?: number;
  playerCount?: number;
  // 'fabrication': what this viewer has already submitted, so a reconnecting
  // phone shows their own lie back rather than an empty box they cannot
  // refill.
  myFabrication?: string;
  // 'voting': the board without authors, plus which row is this viewer's own
  // (shown but unpickable, per the spec) and which they have locked.
  options?: Array<{ key: string; text: string }>;
  myOptionKey?: string;
  myVote?: string;
  // 'reveal': the full truth, once it is safe.
  reveal?: Array<{
    key: string;
    text: string;
    isTruth: boolean;
    authorUserIds: string[];
    voterUserIds: string[];
  }>;
  lastRoundScores?: Record<string, RoundScore>;
  continueUserIds?: string[];
  scores: Record<string, number>;
  finalStats?: Record<string, FinalStats>;
  phaseEndsAt?: number;
  winnerUserIds?: string[];
}

type FabricationAction =
  | { type: 'fabricate'; text: string }
  | { type: 'vote'; optionKey: string }
  | { type: 'continue' }
  // The host's one room control: move off the reveal without waiting for a
  // player who has put their phone down. Resolves exactly what everybody
  // pressing Next resolves, so an early advance and a slow room land on
  // identical state.
  | { type: 'advance' };

// The host creates and runs the room from the television and never plays, so
// everywhere a round is scored, counted or waited on, only these members
// count. ctx.members still includes the host, which is right for the lobby.
function playableMembers(ctx: GameEngineContext): RoomMemberSummary[] {
  return ctx.members.filter((m) => !m.isHost);
}

function connectedPlayers(ctx: GameEngineContext): RoomMemberSummary[] {
  return playableMembers(ctx).filter((m) => m.connected);
}

function toPublicQuestion(question: FabricationQuestion): FabricationPublicQuestion {
  return {
    id: question.id,
    category: question.category,
    prompt: question.prompt,
    promptAr: question.promptAr,
  };
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pickQuestions(pool: FabricationQuestion[], count: number): FabricationQuestion[] {
  return shuffle(pool).slice(0, Math.min(count, pool.length));
}

// Is this fabrication actually the truth? Checked against the canonical
// answer in both languages plus every accepted variant, so "Everest" cannot
// slip through because the bank says "Mount Everest".
export function isTruth(question: FabricationQuestion, text: string): boolean {
  const candidate = normalizeAnswer(text);
  if (!candidate) return false;
  return [question.answer, question.answerAr, ...question.acceptedVariants, ...question.acceptedVariantsAr]
    .map(normalizeAnswer)
    .some((known) => known.length > 0 && known === candidate);
}

function startRound(ctx: GameEngineContext, data: FabricationData, roundIndex: number): GameEngineResult<FabricationData> {
  if (roundIndex >= data.questions.length) {
    return finish(data, roundIndex);
  }
  const question = data.questions[roundIndex];
  const phaseEndsAt = Date.now() + QUESTION_SECONDS * 1000;
  return {
    phase: 'question',
    data: {
      ...data,
      roundIndex,
      currentQuestion: toPublicQuestion(question),
      answer: question.answer,
      answerAr: question.answerAr,
      source: question.source,
      sourceUrl: question.sourceUrl,
      fabrications: {},
      options: undefined,
      votes: undefined,
      lastRoundScores: undefined,
      continueUserIds: undefined,
      phaseEndsAt,
    },
    nextTickAt: phaseEndsAt,
  };
}

function finish(data: FabricationData, roundIndex: number): GameEngineResult<FabricationData> {
  const topScore = Math.max(0, ...Object.values(data.scores));
  const winnerUserIds = Object.entries(data.scores)
    .filter(([, score]) => score === topScore && topScore > 0)
    .map(([userId]) => userId);
  const finalStats: Record<string, FinalStats> = Object.fromEntries(
    Object.keys(data.scores).map((userId) => [
      userId,
      {
        correctVotes: data.correctVoteCounts[userId] ?? 0,
        timesFooled: data.timesFooledCounts[userId] ?? 0,
        playersFooled: data.playersFooledCounts[userId] ?? 0,
      },
    ])
  );
  return {
    phase: 'finished',
    data: {
      ...data,
      roundIndex,
      currentQuestion: undefined,
      answer: undefined,
      answerAr: undefined,
      fabrications: undefined,
      options: undefined,
      votes: undefined,
      continueUserIds: undefined,
      phaseEndsAt: undefined,
      winnerUserIds,
      finalStats,
    },
  };
}

// Fabrication closes when every connected player has submitted, or when the
// clock runs out. A player who never submits simply has no option on the
// board -- the round is not held up for them.
function openVoting(ctx: GameEngineContext, data: FabricationData): GameEngineResult<FabricationData> {
  const fabrications = data.fabrications ?? {};
  const question = data.questions[data.roundIndex];

  // Identical lies become one row, credited to everyone who wrote it.
  const byNormalized = new Map<string, { text: string; authorUserIds: string[] }>();
  for (const [userId, text] of Object.entries(fabrications)) {
    const key = normalizeAnswer(text);
    if (!key) continue;
    const existing = byNormalized.get(key);
    if (existing) {
      existing.authorUserIds.push(userId);
    } else {
      byNormalized.set(key, { text, authorUserIds: [userId] });
    }
  }

  const truthText = question ? question.answer : '';
  const rows = [
    { text: truthText, isTruth: true, authorUserIds: [] as string[] },
    ...Array.from(byNormalized.values()).map((row) => ({
      text: row.text,
      isTruth: false,
      authorUserIds: row.authorUserIds,
    })),
  ];
  const options: FabricationOption[] = shuffle(rows).map((row, i) => ({
    key: OPTION_KEYS[i] ?? String(i + 1),
    text: row.text,
    isTruth: row.isTruth,
    authorUserIds: row.authorUserIds,
  }));

  const phaseEndsAt = Date.now() + VOTING_SECONDS * 1000;
  return {
    phase: 'voting',
    data: { ...data, options, votes: {}, phaseEndsAt },
    nextTickAt: phaseEndsAt,
  };
}

function maybeOpenVoting(ctx: GameEngineContext, data: FabricationData): GameEngineResult<FabricationData> {
  const players = connectedPlayers(ctx);
  const submitted = Object.keys(data.fabrications ?? {});
  const everyoneIn = players.length > 0 && players.every((m) => submitted.includes(m.userId));
  if (!everyoneIn) return { phase: 'fabrication', data, nextTickAt: data.phaseEndsAt };
  return openVoting(ctx, data);
}

// Voting closes the same way: when every connected player has locked a vote,
// or when the clock runs out.
function resolveVoting(ctx: GameEngineContext, data: FabricationData): GameEngineResult<FabricationData> {
  const options = data.options ?? [];
  const votes = data.votes ?? {};
  const players = playableMembers(ctx);

  const scores = { ...data.scores };
  const correctVoteCounts = { ...data.correctVoteCounts };
  const timesFooledCounts = { ...data.timesFooledCounts };
  const playersFooledCounts = { ...data.playersFooledCounts };
  const lastRoundScores: Record<string, RoundScore> = {};

  const truthKey = options.find((o) => o.isTruth)?.key;
  const votersByKey = new Map<string, string[]>();
  for (const [userId, key] of Object.entries(votes)) {
    votersByKey.set(key, [...(votersByKey.get(key) ?? []), userId]);
  }

  // How many players each author fooled: everyone who voted for a lie, minus
  // its own authors (who cannot vote for themselves anyway).
  const fooledByAuthor = new Map<string, number>();
  for (const option of options) {
    if (option.isTruth) continue;
    const voters = (votersByKey.get(option.key) ?? []).filter((v) => !option.authorUserIds.includes(v));
    for (const author of option.authorUserIds) {
      fooledByAuthor.set(author, (fooledByAuthor.get(author) ?? 0) + voters.length);
    }
    for (const voter of voters) {
      timesFooledCounts[voter] = (timesFooledCounts[voter] ?? 0) + 1;
    }
  }

  for (const member of players) {
    const votedCorrectly = Boolean(truthKey && votes[member.userId] === truthKey);
    const fooledCount = fooledByAuthor.get(member.userId) ?? 0;
    const votePoints = votedCorrectly ? POINTS_CORRECT_VOTE : 0;
    const foolPoints = fooledCount * POINTS_PER_FOOLED;
    const total = votePoints + foolPoints;

    if (votedCorrectly) correctVoteCounts[member.userId] = (correctVoteCounts[member.userId] ?? 0) + 1;
    if (fooledCount > 0) playersFooledCounts[member.userId] = (playersFooledCounts[member.userId] ?? 0) + fooledCount;
    scores[member.userId] = (scores[member.userId] ?? 0) + total;
    lastRoundScores[member.userId] = { votedCorrectly, fooledCount, votePoints, foolPoints, total };
  }

  return {
    phase: 'reveal',
    data: {
      ...data,
      scores,
      correctVoteCounts,
      timesFooledCounts,
      playersFooledCounts,
      lastRoundScores,
      continueUserIds: [],
      phaseEndsAt: undefined,
    },
  };
}

function maybeResolveVoting(ctx: GameEngineContext, data: FabricationData): GameEngineResult<FabricationData> {
  const players = connectedPlayers(ctx);
  const voted = Object.keys(data.votes ?? {});
  const everyoneIn = players.length > 0 && players.every((m) => voted.includes(m.userId));
  if (!everyoneIn) return { phase: 'voting', data, nextTickAt: data.phaseEndsAt };
  return resolveVoting(ctx, data);
}

// The reveal ends when every connected player has pressed Next (or the host
// advances). A player who has closed their phone is no longer counted, which
// is why this is re-checked on presence changes as well.
function maybeAdvanceReveal(ctx: GameEngineContext, data: FabricationData): GameEngineResult<FabricationData> {
  const players = connectedPlayers(ctx);
  const continued = data.continueUserIds ?? [];
  const everyoneIn = players.length > 0 && players.every((m) => continued.includes(m.userId));
  if (!everyoneIn) return { phase: 'reveal', data };
  return startRound(ctx, data, data.roundIndex + 1);
}

export const fabricationEngine: GameEngine<FabricationData, FabricationAction> = {
  gameType: 'fabrication',

  async loadConfig(code) {
    const stored = await getFabricationRoomConfig(code);
    const config: FabricationRoomConfig = stored ?? defaultFabricationConfig();
    return { config, pool: resolveFabricationPool(config) };
  },

  createInitialState(ctx) {
    const loaded = ctx.config as { config: FabricationRoomConfig; pool: FabricationQuestion[] } | undefined;
    const config = loaded?.config ?? defaultFabricationConfig();
    const pool = loaded?.pool ?? [];
    const questions = pickQuestions(pool, config.rounds);
    const players = playableMembers(ctx);
    const zeroed = (): Record<string, number> => Object.fromEntries(players.map((m) => [m.userId, 0]));
    const phaseEndsAt = Date.now() + COUNTDOWN_SECONDS * 1000;
    return {
      phase: 'countdown',
      data: {
        questions,
        totalRounds: questions.length,
        roundIndex: -1,
        scores: zeroed(),
        correctVoteCounts: zeroed(),
        timesFooledCounts: zeroed(),
        playersFooledCounts: zeroed(),
        phaseEndsAt,
      },
      nextTickAt: phaseEndsAt,
    };
  },

  applyAction(ctx, phase, data, userId, action) {
    const member = ctx.members.find((m) => m.userId === userId);
    if (!member) {
      throw new GameActionError('NOT_A_MEMBER', 'You are not in this room.');
    }

    if (action.type === 'advance') {
      if (!member.isHost) {
        throw new GameActionError('NOT_HOST', 'Only the host can move the room on.');
      }
      if (phase !== 'reveal') {
        throw new GameActionError('INVALID_PHASE', 'There is nothing to move on from right now.');
      }
      return startRound(ctx, data, data.roundIndex + 1);
    }

    if (member.isHost) {
      throw new GameActionError('HOST_CANNOT_PLAY', 'The host runs the room -- you are not dealt into the round.');
    }

    if (action.type === 'fabricate') {
      if (phase !== 'fabrication') {
        throw new GameActionError('INVALID_PHASE', 'Fabrications are not open right now.');
      }
      if ((data.fabrications ?? {})[userId]) {
        throw new GameActionError('ALREADY_ANSWERED', 'Your answer is already in.');
      }
      const text = action.text.trim();
      if (!text) {
        throw new GameActionError('INVALID_ACTION', 'Write something first.');
      }
      const question = data.questions[data.roundIndex];
      // The spec asks for a submission that is really the truth to be
      // prevented. Saying so costs this player the surprise of the reveal,
      // which is a fair trade for not putting two identical "right answers"
      // on the board and scoring one of them as a lie.
      if (question && isTruth(question, text)) {
        throw new GameActionError('TOO_TRUE', 'That is the real answer -- write something believable instead.');
      }
      const fabrications = { ...(data.fabrications ?? {}), [userId]: text };
      return maybeOpenVoting(ctx, { ...data, fabrications });
    }

    if (action.type === 'vote') {
      if (phase !== 'voting') {
        throw new GameActionError('INVALID_PHASE', 'Voting is not open right now.');
      }
      if ((data.votes ?? {})[userId]) {
        throw new GameActionError('ALREADY_ANSWERED', 'Your vote is locked in.');
      }
      const option = (data.options ?? []).find((o) => o.key === action.optionKey);
      if (!option) {
        throw new GameActionError('INVALID_ACTION', 'That answer is not on the board.');
      }
      if (option.authorUserIds.includes(userId)) {
        throw new GameActionError('OWN_FABRICATION', 'You cannot vote for your own fabrication.');
      }
      const votes = { ...(data.votes ?? {}), [userId]: option.key };
      return maybeResolveVoting(ctx, { ...data, votes });
    }

    if (action.type === 'continue') {
      if (phase !== 'reveal') {
        throw new GameActionError('INVALID_PHASE', 'There is nothing to continue from right now.');
      }
      const continued = data.continueUserIds ?? [];
      if (continued.includes(userId)) return { phase, data };
      return maybeAdvanceReveal(ctx, { ...data, continueUserIds: [...continued, userId] });
    }

    throw new GameActionError('INVALID_ACTION', 'Unknown action.');
  },

  tick(ctx, phase, data) {
    if (phase === 'countdown') return startRound(ctx, data, 0);
    if (phase === 'question') {
      const phaseEndsAt = Date.now() + FABRICATION_SECONDS * 1000;
      return { phase: 'fabrication', data: { ...data, phaseEndsAt }, nextTickAt: phaseEndsAt };
    }
    if (phase === 'fabrication') return openVoting(ctx, data);
    if (phase === 'voting') return resolveVoting(ctx, data);
    return { phase, data };
  },

  // Fabrication, voting and the reveal all end when everyone present has
  // acted, so each has to be looked at again when who is present changes --
  // otherwise the last player to close their phone leaves the room waiting on
  // somebody it has already stopped counting. Only ever completes a phase
  // that is already complete.
  onPresenceChange(ctx, phase, data) {
    if (phase === 'fabrication') return maybeOpenVoting(ctx, data);
    if (phase === 'voting') return maybeResolveVoting(ctx, data);
    if (phase === 'reveal') return maybeAdvanceReveal(ctx, data);
    return { phase, data };
  },

  async cleanup(code) {
    await clearFabricationRoomConfig(code);
  },

  toClientView(ctx, phase, data, viewerUserId): FabricationClientView {
    const players = playableMembers(ctx);
    const view: FabricationClientView = {
      totalRounds: data.totalRounds,
      roundIndex: data.roundIndex,
      currentQuestion: data.currentQuestion,
      lastRoundScores: data.lastRoundScores,
      scores: data.scores,
      finalStats: data.finalStats,
      phaseEndsAt: data.phaseEndsAt,
      winnerUserIds: data.winnerUserIds,
      playerCount: players.length,
    };

    if (phase === 'fabrication') {
      view.submittedCount = Object.keys(data.fabrications ?? {}).length;
      view.myFabrication = (data.fabrications ?? {})[viewerUserId];
    }

    if (phase === 'voting') {
      const options = data.options ?? [];
      // Text and letter only. Which row is the truth, and who wrote each lie,
      // stay on the server until the reveal -- that is the whole game.
      view.options = options.map((o) => ({ key: o.key, text: o.text }));
      view.myOptionKey = options.find((o) => o.authorUserIds.includes(viewerUserId))?.key;
      view.myVote = (data.votes ?? {})[viewerUserId];
      view.votedCount = Object.keys(data.votes ?? {}).length;
    }

    if (phase === 'reveal') {
      const votes = data.votes ?? {};
      view.answer = data.answer;
      view.answerAr = data.answerAr;
      view.source = data.source;
      view.sourceUrl = data.sourceUrl;
      view.continueUserIds = data.continueUserIds;
      view.reveal = (data.options ?? []).map((o) => ({
        key: o.key,
        text: o.text,
        isTruth: o.isTruth,
        authorUserIds: o.authorUserIds,
        voterUserIds: Object.entries(votes)
          .filter(([, key]) => key === o.key)
          .map(([userId]) => userId),
      }));
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
