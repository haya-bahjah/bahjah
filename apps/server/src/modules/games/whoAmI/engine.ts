import type { RoomMemberSummary } from '@bahjah/shared';
import { GameActionError, tablePlayers, type GameEngine, type GameEngineContext, type GameEngineResult } from '../engine';
import { addPlayed, clearConfig, defaultConfig, getConfig, getPlayed, POINTS, resolveIdentities, type RevealMode, type WhoAmIConfig } from './config';
import type { Identity } from './identities';
import { judge } from './match';

// مين أنا؟ (Who Am I?) -- the clue game.
//
// Each round hides one identity behind six first-person clues, hardest first.
// Clues come out one at a time -- every N seconds in Timed mode, or when the
// host says so -- and never out of order. Players guess in free text on
// their phones, as often as they like; wrong tries cost nothing. A correct
// guess locks the player in at the value of the newest clue showing when it
// arrived (600, 500 ... 100). A guess the matcher is unsure of goes to the
// host, keeping that clue's value while the player carries on trying.
//
// Phases: intro (round start) -> clue (1..6) -> reveal -> board, then the
// next round's intro, and finished after the last.
//
// The host never plays: they can see the answer. The shared screen is the
// host's own device, so it gets the host's view and simply does not draw the
// answer or anybody's guess text.

const ALL_SOLVED_GRACE_MS = 2000;
const MAX_GUESSES_PER_ROUND = 40;
const MAX_GUESS_LENGTH = 60;

type GuessVerdict = 'correct' | 'wrong' | 'review' | 'accepted' | 'rejected';

interface Guess {
  id: string;
  userId: string;
  text: string;
  clue: number;
  verdict: GuessVerdict;
  at: number;
}

interface Solve {
  clue: number;
  points: number;
}

interface RoundRecord {
  identityId: string;
  solvers: Array<{ userId: string; clue: number; points: number }>;
  skipped?: boolean;
}

export interface WhoAmIData {
  seats: string[];
  names: Record<string, string>;
  removed: string[];
  identities: Identity[];
  round: number;
  // Clues showing: 0 before the first, then 1..6.
  clue: number;
  reveal: RevealMode;
  seconds: number;
  hostOnTv: boolean;
  phaseEndsAt?: number;
  paused?: boolean;
  // Paused by the host's devices all dropping, not by the host.
  autoPaused?: boolean;
  remainingMs?: number;
  // Everyone has it: the answer comes up in a moment.
  closing?: boolean;
  guesses: Guess[];
  solved: Record<string, Solve>;
  scores: Record<string, number>;
  solvedCount: Record<string, number>;
  history: RoundRecord[];
  seq: number;
  endedEarly?: boolean;
}

type Action =
  | { type: 'guess'; text: string }
  | { type: 'startClues' }
  | { type: 'nextClue' }
  | { type: 'pause' }
  | { type: 'resumeAuto' }
  | { type: 'revealAnswer' }
  | { type: 'accept'; guessId: string }
  | { type: 'reject'; guessId: string }
  | { type: 'board' }
  | { type: 'next' }
  | { type: 'skip' }
  | { type: 'endGame' }
  | { type: 'remove'; userId: string }
  | { type: 'hostOnTv'; on: boolean };

function logEvent(event: string, code: string, detail: Record<string, unknown> = {}): void {
  console.log(JSON.stringify({ game: 'who-am-i', event, room: code, ...detail }));
}

const activeSeats = (data: WhoAmIData) => data.seats.filter((id) => !data.removed.includes(id));
const pointsFor = (clue: number) => POINTS[Math.max(1, Math.min(6, clue)) - 1];
const hostId = (ctx: GameEngineContext) => ctx.members.find((m) => m.isHost)?.userId ?? null;
const hostOnline = (ctx: GameEngineContext) => Boolean(ctx.members.find((m) => m.isHost && m.connected));

function presentSeats(ctx: GameEngineContext, data: WhoAmIData): RoomMemberSummary[] {
  return activeSeats(data)
    .map((id) => ctx.members.find((m) => m.userId === id))
    .filter((m): m is RoomMemberSummary => Boolean(m && m.connected));
}

const keep = (phase: string, data: WhoAmIData): GameEngineResult<WhoAmIData> => ({ phase, data, nextTickAt: data.paused ? undefined : data.phaseEndsAt });

