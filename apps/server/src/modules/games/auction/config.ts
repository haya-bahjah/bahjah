import { redis } from '../../../db/redis';
import { getAuctionCategoriesSync, type AuctionCategory } from './categoryBank';

export interface AuctionRoomConfig {
  rounds: number;
  answerSeconds: number;
  // Empty means every category. Stored as ids rather than names so a
  // renamed category keeps a room's selection intact.
  categoryIds: string[];
  // The one language the whole game is played in (the design's "Categories:
  // Arabic | English"): every screen shows the lots in it. Optional because
  // configs saved before it existed lack it; those play in English.
  language?: AuctionLanguage;
}

export type AuctionLanguage = 'en' | 'ar';

export const MIN_ROUNDS = 3;
export const MAX_ROUNDS = 8;
export const DEFAULT_ROUNDS = 5;
// The spec's recommended default, with a shorter and a longer option either
// side of it for a room that wants more or less pressure. The host's setup
// offers 3 / 5 / 7 lots; the wider range stays valid for rooms saved before.
export const ANSWER_SECONDS_CHOICES = [45, 60, 90];
export const DEFAULT_ANSWER_SECONDS = 60;

export function defaultAuctionConfig(): AuctionRoomConfig {
  return { rounds: DEFAULT_ROUNDS, answerSeconds: DEFAULT_ANSWER_SECONDS, categoryIds: [], language: 'en' };
}

const CONFIG_TTL_SECONDS = 60 * 60 * 6;
const configKey = (code: string) => `bahjah:auction-config:${code}`;

export async function saveAuctionRoomConfig(code: string, config: AuctionRoomConfig): Promise<void> {
  await redis.set(configKey(code), JSON.stringify(config), 'EX', CONFIG_TTL_SECONDS);
}

export async function getAuctionRoomConfig(code: string): Promise<AuctionRoomConfig | null> {
  const raw = await redis.get(configKey(code));
  return raw ? (JSON.parse(raw) as AuctionRoomConfig) : null;
}

export async function clearAuctionRoomConfig(code: string): Promise<void> {
  await redis.del(configKey(code), playedKey(code));
}

// The categories this room has already auctioned, oldest first, so a New game
// in the same room deals fresh lots. Kept for the room's life (cleared with
// the config when the room ends), not per game.
const playedKey = (code: string) => `bahjah:auction-played:${code}`;

export async function getPlayedAuctionCategories(code: string): Promise<string[]> {
  return redis.lrange(playedKey(code), 0, -1);
}

// Moves each id to the newest end, so once every category has been played
// the ones played longest ago come round first.
export async function addPlayedAuctionCategories(code: string, ids: string[]): Promise<void> {
  if (!ids.length) return;
  const tx = redis.multi();
  for (const id of ids) tx.lrem(playedKey(code), 0, id);
  await tx.rpush(playedKey(code), ...ids).expire(playedKey(code), CONFIG_TTL_SECONDS).exec();
}

function shuffled<T>(list: T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// The lots a game will auction: categories this room has not played yet, in
// random order, and only once those run out the played ones, oldest first.
// Within one game a category never comes up twice.
export function drawAuctionCategories(pool: AuctionCategory[], rounds: number, played: string[]): AuctionCategory[] {
  const playedAt = new Map(played.map((id, i) => [id, i]));
  const fresh = shuffled(pool.filter((c) => !playedAt.has(c.id)));
  const stale = shuffled(pool.filter((c) => playedAt.has(c.id))).sort((a, b) => playedAt.get(a.id)! - playedAt.get(b.id)!);
  return [...fresh, ...stale].slice(0, rounds);
}

// A selection that matches nothing falls back to the whole list rather than
// starting a game with no categories to auction.
export function resolveAuctionPool(config: AuctionRoomConfig): AuctionCategory[] {
  const all = getAuctionCategoriesSync();
  if (config.categoryIds.length === 0) return all;
  const picked = all.filter((c) => config.categoryIds.includes(c.id));
  return picked.length > 0 ? picked : all;
}
