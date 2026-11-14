import type { RoomMemberSummary } from '@bahjah/shared';
import { GameActionError, tablePlayers, type GameEngine, type GameEngineContext, type GameEngineResult } from '../engine';
import { clearConfig, defaultConfig, getConfig, resolveStatements, type ForOrAgainstConfig, type GameStatement } from './config';

// مع أو ضد (For or Against) -- the debate game.
//
// For each statement: everybody votes For or Against in private; the split
// makes two teams; each team argues for its time (For first); everybody votes
// again; the side with more *final* votes wins the statement, and each player
// who voted for it in the final vote scores a point. A tie goes to sudden
// death (a minute a side and one more vote) or, at the host's word, to no
// winner. Repeat for every statement, then a leaderboard.
//
// The host drives the phases. A vote also closes on its own once everyone
// still in the room has voted, and a team's turn ends when its clock runs
// out (paused time does not count).

export type Side = 'for' | 'against';
type Outcome = 'for' | 'against' | 'tie' | 'none' | 'skipped';

const CLOSING_MS = 1200;
const SUDDEN_DEATH_SECONDS = 60;

interface RoundRecord {
  statementId: string;
  outcome: Outcome;
  before: { for: number; against: number };
  after: { for: number; against: number };
  switched: number;
  suddenDeath?: boolean;
}

export interface ForOrAgainstData {
  seats: string[];
  names: Record<string, string>;
  removed: string[];
  hostPlays: boolean;
  statements: GameStatement[];
  index: number;
  sideSeconds: number;
  allowSwitch: boolean;
  votes1: Record<string, Side>;
  votes2: Record<string, Side>;
  // 'vote2' when switching is off: players held to their first vote.
  locked?: string[];
  // Sudden death: the teams come from the tied final vote, not the first.
  sudden?: boolean;
  tieTeams?: Record<string, Side>;
  side?: Side;
  phaseEndsAt?: number;
  paused?: boolean;
  remainingMs?: number;
  closing?: boolean;
  scores: Record<string, number>;
  switchedCount: Record<string, number>;
  results: RoundRecord[];
  // 'result': this statement's verdict.
  outcome?: Outcome;
  winners?: string[];
  endedEarly?: boolean;
}

type Action =
  | { type: 'vote'; side: Side }
  | { type: 'openVote' }
  | { type: 'closeVote' }
  | { type: 'startDebate' }
  | { type: 'endTurn' }
  | { type: 'pause' }
  | { type: 'suddenDeath' }
  | { type: 'noWinner' }
  | { type: 'next' }
  | { type: 'skip' }
  | { type: 'endGame' }
  | { type: 'remove'; userId: string };

function logEvent(event: string, code: string, detail: Record<string, unknown> = {}): void {
  console.log(JSON.stringify({ game: 'for-or-against', event, room: code, ...detail }));
}

const isSide = (v: unknown): v is Side => v === 'for' || v === 'against';
const count = (votes: Record<string, Side>, ids?: string[]) => {
  const out = { for: 0, against: 0 };
  for (const [id, side] of Object.entries(votes)) if (!ids || ids.includes(id)) out[side] += 1;
  return out;
};

function activeSeats(data: ForOrAgainstData): string[] {
  return data.seats.filter((id) => !data.removed.includes(id));
}

function presentSeats(ctx: GameEngineContext, data: ForOrAgainstData): RoomMemberSummary[] {
  return activeSeats(data)
    .map((id) => ctx.members.find((m) => m.userId === id))
    .filter((m): m is RoomMemberSummary => Boolean(m && m.connected));
}

// The two teams for the debate in progress.
function teams(data: ForOrAgainstData): Record<string, Side> {
  const src = data.sudden ? data.tieTeams ?? {} : data.votes1;
  const out: Record<string, Side> = {};
  for (const [id, side] of Object.entries(src)) if (!data.removed.includes(id)) out[id] = side;
  return out;
}
const teamSize = (data: ForOrAgainstData, side: Side) => Object.values(teams(data)).filter((s) => s === side).length;

