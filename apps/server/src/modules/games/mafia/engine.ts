import { GameActionError, type GameEngine, type GameEngineContext, type GameEngineResult } from '../engine';

const NIGHT_SECONDS = 60;
const DAY_SECONDS = 180;
const VOTE_SECONDS = 30;
const MAX_CHAT_MESSAGES = 50;
const MAX_CHAT_LENGTH = 240;

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

// Full authoritative state, kept server-side (Redis). Never sent to
// clients as-is — toClientView() below redacts it per viewer. This is the
// framework's first game with real hidden information: different players
// see different things (own secret role, mafia's private chat/target
// channel, a detective's private results), which the trivia engine never
// needed.
interface MafiaData {
  players: MafiaPlayer[];
  round: number;
  phaseEndsAt?: number;
  mafiaKillVotes: Record<string, string>;
  mafiaChat: MafiaChatMessage[];
  // Per-round working copy: gates "already acted this round" and whether
  // the night is done. Reset to {} at the start of every night.
  detectiveInvestigation: Record<string, DetectiveResult>;
  // Persists across phases (never auto-cleared) so a detective still has
  // their intel during the day/vote that follows, instead of losing it the
  // instant the night resolves — which can happen immediately after their
  // own action, if it was the last one needed to complete the round.
  lastInvestigation: Record<string, DetectiveResult>;
  doctorProtection: Record<string, string>;
  dayVotes: Record<string, string>;
  lastNightEliminated?: string | null;
  lastVoteEliminated?: string | null;
  // Snapshot of the day vote once it resolves -- who voted for whom. Kept
  // (not cleared) so the phase right after the vote can still show it;
  // during the vote itself, clients only ever see who HAS voted, never
  // for whom, until this snapshot is taken.
  lastVoteTally?: Record<string, string>;
  // Roles the room is allowed to see -- an elimination's role only lands
  // here one resolution *after* it happens (see pendingRoleReveal), so
  // "who died" and "what they were" are never announced in the same beat.
  eliminatedRoles: Record<string, MafiaRole>;
  pendingRoleReveal: Record<string, MafiaRole>;
  winner?: 'mafia' | 'village';
}

type MafiaAction =
  | { type: 'mafia-kill'; targetUserId: string }
  | { type: 'mafia-chat'; text: string }
  | { type: 'investigate'; targetUserId: string }
  | { type: 'protect'; targetUserId: string }
  | { type: 'vote'; targetUserId: string };

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
  // Everyone's role, revealed only once the game has ended.
  allRoles?: Record<string, MafiaRole>;
  // Night, mafia-only: their shared private target channel + team chat.
  mafiaTeammates?: string[];
  mafiaVotes?: Record<string, string>;
  myKillVote?: string | null;
  mafiaChat?: MafiaChatMessage[];
  // Detective-only: their last known intel, kept visible past the night
  // they learned it (see MafiaData.lastInvestigation). `actedThisRound`
  // separately gates the UI between "act now" and "waiting for others" —
  // myInvestigation alone can't say that, since it doesn't get cleared
  // when a new night starts.
  myInvestigation?: DetectiveResult | null;
  actedThisRound?: boolean;
  // Night, doctor-only.
  myProtection?: string | null;
  // Vote phase: who has voted is visible to build urgency, but not for
  // whom -- that stays hidden until every vote is in and the round
  // resolves (see lastVoteTally above).
  votedUserIds?: string[];
  myVote?: string | null;
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function assignRoles(members: GameEngineContext['members']): MafiaPlayer[] {
  const ids = shuffle(members.map((m) => m.userId));
  const total = ids.length;
  // 1 mafia at the 4-player minimum, +1 for every 4 players beyond that:
  // 4-7 players -> 1 mafia, 8-11 -> 2, 12-15 -> 3.
  const mafiaCount = 1 + Math.floor(Math.max(0, total - 4) / 4);

  const roles: MafiaRole[] = [];
  for (let i = 0; i < mafiaCount; i++) roles.push('mafia');
  roles.push('doctor');
  roles.push('detective');
  while (roles.length < total) roles.push('villager');

  return ids.map((userId, i) => ({ userId, role: roles[i], alive: true }));
}

