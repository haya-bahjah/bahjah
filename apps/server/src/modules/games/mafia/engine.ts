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
// The two report beats the room reads together off the big screen: dawn
// announces the night, elimination turns the hanged player's card face up.
// Not host-configurable -- they are paced by how long it takes to read them
// out.
//
// Dawn and the elimination card are read by the room and then moved on from
// by the players themselves -- everyone presses "start the day" (or "begin
// the night") on their own phone and it goes when the last of them has.
// These durations are the failsafe: long enough that pressing is always the
// normal path, short enough that somebody who has wandered off with their
// phone can't hold the room hostage. They are also what paces a table of
// nothing but practice bots, which has nobody to press anything.
const DAWN_SECONDS = 45;
const ELIM_SECONDS = 45;

export type MafiaRole = 'mafia' | 'detective' | 'doctor' | 'villager';

interface MafiaPlayer {
  userId: string;
  role: MafiaRole;
  alive: boolean;
}

// A Read is two steps. Choosing a player turns up every conversation they
// had last round, listed anonymously -- you can see how many there were and
// how long each one is, and nothing else. Then you open exactly one, and get
// all of it. Which is the point of the ability: a whole conversation is
// worth reading, a single line out of context is not.
interface ReadResult {
  targetUserId: string;
  // The round the Read was made in, so a Read from an earlier night can't be
  // re-opened in a later one.
  round: number;
  // Server-side only. These are thread keys -- two user ids joined -- so
  // they name the other party and are stripped before this reaches a client
  // (see toClientView). The Detective picks by position, never by key.
  keys: string[];
  messageCounts: number[];
  // Which one was opened, and what was in it. Absent until the Detective
  // chooses; only ever one.
  openedIndex?: number;
  // The other party is never named -- 'target' is the player being read,
  // 'unknown' is whoever they were talking to.
  transcript?: Array<{ speaker: 'target' | 'unknown'; text: string }>;
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
  // 'day' phase only, open to every alive player (no role gate, unlike
  // mafiaChat) -- cleared on the day->vote transition in tick() below.
  dayChat: MafiaChatMessage[];
  // Night-phase one-to-one threads, keyed by the two participants' ids
  // sorted and joined, so a pair always resolves to the same thread from
  // either side. Every living player may open one with any other; only the
  // two of them ever receive it (see toClientView), and the Detective's
  // Read ability samples from it.
  privateChats: Record<string, MafiaChatMessage[]>;
  // The round each private thread was last spoken in, so Read can be scoped
  // to "the previous round" without walking message timestamps.
  privateChatRounds: Record<string, number>;
  // Per-round working copy: gates "already acted this round". Reset to {} at
  // the start of every night.
  detectiveInvestigation: Record<string, DetectiveResult>;
  // Persists across phases (never auto-cleared) so a detective still has
  // their intel during the day/vote that follows, instead of losing it the
  // instant the night resolves.
  lastInvestigation: Record<string, DetectiveResult>;
  // Every player the Detective has investigated with either ability, and the
  // round it happened. The flow doc bars using the other ability on that
  // player in the round that follows.
  detectiveSeen: Record<string, number>;
  // The Detective's most recent Read, kept past the night that produced it
  // for the same reason lastInvestigation is.
  lastRead: Record<string, ReadResult>;
  doctorProtection: Record<string, string>;
  // Who each doctor protected in the round before this one. The flow doc
  // forbids protecting the same player twice running, so the previous
  // round's pick has to outlive the per-round working copy above.
  lastDoctorProtection: Record<string, string>;
  dayVotes: Record<string, string>;
  // 'revote' phase only: the tied candidates a revote is scoped to.
  revoteCandidates?: string[];
  lastNightEliminated?: string | null;
  // The doctor's target when it successfully blocked the mafia's kill --
  // lets the client tell "someone was attacked but saved" apart from "no
  // kill happened at all" on the Dawn interstitial. Only truthy on the
  // save case, null in both other cases.
  lastNightSaved?: string | null;
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
  // The host has put the room on hold. Timers stop rather than run down
  // behind the overlay, so pausedRemainingMs holds what was left of the
  // phase and resume hands it back.
  paused?: boolean;
  pausedRemainingMs?: number;
  winner?: 'mafia' | 'village';
}