function openRound(code: string, data: WhoAmIData, round: number): GameEngineResult<WhoAmIData> {
  if (round >= data.identities.length) return finish(code, data, false);
  logEvent('phase_started', code, { phase: 'intro', round });
  return {
    phase: 'intro',
    data: { ...data, round, clue: 0, guesses: [], solved: {}, phaseEndsAt: undefined, paused: false, autoPaused: false, remainingMs: undefined, closing: false },
  };
}

function finish(code: string, data: WhoAmIData, early: boolean): GameEngineResult<WhoAmIData> {
  logEvent('game_completed', code, { played: data.history.length, early });
  return { phase: 'finished', data: { ...data, phaseEndsAt: undefined, paused: false, closing: false, endedEarly: early } };
}

// Shows clue `n`. In Timed mode its clock starts now.
function showClue(code: string, data: WhoAmIData, n: number): GameEngineResult<WhoAmIData> {
  logEvent('clue_revealed', code, { round: data.round, clue: n });
  const phaseEndsAt = data.reveal === 'timed' ? Date.now() + data.seconds * 1000 : undefined;
  return { phase: 'clue', data: { ...data, clue: n, phaseEndsAt, paused: false, autoPaused: false, remainingMs: undefined }, nextTickAt: phaseEndsAt };
}

function toReveal(code: string, data: WhoAmIData): GameEngineResult<WhoAmIData> {
  logEvent('answer_revealed', code, { round: data.round, solved: Object.keys(data.solved).length });
  return { phase: 'reveal', data: { ...data, phaseEndsAt: undefined, paused: false, autoPaused: false, remainingMs: undefined, closing: false } };
}

// Closes the round's books: anything still waiting for the host's call is
// turned down, and the round goes into the history.
function recordRound(data: WhoAmIData, skipped = false): WhoAmIData {
  const identity = data.identities[data.round];
  const guesses = data.guesses.map((g) => (g.verdict === 'review' ? { ...g, verdict: 'rejected' as GuessVerdict } : g));
  const solvers = skipped
    ? []
    : Object.entries(data.solved)
        .filter(([id]) => !data.removed.includes(id))
        .map(([userId, s]) => ({ userId, clue: s.clue, points: s.points }))
        .sort((a, b) => a.clue - b.clue);
  if (data.history.some((h) => h.identityId === identity.id)) return { ...data, guesses };
  return { ...data, guesses, history: [...data.history, { identityId: identity.id, solvers, ...(skipped ? { skipped: true } : {}) }] };
}

// Locks a player in at `clue`, or raises them to it if an earlier guess the
// host has just accepted was worth more than the one that already counted.
function award(data: WhoAmIData, userId: string, clue: number): WhoAmIData {
  const points = pointsFor(clue);
  const before = data.solved[userId];
  if (before && before.points >= points) return data;
  const scores = { ...data.scores, [userId]: (data.scores[userId] ?? 0) - (before?.points ?? 0) + points };
  const solvedCount = before ? data.solvedCount : { ...data.solvedCount, [userId]: (data.solvedCount[userId] ?? 0) + 1 };
  return { ...data, scores, solvedCount, solved: { ...data.solved, [userId]: { clue, points } } };
}

// Everyone still here has it: put the answer up after a short beat.
function maybeClose(ctx: GameEngineContext, data: WhoAmIData): GameEngineResult<WhoAmIData> {
  if (data.closing) return keep('clue', data);
  const present = presentSeats(ctx, data);
  if (present.length === 0 || !present.every((m) => data.solved[m.userId])) return keep('clue', data);
  const phaseEndsAt = Date.now() + ALL_SOLVED_GRACE_MS;
  return { phase: 'clue', data: { ...data, closing: true, paused: false, autoPaused: false, remainingMs: undefined, phaseEndsAt }, nextTickAt: phaseEndsAt };
}

function pause(data: WhoAmIData, auto: boolean): WhoAmIData {
  return { ...data, paused: true, autoPaused: auto, remainingMs: Math.max(0, (data.phaseEndsAt ?? Date.now()) - Date.now()), phaseEndsAt: undefined };
}

