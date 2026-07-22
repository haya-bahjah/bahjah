import { GameActionError, type GameEngine, type GameEngineContext, type GameEngineResult } from '../engine';
import { clearMafiaRoomConfig, defaultMafiaConfig, getMafiaRoomConfig, type MafiaRoomConfig, type MafiaTieRule } from './config';

// Not host-configurable -- the flow doc lists day/night/vote as the only
// configurable timers, so this failsafe (in case someone never presses
// "I'm Ready") stays fixed.
const ROLE_REVEAL_FAILSAFE_SECONDS = 45;
const MAX_CHAT_MESSAGES = 50;
const MAX_CHAT_LENGTH = 240;
// Stall guard: a doctor who keeps saving the mafia's target combined with a
// day vote that keeps tying (tieRule 'none') can otherwise cycle day/night
// forever with no elimination and no winner -- confirmed live during
// playtesting (rooms stuck at round 7-8 with no end in sight). Village is
// already strictly ahead by definition whenever checkWinner hasn't returned
// a winner, so forcing a village win past this round is a fair, deterministic
// way to guarantee every game actually ends.
const MAX_ROUNDS = 12;

export type MafiaRole = 'mafia' | 'detective' | 'doctor' | 'villager';

interface MafiaPlayer {
  userId: string;
  role: MafiaRole;
  alive: boolean;
}

interface DetectiveResult {
  targetUserId: string;
  isMafia: boolean;
}

interface MafiaChatMessage {
  userId: string;
  text: string;
  at: number;
}

// Config-derived values an engine call after createInitialState still needs
// (timer durations, tie rule, etc.) -- ctx.config is only ever populated at
// createInitialState time, so anything needed later has to be baked into
// data once, here, exactly like every other engine in this codebase does.
interface MafiaSettings {
  daySeconds: number;
  nightSeconds: number;
  voteSeconds: number;
  tieRule: MafiaTieRule;
  revealEliminatedRole: boolean;
  doctorCanProtectSelf: boolean;
}

interface MafiaStats {
  doctorSaves: number;
  detectiveFinds: Record<string, number>;
}

// Full authoritative state, kept server-side (Redis). Never sent to clients
// as-is -- toClientView() below redacts it per viewer.
interface MafiaData {
  players: MafiaPlayer[];
  round: number;
  phaseEndsAt?: number;
  settings: MafiaSettings;
  // 'role-reveal' phase only: who has pressed "I'm Ready" so far.
  readyUserIds: string[];
  mafiaKillVotes: Record<string, string>;
  mafiaChat: MafiaChatMessage[];
  // Per-round working copy: gates "already acted this round". Reset to {} at
  // the start of every night.
  detectiveInvestigation: Record<string, DetectiveResult>;
  // Persists across phases (never auto-cleared) so a detective still has
  // their intel during the day/vote that follows, instead of losing it the
  // instant the night resolves.
  lastInvestigation: Record<string, DetectiveResult>;
  doctorProtection: Record<string, string>;
  dayVotes: Record<string, string>;
  // 'revote' phase only: the tied candidates a revote is scoped to.
  revoteCandidates?: string[];
  lastNightEliminated?: string | null;
  lastVoteEliminated?: string | null;
  // Snapshot of the day vote (or revote) once it resolves -- who voted for
  // whom. During the vote itself, clients only ever see who HAS voted,
  // never for whom, until this snapshot is taken.
  lastVoteTally?: Record<string, string>;
  // Populated immediately on elimination (night or vote) when
  // settings.revealEliminatedRole is on -- "who died" and "what they were"
  // land in the very same resolution, matching the flow doc's own example.
  eliminatedRoles: Record<string, MafiaRole>;
  stats: MafiaStats;
  // Every day-vote and revote cast, across the whole game -- used only at
  // 'finished' to compute each player's voting accuracy against final roles.
  voteHistory: Array<{ round: number; voterId: string; targetId: string }>;
  winner?: 'mafia' | 'village';
}

type MafiaAction =
  | { type: 'ready' }
  | { type: 'mafia-kill'; targetUserId: string }
  | { type: 'mafia-chat'; text: string }
  | { type: 'investigate'; targetUserId: string }
  | { type: 'protect'; targetUserId: string }
  | { type: 'vote'; targetUserId: string };

interface MafiaFinalStats {
  totalRounds: number;
  playersEliminated: number;
  mafiaEliminations: number;
  survivors: string[];
  doctorSaves: number;
  detectiveFinds: Record<string, number>;
  votingAccuracy: Record<string, number>;
}

