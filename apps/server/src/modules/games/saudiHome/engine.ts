import { randomBytes, randomInt } from 'crypto';
import type { RoomMemberSummary } from '@bahjah/shared';
import { GameActionError, type GameEngine, type GameEngineContext, type GameEngineResult } from '../engine';
import {
  CHALLENGES,
  FINAL_ORDER,
  FIRST_ROOM,
  getRoomDef,
  ROOMS,
  ROOMS_PER_SESSION,
  SCORING,
  type Challenge,
  type ChallengeOption,
  type FinalCategory,
  type Loc,
  type RoomId,
} from './content';
import { loadSaudiHomeConfig, recordRecentContent, saveSaudiHomeResults, type SaudiHomeConfig } from './config';

// Welcome to a Saudi Home.
//
//   welcome -> room_intro -> challenge -> reveal -> room_complete -> room_intro
//           -> ... (5 rooms)
//           -> final_intro -> challenge -> reveal -> ... (5 questions) -> finished
//
// The host moves the game on. Every phase waits for the host's Next except a
// challenge, which closes itself when its timer runs out (or as soon as every
// player present has answered); the reveal it closes into then waits for the
// host again. The server owns the timer: answers arriving after it are not
// scored, and a paused challenge keeps the time it had left.

type Phase = 'welcome' | 'room_intro' | 'final_intro' | 'challenge' | 'reveal' | 'room_complete' | 'finished';

interface Answer {
  choice: string[];
  // Milliseconds of the timer still left when the answer arrived. Kept rather
  // than a timestamp so a pause in between cannot skew the speed bonus.
  remainingMs: number;
}

interface PlayerResult {
  answered: boolean;
  correct: boolean;
  points: number;
  // The part of points that came from answering quickly.
  speedBonus: number;
}

interface Current {
  challengeId: string;
  isFinal: boolean;
  // The order the options are shown in, decided once per challenge.
  optionOrder: string[];
  timeLimitMs: number;
}

interface Standing {
  userId: string;
  name: string;
  score: number;
  rank: number;
  correctCount: number;
  correctTimeMs: number;
}

interface SaudiHomeData {
  eventId: string | null;
  route: RoomId[];
  // Index into route of the room being played, or route.length once the
  // Final Challenge has begun.
  roomIndex: number;
  skippedRooms: RoomId[];
  finalIds: string[];
  finalIndex: number;
  current?: Current;
  usedChallengeIds: string[];
  // Unused challenges a Skip Challenge can swap in, per room / final slot.
  spares: Record<string, string[]>;
  answers: Record<string, Answer>;
  lastResults?: Record<string, PlayerResult>;
  // Answer counts per option at the last reveal, for the shared screen.
  lastCounts?: Record<string, number>;
  scores: Record<string, number>;
  correctCounts: Record<string, number>;
  correctTimeMs: Record<string, number>;
  questionCount: number;
  // Display names as of the moment each player was last seen in the room, so
  // the final standings still name someone whose phone has dropped.
  names: Record<string, string>;
  phaseEndsAt?: number;
  paused?: { remainingMs?: number };
  standings?: Standing[];
  shareTokens?: Record<string, string>;
}

type SaudiHomeAction =
  | { type: 'answer'; choice: string[] }
  | { type: 'next' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'skipChallenge' }
  | { type: 'skipRoom' }
  | { type: 'finish' };

