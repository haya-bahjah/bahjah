import { redis } from '../../../db/redis';
import { getIhjCategoriesSync, type IhjCategory } from './bank';

export interface IhjRoomConfig {
  rounds: number;
  answerSeconds: number;
  // The categories this room plays with, as ids. Empty means the five the
  // spec names, which is also what a host who never opens the panel gets.
  categoryIds: string[];
}

export const MIN_ROUNDS = 3;
export const MAX_ROUNDS = 8;
export const DEFAULT_ROUNDS = 5;
export const ANSWER_SECONDS_CHOICES = [45, 60, 90];
export const DEFAULT_ANSWER_SECONDS = 60;
// Five is the shape of the game -- إنسان، حيوان، جماد، نبات، بلاد -- and it is
// also what fits a phone without scrolling during a timed round, so a host
// swaps categories in and out rather than adding a sixth.
export const CATEGORY_COUNT = 5;

export function defaultIhjConfig(): IhjRoomConfig {
  return { rounds: DEFAULT_ROUNDS, answerSeconds: DEFAULT_ANSWER_SECONDS, categoryIds: [] };
}

const CONFIG_TTL_SECONDS = 60 * 60 * 6;
const configKey = (code: string) => `bahjah:ihj-config:${code}`;

export async function saveIhjRoomConfig(code: string, config: IhjRoomConfig): Promise<void> {
  await redis.set(configKey(code), JSON.stringify(config), 'EX', CONFIG_TTL_SECONDS);
}

export async function getIhjRoomConfig(code: string): Promise<IhjRoomConfig | null> {
  const raw = await redis.get(configKey(code));
  return raw ? (JSON.parse(raw) as IhjRoomConfig) : null;
}

export async function clearIhjRoomConfig(code: string): Promise<void> {
  await redis.del(configKey(code));
}

// The five categories a room actually plays. A selection that does not add up
// to five (an old config, a category deactivated since) is topped up from the
// defaults rather than played short.
export function resolveIhjCategories(config: IhjRoomConfig): IhjCategory[] {
  const all = getIhjCategoriesSync();
  const picked = config.categoryIds
    .map((id) => all.find((c) => c.id === id))
    .filter((c): c is IhjCategory => Boolean(c));
  if (picked.length === CATEGORY_COUNT) return picked;

  const fallback = all.filter((c) => c.isDefault);
  const result = [...picked];
  for (const c of [...fallback, ...all]) {
    if (result.length >= CATEGORY_COUNT) break;
    if (!result.some((r) => r.id === c.id)) result.push(c);
  }
  return result.slice(0, CATEGORY_COUNT);
}
