export type GameType = 'trivia' | 'mafia' | 'knows-you-best';

export const GAME_TYPES: GameType[] = ['trivia', 'mafia', 'knows-you-best'];

export const GAME_PLAYER_LIMITS: Record<GameType, { min: number; max: number }> = {
  trivia: { min: 1, max: 12 },
  mafia: { min: 4, max: 15 },
  'knows-you-best': { min: 3, max: 10 },
};

export type RoomStatus = 'lobby' | 'in-progress' | 'ended';

export interface RoomMemberSummary {
  userId: string;
  displayName: string;
  avatar: string | null;
  isHost: boolean;
  isReady: boolean;
  connected: boolean;
}

export interface RoomSummary {
  code: string;
  gameType: GameType;
  status: RoomStatus;
  members: RoomMemberSummary[];
}
