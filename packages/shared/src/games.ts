export type GameType = 'trivia' | 'mafia' | 'knows-you-best';

export const GAME_TYPES: GameType[] = ['trivia', 'mafia', 'knows-you-best'];

export const GAME_PLAYER_LIMITS: Record<GameType, { min: number; max: number }> = {
  trivia: { min: 1, max: 12 },
  mafia: { min: 4, max: 15 },
  'knows-you-best': { min: 3, max: 10 },
};

// Whether the host is counted as a player for GAME_PLAYER_LIMITS. Trivia's
// host only creates/monitors/controls -- never plays -- so a room needs at
// least `min` *non-host* members before it can start; mafia's host plays
// like everyone else, so its host still counts. knows-you-best's entry is
// only a fallback default (host spectates unless they opt in) -- the real,
// per-room answer lives in that room's saved KnowsYouBestRoomConfig and is
// read directly by rooms/service.ts's startRoom(), not from this map.
export const GAME_HOST_PLAYS: Record<GameType, boolean> = {
  trivia: false,
  mafia: true,
  'knows-you-best': false,
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
