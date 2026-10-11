import { prisma } from '../../../db/prisma';
import { redis } from '../../../db/redis';
import { getEventById } from '../../events/registry';
import { getPromptBankSync, KYB_BUILTIN_CATEGORIES, type KnowsYouBestPrompt } from './promptBank';

export interface KnowsYouBestRoomConfig {
  totalRounds: number;
  // Which of KYB_BUILTIN_CATEGORIES to draw from -- at least one required.
  // The category screen picks exactly one per game, but this stays an array so
  // a room can still be seeded with more than one.
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

// A config saved before the categories were renamed still names them the old
// way. Configs outlive the deploy that renames them -- they sit in Redis for
// six hours -- so without this a room set up minutes earlier would filter the
// bank down to nothing and draw no questions at all.
const LEGACY_CATEGORY_NAMES: Record<string, string> = {
  Easy: 'Break the Ice',
  Moderate: 'Imagine If',
  Hard: 'For Close Ones Only',
  'Close Friends Only': 'For Close Ones Only',
};

export function canonicalCategory(name: string): string {
  return LEGACY_CATEGORY_NAMES[name] ?? name;
}

// The host runs the room and never plays, so the pool is only ever the built-in
// bank filtered to the chosen category. Rooms used to be able to mix in
// host-authored prompts; that is gone along with the rest of the custom-question
// feature, so there is nothing to merge here any more.
export async function resolveKnowsYouBestPool(
  _code: string,
  config: KnowsYouBestRoomConfig
): Promise<KnowsYouBestPrompt[]> {
  const wanted = new Set(config.categories.map(canonicalCategory));
  return getPromptBankSync().filter((p) => wanted.has(canonicalCategory(p.category)));
}

// A room opened from a private event link plays the event's questions and
// nothing else, in the order the event lists them, one per round. Null for an
// ordinary room, which draws from the bank as above.
export async function resolveEventPrompts(code: string): Promise<KnowsYouBestPrompt[] | null> {
  const room = await prisma.room.findUnique({ where: { code }, select: { eventId: true } });
  const event = getEventById(room?.eventId);
  if (!event || event.gameType !== 'knows-you-best') return null;
  // The category is only ever shown as a label beside the round, so it carries
  // the event's name in the language the event is played in.
  const category = event.title[event.lang];
  return event.prompts.map((text, i) => ({ id: `${event.id}-${i + 1}`, category, text, textAr: text }));
}