function openStatement(code: string, data: ForOrAgainstData, index: number): GameEngineResult<ForOrAgainstData> {
  if (index >= data.statements.length) return finish(code, data, false);
  logEvent('phase_started', code, { phase: 'statement', index });
  return {
    phase: 'statement',
    data: {
      ...data,
      index,
      votes1: {},
      votes2: {},
      locked: undefined,
      sudden: false,
      tieTeams: undefined,
      side: undefined,
      phaseEndsAt: undefined,
      paused: false,
      remainingMs: undefined,
      closing: false,
      outcome: undefined,
      winners: undefined,
    },
  };
}

function finish(code: string, data: ForOrAgainstData, early: boolean): GameEngineResult<ForOrAgainstData> {
  logEvent('game_completed', code, { played: data.results.length, early });
  return { phase: 'finished', data: { ...data, phaseEndsAt: undefined, closing: false, paused: false, endedEarly: early } };
}

function openVote(code: string, data: ForOrAgainstData, round: 1 | 2): GameEngineResult<ForOrAgainstData> {
  logEvent('phase_started', code, { phase: round === 1 ? 'vote1' : 'vote2', index: data.index });
  if (round === 1) return { phase: 'vote1', data: { ...data, votes1: {}, closing: false, phaseEndsAt: undefined } };
  // With switching off, everybody who took a side keeps it; only those who
  // abstained the first time have a vote to cast. Sudden death is always a
  // free vote -- it exists to break a deadlock.
  const votes2: Record<string, Side> = {};
  let locked: string[] | undefined;
  if (!data.allowSwitch && !data.sudden) {
    locked = [];
    for (const [id, side] of Object.entries(data.votes1)) {
      if (data.removed.includes(id)) continue;
      votes2[id] = side;
      locked.push(id);
    }
  }
  return { phase: 'vote2', data: { ...data, votes2, locked, closing: false, phaseEndsAt: undefined, side: undefined, paused: false } };
}

function maybeClose(ctx: GameEngineContext, phase: 'vote1' | 'vote2', data: ForOrAgainstData): GameEngineResult<ForOrAgainstData> {
  if (data.closing) return { phase, data, nextTickAt: data.phaseEndsAt };
  const votes = phase === 'vote1' ? data.votes1 : data.votes2;
  const present = presentSeats(ctx, data);
  if (present.length === 0 || !present.every((m) => votes[m.userId])) return { phase, data };
  const phaseEndsAt = Date.now() + CLOSING_MS;
  return { phase, data: { ...data, closing: true, phaseEndsAt }, nextTickAt: phaseEndsAt };
}

function closeVote1(code: string, data: ForOrAgainstData): GameEngineResult<ForOrAgainstData> {
  logEvent('phase_ended', code, { phase: 'vote1', ...count(data.votes1) });
  return { phase: 'teams', data: { ...data, closing: false, phaseEndsAt: undefined } };
}

function startSide(code: string, data: ForOrAgainstData, side: Side): GameEngineResult<ForOrAgainstData> {
  const seconds = data.sudden ? SUDDEN_DEATH_SECONDS : data.sideSeconds;
  const phaseEndsAt = Date.now() + seconds * 1000;
  logEvent('phase_started', code, { phase: 'debate', side, sudden: Boolean(data.sudden) });
  return { phase: 'debate', data: { ...data, side, phaseEndsAt, paused: false, remainingMs: undefined }, nextTickAt: phaseEndsAt };
}

// For first, then Against; a side with nobody on it is skipped, and with
// nobody on either the final vote opens straight away.
function startDebate(code: string, data: ForOrAgainstData): GameEngineResult<ForOrAgainstData> {
  if (teamSize(data, 'for') > 0) return startSide(code, data, 'for');
  if (teamSize(data, 'against') > 0) return startSide(code, data, 'against');
  return openVote(code, data, 2);
}

function endTurn(code: string, data: ForOrAgainstData): GameEngineResult<ForOrAgainstData> {
  logEvent('phase_ended', code, { phase: 'debate', side: data.side });
  if (data.side === 'for' && teamSize(data, 'against') > 0) return startSide(code, data, 'against');
  return openVote(code, data, 2);
}

