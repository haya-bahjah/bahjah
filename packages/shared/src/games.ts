export type GameType = 'trivia' | 'mafia' | 'knows-you-best';

export const GAME_TYPES: GameType[] = ['trivia', 'mafia', 'knows-you-best'];

export const GAME_PLAYER_LIMITS: Record<GameType, { min: number; max: number }> = {
  trivia: { min: 2, max: 50 },
  // Five is the rules document's stated minimum for a standard match. The
  // ceiling is not a rule -- the document asks for the old cap to be
  // removed for "a larger or effectively unlimited number of players", and
  // the Mafia count scales by formula with no upper bound (see
  // defaultMafiaCount). This number is only the practical ceiling: every
  // state broadcast is redacted once per viewer, and the night's private
  // threads grow with the square of the table. Fifty is comfortably past
  // anything the document's table covers and can go higher on request.
  mafia: { min: 5, max: 50 },
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
  // A practice bot the host added to fill out a short room. Clients label
  // these so nobody at the table mistakes one for a person who has not
  // joined yet.
  isBot: boolean;
}

export type RoomDisplayMode = 'phone' | 'tv';

export interface RoomSummary {
  code: string;
  gameType: GameType;
  status: RoomStatus;
  // 'phone': the creator plays and every screen is drawn on the phones.
  // 'tv': the creator's screen is a passive display and is not a player.
  displayMode: RoomDisplayMode;
  // Who moves the room on *once it is running* -- the between-rounds
  // controls a game gives one person. For the games that hand those to a
  // player it is the first player to join; for Mafia it is the host at the
  // console. Null while nobody has joined yet.
  //
  // Not who presses Start: that is starterId below. The two used to be the
  // same value, which is what made Trivia and Knows You Best begin from the
  // first player's phone while Mafia began from the host's screen.
  controllerId: string | null;
  // Who presses Start. Always the room's creator, in every game -- one rule,
  // so a host who sets up any Bahjah game knows the room is theirs to begin.
  // Null if the room somehow has no host member.
  starterId: string | null;
  // Whether the creator is one of the players in *this* room. Games answer
  // this statically (GAME_HOST_PLAYS), except the ones that offer a display
  // choice, where it follows displayMode. Sent so the lobby never has to
  // work it out from the game name.
  hostPlays: boolean;
  members: RoomMemberSummary[];
}
