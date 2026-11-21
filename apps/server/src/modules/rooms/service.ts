import { GAME_HOST_PLAYS, GAME_PLAYER_LIMITS, type GameType, type RoomSummary } from '@bahjah/shared';
import type { GameType as PrismaGameType, RoomDisplayMode } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { generateUniqueRoomCode } from './codes';
import { getGameEngine } from '../games/engine';
import { computeAccess } from '../payments/access';
import { getEventById } from '../events/registry';
import { fromPrismaGameType, fromPrismaRoomStatus, toPrismaGameType } from './mappers';

export class RoomError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function loadRoomWithMembers(code: string) {
  return prisma.room.findUnique({
    where: { code },
    include: {
      members: {
        orderBy: { joinedAt: 'asc' },
        include: { user: { select: { fullName: true, avatar: true, isBot: true } } },
      },
    },
  });
}

type RoomWithMembers = NonNullable<Awaited<ReturnType<typeof loadRoomWithMembers>>>;

function toSummary(room: RoomWithMembers, connectedUserIds: Set<string>): RoomSummary {
  const gameType = fromPrismaGameType(room.gameType);
  return {
    code: room.code,
    gameType,
    status: fromPrismaRoomStatus(room.status),
    displayMode: room.displayMode,
    controllerId: roomControllerId(room.members, gameType, room.displayMode),
    starterId: roomStarterId(room.members),
    hostPlays: roomHostPlays(gameType, room.displayMode),
    event: eventSummary(room.eventId),
    members: room.members.map((member) => ({
      userId: member.userId,
      displayName: member.user.fullName,
      avatar: member.user.avatar,
      isHost: member.isHost,
      isReady: member.isReady,
      // A bot holds no socket, so presence would report it as a player who
      // dropped. It is in the room for as long as it exists, so it is
      // always connected.
      connected: member.user.isBot || connectedUserIds.has(member.userId),
      isBot: member.user.isBot,
    })),
  };
}

// What a client needs to know about the private event a room was opened for:
// its name, the language its screens are shown in, and how many players it
// takes. Null for an ordinary room -- and for a room whose event has since
// been removed, which then plays under the ordinary rules.
function eventSummary(eventId: string | null): RoomSummary['event'] {
  const event = getEventById(eventId);
  if (!event) return null;
  return { id: event.id, title: event.title, lang: event.lang, maxPlayers: event.maxPlayers };
}

// A room's player limits: the game's, except that an event room takes as many
// players as its event allows.
export function roomPlayerLimits(gameType: GameType, eventId: string | null): { min: number; max: number } {
  const limits = GAME_PLAYER_LIMITS[gameType];
  const event = getEventById(eventId);
  return event ? { min: limits.min, max: event.maxPlayers } : limits;
}

// Who is actually at the table, and who runs the room.
//
// A room's creator is a player when they made the room on their own phone,
// and a passive second screen when they set it up on a TV. So "the host" --
// the person who presses Start and moves the room on -- is not the creator
// but simply the first *player*, which is the creator on a phone and the
// first person to scan the code on a TV. That way nobody has to walk over to
// the television to run the game.
//
// The games whose creator is a player or a screen according to the room's
// displayMode rather than to a fixed GAME_HOST_PLAYS answer. This governs only
// *whether the creator is a player* -- see PLAYER_CONTROLLED_GAMES below for
// who runs the room.
//
// These are the games whose room can be set up either way. The creator picks
// when they open the room: a TV plus phones (they run the room from the
// screen and do not play), or phones only, where the creator plays along
// and runs the room from their own phone. Every public game offers it now;
// event rooms are still always TV rooms (see resolveDisplayMode).
//
// تخاريف (malarkey) also lets the host change their mind in the lobby: they
// flip "Host plays too" while people are joining (setRoomDisplayMode below).
export const GAMES_WITH_DISPLAY_CHOICE: readonly GameType[] = [
  'trivia',
  'fabrication',
  'knows-you-best',
  'malarkey',
  // A playing Mafia host cannot cut the night or a vote short (see the
  // engine's PLAYING_HOST_CANNOT_ADVANCE).
  'mafia',
  'saudi-home',
  // A playing Auction host does not referee: the table votes answers off
  // each other's lists (the engine's applyStrikeMajority). Likewise Insan
  // Hayawan Jamad's disputes go to a vote (decideDisputes).
  'auction',
  'insan-hayawan-jamad',
  // مع أو ضد: a playing host votes like anybody else; the table's votes, not
  // the host, decide each verdict.
  'for-or-against',
];

