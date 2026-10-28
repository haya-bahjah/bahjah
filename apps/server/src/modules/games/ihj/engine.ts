import type { RoomMemberSummary } from '@bahjah/shared';
import { GameActionError, type GameEngine, type GameEngineContext, type GameEngineResult } from '../engine';
import { normalizeAnswer } from '../normalize';
import { drawLetters, type IhjCategory, type IhjLetter } from './bank';
import { isKnownAnswer, startsWithLetter } from './lexicon';
import {
  clearIhjRoomConfig,
  defaultIhjConfig,
  getIhjRoomConfig,
  resolveIhjCategories,
  type IhjRoomConfig,
} from './config';

// How long each round's letter is on screen, circled, before the sheet opens.
// Every round gets it, not just the first: the letter is the moment of the
// round, and dropping straight from the standings into a running clock meant
// the first seconds went on finding out what the letter was.
const REVEAL_SECONDS = 3;
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
  // nobody else wrote this, somebody else did, or the box was empty -- or
  // the answer does not start with the round's letter, which scores nothing
  // and cannot be marked otherwise.
  verdict: 'unique' | 'shared' | 'blank' | 'wrongLetter';
  // False when the answer is not made of words the word list knows
  // (ihj/lexicon.ts): gibberish, or a word too rare for the list. It is
  // suggested as a zero; the player can still mark it, for the rare real word.
  recognised?: boolean;
  // Who else landed on the same word. Drawn on the board so a five is
  // obviously a five rather than an unexplained halving.
  sharedWith: string[];
  // The player's own mark on their own answer: 10, 5 or 0, whichever they
  // pick. Absent means they have not touched it and the system's verdict --
  // offered as the suggestion -- stands. The room sees every mark on the
  // television as it is made, which is what keeps it honest.
  ownedPoints?: 0 | 5 | 10;
  // The older form of the same thing, from before a player could pick any
  // score: false was a strike. Still read so a game running across a deploy
  // keeps its marks.
  ownedValid?: boolean;
  // The host's ruling on a dispute about this word. Only false means
  // anything: the host struck it, and that outranks the player's own say.
  hostValid?: boolean;
}

