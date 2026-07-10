import type { GameType, RoomSummary } from '@bahjah/shared';
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
    include: { members: { include: { user: { select: { fullName: true } } } } },
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
      isHost: member.isHost,
      isReady: false,
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

export async function isRoomMember(code: string, userId: string): Promise<boolean> {
  const room = await prisma.room.findUnique({
    where: { code },
    include: { members: { where: { userId } } },
  });
  return Boolean(room && room.members.length > 0);
}