// The games whose host may change the room's displayMode while it waits in the
// lobby. Never once it has started: the engine seats its players at start, and
// promoting the screen to a player mid-game would hand them a story nobody
// dealt them.
const LOBBY_DISPLAY_TOGGLE_GAMES: readonly GameType[] = ['malarkey', 'for-or-against'];

export async function setRoomDisplayMode(userId: string, code: string, displayMode: RoomDisplayMode) {
  const room = await prisma.room.findUnique({ where: { code } });
  if (!room) throw new RoomError('ROOM_NOT_FOUND', 'No room with that code.', 404);
  const gameType = fromPrismaGameType(room.gameType);
  if (!LOBBY_DISPLAY_TOGGLE_GAMES.includes(gameType)) {
    throw new RoomError('NOT_SUPPORTED', 'This game has no display choice.', 400);
  }
  if (room.hostId !== userId) throw new RoomError('NOT_HOST', 'Only the host can change this.', 403);
  if (room.status !== 'lobby') throw new RoomError('INVALID_STATUS', 'This room has already started or ended.', 409);
  if (room.displayMode === displayMode) return room;
  // Turning the host into a player takes a seat, so a full room cannot.
  if (displayMode === 'phone') {
    const members = await prisma.roomMember.findMany({ where: { roomId: room.id }, select: { isHost: true } });
    const limits = roomPlayerLimits(gameType, room.eventId);
    if (playableRoomMembers(members, gameType, 'phone').length > limits.max) {
      throw new RoomError('ROOM_FULL', `This room is full — ${gameType} allows at most ${limits.max} players.`, 409);
    }
  }
  return prisma.room.update({ where: { id: room.id }, data: { displayMode } });
}

// The games whose between-rounds controls belong to a player rather than to
// the creator. Mafia is absent because its host drives every phase from the
// console.
//
// Knows You Best used to be here, on the reasoning that nobody taps a
// television. In practice the room's screen is a laptop somebody is sitting
// behind, and handing the difficulty to "whoever joined first" meant the
// person running the game watched a stranger's phone decide what the room
// was about to play. It now follows Mafia and the Quiz: the host sets the
// game up, so the host picks.
//
// This no longer governs Start -- that is the host's in every game now, see
// roomStarterId. It governs only who may move a room on once it is running.
const PLAYER_CONTROLLED_GAMES: readonly GameType[] = ['trivia'];

export function roomHostPlays(gameType: GameType, displayMode: RoomDisplayMode): boolean {
  if (GAMES_WITH_DISPLAY_CHOICE.includes(gameType)) return displayMode === 'phone';
  return GAME_HOST_PLAYS[gameType];
}

export function playableRoomMembers<T extends { isHost: boolean }>(
  members: T[],
  gameType: GameType,
  displayMode: RoomDisplayMode
): T[] {
  return roomHostPlays(gameType, displayMode) ? members : members.filter((m) => !m.isHost);
}

// The controller is the first playable member in join order. Callers must
// pass members already ordered by when they joined.
// Who presses Start: the person who made the room, in every game.
//
// This used to be the same answer as roomControllerId, which meant Trivia
// and Knows You Best began from the first player's phone while Mafia began
// from the host's screen -- three games, two rules, and a lobby that told
// the room "the first player to join starts the game". Start is now the
// host's everywhere. Who moves a *running* room on is a separate question
// and still has separate answers; see roomControllerId below.
export function roomStarterId<T extends { userId: string; isHost: boolean }>(
  members: T[]
): string | null {
  const host = members.find((m) => m.isHost);
  return host ? host.userId : null;
}

export function roomControllerId<T extends { userId: string; isHost: boolean }>(
  members: T[],
  gameType: GameType,
  displayMode: RoomDisplayMode
): string | null {
  // Everywhere else the creator stays in charge -- their host console has
  // always owned Start, and moving it would change flows nobody asked to
  // change.
  if (!PLAYER_CONTROLLED_GAMES.includes(gameType)) {
    const host = members.find((m) => m.isHost);
    return host ? host.userId : null;
  }
  const players = playableRoomMembers(members, gameType, displayMode);
  return players.length > 0 ? players[0].userId : null;
}

// What a room is created as. A game without the choice is always a TV room,
// whatever a client asks for -- coerced rather than rejected, so a stale tab
// asking for 'phone' still gets a room it can play.
//
// A private event's room is always a TV room too. The events are run by an
// operator in front of a big screen (the Meet & Greet turns its answer cards
// over on it), and the event link opens with no picker.
export function resolveDisplayMode(
  gameType: GameType,
  requested: RoomDisplayMode,
  eventId: string | null = null
): RoomDisplayMode {
  if (eventId) return 'tv';
  return GAMES_WITH_DISPLAY_CHOICE.includes(gameType) ? requested : 'tv';
}

