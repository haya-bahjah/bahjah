// Shared WebSocket event contract between apps/server and apps/web.
// Filled in during Phase 3 (game engine framework). Placeholder for now
// so both sides can start importing from a stable module path.

export interface ServerErrorPayload {
  code: string;
  message: string;
}
