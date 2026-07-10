import type { GameType as PrismaGameType, RoomStatus as PrismaRoomStatus } from '@prisma/client';
import type { GameType, RoomStatus } from '@bahjah/shared';

// The frontend/shared vocabulary uses kebab-case ('knows-you-best'); Prisma
// enum members can't contain hyphens, so the server maps between the two.
const GAME_TYPE_TO_PRISMA: Record<GameType, PrismaGameType> = {
  trivia: 'trivia',
  mafia: 'mafia',
  'knows-you-best': 'knows_you_best',
};

const GAME_TYPE_FROM_PRISMA: Record<PrismaGameType, GameType> = {
  trivia: 'trivia',
  mafia: 'mafia',
  knows_you_best: 'knows-you-best',
};

export function toPrismaGameType(gameType: GameType): PrismaGameType {
  return GAME_TYPE_TO_PRISMA[gameType];
}

export function fromPrismaGameType(gameType: PrismaGameType): GameType {
  return GAME_TYPE_FROM_PRISMA[gameType];
}

const STATUS_FROM_PRISMA: Record<PrismaRoomStatus, RoomStatus> = {
  lobby: 'lobby',
  in_progress: 'in-progress',
  ended: 'ended',
};

export function fromPrismaRoomStatus(status: PrismaRoomStatus): RoomStatus {
  return STATUS_FROM_PRISMA[status];
}
