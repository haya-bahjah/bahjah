import type { GameType, RoomSummary } from './games';

// Shared WebSocket event contract between apps/server and apps/web.
// Auth: the client passes a JWT via `socket.handshake.auth.token`; there is
// no separate login event over the socket. A socket is a member of at most
// one room at a time, tracked server-side from the last successful
// `room:join`, so events after that don't need to repeat the code.

export interface RoomJoinRequest {
  code: string;
}

export interface ServerErrorPayload {
  code: string;
  message: string;
}

// The generic room/game state machine: lobby -> in-progress -> ended.
// `phase` and `data` are opaque to this framework — each game engine
// (trivia/mafia/knows-you-best) defines its own phases and data shape on
// top of this envelope, starting in Phase 4.
export interface GameStatePayload<TData = unknown> {
  code: string;
  gameType: GameType;
  phase: string;
  startedAt: number;
  data: TData;
}

export interface GameActionRequest<TAction = unknown> {
  action: TAction;
}

// Event name -> payload type, for both directions.
export interface ClientToServerEvents {
  'room:join': (payload: RoomJoinRequest) => void;
  'room:start': () => void;
  'room:end': () => void;
  'game:action': (payload: GameActionRequest) => void;
}

export interface ServerToClientEvents {
  'room:update': (payload: RoomSummary) => void;
  'room:error': (payload: ServerErrorPayload) => void;
  'game:state': (payload: GameStatePayload) => void;
}