export async function createRoom(
  hostId: string,
  gameType: GameType,
  requestedDisplayMode: RoomDisplayMode = 'tv',
  eventId: string | null = null
) {
  const displayMode = resolveDisplayMode(gameType, requestedDisplayMode, eventId);
  const code = await generateUniqueRoomCode(async (candidate) => {
    const existing = await prisma.room.findUnique({ where: { code: candidate } });
    return existing !== null;
  });

  return prisma.room.create({
    data: {
      code,
      gameType: toPrismaGameType(gameType),
      displayMode,
      eventId,
      hostId,
      members: { create: { userId: hostId, isHost: true } },
    },
  });
}

// A room that is already at its game's cap must not take anybody else: the
// limit is only enforced at startRoom, so letting an extra player in leaves
// a room that cannot start and has no way to shed them. Someone already in
// the room is never turned away -- this has to stay idempotent for a
// refresh or a reconnect.
async function assertRoomHasSpace(
  room: { id: string; gameType: PrismaGameType; displayMode: RoomDisplayMode; eventId: string | null },
  userId?: string
) {
  const members = await prisma.roomMember.findMany({
    where: { roomId: room.id },
    select: { userId: true, isHost: true },
  });
  if (userId && members.some((m) => m.userId === userId)) return;
  const gameType = fromPrismaGameType(room.gameType);
  const limits = roomPlayerLimits(gameType, room.eventId);
  if (playableRoomMembers(members, gameType, room.displayMode).length >= limits.max) {
    throw new RoomError('ROOM_FULL', `This room is full — ${gameType} allows at most ${limits.max} players.`, 409);
  }
}

export async function joinRoom(userId: string, code: string) {
  const room = await prisma.room.findUnique({ where: { code } });
  if (!room) {
    throw new RoomError('ROOM_NOT_FOUND', 'No room with that code.', 404);
  }
  if (room.status === 'ended') {
    throw new RoomError('ROOM_ENDED', 'This room has ended.', 410);
  }
  await assertRoomHasSpace(room, userId);
  // Hayakom has no seat for someone arriving mid-game: its scoring is set
  // when the game starts. A member reconnecting is fine; a newcomer waits for
  // the next game, the same rule its guests already follow
  // (assertGuestJoinable).
  if (room.gameType === 'saudi_home' && room.status !== 'lobby') {
    const member = await prisma.roomMember.findUnique({ where: { roomId_userId: { roomId: room.id, userId } } });
    if (!member) throw new RoomError('ROOM_NOT_JOINABLE', 'This room is no longer accepting new players.', 409);
  }

  await prisma.roomMember.upsert({
    where: { roomId_userId: { roomId: room.id, userId } },
    create: { roomId: room.id, userId, isHost: room.hostId === userId },
    update: {},
  });

  return room;
}

// Stricter than joinRoom on purpose: guest join is Kahoot-style (lobby
// only), while joinRoom's looser "any non-ended room" behavior stays
// unchanged for full-account members.
export async function assertGuestJoinable(code: string) {
  const room = await prisma.room.findUnique({ where: { code } });
  if (!room) {
    throw new RoomError('ROOM_NOT_FOUND', 'No room with that code.', 404);
  }
  if (room.status !== 'lobby') {
    throw new RoomError('ROOM_NOT_JOINABLE', 'This room is no longer accepting new players.', 409);
  }
  await assertRoomHasSpace(room);
  return room;
}

// Games where two players may not share a name: the shared screen and the
// leaderboard tell people apart by name alone. A repeat gets a number --
// John, John2, John3 -- rather than being turned away.
const UNIQUE_NAME_GAMES: readonly PrismaGameType[] = ['saudi_home'];
const NAME_MAX = 24;

