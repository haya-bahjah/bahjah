import { GAME_HOST_PLAYS, GAME_PLAYER_LIMITS, type GameType, type RoomSummary } from '@bahjah/shared';
import type { RoomDisplayMode } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { generateUniqueRoomCode } from './codes';
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
        include: { user: { select: { fullName: true, avatar: true } } },
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
    hostPlays: roomHostPlays(gameType, room.displayMode),
    members: room.members.map((member) => ({
      userId: member.userId,
      displayName: member.user.fullName,
      avatar: member.user.avatar,
      isHost: member.isHost,
      isReady: member.isReady,
      connected: connectedUserIds.has(member.userId),
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

// The games whose Start belongs to the first player rather than to the
// creator. Separate from the list above because the two questions are
// genuinely different: Trivia's creator is *always* a television (its
// GAME_HOST_PLAYS entry is false, with no choice offered), and precisely
// because of that, leaving Start on their screen meant somebody had to walk
// over to the TV to begin. The room now starts from the phone of whoever
// scanned the code first, and the television is narration only.
//
// Not Mafia: its host reads the night out loud and drives every phase from
// the console, so Start there is genuinely the screen's to press.
const PLAYER_CONTROLLED_GAMES: readonly GameType[] = ['knows-you-best', 'trivia'];

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

export async function joinRoom(userId: string, code: string) {
  const room = await prisma.room.findUnique({ where: { code } });
  if (!room) {
    throw new RoomError('ROOM_NOT_FOUND', 'No room with that code.', 404);
  }
  if (room.status === 'ended') {
    throw new RoomError('ROOM_ENDED', 'This room has ended.', 410);
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
  return room;
}

export async function getRoomSummary(code: string, connectedUserIds: Set<string>): Promise<RoomSummary> {
  const room = await loadRoomWithMembers(code);
  if (!room) {
    throw new RoomError('ROOM_NOT_FOUND', 'No room with that code.', 404);
  }
  return toSummary(room, connectedUserIds);
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
  // Start belongs to whoever is running the room, which is the first player
  // rather than the creator -- on a TV the creator is a screen, and nobody
  // should have to walk over to it to begin.
  const controllerId = roomControllerId(room.members, gameType, room.displayMode);
  if (controllerId === null) {
    throw new RoomError('NOT_ENOUGH_PLAYERS', `${gameType} needs at least ${GAME_PLAYER_LIMITS[gameType].min} players.`, 409);
  }
  if (controllerId !== userId) {
    throw new RoomError('NOT_HOST', 'Only the player running the room can start the game.', 403);
  }

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
