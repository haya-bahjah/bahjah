import { redis } from '../../../db/redis';
import { getAuctionCategoriesSync, type AuctionCategory } from './categoryBank';

export interface AuctionRoomConfig {
  rounds: number;
  answerSeconds: number;
  // Empty means every category. Stored as ids rather than names so a
  // renamed category keeps a room's selection intact.
  categoryIds: string[];
}

export const MIN_ROUNDS = 3;
export const MAX_ROUNDS = 8;
export const DEFAULT_ROUNDS = 5;
// The spec's recommended default, with a shorter and a longer option either
// side of it for a room that wants more or less pressure.
export const ANSWER_SECONDS_CHOICES = [45, 60, 90];
export const DEFAULT_ANSWER_SECONDS = 60;

export function defaultAuctionConfig(): AuctionRoomConfig {
  return { rounds: DEFAULT_ROUNDS, answerSeconds: DEFAULT_ANSWER_SECONDS, categoryIds: [] };
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
  await redis.del(configKey(code));
}

// A selection that matches nothing falls back to the whole list rather than
// starting a game with no categories to auction.
export function resolveAuctionPool(config: AuctionRoomConfig): AuctionCategory[] {
  const all = getAuctionCategoriesSync();
  if (config.categoryIds.length === 0) return all;
  const picked = all.filter((c) => config.categoryIds.includes(c.id));
  return picked.length > 0 ? picked : all;
}
