import { redis } from '../../../db/redis';
import {
  getFabricationCategoriesSync,
  getFabricationBankSync,
  type FabricationDifficulty,
  type FabricationQuestion,
} from './questionBank';

export interface FabricationRoomConfig {
  rounds: number;
  // 'any' is the default rather than a difficulty: the spec calls difficulty
  // an optional setting, and a host who never opens the panel should get the
  // whole bank rather than a third of it.
  difficulty: FabricationDifficulty | 'any';
  categories: string[];
}

export const MIN_ROUNDS = 3;
export const MAX_ROUNDS = 8;
export const DEFAULT_ROUNDS = 6;

export function defaultFabricationConfig(): FabricationRoomConfig {
  return {
    rounds: DEFAULT_ROUNDS,
    difficulty: 'any',
    categories: getFabricationCategoriesSync().map((c) => c.name),
  };
}

// Config outlives the lobby screen it was set on but not the room, exactly
// like trivia's -- same key shape, same 6h window.
const CONFIG_TTL_SECONDS = 60 * 60 * 6;
const configKey = (code: string) => `bahjah:fabrication-config:${code}`;

export async function saveFabricationRoomConfig(code: string, config: FabricationRoomConfig): Promise<void> {
  await redis.set(configKey(code), JSON.stringify(config), 'EX', CONFIG_TTL_SECONDS);
}

export async function getFabricationRoomConfig(code: string): Promise<FabricationRoomConfig | null> {
  const raw = await redis.get(configKey(code));
  return raw ? (JSON.parse(raw) as FabricationRoomConfig) : null;
}

export async function clearFabricationRoomConfig(code: string): Promise<void> {
  await redis.del(configKey(code));
}

// The questions a room with this config can actually be dealt. A config that
// filters everything out falls back to the whole bank rather than starting a
// game with nothing to ask: the host picked a combination the bank cannot
// fill, and an empty round is a worse answer than an unfiltered one.
export function resolveFabricationPool(config: FabricationRoomConfig): FabricationQuestion[] {
  const bank = getFabricationBankSync();
  const matches = bank.filter(
    (q) =>
      (config.difficulty === 'any' || q.difficulty === config.difficulty) &&
      (config.categories.length === 0 || config.categories.includes(q.category))
  );
  return matches.length > 0 ? matches : bank;
}
