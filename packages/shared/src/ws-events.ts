import type { RoomSummary } from './games';

// Shared WebSocket event contract between apps/server and apps/web.
// Auth: the client passes a JWT via `socket.handshake.auth.token`; there is
// no separate login event over the socket.

export interface RoomJoinRequest {
  code: string;
}

export interface ServerErrorPayload {
  code: string;
  message: string;
}

// Event name -> payload type, for both directions.
export interface ClientToServerEvents {
  'room:join': (payload: RoomJoinRequest) => void;
}

export interface ServerToClientEvents {
  'room:update': (payload: RoomSummary) => void;
  'room:error': (payload: ServerErrorPayload) => void;
}