function closeVote2(code: string, data: ForOrAgainstData): GameEngineResult<ForOrAgainstData> {
  const ids = activeSeats(data);
  const after = count(data.votes2, ids);
  const before = count(data.votes1, ids);
  logEvent('phase_ended', code, { phase: 'vote2', ...after, sudden: Boolean(data.sudden) });
  const base = { ...data, closing: false, phaseEndsAt: undefined };
  if (after.for + after.against === 0) return record(code, base, 'none', before, after);
  if (after.for === after.against) {
    // A second tie is no winner; a first goes to the host's call.
    if (data.sudden) return record(code, base, 'tie', before, after);
    return { phase: 'tie', data: { ...base, tieTeams: { ...data.votes2 } } };
  }
  return record(code, base, after.for > after.against ? 'for' : 'against', before, after);
}

// Saves the statement's verdict and awards its points, once.
function record(
  code: string,
  data: ForOrAgainstData,
  outcome: Outcome,
  before: { for: number; against: number },
  after: { for: number; against: number }
): GameEngineResult<ForOrAgainstData> {
  const ids = activeSeats(data);
  const winners = outcome === 'for' || outcome === 'against' ? ids.filter((id) => data.votes2[id] === outcome) : [];
  const scores = { ...data.scores };
  for (const id of winners) scores[id] = (scores[id] ?? 0) + 1;
  const switchedIds = ids.filter((id) => data.votes1[id] && data.votes2[id] && data.votes1[id] !== data.votes2[id]);
  const switchedCount = { ...data.switchedCount };
  for (const id of switchedIds) switchedCount[id] = (switchedCount[id] ?? 0) + 1;
  const results = [
    ...data.results,
    { statementId: data.statements[data.index].id, outcome, before, after, switched: switchedIds.length, ...(data.sudden ? { suddenDeath: true } : {}) },
  ];
  logEvent('score_awarded', code, { outcome, winners: winners.length });
  return { phase: 'result', data: { ...data, scores, switchedCount, results, outcome, winners } };
}

function skipStatement(code: string, data: ForOrAgainstData): GameEngineResult<ForOrAgainstData> {
  const zero = { for: 0, against: 0 };
  const results = [...data.results, { statementId: data.statements[data.index].id, outcome: 'skipped' as Outcome, before: zero, after: zero, switched: 0 }];
  logEvent('statement_skipped', code, { index: data.index });
  return openStatement(code, { ...data, results }, data.index + 1);
}