function shuffle<T>(items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Random order, but anything recently played goes to the back.
function freshFirst<T>(items: readonly T[], key: (item: T) => string, recent: Set<string>): T[] {
  const shuffled = shuffle(items);
  return [...shuffled.filter((i) => !recent.has(key(i))), ...shuffled.filter((i) => recent.has(key(i)))];
}

const challengeById = new Map(CHALLENGES.map((c) => [c.id, c]));

function getChallenge(id: string): Challenge {
  const challenge = challengeById.get(id);
  if (!challenge) throw new Error(`Unknown Saudi Home challenge ${id}`);
  return challenge;
}

function players(members: RoomMemberSummary[]): RoomMemberSummary[] {
  return members.filter((m) => !m.isHost);
}

function hostId(ctx: GameEngineContext): string | null {
  return ctx.members.find((m) => m.isHost)?.userId ?? null;
}

function rememberNames(data: SaudiHomeData, ctx: GameEngineContext): Record<string, string> {
  const names = { ...data.names };
  for (const p of players(ctx.members)) names[p.userId] = p.displayName;
  return names;
}

function chooseRoute(config: SaudiHomeConfig, recent: Set<string>): RoomId[] {
  const playable = (id: RoomId) => CHALLENGES.some((c) => c.active && c.roomId === id);
  const pool = ROOMS.filter((r) => r.active && r.id !== FIRST_ROOM && playable(r.id)).map((r) => r.id);
  const wanted = ROOMS_PER_SESSION - 1;
  const picked = (config.rooms ?? []).filter((id, i, all) => pool.includes(id) && all.indexOf(id) === i);
  if (picked.length >= wanted) return [FIRST_ROOM, ...picked.slice(0, wanted)];
  const rest = freshFirst(pool.filter((id) => !picked.includes(id)), (id) => `room:${id}`, recent);
  return [FIRST_ROOM, ...picked, ...rest.slice(0, wanted - picked.length)];
}

function timeLimitMs(challenge: Challenge, isFinal: boolean): number {
  const seconds = challenge.timeLimit ?? (isFinal ? SCORING.timers.final : SCORING.timers[challenge.type]);
  return seconds * 1000;
}

function startChallenge(data: SaudiHomeData, challengeId: string, isFinal: boolean): GameEngineResult<SaudiHomeData> {
  const challenge = getChallenge(challengeId);
  const limit = timeLimitMs(challenge, isFinal);
  // True/false always reads True, False; everything else is reshuffled so the
  // right answer is not always in the same place.
  const optionOrder =
    challenge.type === 'true_false' ? challenge.options.map((o) => o.id) : shuffle(challenge.options.map((o) => o.id));
  const phaseEndsAt = Date.now() + limit;
  return {
    phase: 'challenge',
    data: {
      ...data,
      current: { challengeId, isFinal, optionOrder, timeLimitMs: limit },
      usedChallengeIds: data.usedChallengeIds.includes(challengeId)
        ? data.usedChallengeIds
        : [...data.usedChallengeIds, challengeId],
      answers: {},
      lastResults: undefined,
      lastCounts: undefined,
      phaseEndsAt,
      paused: undefined,
    },
    nextTickAt: phaseEndsAt,
  };
}

function isCorrect(challenge: Challenge, choice: string[]): boolean {
  if (choice.length !== challenge.correct.length) return false;
  return challenge.correct.every((id) => choice.includes(id));
}

function scoreAnswer(challenge: Challenge, current: Current, answer: Answer | undefined): PlayerResult {
  if (!answer) return { answered: false, correct: false, points: 0, speedBonus: 0 };
  if (!isCorrect(challenge, answer.choice)) return { answered: true, correct: false, points: 0, speedBonus: 0 };
  const base = current.isFinal ? SCORING.finalBase : SCORING.base;
  const fraction = Math.max(0, Math.min(1, answer.remainingMs / current.timeLimitMs));
  const speed = Math.round(SCORING.speedBonusMax * fraction);
  const multiplier = challenge.difficulty === 'hard' ? SCORING.hardMultiplier : 1;
  return {
    answered: true,
    correct: true,
    points: Math.round((base + speed) * multiplier),
    speedBonus: Math.round(speed * multiplier),
  };
}

function reveal(ctx: GameEngineContext, data: SaudiHomeData): GameEngineResult<SaudiHomeData> {
  const current = data.current;
  if (!current) return { phase: 'reveal', data };
  const challenge = getChallenge(current.challengeId);
  const scores = { ...data.scores };
  const correctCounts = { ...data.correctCounts };
  const correctTimeMs = { ...data.correctTimeMs };
  const lastResults: Record<string, PlayerResult> = {};
  const lastCounts: Record<string, number> = Object.fromEntries(challenge.options.map((o) => [o.id, 0]));
  const everyone = new Set([...players(ctx.members).map((p) => p.userId), ...Object.keys(data.answers)]);
  for (const userId of everyone) {
    const answer = data.answers[userId];
    const result = scoreAnswer(challenge, current, answer);
    lastResults[userId] = result;
    scores[userId] = (scores[userId] ?? 0) + result.points;
    if (result.correct && answer) {
      correctCounts[userId] = (correctCounts[userId] ?? 0) + 1;
      correctTimeMs[userId] = (correctTimeMs[userId] ?? 0) + (current.timeLimitMs - answer.remainingMs);
    }
    for (const id of answer?.choice ?? []) lastCounts[id] = (lastCounts[id] ?? 0) + 1;
  }
  return {
    phase: 'reveal',
    data: {
      ...data,
      names: rememberNames(data, ctx),
      scores,
      correctCounts,
      correctTimeMs,
      lastResults,
      lastCounts,
      questionCount: data.questionCount + 1,
      phaseEndsAt: undefined,
      paused: undefined,
    },
  };
}

function computeStandings(ctx: GameEngineContext, data: SaudiHomeData): Standing[] {
  const names = rememberNames(data, ctx);
  // Everyone still in the room, plus anyone who scored and has only dropped
  // their connection. A player the host removed is no longer a member and is
  // left out.
  const memberIds = new Set(players(ctx.members).map((p) => p.userId));
  const rows = [...memberIds].map((userId) => ({
    userId,
    name: names[userId] ?? 'Player',
    score: data.scores[userId] ?? 0,
    correctCount: data.correctCounts[userId] ?? 0,
    correctTimeMs: data.correctTimeMs[userId] ?? 0,
  }));
  rows.sort((a, b) => b.score - a.score || a.correctTimeMs - b.correctTimeMs || a.name.localeCompare(b.name));
  const standings: Standing[] = [];
  rows.forEach((row, i) => {
    const prev = standings[i - 1];
    const tied = prev && prev.score === row.score && prev.correctTimeMs === row.correctTimeMs;
    standings.push({ ...row, rank: tied ? prev.rank : i + 1 });
  });
  return standings;
}

function finish(ctx: GameEngineContext, data: SaudiHomeData): GameEngineResult<SaudiHomeData> {
  const standings = computeStandings(ctx, data);
  const shareTokens = Object.fromEntries(standings.map((s) => [s.userId, randomBytes(9).toString('base64url')]));
  return {
    phase: 'finished',
    data: {
      ...data,
      names: rememberNames(data, ctx),
      current: undefined,
      answers: {},
      phaseEndsAt: undefined,
      paused: undefined,
      standings,
      shareTokens,
    },
  };
}

// Where Next goes from a reveal (or a skipped room): the next room, the
// Final Challenge's intro, the next final question, or the end.
function advanceAfterRoom(data: SaudiHomeData): GameEngineResult<SaudiHomeData> {
  const nextRoom = data.roomIndex + 1;
  const base = { ...data, current: undefined, answers: {}, phaseEndsAt: undefined, paused: undefined };
  if (nextRoom < data.route.length) return { phase: 'room_intro', data: { ...base, roomIndex: nextRoom } };
  return { phase: 'final_intro', data: { ...base, roomIndex: data.route.length, finalIndex: 0 } };
}

function advanceAfterFinal(ctx: GameEngineContext, data: SaudiHomeData): GameEngineResult<SaudiHomeData> {
  const next = data.finalIndex + 1;
  if (next >= data.finalIds.length) return finish(ctx, data);
  return startChallenge({ ...data, finalIndex: next }, data.finalIds[next], true);
}

function roomChallengeId(data: SaudiHomeData): string {
  return data.spares[`pick:${data.route[data.roomIndex]}`]?.[0] ?? '';
}

function next(ctx: GameEngineContext, phase: Phase, data: SaudiHomeData): GameEngineResult<SaudiHomeData> {
  switch (phase) {
    case 'welcome':
      return { phase: 'room_intro', data: { ...data, roomIndex: 0 } };
    case 'room_intro':
      return startChallenge(data, roomChallengeId(data), false);
    case 'final_intro':
      return startChallenge(data, data.finalIds[0], true);
    case 'challenge':
      // The host closing the answers early.
      return reveal(ctx, data);
    case 'reveal':
      // A room's reveal is followed by the house map; a final question's by
      // the next final question.
      if (data.current?.isFinal) return advanceAfterFinal(ctx, data);
      return { phase: 'room_complete', data: { ...data, answers: {} } };
    case 'room_complete':
      return advanceAfterRoom(data);
    default:
      return { phase, data };
  }
}

function skipChallenge(ctx: GameEngineContext, phase: Phase, data: SaudiHomeData): GameEngineResult<SaudiHomeData> {
  if (phase !== 'room_intro' && phase !== 'challenge' && phase !== 'final_intro') {
    throw new GameActionError('INVALID_PHASE', 'There is no challenge to skip right now.');
  }
  const inFinal = phase === 'final_intro' || Boolean(data.current?.isFinal);
  if (inFinal) {
    const slot = FINAL_ORDER[data.finalIndex];
    const spare = (data.spares[`final:${slot}`] ?? []).find((id) => !data.usedChallengeIds.includes(id));
    if (spare) {
      const finalIds = data.finalIds.map((id, i) => (i === data.finalIndex ? spare : id));
      const spares = { ...data.spares, [`final:${slot}`]: data.spares[`final:${slot}`].filter((id) => id !== spare) };
      return startChallenge({ ...data, finalIds, spares }, spare, true);
    }
    // Nothing left in this slot: move past it without scoring it.
    return advanceAfterFinal(ctx, data);
  }
  const roomId = data.route[data.roomIndex];
  const pool = data.spares[`room:${roomId}`] ?? [];
  const spare = pool.find((id) => !data.usedChallengeIds.includes(id));
  if (!spare) return skipRoom(phase, data);
  const spares = {
    ...data.spares,
    [`room:${roomId}`]: pool.filter((id) => id !== spare),
    [`pick:${roomId}`]: [spare],
  };
  // Swapped before it was shown: stay on the room's intro with the new one
  // lined up. Swapped mid-challenge: start the replacement straight away.
  if (phase === 'room_intro') return { phase, data: { ...data, spares } };
  return startChallenge({ ...data, spares }, spare, false);
}

function skipRoom(phase: Phase, data: SaudiHomeData): GameEngineResult<SaudiHomeData> {
  const scored = phase === 'room_complete' || (phase === 'reveal' && !data.current?.isFinal);
  if (phase !== 'room_intro' && phase !== 'challenge' && !scored) {
    throw new GameActionError('INVALID_PHASE', 'There is no room to skip right now.');
  }
  if (data.roomIndex >= data.route.length) {
    throw new GameActionError('INVALID_PHASE', 'The Final Challenge has no rooms to skip.');
  }
  const roomId = data.route[data.roomIndex];
  // A room skipped after its reveal has already been scored; only one skipped
  // before then is marked as skipped on the house map.
  const skippedRooms = scored ? data.skippedRooms : [...data.skippedRooms, roomId];
  return advanceAfterRoom({ ...data, skippedRooms });
}

export const saudiHomeEngine: GameEngine<SaudiHomeData, SaudiHomeAction> = {
  gameType: 'saudi-home',

  loadConfig: loadSaudiHomeConfig,

  createInitialState(ctx) {
    const config = (ctx.config as SaudiHomeConfig | undefined) ?? { eventId: null, rooms: [], recent: [] };
    const recent = new Set(config.recent);
    const route = chooseRoute(config, recent);

    const spares: Record<string, string[]> = {};
    for (const roomId of route) {
      const pool = freshFirst(
        CHALLENGES.filter((c) => c.active && c.roomId === roomId),
        (c) => c.id,
        recent
      ).map((c) => c.id);
      spares[`pick:${roomId}`] = pool.slice(0, 1);
      spares[`room:${roomId}`] = pool.slice(1);
    }
    const finalIds: string[] = [];
    for (const slot of FINAL_ORDER) {
      const pool = freshFirst(
        CHALLENGES.filter((c) => c.active && c.roomId === 'final' && c.finalCategory === slot),
        (c) => c.id,
        recent
      ).map((c) => c.id);
      if (pool.length === 0) continue;
      finalIds.push(pool[0]);
      spares[`final:${slot}`] = pool.slice(1);
    }

    // Remember what this host's screen is about to show, so the next group
    // gets different rooms and questions first. Fire-and-forget: a Redis
    // hiccup must not stop the game from starting.
    const host = hostId(ctx);
    if (host) {
      const shown = [...route.map((id) => `room:${id}`), ...route.map((id) => spares[`pick:${id}`][0]), ...finalIds];
      recordRecentContent(host, shown.filter(Boolean)).catch((err) =>
        console.error('saudi-home: failed to record recent content', err)
      );
    }

    const data: SaudiHomeData = {
      eventId: config.eventId,
      route,
      roomIndex: 0,
      skippedRooms: [],
      finalIds,
      finalIndex: 0,
      usedChallengeIds: [],
      spares,
      answers: {},
      scores: {},
      correctCounts: {},
      correctTimeMs: {},
      questionCount: 0,
      names: {},
    };
    return { phase: 'welcome', data: { ...data, names: rememberNames(data, ctx) } };
  },

  applyAction(ctx, phaseRaw, data, userId, action) {
    const phase = phaseRaw as Phase;
    if (!action || typeof action !== 'object') {
      throw new GameActionError('INVALID_ACTION', 'Unknown action.');
    }
    const isHost = hostId(ctx) === userId;

    if (action.type === 'answer') {
      if (isHost) throw new GameActionError('NOT_A_PLAYER', 'The host screen does not answer.');
      if (phase !== 'challenge' || !data.current || !data.phaseEndsAt) {
        throw new GameActionError('INVALID_PHASE', 'Answers are closed.');
      }
      if (data.paused) throw new GameActionError('PAUSED', 'The game is paused.');
      if (data.answers[userId]) throw new GameActionError('ALREADY_ANSWERED', 'You already answered.');
      const remainingMs = data.phaseEndsAt - Date.now();
      // The server's clock decides: anything after the deadline is not taken.
      if (remainingMs <= 0) throw new GameActionError('TOO_LATE', 'Time is up.');
      const challenge = getChallenge(data.current.challengeId);
      const valid = new Set(challenge.options.map((o) => o.id));
      const choice = Array.isArray(action.choice)
        ? [...new Set(action.choice.map(String))].filter((id) => valid.has(id))
        : [];
      if (choice.length === 0 || (challenge.type !== 'multi' && choice.length !== 1)) {
        throw new GameActionError('INVALID_ANSWER', 'Pick an answer.');
      }
      const answers = { ...data.answers, [userId]: { choice, remainingMs } };
      const nextData = { ...data, answers };
      // Everybody present has answered: no point making the room wait out the
      // clock.
      const waitingOn = players(ctx.members).filter((p) => p.connected && !answers[p.userId]);
      if (waitingOn.length === 0) return reveal(ctx, nextData);
      return { phase, data: nextData, nextTickAt: data.phaseEndsAt };
    }

    if (!isHost) throw new GameActionError('NOT_HOST', 'Only the host can do that.');
    const keepClock = phase === 'challenge' && !data.paused ? data.phaseEndsAt : undefined;

    switch (action.type) {
      case 'pause': {
        if (phase === 'finished' || data.paused) return { phase, data, nextTickAt: keepClock };
        const remainingMs = phase === 'challenge' && data.phaseEndsAt ? Math.max(0, data.phaseEndsAt - Date.now()) : undefined;
        return { phase, data: { ...data, paused: { remainingMs } } };
      }
      case 'resume': {
        if (!data.paused) return { phase, data, nextTickAt: keepClock };
        if (phase === 'challenge' && data.paused.remainingMs !== undefined) {
          const phaseEndsAt = Date.now() + data.paused.remainingMs;
          return { phase, data: { ...data, paused: undefined, phaseEndsAt }, nextTickAt: phaseEndsAt };
        }
        return { phase, data: { ...data, paused: undefined } };
      }
      case 'next':
        if (data.paused) throw new GameActionError('PAUSED', 'Resume the game first.');
        return next(ctx, phase, data);
      case 'skipChallenge':
        return skipChallenge(ctx, phase, { ...data, paused: undefined });
      case 'skipRoom':
        return skipRoom(phase, { ...data, paused: undefined });
      case 'finish':
        if (phase === 'finished') return { phase, data };
        return finish(ctx, data);
      default:
        throw new GameActionError('INVALID_ACTION', 'Unknown action.');
    }
  },

  tick(ctx, phase, data) {
    if (phase === 'challenge' && !data.paused) return reveal(ctx, data);
    return { phase, data };
  },

  // A player dropping out mid-challenge may have been the last one the room
  // was waiting on.
  onPresenceChange(ctx, phase, data) {
    if (phase !== 'challenge' || data.paused || !data.phaseEndsAt) return { phase, data, nextTickAt: data.phaseEndsAt };
    const present = players(ctx.members).filter((p) => p.connected);
    if (present.length > 0 && present.every((p) => data.answers[p.userId])) return reveal(ctx, data);
    return { phase, data, nextTickAt: data.phaseEndsAt };
  },

  toClientView(ctx, phaseRaw, data, viewerUserId) {
    const phase = phaseRaw as Phase;
    const loc = (l: Loc) => l;
    const roomOf = (id: RoomId) => {
      const def = getRoomDef(id);
      return def ? { id, name: loc(def.name), theme: loc(def.theme), emoji: def.emoji } : { id, name: { en: id, ar: id }, theme: { en: '', ar: '' }, emoji: '🚪' };
    };
    const inFinal = data.roomIndex >= data.route.length;
    // The house map: rooms already visited by name, the current one, and the
    // rest as unknown doors.
    const map = data.route.map((id, i) => {
      // On the house map after a room, that room already counts as visited.
      const visited = i < data.roomIndex || (i === data.roomIndex && phase === 'room_complete');
      const status = visited
        ? data.skippedRooms.includes(id) ? 'skipped' : 'done'
        : i === data.roomIndex && phase !== 'welcome' ? 'current' : 'upcoming';
      return status === 'upcoming' ? { status } : { status, ...roomOf(id) };
    });

    const current = data.current;
    let challenge: unknown = undefined;
    if (current && (phase === 'challenge' || phase === 'reveal')) {
      const c = getChallenge(current.challengeId);
      const byId = new Map<string, ChallengeOption>(c.options.map((o) => [o.id, o]));
      challenge = {
        id: c.id,
        type: c.type,
        question: c.question,
        options: current.optionOrder.map((id) => ({ id, text: byId.get(id)!.text })),
        media: c.media ?? null,
        timeLimitMs: current.timeLimitMs,
        isFinal: current.isFinal,
        difficulty: c.difficulty,
        finalCategory: current.isFinal ? c.finalCategory ?? null : null,
        ...(phase === 'reveal'
          ? {
              correct: c.correct,
              explanation: c.explanation,
              counts: data.lastCounts ?? {},
              // How many got it right, for "n of N got it right".
              rightCount: Object.values(data.lastResults ?? {}).filter((r) => r.correct).length,
            }
          : {}),
      };
    }

    const playerList = players(ctx.members);
    const answeredCount = playerList.filter((p) => data.answers[p.userId]).length;
    const live = phase === 'finished' ? data.standings ?? [] : computeStandings(ctx, data);
    const me = live.find((s) => s.userId === viewerUserId);
    const isViewerHost = hostId(ctx) === viewerUserId;

    return {
      phase,
      serverNow: Date.now(),
      phaseEndsAt: data.phaseEndsAt,
      paused: data.paused ? { remainingMs: data.paused.remainingMs } : null,
      map,
      roomIndex: Math.min(data.roomIndex, data.route.length),
      totalRooms: data.route.length,
      room: !inFinal && phase !== 'welcome' ? roomOf(data.route[data.roomIndex]) : null,
      // On the house map: where Next goes. Only ever the one room ahead.
      nextRoom:
        phase === 'room_complete'
          ? data.roomIndex + 1 < data.route.length
            ? roomOf(data.route[data.roomIndex + 1])
            : 'final'
          : null,
      inFinal,
      finalIndex: data.finalIndex,
      finalTotal: data.finalIds.length,
      challenge,
      answeredCount,
      playerCount: playerList.length,
      // Only the host screen sees who is still to answer; phones see counts.
      waitingOn: isViewerHost && phase === 'challenge' ? playerList.filter((p) => !data.answers[p.userId]).map((p) => p.displayName) : undefined,
      leaderboard: live.slice(0, phase === 'finished' ? 8 : 5).map((s) => ({
        userId: s.userId,
        name: s.name,
        score: s.score,
        rank: s.rank,
        lastPoints: phase === 'reveal' ? data.lastResults?.[s.userId]?.points ?? 0 : undefined,
      })),
      // Nobody is champion of a game nobody scored in.
      champions: phase === 'finished' ? live.filter((s) => s.rank === 1 && s.score > 0).map((s) => s.name) : undefined,
      me: isViewerHost
        ? null
        : {
            score: me?.score ?? 0,
            rank: me?.rank ?? null,
            correctCount: me?.correctCount ?? 0,
            answered: data.answers[viewerUserId]?.choice ?? null,
            lastResult: phase === 'reveal' ? data.lastResults?.[viewerUserId] ?? null : null,
            shareToken: phase === 'finished' ? data.shareTokens?.[viewerUserId] ?? null : null,
          },
      questionCount: data.questionCount,
    };
  },

  async onFinished(code, ctx, data) {
    if (!data.standings || !data.shareTokens || !data.eventId) return;
    await saveSaudiHomeResults({
      code,
      eventId: data.eventId,
      questionCount: data.questionCount,
      standings: data.standings.map((s) => ({ ...s, shareToken: data.shareTokens![s.userId] })),
    });
  },

  getFinalResults(data) {
    return (data.standings ?? []).map((s) => ({ userId: s.userId, score: s.score, isWinner: s.rank === 1 && s.score > 0 }));
  },
};
