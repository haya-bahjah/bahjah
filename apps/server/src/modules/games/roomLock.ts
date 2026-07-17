// Serializes game-state read-modify-write operations per room code. Both
// rooms/socket.ts's game:action handler and this module's own tick
// scheduler (scheduler.ts) mutate the same Redis-backed game state via
// loadGameState -> (engine logic) -> saveGameState; two such operations on
// the same room landing close together -- e.g. several players submitting
// around the same moment, or a scheduled tick firing right as someone
// acts -- can otherwise interleave: the later save overwrites state read
// before the earlier save landed, silently dropping that update. Awaiting
// withRoomLock around each read-modify-write closes that window. Lives in
// its own module (not rooms/socket.ts) so scheduler.ts can use it too
// without a circular import (socket.ts already imports from scheduler.ts).
const locks = new Map<string, Promise<unknown>>();

export function withRoomLock<T>(code: string, fn: () => Promise<T>): Promise<T> {
  const prior = locks.get(code) ?? Promise.resolve();
  const result = prior.then(fn, fn);
  locks.set(code, result.catch(() => undefined));
  return result;
}
