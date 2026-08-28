export type GameType = 'trivia' | 'mafia' | 'knows-you-best';

export const GAME_TYPES: GameType[] = ['trivia', 'mafia', 'knows-you-best'];

export const GAME_PLAYER_LIMITS: Record<GameType, { min: number; max: number }> = {
  trivia: { min: 2, max: 50 },
  mafia: { min: 4, max: 20 },
  'knows-you-best': { min: 3, max: 12 },
};

// Whether the host is counted as a player for GAME_PLAYER_LIMITS. No game
// counts its host any more: each one's host creates, monitors and controls
// the room from the big screen without ever playing, so a room needs at
// least `min` *non-host* members before it can start. knows-you-best's entry
// is only a fallback default -- the real, per-room answer lives in that
// room's saved KnowsYouBestRoomConfig and is read directly by
// rooms/service.ts's startRoom(), not from this map.
export const GAME_HOST_PLAYS: Record<GameType, boolean> = {
  trivia: false,
  // The host runs Mafia from the big screen and is never dealt a card, so
  // they stay on the lobby page and the host console takes over there --
  // same arrangement as trivia and knows-you-best.
  mafia: false,
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

export type RoomDisplayMode = 'phone' | 'tv';

export interface RoomSummary {
  code: string;
  gameType: GameType;
  status: RoomStatus;
  // 'phone': the creator plays and every screen is drawn on the phones.
  // 'tv': the creator's screen is a passive display and is not a player.
  displayMode: RoomDisplayMode;
  // Who runs the room -- presses Start, then moves it on between rounds.
  // The first player to join, which is the creator on a phone and the first
  // person to scan the code on a TV. Null while nobody has joined yet.
  controllerId: string | null;
  // Whether the creator is one of the players in *this* room. Games answer
  // this statically (GAME_HOST_PLAYS), except the ones that offer a display
  // choice, where it follows displayMode. Sent so the lobby never has to
  // work it out from the game name.
  hostPlays: boolean;
  members: RoomMemberSummary[];
}