function resume(data: WhoAmIData): GameEngineResult<WhoAmIData> {
  const phaseEndsAt = Date.now() + Math.max(500, data.remainingMs ?? 0);
  return { phase: 'clue', data: { ...data, paused: false, autoPaused: false, remainingMs: undefined, phaseEndsAt }, nextTickAt: phaseEndsAt };
}

export const whoAmIEngine: GameEngine<WhoAmIData, Action> = {
  gameType: 'who-am-i',

  // The identities are dealt here, where the room's history can be read:
  // ones this room has already played go to the back of the deck.
  async loadConfig(code) {
    const config = await getConfig(code);
    const identities = resolveIdentities(config, await getPlayed(code));
    await addPlayed(code, identities.map((i) => i.id));
    return { ...config, identities };
  },

  createInitialState(ctx) {
    const config = (ctx.config as (WhoAmIConfig & { identities?: Identity[] }) | undefined) ?? defaultConfig();
    const players = tablePlayers(ctx);
    const seats = players.map((m) => m.userId);
    const data: WhoAmIData = {
      seats,
      names: Object.fromEntries(players.map((m) => [m.userId, m.displayName])),
      removed: [],
      identities: (config as { identities?: Identity[] }).identities ?? resolveIdentities(config),
      round: 0,
      clue: 0,
      reveal: config.reveal,
      seconds: config.seconds,
      hostOnTv: config.hostOnTv,
      guesses: [],
      solved: {},
      scores: Object.fromEntries(seats.map((id) => [id, 0])),
      solvedCount: Object.fromEntries(seats.map((id) => [id, 0])),
      history: [],
      seq: 0,
    };
    logEvent('game_started', ctx.code, { players: seats.length, identities: data.identities.length, reveal: data.reveal });
    return openRound(ctx.code, data, 0);
  },

  applyAction(ctx, phase, data, userId, action) {
    const member = ctx.members.find((m) => m.userId === userId);
    if (!member) throw new GameActionError('NOT_A_MEMBER', 'You are not in this room.');
    const type = action && typeof action === 'object' ? action.type : undefined;

    if (type === 'guess') {
      if (!data.seats.includes(userId)) throw new GameActionError('NOT_SEATED', member.isHost ? 'The host knows the answer and does not guess.' : 'You joined after the game started.');
      if (data.removed.includes(userId)) throw new GameActionError('REMOVED', 'The host took you out of this game.');
      if (phase !== 'clue') throw new GameActionError('ROUND_LOCKED', 'Round locked — your guess arrived after time.');
      if (data.solved[userId]) throw new GameActionError('ALREADY_SOLVED', 'You already have this one.');
      const text = String((action as { text?: unknown }).text ?? '').trim().replace(/\s+/g, ' ');
      if (!text) throw new GameActionError('INVALID_ACTION', 'Type a name.');
      if (text.length > MAX_GUESS_LENGTH) throw new GameActionError('INVALID_ACTION', `Keep it under ${MAX_GUESS_LENGTH} characters.`);
      if (data.guesses.filter((g) => g.userId === userId).length >= MAX_GUESSES_PER_ROUND) throw new GameActionError('TOO_MANY', 'That is a lot of tries — wait for the next clue.');
      const identity = data.identities[data.round];
      let verdict: GuessVerdict = judge(text, identity.aliases);
      // With the host on the TV there is no private place to review, so an
      // unsure guess counts as a miss -- free, like every miss.
      if (verdict === 'review' && data.hostOnTv) verdict = 'wrong';
      const guess: Guess = { id: `g${data.seq + 1}`, userId, text, clue: data.clue, verdict, at: Date.now() };
      let next: WhoAmIData = { ...data, seq: data.seq + 1, guesses: [...data.guesses, guess] };
      logEvent('guess', ctx.code, { round: data.round, clue: data.clue, verdict });
      if (verdict === 'correct') {
        next = award(next, userId, data.clue);
        return maybeClose(ctx, next);
      }
      return keep(phase, next);
    }

    if (!member.isHost) throw new GameActionError('NOT_HOST', 'Only the host can do that.');

    switch (type) {
      case 'startClues':
        if (phase !== 'intro') throw new GameActionError('INVALID_PHASE', 'The clues have already started.');
        return showClue(ctx.code, data, 1);
      case 'nextClue':
        if (phase !== 'clue') throw new GameActionError('INVALID_PHASE', 'No round is running.');
        if (data.closing) return keep(phase, data);
        if (data.clue >= 6) throw new GameActionError('INVALID_PHASE', 'All six clues are out.');
        return showClue(ctx.code, data, data.clue + 1);
      case 'pause':
        if (phase !== 'clue' || data.reveal !== 'timed' || data.closing) throw new GameActionError('INVALID_PHASE', 'There is no clock running.');
        return data.paused ? resume(data) : { phase, data: pause(data, false) };
      // Sent by the host's screens as they come back: lifts a pause the
      // host's absence caused, and does nothing otherwise -- so the TV and the
      // panel both sending it is harmless. (A rejoin does not reach
      // onPresenceChange on its own.)
      case 'resumeAuto':
        if (phase === 'clue' && data.paused && data.autoPaused) return resume(data);
        return keep(phase, data);
      case 'revealAnswer':
        if (phase !== 'clue' && phase !== 'intro') throw new GameActionError('INVALID_PHASE', 'There is no round to reveal.');
        return toReveal(ctx.code, data);
      case 'accept':
      case 'reject': {
        if (phase !== 'clue' && phase !== 'reveal') throw new GameActionError('INVALID_PHASE', 'There is nothing to review now.');
        const id = String((action as { guessId?: unknown }).guessId ?? '');
        const g = data.guesses.find((x) => x.id === id);
        if (!g) throw new GameActionError('INVALID_ACTION', 'That guess is not waiting for review.');
        if (g.verdict !== 'review') return keep(phase, data);
        const verdict: GuessVerdict = type === 'accept' ? 'accepted' : 'rejected';
        let next: WhoAmIData = { ...data, guesses: data.guesses.map((x) => (x.id === id ? { ...x, verdict } : x)) };
        logEvent('reviewed', ctx.code, { round: data.round, verdict });
        if (verdict === 'accepted' && !data.removed.includes(g.userId)) {
          next = award(next, g.userId, g.clue);
          if (phase === 'clue') return maybeClose(ctx, next);
        }
        return keep(phase, next);
      }
      case 'board':
        if (phase !== 'reveal') throw new GameActionError('INVALID_PHASE', 'The answer is not up yet.');
        return { phase: 'board', data: recordRound(data) };
      case 'next':
        if (phase === 'reveal') return openRound(ctx.code, recordRound(data), data.round + 1);
        if (phase !== 'board') throw new GameActionError('INVALID_PHASE', 'Finish this round first.');
        return openRound(ctx.code, data, data.round + 1);
      case 'skip': {
        if (phase !== 'intro' && phase !== 'clue') throw new GameActionError('INVALID_PHASE', 'Nothing to skip.');
        // A skipped identity scores nobody: points already won this round
        // are taken back, so a skip is never worth more than playing it out.
        const scores = { ...data.scores };
        const solvedCount = { ...data.solvedCount };
        for (const [id, s] of Object.entries(data.solved)) {
          scores[id] = (scores[id] ?? 0) - s.points;
          solvedCount[id] = Math.max(0, (solvedCount[id] ?? 0) - 1);
        }
        logEvent('identity_skipped', ctx.code, { round: data.round });
        return openRound(ctx.code, recordRound({ ...data, scores, solvedCount, solved: {} }, true), data.round + 1);
      }
      case 'endGame':
        if (phase === 'finished') return keep(phase, data);
        return finish(ctx.code, phase === 'reveal' ? recordRound(data) : data, true);
      case 'remove': {
        const target = String((action as { userId?: unknown }).userId ?? '');
        if (!data.seats.includes(target)) throw new GameActionError('INVALID_ACTION', 'That player is not in this game.');
        if (data.removed.includes(target)) return keep(phase, data);
        const next = { ...data, removed: [...data.removed, target] };
        if (phase === 'clue') return maybeClose(ctx, next);
        return keep(phase, next);
      }
      case 'hostOnTv': {
        const on = Boolean((action as { on?: unknown }).on);
        return keep(phase, { ...data, hostOnTv: on });
      }
      default:
        throw new GameActionError('INVALID_ACTION', 'Unknown action.');
    }
  },

  tick(ctx, phase, data) {
    if (phase !== 'clue' || data.paused) return keep(phase, data);
    if (data.closing || data.clue >= 6) return toReveal(ctx.code, data);
    if (data.reveal === 'timed') return showClue(ctx.code, data, data.clue + 1);
    return keep(phase, data);
  },

  // A round closes early once everyone *present* has it, so it is looked at
  // again when a phone drops. A Timed round holds still while every one of
  // the host's devices is gone, and carries on when one comes back.
  onPresenceChange(ctx, phase, data) {
    if (phase !== 'clue') return keep(phase, data);
    if (data.reveal === 'timed' && !data.closing) {
      if (!hostOnline(ctx) && !data.paused) return { phase, data: pause(data, true) };
      if (hostOnline(ctx) && data.paused && data.autoPaused) return resume(data);
    }
    return maybeClose(ctx, data);
  },

  async cleanup(code) {
    await clearConfig(code);
  },

  toClientView(ctx, phase, data, viewer) {
    const isHost = viewer === hostId(ctx);
    const identity = data.identities[data.round];
    const seatSet = new Set(activeSeats(data));
    const answerOut = phase === 'reveal' || phase === 'board' || phase === 'finished';
    const shown = Math.max(0, Math.min(6, data.clue));
    const view: Record<string, unknown> = {
      serverNow: Date.now(),
      players: data.seats.map((userId, seat) => ({ userId, name: data.names[userId] ?? '', seat, ...(data.removed.includes(userId) ? { removed: true } : {}) })),
      seated: data.seats.includes(viewer),
      removed: data.removed.includes(viewer),
      isHost,
      round: data.round,
      total: data.identities.length,
      clue: data.clue,
      reveal: data.reveal,
      seconds: data.seconds,
      hostOnTv: data.hostOnTv,
      phaseEndsAt: data.phaseEndsAt,
      paused: Boolean(data.paused),
      autoPaused: Boolean(data.autoPaused),
      remainingMs: data.remainingMs,
      closing: Boolean(data.closing),
      points: POINTS,
      scores: data.scores,
      solvedCount: data.solvedCount,
    };
    if (identity && phase !== 'finished') {
      // Clues only as far as they have come out; the host sees all six.
      view.clues = {
        ar: identity.ar.clues.slice(0, isHost ? 6 : shown),
        en: identity.en.clues.slice(0, isHost ? 6 : shown),
      };
      // Who has it, never what they typed.
      view.status = activeSeats(data).map((userId) => {
        const mine = data.guesses.filter((g) => g.userId === userId);
        const s = data.solved[userId];
        return {
          userId,
          state: s ? 'solved' : mine.some((g) => g.verdict === 'review') ? 'review' : mine.length ? 'guessing' : 'none',
          clue: s?.clue,
          points: s?.points,
          tries: mine.length,
        };
      });
      view.mySolve = data.solved[viewer] ?? null;
      view.myGuesses = data.guesses.filter((g) => g.userId === viewer).map((g) => ({ id: g.id, text: g.text, clue: g.clue, verdict: g.verdict }));
      if (isHost || answerOut) {
        view.answer = { ar: identity.ar.name, en: identity.en.name, aliases: identity.aliases, image: identity.image ?? null };
      }
      if (isHost) {
        view.guesses = data.guesses.map((g) => ({ ...g, name: data.names[g.userId] ?? '' }));
      }
      if (answerOut) {
        view.solvers = Object.entries(data.solved)
          .filter(([id]) => seatSet.has(id))
          .map(([userId, s]) => ({ userId, clue: s.clue, points: s.points }))
          .sort((a, b) => a.clue - b.clue);
      }
    }
    if (phase === 'board' || phase === 'finished') {
      const last = data.history[data.history.length - 1];
      view.delta = Object.fromEntries((last?.solvers ?? []).map((s) => [s.userId, s.points]));
    }
    if (phase === 'finished') {
      view.history = data.history.map((h) => {
        const i = data.identities.find((x) => x.id === h.identityId);
        return { ...h, ar: i?.ar.name ?? '', en: i?.en.name ?? '' };
      });
      view.endedEarly = Boolean(data.endedEarly);
    }
    return view;
  },

  getFinalResults(data) {
    const ids = activeSeats(data);
    const top = Math.max(0, ...ids.map((id) => data.scores[id] ?? 0));
    return ids.map((userId) => ({ userId, score: data.scores[userId] ?? 0, isWinner: top > 0 && (data.scores[userId] ?? 0) === top }));
  },
};
