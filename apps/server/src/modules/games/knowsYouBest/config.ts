import { prisma } from '../../../db/prisma';
import { redis } from '../../../db/redis';
import { getPromptBankSync, KYB_BUILTIN_CATEGORIES, type KnowsYouBestPrompt } from './promptBank';

export interface KnowsYouBestRoomConfig {
  totalRounds: number;
  // Whether the host is a real player (answers/matches/scores like anyone
  // else) or a spectator-only monitor -- unlike trivia/mafia this is a
  // per-room choice, not a fixed-per-game-type constant. Defaults to false
  // ("does not participate unless they choose to join").
  hostPlays: boolean;
  // Which of KYB_BUILTIN_CATEGORIES to draw from -- at least one required.
  categories: string[];
  useCustomQuestions: boolean;
}

// Used when a host starts the game without ever visiting the config panel.
export function defaultKnowsYouBestConfig(): KnowsYouBestRoomConfig {
  return { totalRounds: 5, hostPlays: false, categories: [...KYB_BUILTIN_CATEGORIES], useCustomQuestions: false };
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

// Cheap fallback getter for rooms/service.ts's startRoom() player-count
// check, which runs before the game engine (and its loadConfig hook) ever
// gets involved -- see engine.ts's loadConfig for the same default.
export async function getHostPlaysForRoom(code: string): Promise<boolean> {
  const config = await getKnowsYouBestRoomConfig(code);
  return config?.hostPlays ?? defaultKnowsYouBestConfig().hostPlays;
}

export async function clearKnowsYouBestRoomConfig(code: string): Promise<void> {
  await redis.del(configKey(code));
  await prisma.knowsYouBestCustomPrompt.deleteMany({ where: { roomCode: code } });
}

export interface KnowsYouBestCustomPromptInput {
  text: string;
  textAr?: string | null;
}

export async function replaceCustomPrompts(code: string, prompts: KnowsYouBestCustomPromptInput[]): Promise<void> {
  await prisma.$transaction([
    prisma.knowsYouBestCustomPrompt.deleteMany({ where: { roomCode: code } }),
    ...(prompts.length > 0
      ? [
          prisma.knowsYouBestCustomPrompt.createMany({
            data: prompts.map((p) => ({ roomCode: code, text: p.text, textAr: p.textAr ?? null })),
          }),
        ]
      : []),
  ]);
}

export async function resolveKnowsYouBestPool(code: string, config: KnowsYouBestRoomConfig): Promise<KnowsYouBestPrompt[]> {
  const bank = getPromptBankSync().filter((p) => config.categories.includes(p.category));
  if (!config.useCustomQuestions) return bank;
  const customRows = await prisma.knowsYouBestCustomPrompt.findMany({ where: { roomCode: code } });
  const custom: KnowsYouBestPrompt[] = customRows.map((row) => ({
    id: row.id,
    category: 'Custom',
    text: row.text,
    textAr: row.textAr ?? undefined,
  }));
  return [...bank, ...custom];
}
