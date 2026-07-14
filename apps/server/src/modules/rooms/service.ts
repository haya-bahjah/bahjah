import { GAME_PLAYER_LIMITS, type GameType, type RoomSummary } from '@bahjah/shared';
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
    include: { members: { include: { user: { select: { fullName: true, avatar: true } } } } },
  });
}

type RoomWithMembers = NonNullable<Awaited<ReturnType<typeof loadRoomWithMembers>>>;

function toSummary(room: RoomWithMembers, connectedUserIds: Set<string>): RoomSummary {
  return {
    code: room.code,
    gameType: fromPrismaGameType(room.gameType),
    status: fromPrismaRoomStatus(room.status),
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

export async function createRoom(hostId: string, gameType: GameType) {
  const code = await generateUniqueRoomCode(async (candidate) => {
    const existing = await prisma.room.findUnique({ where: { code: candidate } });
    return existing !== null;
  });

  return prisma.room.create({
    data: {
      code,
      gameType: toPrismaGameType(gameType),
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

export async function getRoomSummary(code: string, connectedUserIds: Set<string>): Promise<RoomSummary> {
  const room = await loadRoomWithMembers(code);
  if (!room) {
    throw new RoomError('ROOM_NOT_FOUND', 'No room with that code.', 404);
  }
  return toSummary(room, connectedUserIds);
}

export async function startRoom(userId: string, code: string) {
  const room = await prisma.room.findUnique({ where: { code }, include: { members: true } });
  if (!room) {
    throw new RoomError('ROOM_NOT_FOUND', 'No room with that code.', 404);
  }
  if (room.hostId !== userId) {
    throw new RoomError('NOT_HOST', 'Only the host can start the game.', 403);
  }
  if (room.status !== 'lobby') {
    throw new RoomError('INVALID_STATUS', 'This room has already started or ended.', 409);
  }

  const gameType = fromPrismaGameType(room.gameType);
  const limits = GAME_PLAYER_LIMITS[gameType];
  if (room.members.length < limits.min) {
    throw new RoomError('NOT_ENOUGH_PLAYERS', `${gameType} needs at least ${limits.min} players.`, 409);
  }
  if (room.members.length > limits.max) {
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