export async function uniqueDisplayName(code: string, nickname: string): Promise<string> {
  const room = await prisma.room.findUnique({
    where: { code },
    select: { gameType: true, members: { select: { user: { select: { fullName: true } } } } },
  });
  if (!room || !UNIQUE_NAME_GAMES.includes(room.gameType)) return nickname;
  const taken = new Set(room.members.map((m) => m.user.fullName.trim().toLowerCase()));
  const base = nickname.trim();
  if (!taken.has(base.toLowerCase())) return base;
  for (let n = 2; ; n += 1) {
    const suffix = String(n);
    const candidate = base.slice(0, NAME_MAX - suffix.length) + suffix;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

// Games whose host may take a player out of the room: the event operator
// A player leaving a room for good ("Leave room"), in the games that offer
// it. Without this a player who walked away stayed a member: they kept a seat
// in the next game, counted towards the player limit, and showed as offline
// in the lobby until the room was swept. The host cannot leave -- they own
// the room and End room is theirs.
const LEAVABLE_GAMES: readonly PrismaGameType[] = ['malarkey', 'for_or_against'];

export async function leaveRoom(userId: string, code: string): Promise<void> {
  const room = await prisma.room.findUnique({ where: { code } });
  if (!room) throw new RoomError('ROOM_NOT_FOUND', 'No room with that code.', 404);
  if (!LEAVABLE_GAMES.includes(room.gameType)) throw new RoomError('NOT_SUPPORTED', 'This game has no Leave.', 400);
  if (room.hostId === userId) throw new RoomError('INVALID_TARGET', 'The host cannot leave their own room.', 400);
  await prisma.roomMember.deleteMany({ where: { roomId: room.id, userId } });
}

// removing a duplicate or disruptive participant.
const REMOVABLE_PLAYER_GAMES: readonly PrismaGameType[] = ['saudi_home', 'for_or_against'];

export async function removeRoomPlayer(userId: string, code: string, targetUserId: string): Promise<void> {
  const room = await prisma.room.findUnique({ where: { code } });
  if (!room) throw new RoomError('ROOM_NOT_FOUND', 'No room with that code.', 404);
  if (!REMOVABLE_PLAYER_GAMES.includes(room.gameType)) {
    throw new RoomError('NOT_SUPPORTED', 'Players cannot be removed from this game.', 400);
  }
  if (room.hostId !== userId) throw new RoomError('NOT_HOST', 'Only the host can remove a player.', 403);
  if (targetUserId === room.hostId) throw new RoomError('INVALID_TARGET', 'The host cannot be removed.', 400);
  await prisma.roomMember.deleteMany({ where: { roomId: room.id, userId: targetUserId } });
}

export async function getRoomSummary(code: string, connectedUserIds: Set<string>): Promise<RoomSummary> {
  const room = await loadRoomWithMembers(code);
  if (!room) {
    throw new RoomError('ROOM_NOT_FOUND', 'No room with that code.', 404);
  }
  return toSummary(room, connectedUserIds);
}

// The paywall, checked at the moment a game actually starts -- and now the
// only one. Creating a room is open to an account without a Day Pass (its
// lobby is locked under a checkout instead), and joining never checked.
//
// Originally creating and joining both ran requireActiveAccess, but neither
// start nor restart did -- and a room outlives the check that made it. So the
// free trial could be stretched indefinitely: sign up, make a room inside the
// six hours, then keep pressing Play again long after the trial expired,
// because restart only ever asked who the host was, never whether they still
// had access. Every new game now costs what the first one did.
//
// Only the host is checked. Guests and invited players ride on the room the
// host is paying for, which is the whole shape of the product -- one person
// buys the evening, the room joins by scanning a code.
//
// A room opened from a private event link is free to start: the event is the
// one paying, so whoever opened the link is never asked for a pass.
async function assertHostMayStart(userId: string, eventId: string | null): Promise<void> {
  if (getEventById(eventId)) return;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, createdAt: true, paidUntil: true },
  });
  if (!user) {
    throw new RoomError('NOT_FOUND', 'User not found.', 404);
  }
  const access = computeAccess(user);
  if (!access.hasAccess) {
    throw new RoomError(
      'ACCESS_REQUIRED',
      'Your free trial has ended. Get a Day Pass to keep playing.',
      402
    );
  }
}

export async function startRoom(userId: string, code: string) {
  const room = await prisma.room.findUnique({
    where: { code },
    include: { members: { orderBy: { joinedAt: 'asc' } } },
  });
  if (!room) {
    throw new RoomError('ROOM_NOT_FOUND', 'No room with that code.', 404);
  }
  if (room.status !== 'lobby') {
    throw new RoomError('INVALID_STATUS', 'This room has already started or ended.', 409);
  }

  const gameType = fromPrismaGameType(room.gameType);
  // Start belongs to the host, in every game. See roomStarterId.
  const starterId = roomStarterId(room.members);
  if (starterId === null) {
    throw new RoomError('NOT_HOST', 'This room has no host to start it.', 409);
  }
  if (starterId !== userId) {
    throw new RoomError('NOT_HOST', 'Only the host can start the game.', 403);
  }
  await assertHostMayStart(userId, room.eventId);

  const limits = roomPlayerLimits(gameType, room.eventId);
  const playableCount = playableRoomMembers(room.members, gameType, room.displayMode).length;
  if (playableCount < limits.min) {
    throw new RoomError('NOT_ENOUGH_PLAYERS', `${gameType} needs at least ${limits.min} players.`, 409);
  }
  if (playableCount > limits.max) {
    throw new RoomError('TOO_MANY_PLAYERS', `${gameType} allows at most ${limits.max} players.`, 409);
  }

  await prisma.room.update({ where: { id: room.id }, data: { status: 'in_progress' } });
  return room;
}

