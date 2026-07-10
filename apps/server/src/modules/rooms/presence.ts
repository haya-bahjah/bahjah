// In-memory, single-process tracking of which users currently have an
// active socket in a given room. Fine for one server instance; a
// multi-instance deployment needs a Redis-backed adapter, which lands in
// Phase 3 alongside the shared game engine's authoritative state.
// Reference-counted so a user with multiple tabs/sockets only drops to
// "disconnected" once every socket for them has closed.
const connectedByRoom = new Map<string, Map<string, number>>();

export function markConnected(code: string, userId: string): void {
  const room = connectedByRoom.get(code) ?? new Map<string, number>();
  room.set(userId, (room.get(userId) ?? 0) + 1);
  connectedByRoom.set(code, room);
}

export function markDisconnected(code: string, userId: string): void {
  const room = connectedByRoom.get(code);
  if (!room) return;
  const remaining = (room.get(userId) ?? 1) - 1;
  if (remaining <= 0) {
    room.delete(userId);
  } else {
    room.set(userId, remaining);
  }
  if (room.size === 0) connectedByRoom.delete(code);
}

export function getConnectedUserIds(code: string): Set<string> {
  return new Set(connectedByRoom.get(code)?.keys() ?? []);
}
