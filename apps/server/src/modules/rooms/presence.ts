import { redis } from '../../db/redis';

// Redis-backed tracking of which users currently have an active socket in a
// given room, so presence is correct across multiple server instances (a
// single in-memory Map only worked for one process). Reference-counted via
// HINCRBY so a user with multiple tabs/sockets only drops to "disconnected"
// once every socket for them has closed.
const PRESENCE_TTL_SECONDS = 60 * 60 * 6;

const presenceKey = (code: string) => `bahjah:presence:${code}`;

export async function markConnected(code: string, userId: string): Promise<void> {
  const key = presenceKey(code);
  await redis.hincrby(key, userId, 1);
  await redis.expire(key, PRESENCE_TTL_SECONDS);
}

export async function markDisconnected(code: string, userId: string): Promise<void> {
  const key = presenceKey(code);
  const remaining = await redis.hincrby(key, userId, -1);
  if (remaining <= 0) {
    await redis.hdel(key, userId);
  }
}

export async function getConnectedUserIds(code: string): Promise<Set<string>> {
  const entries = await redis.hgetall(presenceKey(code));
  return new Set(Object.keys(entries));
}

export async function clearPresence(code: string): Promise<void> {
  await redis.del(presenceKey(code));
}
