import type { GameStatePayload } from '@bahjah/shared';
import { redis } from '../../db/redis';

const STATE_TTL_SECONDS = 60 * 60 * 12;

const stateKey = (code: string) => `bahjah:game-state:${code}`;

export async function saveGameState(payload: GameStatePayload): Promise<void> {
  await redis.set(stateKey(payload.code), JSON.stringify(payload), 'EX', STATE_TTL_SECONDS);
}

export async function loadGameState(code: string): Promise<GameStatePayload | null> {
  const raw = await redis.get(stateKey(code));
  return raw ? (JSON.parse(raw) as GameStatePayload) : null;
}

export async function clearGameState(code: string): Promise<void> {
  await redis.del(stateKey(code));
}