type MafiaAction =
  | { type: 'ready' }
  // The host's own controls, from the big screen or their phone remote. They
  // hold no role, so these are the only actions they can send.
  | { type: 'advance' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'mafia-kill'; targetUserId: string }
  | { type: 'mafia-chat'; text: string }
  | { type: 'day-chat'; text: string }
  | { type: 'private-chat'; targetUserId: string; text: string }
  | { type: 'read'; targetUserId: string }
  // Opens one of the conversations a 'read' turned up, by position.
  | { type: 'read-open'; index: number }
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
  lastNightSaved?: string | null;
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
  // Detective-only: the last Read, whether Read is available tonight, and
  // who is off-limits this round because they were investigated last round.
  // Without the thread keys -- see toClientView.
  myRead?: Omit<ReadResult, 'keys'> | null;
  canRead?: boolean;
  blockedTargets?: string[];
  noTargetsLeft?: boolean;
  // Night, everyone: this player's own one-to-one threads, keyed by the
  // other participant. Never anyone else's -- the whole point of the
  // Detective's Read is that these are otherwise private.
  myPrivateChats?: Record<string, MafiaChatMessage[]>;
  actedThisRound?: boolean;
  // Night, doctor-only.
  myProtection?: string | null;
  // 'day'-only, visible to every viewer (including spectators watching an
  // already-eliminated player's screen -- see toClientView).
  dayChat?: MafiaChatMessage[];
  // 'vote'/'revote': who has voted is visible (urgency), for whom stays
  // hidden until lastVoteTally is populated above.
  votedUserIds?: string[];
  myVote?: string | null;
  revoteCandidates?: string[];
  // Night, everyone: which of the acting roles have submitted, so the big
  // screen can show the room how far the night has got. Roles only -- never
  // who holds them and never their target, so this stays safe to put on a
  // screen the whole table is looking at.
  nightActedRoles?: MafiaRole[];
  // The host has the room on hold. Every surface reads this, so the TV can
  // say so and the phones can stop asking for input.
  paused?: boolean;
  // 'dawn' / 'elim': the report the whole room reads together. Roles here are
  // already public -- a body on the table is shown to everyone or to nobody,
  // per settings.revealEliminatedRole -- so these are safe on the big screen.
  dawnKilledUserId?: string | null;
  dawnSaved?: boolean;
  dawnSavedUserId?: string | null;
  elimUserId?: string | null;
  elimRole?: MafiaRole | null;
  // Who voted for whom, once the vote has closed. Drives the TV's tally bars.
  elimTally?: Record<string, number>;
}

// Who this Detective may still spend an ability on: alive, not themselves,
// and not already investigated. The bar is permanent, so at a small table
// this list empties -- five players leaves four targets, and after four
// nights the Detective has nobody left. That is a legal state, not a stuck
// one, and it is why the night has to know about it (see maybeResolveNight).
function detectiveTargets(data: MafiaData, detectiveId: string): MafiaPlayer[] {
  return data.players.filter(
    (p) => p.alive && p.userId !== detectiveId && data.detectiveSeen[p.userId] == null
  );
}

// The living players who are actual people. Used where the room waits on
// everyone to press something: a practice bot has no screen to read and
// should never be the reason a room is stuck.
function livingHumans(ctx: GameEngineContext, data: MafiaData): string[] {
  const bots = new Set(ctx.members.filter((m) => m.isBot).map((m) => m.userId));
  return data.players.filter((p) => p.alive && !bots.has(p.userId)).map((p) => p.userId);
}

