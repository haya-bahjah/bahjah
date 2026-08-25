import { redis } from '../../../db/redis';
import { getPromptBankSync, KYB_BUILTIN_CATEGORIES, type KnowsYouBestPrompt } from './promptBank';

export interface KnowsYouBestRoomConfig {
  totalRounds: number;
  // Which of KYB_BUILTIN_CATEGORIES to draw from -- at least one required.
  // The design's category screen picks exactly one difficulty per game, but
  // this stays an array so a room can still be seeded with more than one.
  categories: string[];
}

// Used when a host starts the game without ever visiting the config panel.
export function defaultKnowsYouBestConfig(): KnowsYouBestRoomConfig {
  return { totalRounds: 3, categories: [...KYB_BUILTIN_CATEGORIES] };
}

// Same TTL ballpark as trivia's config -- set up during an actively-configured
// lobby, not meant to outlive it by much.
const CONFIG_TTL_SECONDS = 60 * 60 * 6;
const configKey = (code: string) => `bahjah:kyb-config:${code}`;

export async function saveKnowsYouBestRoomConfig(code: string, config: KnowsYouBestRoomConfig): Promise<void> {
  await redis.set(configKey(code), JSON.stringify(config), 'EX', CONFIG_TTL_SECONDS);
}

export async function getKnowsYouBestRoomConfig(code: string): Promise<KnowsYouBestRoomConfig | null> {
  const raw = await redis.get(configKey(code));
  return raw ? (JSON.parse(raw) as KnowsYouBestRoomConfig) : null;
}

export async function clearKnowsYouBestRoomConfig(code: string): Promise<void> {
  await redis.del(configKey(code));
}

// The host runs the room and never plays, so the pool is only ever the built-in
// bank filtered to the chosen difficulty. Rooms used to be able to mix in
// host-authored prompts; that is gone along with the rest of the custom-question
// feature, so there is nothing to merge here any more.
export async function resolveKnowsYouBestPool(
  _code: string,
  config: KnowsYouBestRoomConfig
): Promise<KnowsYouBestPrompt[]> {
  return getPromptBankSync().filter((p) => config.categories.includes(p.category));
}
