import { GAME_HOST_PLAYS, GAME_PLAYER_LIMITS, type GameType, type RoomSummary } from '@bahjah/shared';
import type { GameType as PrismaGameType, RoomDisplayMode } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { generateUniqueRoomCode } from './codes';
import { getGameEngine } from '../games/engine';
import { computeAccess } from '../payments/access';
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
// Nothing creates a phone-mode room any more: knows-you-best was the only game
// that ever offered the choice, and TV_ONLY_GAMES now pins it to 'tv' (the
// picker that used to ask is gone from the client too). This stays for the
// rooms that were made phone-only before that, which are still in the database
// and still finish under the rules they started with. It can go once none are
// left; until then, removing it would silently promote their creator from
// spectator to player mid-game.
const GAMES_WITH_DISPLAY_CHOICE: readonly GameType[] = ['knows-you-best'];

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

// Games that can only be set up as a television plus phones, whatever a client
// asks for. Knows You Best is here because its flow now spans both: the
// difficulty goes up on the shared screen for the room to argue about, the
// answers are read off it, and the reveal is paced from it -- none of which a
// phone-only room has anywhere to put.
//
// Coerced rather than rejected. The only client that could still ask for
// 'phone' is a tab that was loaded before this shipped, and a 400 would leave
// it stuck on a button that does nothing; giving it the room it can actually
// play is the better failure. Rooms created phone-only before this are left
// alone and finish under the old rules -- see roomHostPlays.
const TV_ONLY_GAMES: readonly GameType[] = ['knows-you-best'];

export function resolveDisplayMode(gameType: GameType, requested: RoomDisplayMode): RoomDisplayMode {
  return TV_ONLY_GAMES.includes(gameType) ? 'tv' : requested;
}

export async function createRoom(
  hostId: string,
  gameType: GameType,
  requestedDisplayMode: RoomDisplayMode = 'tv'
) {
  const displayMode = resolveDisplayMode(gameType, requestedDisplayMode);
  const code = await generateUniqueRoomCode(async (candidate) => {
    const existing = await prisma.room.findUnique({ where: { code: candidate } });
    return existing !== null;
  });

  return prisma.room.create({
    data: {
      code,
      gameType: toPrismaGameType(gameType),
      displayMode,
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
async function assertRoomHasSpace(room: { id: string; gameType: PrismaGameType; displayMode: RoomDisplayMode }, userId?: string) {
  const members = await prisma.roomMember.findMany({
    where: { roomId: room.id },
    select: { userId: true, isHost: true },
  });
  if (userId && members.some((m) => m.userId === userId)) return;
  const gameType = fromPrismaGameType(room.gameType);
  const limits = GAME_PLAYER_LIMITS[gameType];
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

export async function getRoomSummary(code: string, connectedUserIds: Set<string>): Promise<RoomSummary> {
  const room = await loadRoomWithMembers(code);
  if (!room) {
    throw new RoomError('ROOM_NOT_FOUND', 'No room with that code.', 404);
  }
  return toSummary(room, connectedUserIds);
}

// The paywall, re-checked at the moment a game actually starts.
//
// Creating a room and joining one both run requireActiveAccess, but neither
// start nor restart did -- and a room outlives the check that made it. So the
// free trial could be stretched indefinitely: sign up, make a room inside the
// six hours, then keep pressing Play again long after the trial expired,
// because restart only ever asked who the host was, never whether they still
// had access. Every new game now costs what the first one did.
//
// Only the host is checked. Guests and invited players ride on the room the
// host is paying for, which is the whole shape of the product -- one person
// buys the evening, the room joins by scanning a code.
async function assertHostMayStart(userId: string): Promise<void> {
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
  await assertHostMayStart(userId);

  const limits = GAME_PLAYER_LIMITS[gameType];
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
  await assertHostMayStart(userId);

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