interface MafiaClientView {
  players: Array<{ userId: string; alive: boolean }>;
  round: number;
  phaseEndsAt?: number;
  myRole: MafiaRole | null;
  myAlive: boolean;
  eliminatedRoles: Record<string, MafiaRole>;
  lastNightEliminated?: string | null;
  lastVoteEliminated?: string | null;
  lastVoteTally?: Record<string, string>;
  winner?: 'mafia' | 'village';
  // 'role-reveal' only.
  readyCount?: number;
  totalPlayers?: number;
  iAmReady?: boolean;
  // Everyone's role + final stats, revealed only once the game has ended.
  allRoles?: Record<string, MafiaRole>;
  stats?: MafiaFinalStats;
  // Night, mafia-only: their shared private target channel + team chat.
  mafiaTeammates?: string[];
  mafiaVotes?: Record<string, string>;
  myKillVote?: string | null;
  mafiaChat?: MafiaChatMessage[];
  // Detective-only.
  myInvestigation?: DetectiveResult | null;
  actedThisRound?: boolean;
  // Night, doctor-only.
  myProtection?: string | null;
  // 'vote'/'revote': who has voted is visible (urgency), for whom stays
  // hidden until lastVoteTally is populated above.
  votedUserIds?: string[];
  myVote?: string | null;
  revoteCandidates?: string[];
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Matches the flow doc's suggested-defaults table exactly (4-6:1, 7-10:2,
// 11-15:3, 16+:4). The 16+ bracket is currently unreachable given
// GAME_PLAYER_LIMITS.mafia.max=15, kept for doc fidelity/future-proofing.
function defaultMafiaCount(total: number): number {
  if (total <= 6) return 1;
  if (total <= 10) return 2;
  if (total <= 15) return 3;
  return 4;
}

function assignRoles(members: GameEngineContext['members'], config: MafiaRoomConfig): MafiaPlayer[] {
  const ids = shuffle(members.map((m) => m.userId));
  const total = ids.length;
  // A host override is clamped defensively (in case it was set before the
  // final player count was known) so mafia can never start already at or
  // past parity with the village.
  const maxOverride = Math.max(1, Math.floor((total - 1) / 2));
  const mafiaCount =
    config.mafiaCountOverride != null ? Math.max(1, Math.min(config.mafiaCountOverride, maxOverride)) : defaultMafiaCount(total);

  const roles: MafiaRole[] = [];
  for (let i = 0; i < mafiaCount; i++) roles.push('mafia');
  if (config.includeDoctor) roles.push('doctor');
  if (config.includeDetective) roles.push('detective');
  while (roles.length < total) roles.push('villager');

  return ids.map((userId, i) => ({ userId, role: roles[i], alive: true }));
}

function tallyWithTieInfo(votes: Record<string, string>): { leaders: string[] } {
  const counts = new Map<string, number>();
  Object.values(votes).forEach((target) => counts.set(target, (counts.get(target) ?? 0) + 1));
  if (counts.size === 0) return { leaders: [] };
  const max = Math.max(...counts.values());
  return { leaders: [...counts.entries()].filter(([, count]) => count === max).map(([id]) => id) };
}

// The flow doc doesn't call out a configurable tie rule for the mafia's own
// kill vote (only for the day vote) -- a tie here is broken randomly, same
// as this engine has always done.
function tallyMafiaKill(votes: Record<string, string>): string | null {
  const { leaders } = tallyWithTieInfo(votes);
  if (leaders.length === 0) return null;
  return leaders[Math.floor(Math.random() * leaders.length)];
}

function checkWinner(players: MafiaPlayer[]): 'mafia' | 'village' | undefined {
  const alive = players.filter((p) => p.alive);
  const aliveMafia = alive.filter((p) => p.role === 'mafia').length;
  const aliveVillage = alive.length - aliveMafia;
  if (aliveMafia === 0) return 'village';
  if (aliveMafia >= aliveVillage) return 'mafia';
  return undefined;
}

function eliminate(players: MafiaPlayer[], targetUserId: string | null): { players: MafiaPlayer[]; eliminatedRole: MafiaRole | null } {
  if (!targetUserId) return { players, eliminatedRole: null };
  const target = players.find((p) => p.userId === targetUserId);
  const nextPlayers = players.map((p) => (p.userId === targetUserId ? { ...p, alive: false } : p));
  return { players: nextPlayers, eliminatedRole: target ? target.role : null };
}

// Reveals a dead player's role immediately, in the same resolution as their
// elimination, when the room's settings allow it -- matches the flow doc's
// own example ("Ahmed was eliminated." / "Ahmed was a Villager.", same
// beat, not staggered).
function revealIfEnabled(data: MafiaData, targetId: string | null, role: MafiaRole | null): Record<string, MafiaRole> {
  if (!targetId || !role || !data.settings.revealEliminatedRole) return data.eliminatedRoles;
  return { ...data.eliminatedRoles, [targetId]: role };
}

function resolveRoleReveal(data: MafiaData): GameEngineResult<MafiaData> {
  const phaseEndsAt = Date.now() + data.settings.daySeconds * 1000;
  return { phase: 'briefing', data: { ...data, phaseEndsAt, readyUserIds: [] }, nextTickAt: phaseEndsAt };
}

function resolveNight(ctx: GameEngineContext, data: MafiaData): GameEngineResult<MafiaData> {
  const killTarget = tallyMafiaKill(data.mafiaKillVotes);
  const protectedIds = new Set(Object.values(data.doctorProtection));
  const wasSaved = Boolean(killTarget && protectedIds.has(killTarget));
  const eliminatedTarget = killTarget && !wasSaved ? killTarget : null;

  const { players, eliminatedRole } = eliminate(data.players, eliminatedTarget);
  const eliminatedRoles = revealIfEnabled(data, eliminatedTarget, eliminatedRole);
  const stats: MafiaStats = wasSaved ? { ...data.stats, doctorSaves: data.stats.doctorSaves + 1 } : data.stats;

  const afterNight: MafiaData = {
    ...data,
    players,
    eliminatedRoles,
    stats,
    mafiaKillVotes: {},
    mafiaChat: [],
    detectiveInvestigation: {},
    doctorProtection: {},
    lastNightEliminated: eliminatedTarget,
    lastVoteEliminated: undefined,
  };

  const winner = checkWinner(players);
  if (winner) {
    // Game's over -- don't bump round on this branch, or "total rounds
    // played" ends up inflated by one whenever a night kill ends the game.
    return { phase: 'finished', data: { ...afterNight, winner } };
  }
  if (data.round >= MAX_ROUNDS) {
    return { phase: 'finished', data: { ...afterNight, winner: 'village' } };
  }

  // "Round N" = [day(N), vote(N), night(N)] as one contiguous unit -- this
  // is the ONLY place round increments, marking the start of a new one.
  const phaseEndsAt = Date.now() + data.settings.daySeconds * 1000;
  return { phase: 'day', data: { ...afterNight, round: data.round + 1, phaseEndsAt }, nextTickAt: phaseEndsAt };
}

function finishVoteLike(data: MafiaData, target: string | null): GameEngineResult<MafiaData> {
  const { players, eliminatedRole } = eliminate(data.players, target);
  const eliminatedRoles = revealIfEnabled(data, target, eliminatedRole);
  const afterVote: MafiaData = {
    ...data,
    players,
    eliminatedRoles,
    dayVotes: {},
    revoteCandidates: undefined,
    lastVoteEliminated: target,
    lastVoteTally: { ...data.dayVotes },
  };

  const winner = checkWinner(players);
  if (winner) {
    return { phase: 'finished', data: { ...afterVote, winner } };
  }

  const phaseEndsAt = Date.now() + data.settings.nightSeconds * 1000;
  return { phase: 'night', data: { ...afterVote, phaseEndsAt }, nextTickAt: phaseEndsAt };
}

function resolveVote(ctx: GameEngineContext, data: MafiaData): GameEngineResult<MafiaData> {
  const { leaders } = tallyWithTieInfo(data.dayVotes);

  if (leaders.length > 1 && data.settings.tieRule === 'revote') {
    const phaseEndsAt = Date.now() + data.settings.voteSeconds * 1000;
    return {
      phase: 'revote',
      data: { ...data, revoteCandidates: leaders, lastVoteTally: { ...data.dayVotes }, dayVotes: {}, phaseEndsAt },
      nextTickAt: phaseEndsAt,
    };
  }

  let target: string | null = null;
  if (leaders.length === 1) target = leaders[0];
  else if (leaders.length > 1 && data.settings.tieRule === 'random') target = leaders[Math.floor(Math.random() * leaders.length)];
  // leaders.length === 0 (no one voted) or tieRule === 'none': no elimination.
  return finishVoteLike(data, target);
}

function resolveRevote(ctx: GameEngineContext, data: MafiaData): GameEngineResult<MafiaData> {
  const { leaders } = tallyWithTieInfo(data.dayVotes);
  // A repeat tie falls back to no-elimination -- the doc doesn't specify
  // what happens on a second tie, and this avoids an infinite-revote loop.
  const target = leaders.length === 1 ? leaders[0] : null;
  return finishVoteLike(data, target);
}

function maybeResolveNight(ctx: GameEngineContext, data: MafiaData): GameEngineResult<MafiaData> {
  const alive = data.players.filter((p) => p.alive);
  const mafiaDone = alive.filter((p) => p.role === 'mafia').every((p) => data.mafiaKillVotes[p.userId]);
  const detectiveDone = alive.filter((p) => p.role === 'detective').every((p) => data.detectiveInvestigation[p.userId]);
  const doctorDone = alive.filter((p) => p.role === 'doctor').every((p) => data.doctorProtection[p.userId]);

  if (mafiaDone && detectiveDone && doctorDone) {
    return resolveNight(ctx, data);
  }
  return { phase: 'night', data, nextTickAt: data.phaseEndsAt };
}

function maybeResolveVoteLike(ctx: GameEngineContext, phase: 'vote' | 'revote', data: MafiaData): GameEngineResult<MafiaData> {
  const alive = data.players.filter((p) => p.alive);
  if (alive.every((p) => data.dayVotes[p.userId])) {
    return phase === 'vote' ? resolveVote(ctx, data) : resolveRevote(ctx, data);
  }
  return { phase, data, nextTickAt: data.phaseEndsAt };
}

function computeVotingAccuracy(voteHistory: MafiaData['voteHistory'], players: MafiaPlayer[]): Record<string, number> {
  const roleOf = new Map(players.map((p) => [p.userId, p.role]));
  const perVoter = new Map<string, { correct: number; total: number }>();
  for (const { voterId, targetId } of voteHistory) {
    const entry = perVoter.get(voterId) ?? { correct: 0, total: 0 };
    entry.total += 1;
    if (roleOf.get(targetId) === 'mafia') entry.correct += 1;
    perVoter.set(voterId, entry);
  }
  return Object.fromEntries([...perVoter].map(([id, { correct, total }]) => [id, total ? correct / total : 0]));
}

export const mafiaEngine: GameEngine<MafiaData, MafiaAction> = {
  gameType: 'mafia',

  async loadConfig(code) {
    const stored = await getMafiaRoomConfig(code);
    return { config: stored ?? defaultMafiaConfig() };
  },

  async cleanup(code) {
    await clearMafiaRoomConfig(code);
  },

  createInitialState(ctx) {
    const loaded = ctx.config as { config: MafiaRoomConfig } | undefined;
    const config = loaded?.config ?? defaultMafiaConfig();
    const players = assignRoles(ctx.members, config);
    // Everyone privately sees their role and must press "I'm Ready" before
    // the intro discussion (the 'briefing' phase) begins.
    const phaseEndsAt = Date.now() + ROLE_REVEAL_FAILSAFE_SECONDS * 1000;
    const data: MafiaData = {
      players,
      round: 1,
      phaseEndsAt,
      settings: {
        daySeconds: config.daySeconds,
        nightSeconds: config.nightSeconds,
        voteSeconds: config.voteSeconds,
        tieRule: config.tieRule,
        revealEliminatedRole: config.revealEliminatedRole,
        doctorCanProtectSelf: config.doctorCanProtectSelf,
      },
      readyUserIds: [],
      mafiaKillVotes: {},
      mafiaChat: [],
      detectiveInvestigation: {},
      lastInvestigation: {},
      doctorProtection: {},
      dayVotes: {},
      eliminatedRoles: {},
      stats: { doctorSaves: 0, detectiveFinds: {} },
      voteHistory: [],
    };
    return { phase: 'role-reveal', data, nextTickAt: phaseEndsAt };
  },

  applyAction(ctx, phase, data, userId, action) {
    if (phase === 'role-reveal') {
      if (action.type !== 'ready') throw new GameActionError('INVALID_ACTION', 'Unrecognized role-reveal action.');
      if (data.readyUserIds.includes(userId)) throw new GameActionError('ALREADY_ACTED', 'You are already ready.');
      const readyUserIds = [...data.readyUserIds, userId];
      if (readyUserIds.length >= data.players.length) {
        return resolveRoleReveal({ ...data, readyUserIds });
      }
      return { phase, data: { ...data, readyUserIds }, nextTickAt: data.phaseEndsAt };
    }

    const me = data.players.find((p) => p.userId === userId);
    if (!me || !me.alive) {
      throw new GameActionError('NOT_ALIVE', 'Eliminated players cannot act.');
    }

    if (phase === 'night') {
      if (action.type === 'mafia-kill') {
        if (me.role !== 'mafia') throw new GameActionError('WRONG_ROLE', 'Only Mafia can choose a kill target.');
        const target = data.players.find((p) => p.userId === action.targetUserId);
        if (!target || !target.alive || target.role === 'mafia') {
          throw new GameActionError('INVALID_TARGET', 'Invalid kill target.');
        }
        return maybeResolveNight(ctx, { ...data, mafiaKillVotes: { ...data.mafiaKillVotes, [userId]: target.userId } });
      }

      if (action.type === 'mafia-chat') {
        if (me.role !== 'mafia') throw new GameActionError('WRONG_ROLE', 'Only Mafia can use the team chat.');
        const text = (action.text ?? '').trim();
        if (!text) throw new GameActionError('INVALID_ACTION', 'Message cannot be empty.');
        if (text.length > MAX_CHAT_LENGTH) throw new GameActionError('INVALID_ACTION', 'Message is too long.');
        const mafiaChat = [...data.mafiaChat, { userId, text, at: Date.now() }].slice(-MAX_CHAT_MESSAGES);
        // A chat message isn't a vote -- it never counts toward "everyone's
        // acted", so the phase/timer are untouched.
        return { phase, data: { ...data, mafiaChat }, nextTickAt: data.phaseEndsAt };
      }

      if (action.type === 'investigate') {
        if (me.role !== 'detective') throw new GameActionError('WRONG_ROLE', 'Only the Detective can investigate.');
        if (data.detectiveInvestigation[userId]) throw new GameActionError('ALREADY_ACTED', 'You already investigated someone tonight.');
        const target = data.players.find((p) => p.userId === action.targetUserId);
        if (!target || !target.alive || target.userId === userId) {
          throw new GameActionError('INVALID_TARGET', 'Invalid investigation target.');
        }
        const result: DetectiveResult = { targetUserId: target.userId, isMafia: target.role === 'mafia' };
        const detectiveFinds = result.isMafia
          ? { ...data.stats.detectiveFinds, [userId]: (data.stats.detectiveFinds[userId] ?? 0) + 1 }
          : data.stats.detectiveFinds;
        return maybeResolveNight(ctx, {
          ...data,
          detectiveInvestigation: { ...data.detectiveInvestigation, [userId]: result },
          lastInvestigation: { ...data.lastInvestigation, [userId]: result },
          stats: { ...data.stats, detectiveFinds },
        });
      }

      if (action.type === 'protect') {
        if (me.role !== 'doctor') throw new GameActionError('WRONG_ROLE', 'Only the Doctor can protect.');
        if (data.doctorProtection[userId]) throw new GameActionError('ALREADY_ACTED', 'You already protected someone tonight.');
        const target = data.players.find((p) => p.userId === action.targetUserId);
        if (!target || !target.alive) throw new GameActionError('INVALID_TARGET', 'Invalid protection target.');
        if (!data.settings.doctorCanProtectSelf && target.userId === userId) {
          throw new GameActionError('INVALID_TARGET', 'You cannot protect yourself.');
        }
        return maybeResolveNight(ctx, { ...data, doctorProtection: { ...data.doctorProtection, [userId]: target.userId } });
      }

      throw new GameActionError('INVALID_ACTION', 'Unrecognized night action.');
    }

    if (phase === 'vote' || phase === 'revote') {
      if (action.type !== 'vote') throw new GameActionError('INVALID_ACTION', 'Unrecognized vote action.');
      if (data.dayVotes[userId]) throw new GameActionError('ALREADY_ACTED', 'You already voted.');
      if (action.targetUserId === userId) throw new GameActionError('INVALID_TARGET', 'You cannot vote for yourself.');
      const target = data.players.find((p) => p.userId === action.targetUserId);
      if (!target || !target.alive) throw new GameActionError('INVALID_TARGET', 'Invalid vote target.');
      if (phase === 'revote' && !(data.revoteCandidates ?? []).includes(target.userId)) {
        throw new GameActionError('INVALID_TARGET', 'You must vote for one of the tied candidates.');
      }
      const dayVotes = { ...data.dayVotes, [userId]: target.userId };
      const voteHistory = [...data.voteHistory, { round: data.round, voterId: userId, targetId: target.userId }];
      return maybeResolveVoteLike(ctx, phase, { ...data, dayVotes, voteHistory });
    }

    throw new GameActionError('INVALID_PHASE', 'No actions are accepted right now.');
  },

  tick(ctx, phase, data) {
    if (phase === 'role-reveal') return resolveRoleReveal(data);
    if (phase === 'briefing') {
      const phaseEndsAt = Date.now() + data.settings.nightSeconds * 1000;
      return { phase: 'night', data: { ...data, phaseEndsAt }, nextTickAt: phaseEndsAt };
    }
    if (phase === 'day') {
      const phaseEndsAt = Date.now() + data.settings.voteSeconds * 1000;
      return { phase: 'vote', data: { ...data, phaseEndsAt }, nextTickAt: phaseEndsAt };
    }
    if (phase === 'vote') return resolveVote(ctx, data);
    if (phase === 'revote') return resolveRevote(ctx, data);
    if (phase === 'night') return resolveNight(ctx, data);
    return { phase, data };
  },

  toClientView(ctx, phase, data, viewerUserId): MafiaClientView {
    const me = data.players.find((p) => p.userId === viewerUserId);
    const view: MafiaClientView = {
      players: data.players.map((p) => ({ userId: p.userId, alive: p.alive })),
      round: data.round,
      phaseEndsAt: data.phaseEndsAt,
      myRole: me?.role ?? null,
      myAlive: me?.alive ?? false,
      eliminatedRoles: data.eliminatedRoles,
      lastNightEliminated: data.lastNightEliminated,
      lastVoteEliminated: data.lastVoteEliminated,
      lastVoteTally: data.lastVoteTally,
      winner: data.winner,
    };

    if (phase === 'role-reveal') {
      view.readyCount = data.readyUserIds.length;
      view.totalPlayers = data.players.length;
      view.iAmReady = data.readyUserIds.includes(viewerUserId);
    }

    if (me?.role === 'detective') {
      // Their latest known intel, kept visible through the day/vote that
      // follows the night they learned it.
      view.myInvestigation = data.lastInvestigation[viewerUserId] ?? null;
      if (phase === 'night') view.actedThisRound = Boolean(data.detectiveInvestigation[viewerUserId]);
    }

    if (phase === 'night' && me?.alive) {
      if (me.role === 'mafia') {
        view.mafiaTeammates = data.players.filter((p) => p.role === 'mafia' && p.userId !== viewerUserId).map((p) => p.userId);
        view.mafiaVotes = { ...data.mafiaKillVotes };
        view.myKillVote = data.mafiaKillVotes[viewerUserId] ?? null;
        view.mafiaChat = data.mafiaChat;
      } else if (me.role === 'doctor') {
        view.myProtection = data.doctorProtection[viewerUserId] ?? null;
      }
    }

    if (phase === 'vote' || phase === 'revote') {
      view.votedUserIds = Object.keys(data.dayVotes);
      view.myVote = data.dayVotes[viewerUserId] ?? null;
      if (phase === 'revote') view.revoteCandidates = data.revoteCandidates;
    }

    if (phase === 'finished') {
      view.allRoles = Object.fromEntries(data.players.map((p) => [p.userId, p.role]));
      view.stats = {
        totalRounds: data.round,
        playersEliminated: data.players.filter((p) => !p.alive).length,
        mafiaEliminations: data.players.filter((p) => p.role === 'mafia' && !p.alive).length,
        survivors: data.players.filter((p) => p.alive).map((p) => p.userId),
        doctorSaves: data.stats.doctorSaves,
        detectiveFinds: data.stats.detectiveFinds,
        // Fraction of a player's total game-long votes that landed on an
        // eventual Mafia member -- the doc names "voting accuracy" as a
        // final stat without a worked example, so this is our best-effort
        // definition of it.
        votingAccuracy: computeVotingAccuracy(data.voteHistory, data.players),
      };
    }

    return view;
  },

  getFinalResults(data) {
    return data.players.map((p) => {
      const isWinner = data.winner === (p.role === 'mafia' ? 'mafia' : 'village');
      return { userId: p.userId, score: isWinner ? 1 : 0, isWinner };
    });
  },
};