function tallyMajority(votes: Record<string, string>): string | null {
  const counts = new Map<string, number>();
  Object.values(votes).forEach((target) => counts.set(target, (counts.get(target) ?? 0) + 1));
  if (counts.size === 0) return null;
  const max = Math.max(...counts.values());
  const leaders = [...counts.entries()].filter(([, count]) => count === max).map(([id]) => id);
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

// Reveals whatever elimination was still pending from the *previous*
// resolution -- called at the top of every new resolution, before that
// resolution's own elimination (if any) becomes the new pending one. Net
// effect: a role is always announced exactly one elimination-cycle after
// the player who had it actually dies.
function graduatePendingReveal(data: MafiaData): Record<string, MafiaRole> {
  return { ...data.eliminatedRoles, ...data.pendingRoleReveal };
}

function resolveNight(ctx: GameEngineContext, data: MafiaData): GameEngineResult<MafiaData> {
  const killTarget = tallyMajority(data.mafiaKillVotes);
  const protectedIds = new Set(Object.values(data.doctorProtection));
  const eliminated = killTarget && !protectedIds.has(killTarget) ? killTarget : null;

  const eliminatedRoles = graduatePendingReveal(data);
  const { players, eliminatedRole } = eliminate(data.players, eliminated);
  const pendingRoleReveal = eliminated && eliminatedRole ? { [eliminated]: eliminatedRole } : {};

  const afterNight: MafiaData = {
    ...data,
    players,
    eliminatedRoles,
    pendingRoleReveal,
    mafiaKillVotes: {},
    mafiaChat: [],
    detectiveInvestigation: {},
    doctorProtection: {},
    lastNightEliminated: eliminated,
    lastVoteEliminated: undefined,
  };

  const winner = checkWinner(players);
  if (winner) {
    // Game's over -- reveal everyone via allRoles regardless of the
    // one-cycle delay, so the finished screen isn't missing anyone.
    return { phase: 'finished', data: { ...afterNight, winner } };
  }

  const phaseEndsAt = Date.now() + DAY_SECONDS * 1000;
  return { phase: 'day', data: { ...afterNight, phaseEndsAt }, nextTickAt: phaseEndsAt };
}

function resolveVote(ctx: GameEngineContext, data: MafiaData): GameEngineResult<MafiaData> {
  const target = tallyMajority(data.dayVotes);

  const eliminatedRoles = graduatePendingReveal(data);
  const { players, eliminatedRole } = eliminate(data.players, target);
  const pendingRoleReveal = target && eliminatedRole ? { [target]: eliminatedRole } : {};

  const afterVote: MafiaData = {
    ...data,
    players,
    eliminatedRoles,
    pendingRoleReveal,
    dayVotes: {},
    lastVoteEliminated: target,
    lastVoteTally: { ...data.dayVotes },
  };

  const winner = checkWinner(players);
  if (winner) {
    return { phase: 'finished', data: { ...afterVote, winner } };
  }

  const phaseEndsAt = Date.now() + NIGHT_SECONDS * 1000;
  return { phase: 'night', data: { ...afterVote, round: data.round + 1, phaseEndsAt }, nextTickAt: phaseEndsAt };
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

function maybeResolveVote(ctx: GameEngineContext, data: MafiaData): GameEngineResult<MafiaData> {
  const alive = data.players.filter((p) => p.alive);
  if (alive.every((p) => data.dayVotes[p.userId])) {
    return resolveVote(ctx, data);
  }
  return { phase: 'vote', data, nextTickAt: data.phaseEndsAt };
}

export const mafiaEngine: GameEngine<MafiaData, MafiaAction> = {
  gameType: 'mafia',

  createInitialState(ctx) {
    const players = assignRoles(ctx.members);
    // The room opens on a day -- everyone introduces themselves before the
    // first night ever falls, matching the "day one, no night yet" format.
    const phaseEndsAt = Date.now() + DAY_SECONDS * 1000;
    const data: MafiaData = {
      players,
      round: 1,
      phaseEndsAt,
      mafiaKillVotes: {},
      mafiaChat: [],
      detectiveInvestigation: {},
      lastInvestigation: {},
      doctorProtection: {},
      dayVotes: {},
      eliminatedRoles: {},
      pendingRoleReveal: {},
    };
    return { phase: 'day', data, nextTickAt: phaseEndsAt };
  },

  applyAction(ctx, phase, data, userId, action) {
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
        return maybeResolveNight(ctx, {
          ...data,
          detectiveInvestigation: { ...data.detectiveInvestigation, [userId]: result },
          lastInvestigation: { ...data.lastInvestigation, [userId]: result },
        });
      }

      if (action.type === 'protect') {
        if (me.role !== 'doctor') throw new GameActionError('WRONG_ROLE', 'Only the Doctor can protect.');
        if (data.doctorProtection[userId]) throw new GameActionError('ALREADY_ACTED', 'You already protected someone tonight.');
        const target = data.players.find((p) => p.userId === action.targetUserId);
        if (!target || !target.alive) throw new GameActionError('INVALID_TARGET', 'Invalid protection target.');
        return maybeResolveNight(ctx, { ...data, doctorProtection: { ...data.doctorProtection, [userId]: target.userId } });
      }

      throw new GameActionError('INVALID_ACTION', 'Unrecognized night action.');
    }

    if (phase === 'vote') {
      if (action.type !== 'vote') throw new GameActionError('INVALID_ACTION', 'Unrecognized vote action.');
      if (data.dayVotes[userId]) throw new GameActionError('ALREADY_ACTED', 'You already voted.');
      const target = data.players.find((p) => p.userId === action.targetUserId);
      if (!target || !target.alive) throw new GameActionError('INVALID_TARGET', 'Invalid vote target.');
      return maybeResolveVote(ctx, { ...data, dayVotes: { ...data.dayVotes, [userId]: target.userId } });
    }

    throw new GameActionError('INVALID_PHASE', 'No actions are accepted right now.');
  },

  tick(ctx, phase, data) {
    if (phase === 'day') {
      const phaseEndsAt = Date.now() + VOTE_SECONDS * 1000;
      return { phase: 'vote', data: { ...data, phaseEndsAt }, nextTickAt: phaseEndsAt };
    }
    if (phase === 'vote') return resolveVote(ctx, data);
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

    if (me?.role === 'detective') {
      // Their latest known intel, kept visible through the day/vote that
      // follows the night they learned it — not just the instant of night.
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

    if (phase === 'vote') {
      // Who has voted is visible (builds urgency); for whom stays hidden
      // until the round resolves and lastVoteTally is populated above.
      view.votedUserIds = Object.keys(data.dayVotes);
      view.myVote = data.dayVotes[viewerUserId] ?? null;
    }

    if (phase === 'finished') {
      view.allRoles = Object.fromEntries(data.players.map((p) => [p.userId, p.role]));
    }

    return view;
  },
};