export async function endRoom(userId: string, code: string) {
  const room = await prisma.room.findUnique({ where: { code } });
  if (!room) {
    throw new RoomError('ROOM_NOT_FOUND', 'No room with that code.', 404);
  }
  if (room.hostId !== userId) {
    throw new RoomError('NOT_HOST', 'Only the host can end the game.', 403);
  }
  if (room.status !== 'in_progress') {
    throw new RoomError('INVALID_STATUS', 'This room is not in progress.', 409);
  }

  await prisma.room.update({ where: { id: room.id }, data: { status: 'ended', endedAt: new Date() } });
  return room;
}

// "Play again": resets the room to the lobby, same code, so everyone who's
// still connected just flows back to the waiting room instead of needing a
// new code. Only clears ready-state -- the host's saved game config
// (category/difficulty/custom questions for trivia) is left alone by the
// caller so a replay can reuse it.
export async function restartRoom(userId: string, code: string) {
  const room = await prisma.room.findUnique({ where: { code } });
  if (!room) {
    throw new RoomError('ROOM_NOT_FOUND', 'No room with that code.', 404);
  }
  if (room.hostId !== userId) {
    throw new RoomError('NOT_HOST', 'Only the host can restart the game.', 403);
  }
  if (room.status !== 'in_progress') {
    throw new RoomError('INVALID_STATUS', 'This room is not in progress.', 409);
  }
  await assertHostMayStart(userId, room.eventId);

  await prisma.$transaction([
    prisma.room.update({ where: { id: room.id }, data: { status: 'lobby' } }),
    prisma.roomMember.updateMany({ where: { roomId: room.id }, data: { isReady: false } }),
  ]);
  return room;
}

export async function setReady(userId: string, code: string, isReady: boolean) {
  const room = await prisma.room.findUnique({ where: { code } });
  if (!room) {
    throw new RoomError('ROOM_NOT_FOUND', 'No room with that code.', 404);
  }
  await prisma.roomMember.update({
    where: { roomId_userId: { roomId: room.id, userId } },
    data: { isReady },
  });
}

export async function getRoomGameType(code: string): Promise<GameType> {
  const room = await prisma.room.findUnique({ where: { code }, select: { gameType: true } });
  if (!room) {
    throw new RoomError('ROOM_NOT_FOUND', 'No room with that code.', 404);
  }
  return fromPrismaGameType(room.gameType);
}

// The language a private event's room is played in, or null for an ordinary
// room.
export async function getRoomEventLang(code: string): Promise<'en' | 'ar' | null> {
  const room = await prisma.room.findUnique({ where: { code }, select: { eventId: true } });
  return getEventById(room?.eventId)?.lang ?? null;
}

export async function isRoomMember(code: string, userId: string): Promise<boolean> {
  const room = await prisma.room.findUnique({
    where: { code },
    include: { members: { where: { userId } } },
  });
  return Boolean(room && room.members.length > 0);
}

// Practice bots are gone from the product.
//
// They existed so one person could walk Mafia's whole flow alone -- deal,
// night, dawn, day, vote, win -- without finding four more people, and they
// did that job. What they could not do is tell a real room from a rehearsal:
// the seats filled on everybody's phone, and "TEST: PLAY AS Doctor" sat in a
// live lobby. Nothing creates a bot any more; addRoomBots/removeRoomBots and
// the sockets that called them are removed.
//
// What stays, deliberately: User.isBot, getRoomBotIds below, and the engines'
// botAction. Rooms played with bots are already in the database and in game
// history, analytics counts on isBot to keep them out of the signup numbers,
// and a room that still holds one has to keep working rather than stall on a
// seat nothing will play. No new ones can appear.

export async function getRoomBotIds(code: string): Promise<string[]> {
  const room = await prisma.room.findUnique({
    where: { code },
    include: { members: { include: { user: { select: { isBot: true } } } } },
  });
  if (!room) return [];
  return room.members.filter((m) => m.user.isBot).map((m) => m.userId);
}