// Another player challenging an answer during the marking. The host settles
// it alone; until they do, the cell shows as disputed on the television and
// the round cannot close on its own.
interface IhjDispute {
  id: string;
  byUserId: string;
  targetUserId: string;
  index: number;
  status: 'open' | 'accepted' | 'rejected';
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
  disputes?: IhjDispute[];
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
  // Who is in, so the big screen can tick them off. Ids only, never text.
  submittedUserIds?: string[];
  playerCount?: number;
  // 'scoring' onward: the whole board, which is public by then.
  board?: Record<string, IhjAnswer[]>;
  lastRoundScores?: Record<string, RoundScore>;
  continueUserIds?: string[];
  disputes?: IhjDispute[];
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
  // A player marking one of their own answers 10, 5 or 0. `valid` is the
  // older strike / unstrike form.
  | { type: 'mark'; index: number; points?: number; valid?: boolean }
  | { type: 'continue' }
  // A player challenging somebody else's answer, and the host ruling on it.
  | { type: 'dispute'; targetUserId: string; index: number }
  | { type: 'settle'; disputeId: string; accept: boolean }
  | { type: 'advance' };

function playableMembers(ctx: GameEngineContext): RoomMemberSummary[] {
  return ctx.members.filter((m) => !m.isHost);
}

function connectedPlayers(ctx: GameEngineContext): RoomMemberSummary[] {
  return playableMembers(ctx).filter((m) => m.connected);
}

// A round opens on its letter: circled on every screen for a few seconds,
// with the sheet still shut, and then the clock starts.
function startRound(ctx: GameEngineContext, data: IhjData, roundIndex: number): GameEngineResult<IhjData> {
  if (roundIndex >= data.letters.length) return finish(data, roundIndex);
  const phaseEndsAt = Date.now() + REVEAL_SECONDS * 1000;
  return {
    phase: 'reveal',
    data: {
      ...data,
      roundIndex,
      currentLetter: data.letters[roundIndex].letter,
      drafts: undefined,
      submitted: undefined,
      board: undefined,
      lastRoundScores: undefined,
      continueUserIds: undefined,
      disputes: undefined,
      phaseEndsAt,
    },
    nextTickAt: phaseEndsAt,
  };
}

function openAnswering(data: IhjData): GameEngineResult<IhjData> {
  const phaseEndsAt = Date.now() + data.answerSeconds * 1000;
  return {
    phase: 'answering',
    data: { ...data, drafts: {}, submitted: [], phaseEndsAt },
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
      disputes: undefined,
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
    const letter = data.currentLetter ?? '';
    // An answer only counts if it starts with the round's letter; one that
    // does not neither scores nor makes anybody else's answer a shared one.
    const onLetter = (text: string) => !letter || startsWithLetter(text, letter);
    // Who wrote what in this column, keyed by the normalised form.
    const byKey = new Map<string, string[]>();
    for (const member of players) {
      const text = (drafts[member.userId] ?? [])[col] ?? '';
      const key = normalizeAnswer(text);
      if (!key || !onLetter(text)) continue;
      byKey.set(key, [...(byKey.get(key) ?? []), member.userId]);
    }
    for (const member of players) {
      const text = ((drafts[member.userId] ?? [])[col] ?? '').trim();
      const key = normalizeAnswer(text);
      if (key && !onLetter(text)) {
        board[member.userId] = [...(board[member.userId] ?? []), { text, verdict: 'wrongLetter', sharedWith: [] }];
        continue;
      }
      const sharers = key ? (byKey.get(key) ?? []).filter((id) => id !== member.userId) : [];
      const answer: IhjAnswer = {
        text,
        verdict: !key ? 'blank' : sharers.length > 0 ? 'shared' : 'unique',
        sharedWith: sharers,
        ...(key ? { recognised: isKnownAnswer(text) } : {}),
      };
      board[member.userId] = [...(board[member.userId] ?? []), answer];
    }
  }

  return { phase: 'scoring', data: { ...data, board, continueUserIds: [], disputes: [], phaseEndsAt: undefined } };
}

function maybeCloseAnswering(ctx: GameEngineContext, data: IhjData): GameEngineResult<IhjData> {
  const present = connectedPlayers(ctx);
  const submitted = data.submitted ?? [];
  const everyoneIn = present.length > 0 && present.every((m) => submitted.includes(m.userId));
  if (!everyoneIn) return { phase: 'answering', data, nextTickAt: data.phaseEndsAt };
  return buildBoard(ctx, data);
}

// What one marked answer is worth. The host striking it beats everything;
// then the player's own mark; then the system's verdict. A blank is nothing.
function isStruck(answer: IhjAnswer): boolean {
  return answer.ownedValid === false || answer.ownedPoints === 0 || answer.hostValid === false;
}

function valueOf(answer: IhjAnswer): number {
  if (isStruck(answer)) return 0;
  if (answer.verdict === 'blank' || answer.verdict === 'wrongLetter') return 0;
  if (answer.ownedPoints !== undefined) return answer.ownedPoints;
  // Not a word the list knows: a zero unless the player marks it.
  if (answer.recognised === false) return 0;
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
    // Counted by what each answer finally scored, so a word marked ten is
    // a unique answer in the final stats whatever the system first thought.
    for (const answer of answers) {
      const value = valueOf(answer);
      if (value === 0) {
        blankCounts[member.userId] = (blankCounts[member.userId] ?? 0) + 1;
      } else if (value === POINTS_UNIQUE) {
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

// An open dispute holds the round: the room agreeing to move on does not
// settle an argument the host has not ruled on yet.
function maybeCloseScoring(ctx: GameEngineContext, data: IhjData): GameEngineResult<IhjData> {
  const present = connectedPlayers(ctx);
  const continued = data.continueUserIds ?? [];
  const everyoneIn = present.length > 0 && present.every((m) => continued.includes(m.userId));
  const unsettled = (data.disputes ?? []).some((d) => d.status === 'open');
  if (!everyoneIn || unsettled) return { phase: 'scoring', data };
  return scoreRound(ctx, data);
}

// The host's ruling lands on the word, not just the one cell: if two players
// both wrote a "plant" that is not one, striking it for one of them and
// leaving the other a five would make no sense.
function applyRuling(data: IhjData, dispute: IhjDispute, accept: boolean): IhjData {
  const board = { ...(data.board ?? {}) };
  const target = (board[dispute.targetUserId] ?? [])[dispute.index];
  const userIds = target ? [dispute.targetUserId, ...target.sharedWith] : [dispute.targetUserId];
  for (const id of userIds) {
    const answers = board[id];
    if (!answers || !answers[dispute.index]) continue;
    const updated = [...answers];
    updated[dispute.index] = { ...updated[dispute.index], hostValid: accept };
    board[id] = updated;
  }
  const disputes = (data.disputes ?? []).map((d) =>
    d.id === dispute.id ? { ...d, status: accept ? ('accepted' as const) : ('rejected' as const) } : d
  );
  return { ...data, board, disputes };
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
    const data: IhjData = {
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
    };
    // The game opens straight on round one's letter.
    return startRound(ctx, data, 0);
  },

  applyAction(ctx, phase, data, userId, action) {
    const member = ctx.members.find((m) => m.userId === userId);
    if (!member) throw new GameActionError('NOT_A_MEMBER', 'You are not in this room.');

    if (action.type === 'advance') {
      if (!member.isHost) throw new GameActionError('NOT_HOST', 'Only the host can move the room on.');
      if (phase !== 'scoring') throw new GameActionError('INVALID_PHASE', 'There is nothing to move on from right now.');
      // Moving on over an open dispute lets the answer stand -- the host has
      // seen it and chosen not to strike it.
      const settled = (data.disputes ?? []).map((d) => (d.status === 'open' ? { ...d, status: 'accepted' as const } : d));
      return scoreRound(ctx, { ...data, disputes: settled });
    }

    if (action.type === 'settle') {
      if (!member.isHost) throw new GameActionError('NOT_HOST', 'Only the host settles a dispute.');
      if (phase !== 'scoring') throw new GameActionError('INVALID_PHASE', 'There is nothing to settle right now.');
      const dispute = (data.disputes ?? []).find((d) => d.id === action.disputeId);
      if (!dispute) throw new GameActionError('INVALID_ACTION', 'That dispute is not on this board.');
      if (dispute.status !== 'open') return { phase, data };
      return maybeCloseScoring(ctx, applyRuling(data, dispute, Boolean(action.accept)));
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
      // Nor is the letter: an answer that does not start with it scores
      // nothing, whatever its writer would like.
      if (row.verdict === 'wrongLetter') {
        throw new GameActionError('INVALID_ACTION', 'That answer does not start with the round’s letter.');
      }
      let ownedPoints: IhjAnswer['ownedPoints'];
      if (action.points !== undefined) {
        if (action.points !== 0 && action.points !== POINTS_SHARED && action.points !== POINTS_UNIQUE) {
          throw new GameActionError('INVALID_ACTION', 'A mark is 10, 5 or 0.');
        }
        ownedPoints = action.points;
      } else {
        ownedPoints = action.valid === false ? 0 : undefined;
      }
      const updated = [...mine];
      updated[action.index] = { ...row, ownedPoints, ownedValid: undefined };
      return { phase, data: { ...data, board: { ...(data.board ?? {}), [userId]: updated } } };
    }

    if (action.type === 'dispute') {
      if (phase !== 'scoring') throw new GameActionError('INVALID_PHASE', 'There is nothing to dispute right now.');
      if (typeof action.targetUserId !== 'string' || !Number.isInteger(action.index)) {
        throw new GameActionError('INVALID_ACTION', 'That answer is not on the board.');
      }
      if (action.targetUserId === userId) {
        throw new GameActionError('INVALID_ACTION', 'Strike your own answer instead of disputing it.');
      }
      const row = ((data.board ?? {})[action.targetUserId] ?? [])[action.index];
      if (!row) throw new GameActionError('INVALID_ACTION', 'That answer is not on the board.');
      if (row.verdict === 'blank' || row.verdict === 'wrongLetter') throw new GameActionError('INVALID_ACTION', 'That answer already scores nothing.');
      if (isStruck(row)) throw new GameActionError('INVALID_ACTION', 'That answer already scores nothing.');
      const disputes = data.disputes ?? [];
      // One argument per word: a second player raising the same answer adds
      // nothing the host has not already been asked.
      const sameWord = new Set([action.targetUserId, ...row.sharedWith]);
      if (disputes.some((d) => d.index === action.index && sameWord.has(d.targetUserId))) {
        throw new GameActionError('ALREADY_DISPUTED', 'That answer is already being disputed.');
      }
      const dispute: IhjDispute = {
        id: `${data.roundIndex}-${action.targetUserId}-${action.index}`,
        byUserId: userId,
        targetUserId: action.targetUserId,
        index: action.index,
        status: 'open',
      };
      return { phase, data: { ...data, disputes: [...disputes, dispute] } };
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
    // 'countdown' is only reachable from a game started before rounds opened
    // on their letter; it goes to round one the same way.
    if (phase === 'countdown') return startRound(ctx, data, 0);
    if (phase === 'reveal') return openAnswering(data);
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
      view.submittedUserIds = data.submitted ?? [];
    }

    if (phase === 'scoring' || phase === 'standings') {
      view.board = data.board;
      view.continueUserIds = data.continueUserIds;
      view.disputes = data.disputes;
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