export const forOrAgainstEngine: GameEngine<ForOrAgainstData, Action> = {
  gameType: 'for-or-against',

  async loadConfig(code) {
    return getConfig(code);
  },

  createInitialState(ctx) {
    const config = (ctx.config as ForOrAgainstConfig | undefined) ?? defaultConfig();
    const players = tablePlayers(ctx);
    const seats = players.map((m) => m.userId);
    const data: ForOrAgainstData = {
      seats,
      names: Object.fromEntries(players.map((m) => [m.userId, m.displayName])),
      removed: [],
      hostPlays: ctx.displayMode === 'phone',
      statements: resolveStatements(config),
      index: 0,
      sideSeconds: config.sideSeconds,
      allowSwitch: config.allowSwitch,
      votes1: {},
      votes2: {},
      scores: Object.fromEntries(seats.map((id) => [id, 0])),
      switchedCount: Object.fromEntries(seats.map((id) => [id, 0])),
      results: [],
    };
    logEvent('game_started', ctx.code, { players: seats.length, statements: data.statements.length });
    return openStatement(ctx.code, data, 0);
  },

  applyAction(ctx, phase, data, userId, action) {
    const member = ctx.members.find((m) => m.userId === userId);
    if (!member) throw new GameActionError('NOT_A_MEMBER', 'You are not in this room.');
    const type = action && typeof action === 'object' ? action.type : undefined;
    const keep = (): GameEngineResult<ForOrAgainstData> => ({ phase, data, nextTickAt: data.paused ? undefined : data.phaseEndsAt });

    if (type === 'vote') {
      if (!data.seats.includes(userId)) throw new GameActionError('NOT_SEATED', member.isHost ? 'The host runs the big screen and does not vote.' : 'You joined after the game started.');
      if (data.removed.includes(userId)) throw new GameActionError('REMOVED', 'The host took you out of this game.');
      if (phase !== 'vote1' && phase !== 'vote2') throw new GameActionError('INVALID_PHASE', 'Voting is closed.');
      if (data.closing) throw new GameActionError('INVALID_PHASE', 'Voting is closed.');
      const side = (action as { side?: unknown }).side;
      if (!isSide(side)) throw new GameActionError('INVALID_ACTION', 'Vote For or Against.');
      if (phase === 'vote2' && (data.locked ?? []).includes(userId) && data.votes2[userId] !== side) {
        throw new GameActionError('LOCKED', 'Switching sides is off for this game.');
      }
      // One vote per player per voting phase; changing it before the vote
      // closes replaces it rather than adding another.
      if (phase === 'vote1') return maybeClose(ctx, phase, { ...data, votes1: { ...data.votes1, [userId]: side } });
      return maybeClose(ctx, phase, { ...data, votes2: { ...data.votes2, [userId]: side } });
    }

    if (!member.isHost) throw new GameActionError('NOT_HOST', 'Only the host can do that.');

    switch (type) {
      case 'openVote':
        if (phase !== 'statement') throw new GameActionError('INVALID_PHASE', 'There is no statement waiting.');
        return openVote(ctx.code, data, 1);
      case 'closeVote':
        if (phase === 'vote1') return closeVote1(ctx.code, data);
        if (phase === 'vote2') return closeVote2(ctx.code, data);
        throw new GameActionError('INVALID_PHASE', 'No vote is open.');
      case 'startDebate':
        if (phase !== 'teams') throw new GameActionError('INVALID_PHASE', 'The teams are not ready.');
        return startDebate(ctx.code, data);
      case 'endTurn':
        if (phase !== 'debate') throw new GameActionError('INVALID_PHASE', 'No team is arguing.');
        return endTurn(ctx.code, { ...data, paused: false });
      case 'pause': {
        if (phase !== 'debate') throw new GameActionError('INVALID_PHASE', 'There is no clock running.');
        if (data.paused) {
          const phaseEndsAt = Date.now() + Math.max(500, data.remainingMs ?? 0);
          logEvent('resumed', ctx.code, {});
          return { phase, data: { ...data, paused: false, remainingMs: undefined, phaseEndsAt }, nextTickAt: phaseEndsAt };
        }
        logEvent('paused', ctx.code, {});
        return { phase, data: { ...data, paused: true, remainingMs: Math.max(0, (data.phaseEndsAt ?? Date.now()) - Date.now()), phaseEndsAt: undefined } };
      }
      case 'suddenDeath':
        if (phase !== 'tie') throw new GameActionError('INVALID_PHASE', 'There is no tie to break.');
        return startDebate(ctx.code, { ...data, sudden: true });
      case 'noWinner': {
        if (phase !== 'tie') throw new GameActionError('INVALID_PHASE', 'There is no tie.');
        const ids = activeSeats(data);
        return record(ctx.code, data, 'tie', count(data.votes1, ids), count(data.votes2, ids));
      }
      case 'next':
        if (phase !== 'result') throw new GameActionError('INVALID_PHASE', 'The verdict is not in yet.');
        return openStatement(ctx.code, data, data.index + 1);
      case 'skip':
        if (!['statement', 'vote1', 'teams', 'debate', 'vote2', 'tie'].includes(phase)) throw new GameActionError('INVALID_PHASE', 'Nothing to skip.');
        return skipStatement(ctx.code, data);
      case 'endGame':
        if (phase === 'finished') return keep();
        return finish(ctx.code, data, true);
      case 'remove': {
        const target = String((action as { userId?: unknown }).userId ?? '');
        if (!data.seats.includes(target)) throw new GameActionError('INVALID_ACTION', 'That player is not in this game.');
        if (target === userId) throw new GameActionError('INVALID_ACTION', 'You cannot remove yourself.');
        if (data.removed.includes(target)) return keep();
        const votes1 = { ...data.votes1 };
        const votes2 = { ...data.votes2 };
        if (phase === 'vote1') delete votes1[target];
        if (phase === 'vote2') delete votes2[target];
        const next = { ...data, removed: [...data.removed, target], votes1, votes2 };
        if (phase === 'vote1' || phase === 'vote2') return maybeClose(ctx, phase, next);
        return { phase, data: next, nextTickAt: next.paused ? undefined : next.phaseEndsAt };
      }
      default:
        throw new GameActionError('INVALID_ACTION', 'Unknown action.');
    }
  },

  tick(ctx, phase, data) {
    if (phase === 'vote1' && data.closing) return closeVote1(ctx.code, data);
    if (phase === 'vote2' && data.closing) return closeVote2(ctx.code, data);
    if (phase === 'debate' && !data.paused) return endTurn(ctx.code, data);
    return { phase, data };
  },

  // A vote closes once everyone *present* has voted, so it is looked at again
  // when somebody's phone drops. The debate clock is the host's to pause.
  onPresenceChange(ctx, phase, data) {
    if (phase === 'vote1' || phase === 'vote2') return maybeClose(ctx, phase, data);
    return { phase, data, nextTickAt: data.paused ? undefined : data.phaseEndsAt };
  },

  async cleanup(code) {
    await clearConfig(code);
  },

  toClientView(ctx, phase, data, viewer) {
    const statement = data.statements[data.index];
    const seatSet = new Set(activeSeats(data));
    const view: Record<string, unknown> = {
      serverNow: Date.now(),
      hostPlays: data.hostPlays,
      players: data.seats.map((userId, seat) => ({
        userId,
        name: data.names[userId] ?? '',
        seat,
        ...(data.removed.includes(userId) ? { removed: true } : {}),
      })),
      seated: data.seats.includes(viewer),
      removed: data.removed.includes(viewer),
      index: data.index,
      total: data.statements.length,
      statement: statement ? { id: statement.id, ar: statement.ar, en: statement.en, category: statement.category, mine: Boolean(statement.mine) } : null,
      sideSeconds: data.sideSeconds,
      allowSwitch: data.allowSwitch,
      scores: data.scores,
      phaseEndsAt: data.phaseEndsAt,
      closing: Boolean(data.closing),
      sudden: Boolean(data.sudden),
    };

    if (phase === 'vote1' || phase === 'vote2') {
      // Who has voted, never what: each vote stays private until it closes.
      const votes = phase === 'vote1' ? data.votes1 : data.votes2;
      view.votedIds = Object.keys(votes).filter((id) => seatSet.has(id));
      view.myVote = votes[viewer] ?? null;
      if (phase === 'vote2') {
        view.myFirst = data.votes1[viewer] ?? null;
        view.myLocked = (data.locked ?? []).includes(viewer);
      }
    }
    if (['teams', 'debate', 'vote2', 'result', 'tie'].includes(phase)) {
      view.teams = teams(data);
      view.firstVotes = Object.fromEntries(Object.entries(data.votes1).filter(([id]) => seatSet.has(id)));
    }
    if (phase === 'debate') {
      view.side = data.side;
      view.paused = Boolean(data.paused);
      view.remainingMs = data.remainingMs;
      view.turnSeconds = data.sudden ? SUDDEN_DEATH_SECONDS : data.sideSeconds;
      view.nextSide = data.side === 'for' && teamSize(data, 'against') > 0 ? 'against' : null;
    }
    if (phase === 'tie') {
      view.tie = count(data.votes2, [...seatSet]);
    }
    if (phase === 'result') {
      view.result = data.results[data.results.length - 1];
      view.winners = data.winners ?? [];
      view.myFinal = data.votes2[viewer] ?? null;
      view.finalVotes = data.votes2;
    }
    if (phase === 'finished') {
      view.results = data.results.map((r) => {
        const s = data.statements.find((x) => x.id === r.statementId);
        return { ...r, ar: s?.ar ?? '', en: s?.en ?? '' };
      });
      view.unplayed = Math.max(0, data.statements.length - data.results.length);
      view.switchedCount = data.switchedCount;
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