// A pair of players always maps to one thread, whichever of them is asking.
function threadKey(a: string, b: string): string {
  return [a, b].sort().join('|');
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// One Mafia is a legal deal now: the rules document's table starts at five
// players with a single one. (It used to be two, which is what made a
// five-player game end the moment they landed a kill.)
export const MIN_MAFIA = 1;

// The rules document's table, as a formula. It lists 5:1, 6:2, 7:2, 8:3,
// 9:3, 10:4, 11:4, 12:5, 13:5, 14:6, 15:6, 16:7 and then "every additional
// 2 players adds 1 Mafia" -- which is floor(n / 2) - 1 for every row of it,
// and keeps going for tables past the end of the printed table.
//
// Worth noting that this can never deal a game that is already over:
// floor(n/2) - 1 is always strictly less than the citizens left over, so
// checkWinner above returns nothing on the opening deal at any size.
function defaultMafiaCount(total: number): number {
  return Math.max(MIN_MAFIA, Math.floor(total / 2) - 1);
}

// The host runs the room from the big screen and is never dealt a card, so
// they are excluded before roles are counted -- otherwise a 6-player room
// would size its mafia count as if there were 7 at the table.
export function playableMembers(members: GameEngineContext['members']): GameEngineContext['members'] {
  return members.filter((m) => !m.isHost);
}

function assignRoles(members: GameEngineContext['members'], config: MafiaRoomConfig): MafiaPlayer[] {
  const ids = shuffle(playableMembers(members).map((m) => m.userId));
  const total = ids.length;
  // A host override is clamped so the deal can't hand the Mafia a win
  // before anyone has acted: they win at mafia > citizens, so the most they
  // may hold is half the table.
  const maxOverride = Math.max(MIN_MAFIA, Math.floor(total / 2));
  const mafiaCount =
    config.mafiaCountOverride != null
      ? Math.max(MIN_MAFIA, Math.min(config.mafiaCountOverride, maxOverride))
      : defaultMafiaCount(total);

  const roles: MafiaRole[] = [];
  for (let i = 0; i < mafiaCount; i++) roles.push('mafia');
  if (config.includeDoctor) roles.push('doctor');
  if (config.includeDetective) roles.push('detective');
  while (roles.length < total) roles.push('villager');

  // Testing aid: hand one named player the role they asked for, then deal
  // everything else at random as usual. Only honoured in a room with
  // practice bots in it -- rigging your own role in a game with real people
  // would just be cheating, and this exists so all four roles' screens can
  // actually be walked through.
  const forced = config.forcedRole;
  if (forced && members.some((m) => m.isBot)) {
    const seat = ids.indexOf(forced.userId);
    const slot = roles.indexOf(forced.role);
    if (seat >= 0 && slot >= 0) {
      [ids[seat], ids[slot]] = [ids[slot], ids[seat]];
    }
  }

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

// The rules document's ladder, in its order, checked against the players
// who are still alive.
//
//   Mafia = 0                        -> Citizens win
//   Mafia = 1 AND Citizens = 1       -> Mafia win
//   Mafia > Citizens                 -> Mafia win
//   otherwise                        -> the game continues
//
// The middle rule is the whole point of writing this out. Equal counts do
// NOT end the game -- 2v2, 3v3, 4v4 all continue -- and the only equal
// count that does is the last two players standing. This used to be a
// single `aliveMafia >= aliveVillage`, which ended 2v2 and 3v3 on the spot
// and, at the old two-Mafia minimum, ended a five-player game the first
// time the Mafia landed a kill.
function checkWinner(players: MafiaPlayer[]): 'mafia' | 'village' | undefined {
  const alive = players.filter((p) => p.alive);
  const mafia = alive.filter((p) => p.role === 'mafia').length;
  // "Citizens" here is the whole village side -- Doctor and Sheriff
  // included. They are what the Mafia has to outnumber.
  const citizens = alive.length - mafia;
  if (mafia === 0) return 'village';
  if (mafia === 1 && citizens === 1) return 'mafia';
  if (mafia > citizens) return 'mafia';
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

// The host is the one member who holds no card. The server settles who runs
// a room (rooms/service.ts) and sends it down as controllerId; the isHost
// flag is the fallback for a context built before that existed.
function isHostUser(ctx: GameEngineContext, userId: string): boolean {
  if (ctx.controllerId !== undefined) return ctx.controllerId === userId;
  return ctx.members.some((m) => m.userId === userId && m.isHost);
}

// Every phase's "move on now", resolving whatever its timer would have. The
// two lobby-side phases have their own resolvers; the rest fall through to
// the same functions tick() uses.
function hostAdvance(
  ctx: GameEngineContext,
  phase: string,
  data: MafiaData
): GameEngineResult<MafiaData> {
  if (phase === 'role-reveal') return resolveRoleReveal(data);
  if (phase === 'briefing') {
    const phaseEndsAt = Date.now() + data.settings.nightSeconds * 1000;
    return { phase: 'night', data: { ...data, phaseEndsAt }, nextTickAt: phaseEndsAt };
  }
  if (phase === 'night') return resolveNight(ctx, data);
  if (phase === 'dawn') return resolveDawn(data);
  if (phase === 'day') {
    const phaseEndsAt = Date.now() + data.settings.voteSeconds * 1000;
    return { phase: 'vote', data: { ...data, dayChat: [], phaseEndsAt }, nextTickAt: phaseEndsAt };
  }
  if (phase === 'vote') return resolveVote(ctx, data);
  if (phase === 'revote') return resolveRevote(ctx, data);
  if (phase === 'elim') return resolveElim(data);
  throw new GameActionError('INVALID_PHASE', 'There is nothing to move on from.');
}

// Once everyone has seen their card, the game begins -- and it begins at
// night, which is the first thing the flow doc's cycle asks for. This used
// to open a 'briefing' window a full daySeconds long before the night
// started: two minutes in which nobody had an action, no screen had a clock,
// and the room could only conclude the game had hung. That window is not in
// the flow, so it is gone; 'briefing' is still handled below for any game
// already sitting in it, but nothing produces it any more.
function resolveRoleReveal(data: MafiaData): GameEngineResult<MafiaData> {
  const phaseEndsAt = Date.now() + data.settings.nightSeconds * 1000;
  return { phase: 'night', data: { ...data, phaseEndsAt, readyUserIds: [] }, nextTickAt: phaseEndsAt };
}

function resolveNight(ctx: GameEngineContext, data: MafiaData): GameEngineResult<MafiaData> {
  // The Mafia only kill when all of them have named a target. One of two
  // partners picking and the clock running out on the other is a skip, not
  // a kill by whoever happened to answer -- the hit is the team's decision
  // and half a team hasn't made one. No votes at all is the same skip.
  const livingMafia = data.players.filter((p) => p.alive && p.role === 'mafia');
  const allMafiaVoted = livingMafia.length > 0 && livingMafia.every((p) => data.mafiaKillVotes[p.userId]);
  const killTarget = allMafiaVoted ? tallyMafiaKill(data.mafiaKillVotes) : null;
  const protectedIds = new Set(Object.values(data.doctorProtection));
  const wasSaved = Boolean(killTarget && protectedIds.has(killTarget));
  const eliminatedTarget = killTarget && !wasSaved ? killTarget : null;

  const { players } = eliminate(data.players, eliminatedTarget);
  // A body found in the morning keeps its secret. The room is told who the
  // Mafia took and who the Doctor pulled out of it, and nothing more --
  // working out what the dead were is the game. (The town's own verdict is
  // different: a player the room votes out has their card turned face up,
  // which is where revealEliminatedRole still applies.)
  const stats: MafiaStats = wasSaved ? { ...data.stats, doctorSaves: data.stats.doctorSaves + 1 } : data.stats;

  const afterNight: MafiaData = {
    ...data,
    players,
    stats,
    mafiaKillVotes: {},
    mafiaChat: [],
    detectiveInvestigation: {},
    doctorProtection: {},
    lastDoctorProtection: data.doctorProtection,
    lastNightEliminated: eliminatedTarget,
    lastNightSaved: wasSaved ? killTarget : null,
    lastVoteEliminated: undefined,
  };

  // Every night lands on dawn, win or no win. The room hears what happened
  // before it hears that the game is over -- cutting straight to the verdict
  // skipped the one report the whole table is waiting for. Whether this was
  // also the last night is worked out when dawn moves on.
  const phaseEndsAt = Date.now() + DAWN_SECONDS * 1000;
  return { phase: 'dawn', data: { ...afterNight, phaseEndsAt, readyUserIds: [] }, nextTickAt: phaseEndsAt };
}

// Dawn is a report, not a decision: it ends by asking the same two questions
// the night resolution used to ask inline.
function resolveDawn(data: MafiaData): GameEngineResult<MafiaData> {
  const winner = checkWinner(data.players);
  if (winner) {
    // Don't bump round on this branch, or "total rounds played" ends up
    // inflated by one whenever a night kill ends the game.
    return { phase: 'finished', data: { ...data, winner } };
  }
  if (data.round >= MAX_ROUNDS) {
    return { phase: 'finished', data: { ...data, winner: 'village' } };
  }

  // "Round N" = [day(N), vote(N), night(N)] as one contiguous unit -- this
  // is the ONLY place round increments, marking the start of a new one.
  const phaseEndsAt = Date.now() + data.settings.daySeconds * 1000;
  return { phase: 'day', data: { ...data, round: data.round + 1, phaseEndsAt, readyUserIds: [] }, nextTickAt: phaseEndsAt };
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

  // Same shape as dawn: the town sees the card it just turned over before it
  // finds out whether that ended the game.
  const phaseEndsAt = Date.now() + ELIM_SECONDS * 1000;
  return { phase: 'elim', data: { ...afterVote, phaseEndsAt, readyUserIds: [] }, nextTickAt: phaseEndsAt };
}

function resolveElim(data: MafiaData): GameEngineResult<MafiaData> {
  const winner = checkWinner(data.players);
  if (winner) {
    return { phase: 'finished', data: { ...data, winner } };
  }
  const phaseEndsAt = Date.now() + data.settings.nightSeconds * 1000;
  return { phase: 'night', data: { ...data, phaseEndsAt, readyUserIds: [] }, nextTickAt: phaseEndsAt };
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
  // A Detective with nobody left to investigate has nothing to submit, so
  // the night must not sit waiting on them until the clock runs out.
  const detectiveDone = alive
    .filter((p) => p.role === 'detective')
    .every((p) => data.detectiveInvestigation[p.userId] || detectiveTargets(data, p.userId).length === 0);
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

// Practice bots (see games/bots.ts). Everything below only ever runs for a
// room the host filled out with bots to reach the player minimum.
//
// The lines are deliberately vague table-talk: the point is that the night's
// private threads and the day's discussion aren't empty, so a Detective's
// Read has something to come back with and the day screen looks like a
// conversation. They say nothing a bot actually knows.
const BOT_NIGHT_LINES = [
  'you awake?',
  'i think we should watch the quiet ones',
  'meet me at dawn',
  'not me, i swear',
  'who do you trust right now',
  'keep this between us',
];

const BOT_REPLY_LINES = [
  'maybe. i am not sure yet',
  'yeah i noticed that too',
  'go on',
  "i'd rather not say here",
  'okay. i am with you',
];

const BOT_DAY_LINES = [
  'that was too quiet last night',
  'i want to hear from everyone before we vote',
  'something is off about that story',
  "i'll follow the room on this one",
  'we cannot afford another wrong vote',
];

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

// Who a bot starts a thread with tonight. Derived from its seat and the
// round rather than picked at random, so the pairings shift each night
// instead of every bot piling onto the same player -- and so that "have I
// already opened my thread this round?" is answerable from state alone
// (privateChatRounds on that one thread), with no per-pass memory to keep.
function botNightPartner(data: MafiaData, userId: string, others: MafiaPlayer[]): MafiaPlayer {
  const seat = data.players.findIndex((p) => p.userId === userId);
  return others[(data.round + Math.max(0, seat)) % others.length];
}

// A thread where somebody spoke to this bot and it hasn't answered since.
// Only threads whose last word came from a *person* count: two bots trading
// "who do you trust" forever would fill the thread and tell nobody anything.
function botThreadAwaitingReply(
  ctx: GameEngineContext,
  data: MafiaData,
  userId: string
): { targetUserId: string } | null {
  const botIds = new Set(ctx.members.filter((m) => m.isBot).map((m) => m.userId));
  for (const key of Object.keys(data.privateChats)) {
    const parts = key.split('|');
    if (!parts.includes(userId)) continue;
    const thread = data.privateChats[key] ?? [];
    const last = thread[thread.length - 1];
    if (!last || last.userId === userId || botIds.has(last.userId)) continue;
    const other = parts.find((id) => id !== userId);
    const target = data.players.find((p) => p.userId === other);
    if (target && target.alive) return { targetUserId: target.userId };
  }
  return null;
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
      dayChat: [],
      privateChats: {},
      privateChatRounds: {},
      detectiveInvestigation: {},
      lastInvestigation: {},
      detectiveSeen: {},
      lastRead: {},
      doctorProtection: {},
      lastDoctorProtection: {},
      dayVotes: {},
      eliminatedRoles: {},
      stats: { doctorSaves: 0, detectiveFinds: {} },
      voteHistory: [],
    };
    return { phase: 'role-reveal', data, nextTickAt: phaseEndsAt };
  },

  applyAction(ctx, phase, data, userId, action) {
    if (action.type === 'advance' || action.type === 'pause' || action.type === 'resume') {
      if (!isHostUser(ctx, userId)) {
        throw new GameActionError('NOT_HOST', 'Only the host can run the room.');
      }
      if (action.type === 'pause') {
        // A paused room stops resolving on its own. The clock is put away
        // rather than left running down behind the overlay, so resuming gives
        // the room back the time it actually had left.
        if (data.paused) return { phase, data };
        const remainingMs = data.phaseEndsAt ? Math.max(0, data.phaseEndsAt - Date.now()) : undefined;
        return { phase, data: { ...data, paused: true, pausedRemainingMs: remainingMs, phaseEndsAt: undefined } };
      }
      if (action.type === 'resume') {
        if (!data.paused) return { phase, data };
        const phaseEndsAt = data.pausedRemainingMs ? Date.now() + data.pausedRemainingMs : undefined;
        return {
          phase,
          data: { ...data, paused: false, pausedRemainingMs: undefined, phaseEndsAt },
          nextTickAt: phaseEndsAt,
        };
      }
      // Advance resolves exactly what the timer would have resolved, so
      // moving on early and letting the clock run out land on identical
      // state -- there is no second code path to keep in step.
      return hostAdvance(ctx, phase, data);
    }

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

    // Dawn and the elimination card are reports the room reads together, and
    // the room decides when it has finished reading: every living player
    // presses "start the day" (or "begin the night") on their own phone and
    // it moves when the last of them has. The television is narration and
    // holds no controls, so this can't be its job -- and the button used to
    // do nothing at all on a player's screen, since only the host's advance
    // was wired up.
    if (phase === 'dawn' || phase === 'elim') {
      if (action.type !== 'ready') throw new GameActionError('INVALID_ACTION', 'Unrecognized action.');
      if (data.readyUserIds.includes(userId)) throw new GameActionError('ALREADY_ACTED', 'You are already ready.');
      const readyUserIds = [...data.readyUserIds, userId];
      const waitingOn = livingHumans(ctx, data);
      // Nobody waits on a bot to finish reading a screen. A table with no
      // people left in it has nothing to wait for either, so it falls
      // through to the phase timer -- which is what gives an all-bot room a
      // dawn you can actually watch.
      if (waitingOn.length > 0 && waitingOn.every((id) => readyUserIds.includes(id))) {
        const next = { ...data, readyUserIds };
        return phase === 'dawn' ? resolveDawn(next) : resolveElim(next);
      }
      return { phase, data: { ...data, readyUserIds }, nextTickAt: data.phaseEndsAt };
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

      if (action.type === 'private-chat') {
        // Open to every living player, Mafia included: the flow doc puts
        // these alongside the Mafia's own group chat, not instead of it.
        const target = data.players.find((p) => p.userId === action.targetUserId);
        if (!target || !target.alive) throw new GameActionError('INVALID_TARGET', 'Invalid chat target.');
        if (target.userId === userId) throw new GameActionError('INVALID_TARGET', 'You cannot message yourself.');
        const text = action.text.trim();
        if (!text) throw new GameActionError('INVALID_ACTION', 'Message cannot be empty.');
        if (text.length > MAX_CHAT_LENGTH) throw new GameActionError('INVALID_ACTION', 'Message is too long.');
        const key = threadKey(userId, target.userId);
        const thread = [...(data.privateChats[key] ?? []), { userId, text, at: Date.now() }].slice(-MAX_CHAT_MESSAGES);
        // Talking is never an action that closes the night, so the phase
        // timer is handed back untouched.
        return {
          phase,
          data: {
            ...data,
            privateChats: { ...data.privateChats, [key]: thread },
            privateChatRounds: { ...data.privateChatRounds, [key]: data.round },
          },
          nextTickAt: data.phaseEndsAt,
        };
      }

      if (action.type === 'read') {
        if (me.role !== 'detective') throw new GameActionError('WRONG_ROLE', 'Only the Detective can read.');
        // Read unlocks from the second night, because it looks back at the
        // previous round's conversations and there are none before then.
        if (data.round < 2) throw new GameActionError('INVALID_ACTION', 'Read unlocks from the second night.');
        if (data.detectiveInvestigation[userId]) {
          throw new GameActionError('ALREADY_ACTED', 'You already used an ability tonight.');
        }
        const target = data.players.find((p) => p.userId === action.targetUserId);
        if (!target || !target.alive || target.userId === userId) {
          throw new GameActionError('INVALID_TARGET', 'Invalid target.');
        }
        if (data.detectiveSeen[action.targetUserId] != null) {
          throw new GameActionError('INVALID_TARGET', 'You have already investigated them — choose someone else.');
        }
        // Every thread that player spoke in last round, shuffled. The
        // Mafia's group chat is deliberately not among them.
        const eligible = shuffle(
          Object.keys(data.privateChats).filter(
            (key) => key.split('|').includes(action.targetUserId) && data.privateChatRounds[key] === data.round - 1
          )
        );
        // Choosing a target only lists what there is to read. The ability is
        // not spent until one is opened -- which also means the night does
        // not resolve out from under a Detective who is still choosing,
        // since they are the very player it would be waiting on.
        return {
          phase,
          data: {
            ...data,
            lastRead: {
              ...data.lastRead,
              [userId]: {
                targetUserId: target.userId,
                round: data.round,
                keys: eligible,
                messageCounts: eligible.map((key) => (data.privateChats[key] ?? []).length),
              },
            },
          },
          nextTickAt: data.phaseEndsAt,
        };
      }

      if (action.type === 'read-open') {
        if (me.role !== 'detective') throw new GameActionError('WRONG_ROLE', 'Only the Detective can read.');
        const pending = data.lastRead[userId];
        if (!pending || pending.round !== data.round) {
          throw new GameActionError('INVALID_ACTION', 'Choose someone to read first.');
        }
        if (pending.openedIndex != null) {
          throw new GameActionError('ALREADY_ACTED', 'You already opened a conversation tonight.');
        }
        const index = Number(action.index);
        if (!Number.isInteger(index) || index < 0 || index >= pending.keys.length) {
          throw new GameActionError('INVALID_TARGET', 'No such conversation.');
        }
        const transcript: NonNullable<ReadResult['transcript']> = (data.privateChats[pending.keys[index]] ?? []).map(
          (m) => ({
            // The other party stays anonymous: the Detective learns what was
            // said, never who said it back.
            speaker: (m.userId === pending.targetUserId ? 'target' : 'unknown') as 'target' | 'unknown',
            text: m.text,
          })
        );
        const result: DetectiveResult = { targetUserId: pending.targetUserId, isMafia: false };
        return maybeResolveNight(ctx, {
          ...data,
          // Opening the conversation is what spends the night's single
          // ability. It reveals no alignment, so it is recorded as used
          // without a Reveal result.
          detectiveInvestigation: { ...data.detectiveInvestigation, [userId]: result },
          detectiveSeen: { ...data.detectiveSeen, [pending.targetUserId]: data.round },
          lastRead: { ...data.lastRead, [userId]: { ...pending, openedIndex: index, transcript } },
        });
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
        if (data.detectiveInvestigation[userId]) throw new GameActionError('ALREADY_ACTED', 'You already used an ability tonight.');
        const target = data.players.find((p) => p.userId === action.targetUserId);
        if (!target || !target.alive || target.userId === userId) {
          throw new GameActionError('INVALID_TARGET', 'Invalid investigation target.');
        }
        if (data.detectiveSeen[action.targetUserId] != null) {
          throw new GameActionError('INVALID_TARGET', 'You have already investigated them — choose someone else.');
        }
        const result: DetectiveResult = { targetUserId: target.userId, isMafia: target.role === 'mafia' };
        const detectiveFinds = result.isMafia
          ? { ...data.stats.detectiveFinds, [userId]: (data.stats.detectiveFinds[userId] ?? 0) + 1 }
          : data.stats.detectiveFinds;
        return maybeResolveNight(ctx, {
          ...data,
          detectiveInvestigation: { ...data.detectiveInvestigation, [userId]: result },
          lastInvestigation: { ...data.lastInvestigation, [userId]: result },
          detectiveSeen: { ...data.detectiveSeen, [action.targetUserId]: data.round },
          stats: { ...data.stats, detectiveFinds },
        });
      }

      if (action.type === 'protect') {
        if (me.role !== 'doctor') throw new GameActionError('WRONG_ROLE', 'Only the Doctor can protect.');
        if (data.doctorProtection[userId]) throw new GameActionError('ALREADY_ACTED', 'You already protected someone tonight.');
        const target = data.players.find((p) => p.userId === action.targetUserId);
        if (!target || !target.alive) throw new GameActionError('INVALID_TARGET', 'Invalid protection target.');
        if (data.lastDoctorProtection[userId] === action.targetUserId) {
          throw new GameActionError('INVALID_TARGET', 'You protected them last round — choose someone else.');
        }
        if (!data.settings.doctorCanProtectSelf && target.userId === userId) {
          throw new GameActionError('INVALID_TARGET', 'You cannot protect yourself.');
        }
        return maybeResolveNight(ctx, { ...data, doctorProtection: { ...data.doctorProtection, [userId]: target.userId } });
      }

      throw new GameActionError('INVALID_ACTION', 'Unrecognized night action.');
    }

    if (phase === 'day') {
      if (action.type !== 'day-chat') throw new GameActionError('INVALID_ACTION', 'Unrecognized day action.');
      const text = (action.text ?? '').trim();
      if (!text) throw new GameActionError('INVALID_ACTION', 'Message cannot be empty.');
      if (text.length > MAX_CHAT_LENGTH) throw new GameActionError('INVALID_ACTION', 'Message is too long.');
      const dayChat = [...data.dayChat, { userId, text, at: Date.now() }].slice(-MAX_CHAT_MESSAGES);
      // Not a vote -- never counts toward phase resolution, same as mafia-chat.
      return { phase, data: { ...data, dayChat }, nextTickAt: data.phaseEndsAt };
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
      return { phase: 'vote', data: { ...data, dayChat: [], phaseEndsAt }, nextTickAt: phaseEndsAt };
    }
    if (phase === 'vote') return resolveVote(ctx, data);
    if (phase === 'revote') return resolveRevote(ctx, data);
    if (phase === 'night') return resolveNight(ctx, data);
    if (phase === 'dawn') return resolveDawn(data);
    if (phase === 'elim') return resolveElim(data);
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
      lastNightSaved: data.lastNightSaved,
      lastVoteEliminated: data.lastVoteEliminated,
      lastVoteTally: data.lastVoteTally,
      winner: data.winner,
    };

    // Night's one-to-one threads: each viewer receives only the threads they
    // are part of, keyed by the other participant. Nobody else's threads are
    // ever sent, which is exactly what makes the Detective's Read worth
    // spending a night on.
    if (phase === 'night' && me?.alive) {
      const mine: Record<string, MafiaChatMessage[]> = {};
      Object.keys(data.privateChats).forEach((key) => {
        const parts = key.split('|');
        if (!parts.includes(viewerUserId)) return;
        const other = parts[0] === viewerUserId ? parts[1] : parts[0];
        mine[other] = data.privateChats[key];
      });
      view.myPrivateChats = mine;
    }

    if (data.paused) view.paused = true;

    if (phase === 'dawn' || phase === 'elim') {
      // The room is counting up to the living people in it -- not the seat
      // count, and not the bots, who are never waited on.
      const waitingOn = livingHumans(ctx, data);
      view.totalPlayers = waitingOn.length;
      view.readyCount = data.readyUserIds.filter((id) => waitingOn.includes(id)).length;
      view.iAmReady = data.readyUserIds.includes(viewerUserId);
    }

    if (phase === 'dawn') {
      view.dawnKilledUserId = data.lastNightEliminated ?? null;
      view.dawnSaved = Boolean(data.lastNightSaved);
      // Who the Doctor pulled out of it. The room is told this outright --
      // it is a loud piece of information (it marks both the Doctor's pick
      // and a confirmed Mafia target) but that is the flow we were asked
      // for, and hiding the name while announcing the save told the room
      // half a fact.
      view.dawnSavedUserId = data.lastNightSaved ?? null;
      // Deliberately no dawnKilledRole: see resolveNight.
    }

    if (phase === 'elim') {
      view.elimUserId = data.lastVoteEliminated ?? null;
      view.elimRole = data.lastVoteEliminated
        ? data.eliminatedRoles[data.lastVoteEliminated] ?? null
        : null;
      // Counts, not ballots: the TV shows how the pressure landed without
      // naming who pointed where.
      const counts: Record<string, number> = {};
      Object.values(data.lastVoteTally ?? {}).forEach((targetId) => {
        counts[targetId] = (counts[targetId] ?? 0) + 1;
      });
      view.elimTally = counts;
    }

    if (phase === 'role-reveal') {
      view.readyCount = data.readyUserIds.length;
      view.totalPlayers = data.players.length;
      view.iAmReady = data.readyUserIds.includes(viewerUserId);
    }

    if (phase === 'night') {
      const alive = data.players.filter((p) => p.alive);
      const acted: MafiaRole[] = [];
      if (Object.keys(data.mafiaKillVotes).length > 0) acted.push('mafia');
      if (alive.some((p) => p.role === 'doctor' && data.doctorProtection[p.userId])) acted.push('doctor');
      if (alive.some((p) => p.role === 'detective' && data.detectiveInvestigation[p.userId])) acted.push('detective');
      view.nightActedRoles = acted;
    }

    if (me?.role === 'detective') {
      // Their latest known intel, kept visible through the day/vote that
      // follows the night they learned it.
      view.myInvestigation = data.lastInvestigation[viewerUserId] ?? null;
      // Never the keys: a thread key is the two participants' user ids, and
      // the whole point of a Read is that the other party stays anonymous.
      // The Detective picks a conversation by position.
      const myRead = data.lastRead[viewerUserId];
      view.myRead = myRead
        ? {
            targetUserId: myRead.targetUserId,
            round: myRead.round,
            messageCounts: myRead.messageCounts,
            openedIndex: myRead.openedIndex,
            transcript: myRead.transcript,
          }
        : null;
      view.canRead = data.round >= 2;
      // Everyone this Detective has ever spent an ability on. The bar is for
      // the rest of the game, not just the round after.
      view.blockedTargets = Object.keys(data.detectiveSeen);
      // Nobody left to spend it on. Said outright rather than leaving a
      // screen of greyed-out names and a dead Confirm.
      view.noTargetsLeft = detectiveTargets(data, viewerUserId).length === 0;
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

    if (phase === 'day') {
      // Visible to every viewer, including spectators watching an
      // already-eliminated player's screen -- not gated by me?.alive.
      // The day's discussion is a forum, not a chat: everyone can read it,
      // nobody can see who wrote what. Anonymising it in the view rather
      // than at write time keeps the authors on the server, where the
      // engine still needs them -- one line per player per day for the
      // bots, and the author of a message is never inferable from anyone's
      // client. A viewer keeps their own id on their own lines so their
      // phone can still show them which ones are theirs; that tells them
      // nothing they didn't already know.
      view.dayChat = data.dayChat.map((m) =>
        m.userId === viewerUserId ? m : { ...m, userId: '' }
      );
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

  // What one bot does right now, or null when it has nothing to do. See
  // games/bots.ts for what 'chatter' and 'commit' are allowed to include:
  // in short, a bot talks as soon as the phase opens but doesn't cast the
  // action that closes it until the phase is nearly over, so a table full of
  // bots doesn't resolve the night out from under the people playing.
  botAction(ctx, phase, data, userId, stage) {
    if (data.paused) return null;

    if (phase === 'role-reveal') {
      return data.readyUserIds.includes(userId) ? null : { type: 'ready' };
    }

    const me = data.players.find((p) => p.userId === userId);
    if (!me || !me.alive) return null;
    const others = data.players.filter((p) => p.alive && p.userId !== userId);
    if (others.length === 0) return null;

    if (phase === 'night') {
      // Answering someone comes first -- a player who messages a bot and
      // gets nothing back would reasonably conclude the chat is broken.
      const awaiting = botThreadAwaitingReply(ctx, data, userId);
      if (awaiting) {
        return { type: 'private-chat', targetUserId: awaiting.targetUserId, text: pick(BOT_REPLY_LINES) };
      }
      const partner = botNightPartner(data, userId, others);
      if (data.privateChatRounds[threadKey(userId, partner.userId)] !== data.round) {
        return { type: 'private-chat', targetUserId: partner.userId, text: pick(BOT_NIGHT_LINES) };
      }
      if (stage !== 'commit') return null;

      if (me.role === 'mafia') {
        if (data.mafiaKillVotes[userId]) return null;
        const targets = others.filter((p) => p.role !== 'mafia');
        return targets.length ? { type: 'mafia-kill', targetUserId: pick(targets).userId } : null;
      }
      if (me.role === 'doctor') {
        if (data.doctorProtection[userId]) return null;
        const targets = data.players.filter(
          (p) =>
            p.alive &&
            p.userId !== data.lastDoctorProtection[userId] &&
            (data.settings.doctorCanProtectSelf || p.userId !== userId)
        );
        return targets.length ? { type: 'protect', targetUserId: pick(targets).userId } : null;
      }
      if (me.role === 'detective') {
        if (data.detectiveInvestigation[userId]) return null;
        const targets = others.filter((p) => data.detectiveSeen[p.userId] == null);
        return targets.length ? { type: 'investigate', targetUserId: pick(targets).userId } : null;
      }
      // A Villager has no night ability -- they only talk, which they have
      // already done above.
      return null;
    }

    if (phase === 'day') {
      if (data.dayChat.some((m) => m.userId === userId)) return null;
      return { type: 'day-chat', text: pick(BOT_DAY_LINES) };
    }

    if (phase === 'vote' || phase === 'revote') {
      if (stage !== 'commit') return null;
      if (data.dayVotes[userId]) return null;
      let targets = phase === 'revote'
        ? others.filter((p) => (data.revoteCandidates ?? []).includes(p.userId))
        : others;
      // A Mafia bot knows who its partners are, so it doesn't hang them.
      // Falls back to the full pool if the Mafia are all that's left, in
      // which case the game is already over on the next win check anyway.
      if (me.role === 'mafia') {
        const outsiders = targets.filter((p) => p.role !== 'mafia');
        if (outsiders.length) targets = outsiders;
      }
      return targets.length ? { type: 'vote', targetUserId: pick(targets).userId } : null;
    }

    // 'briefing', 'dawn', 'elim' and 'finished' are the room reading the
    // screen together; nobody acts, bots included.
    return null;
  },

  getFinalResults(data) {
    return data.players.map((p) => {
      const isWinner = data.winner === (p.role === 'mafia' ? 'mafia' : 'village');
      return { userId: p.userId, score: isWinner ? 1 : 0, isWinner };
    });
  },
};
