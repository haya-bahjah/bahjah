import { redis } from '../../../db/redis';
import { IDENTITIES, PACKS, type Identity, type PackId } from './identities';

// The host's session setup (wireframe 01), saved per room while it waits in
// the lobby and read once when the game starts.
export type RevealMode = 'timed' | 'host';
export type PackChoice = PackId | 'mixed';

export interface WhoAmIConfig {
  pack: PackChoice;
  reveal: RevealMode;
  // Timed mode: seconds each clue stays up before the next one.
  seconds: number;
  // How many identities the game plays.
  count: number;
  // The host runs the game from a bar on the TV instead of their phone.
  hostOnTv: boolean;
}

export const PACK_CHOICES: PackChoice[] = [...PACKS, 'mixed'];
export const MIN_SECONDS = 10;
export const MAX_SECONDS = 30;
export const SECONDS_STEP = 5;
export const MIN_COUNT = 1;
export const MAX_COUNT = 10;
export const POINTS = [600, 500, 400, 300, 200, 100] as const;

export function defaultConfig(): WhoAmIConfig {
  return { pack: 'mixed', reveal: 'timed', seconds: 15, count: 5, hostOnTv: false };
}

const TTL_SECONDS = 60 * 60 * 6;
const key = (code: string) => `bahjah:wai-config:${code}`;
const playedKey = (code: string) => `bahjah:wai-played:${code}`;

export async function getConfig(code: string): Promise<WhoAmIConfig> {
  const raw = await redis.get(key(code));
  return raw ? { ...defaultConfig(), ...(JSON.parse(raw) as Partial<WhoAmIConfig>) } : defaultConfig();
}

export async function saveConfig(code: string, config: WhoAmIConfig): Promise<void> {
  await redis.set(key(code), JSON.stringify(config), 'EX', TTL_SECONDS);
}

export async function clearConfig(code: string): Promise<void> {
  await redis.del(key(code), playedKey(code));
}

// Identities already played in this room, so a rematch brings new ones.
export async function getPlayed(code: string): Promise<string[]> {
  return redis.smembers(playedKey(code));
}

export async function addPlayed(code: string, ids: string[]): Promise<void> {
  if (!ids.length) return;
  await redis.multi().sadd(playedKey(code), ...ids).expire(playedKey(code), TTL_SECONDS).exec();
}

export function packSize(pack: PackChoice): number {
  return pack === 'mixed' ? IDENTITIES.length : IDENTITIES.filter((i) => i.pack === pack).length;
}

function shuffled<T>(list: T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// The identities a game will play: from the chosen pack, shuffled, with any
// already played in this room at the back so a rematch only repeats one when
// the fresh ones run out.
export function resolveIdentities(config: WhoAmIConfig, played: string[] = []): Identity[] {
  const pool = shuffled(config.pack === 'mixed' ? IDENTITIES : IDENTITIES.filter((i) => i.pack === config.pack));
  const seen = new Set(played);
  const ordered = [...pool.filter((i) => !seen.has(i.id)), ...pool.filter((i) => seen.has(i.id))];
  return ordered.slice(0, Math.max(MIN_COUNT, Math.min(MAX_COUNT, config.count)));
}
