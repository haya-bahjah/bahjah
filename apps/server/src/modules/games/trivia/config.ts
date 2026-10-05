import { prisma } from '../../../db/prisma';
import { redis } from '../../../db/redis';
import {
  getBankCategoriesSync,
  getQuestionBankSync,
  TRIVIA_DIFFICULTIES,
  type TriviaDifficulty,
  type TriviaQuestion,
} from './questionBank';

export interface TriviaRoomConfig {
  // One or more of easy/medium/hard, always in that canonical order. A game
  // is still 10 questions whatever the mix -- see pickQuestions in engine.ts
  // for how they're shared out across the picked difficulties.
  difficulties: TriviaDifficulty[];
  categories: string[];
  customCategories: string[];
}

// Dedupes and orders a host's difficulty pick; an empty or unrecognised
// pick falls back to medium so a config can never resolve to no bank
// questions at all by way of its difficulty.
export function normalizeDifficulties(input: readonly string[] | undefined): TriviaDifficulty[] {
  const picked = TRIVIA_DIFFICULTIES.filter((d) => input?.includes(d));
  return picked.length > 0 ? picked : ['medium'];
}

// Configs saved before multi-difficulty carried a single `difficulty`
// string -- a lobby open across the deploy still has one of those in Redis.
function normalizeStoredConfig(raw: unknown): TriviaRoomConfig {
  const obj = (raw ?? {}) as Partial<TriviaRoomConfig> & { difficulty?: string };
  return {
    difficulties: normalizeDifficulties(obj.difficulties ?? (obj.difficulty ? [obj.difficulty] : undefined)),
    categories: Array.isArray(obj.categories) ? obj.categories : [],
    customCategories: Array.isArray(obj.customCategories) ? obj.customCategories : [],
  };
}

// Used when a host starts the game without ever visiting the config panel
// (e.g. an old client, or a very fast double-click on "Start") -- medium
// difficulty across every built-in category, so the game is never blocked
// on a config step that's otherwise optional.
// Saudi National Day is a seasonal category: picking it re-themes the whole
// game, so it has to be opted into rather than swept in by a default that
// means "everything". Excluded here and from the client's equivalent
// fallback in assets/trivia-lobby-config.js.
const SEASONAL_CATEGORIES = new Set(['saudi national day']);

export function isSeasonalCategory(name: string): boolean {
  return SEASONAL_CATEGORIES.has(name.trim().toLowerCase());
}

export function defaultTriviaConfig(): TriviaRoomConfig {
  return {
    difficulties: ['medium'],
    categories: getBankCategoriesSync()
      .map((c) => c.name)
      .filter((name) => !isSeasonalCategory(name)),
    customCategories: [],
  };
}

// Config lives alongside the room, not the in-progress game state -- it's
// set up before the game even starts and should survive independently of
// game-state TTLs/clearing. Same 6h ballpark as a lobby that's likely to be
// actively configured, not left open indefinitely.
const CONFIG_TTL_SECONDS = 60 * 60 * 6;
const configKey = (code: string) => `bahjah:trivia-config:${code}`;

export async function saveTriviaRoomConfig(code: string, config: TriviaRoomConfig): Promise<void> {
  await redis.set(configKey(code), JSON.stringify(config), 'EX', CONFIG_TTL_SECONDS);
}

export async function getTriviaRoomConfig(code: string): Promise<TriviaRoomConfig | null> {
  const raw = await redis.get(configKey(code));
  return raw ? normalizeStoredConfig(JSON.parse(raw)) : null;
}

export async function clearTriviaRoomConfig(code: string): Promise<void> {
  await redis.del(configKey(code));
  await prisma.triviaCustomQuestion.deleteMany({ where: { roomCode: code } });
}

export interface TriviaCustomCategoryInput {
  name: string;
  questions: Array<{ prompt: string; choices: [string, string, string, string]; correctIndex: number }>;
}

export async function replaceCustomQuestions(code: string, customCategories: TriviaCustomCategoryInput[]): Promise<void> {
  await prisma.$transaction([
    prisma.triviaCustomQuestion.deleteMany({ where: { roomCode: code } }),
    ...(customCategories.length > 0
      ? [
          prisma.triviaCustomQuestion.createMany({
            data: customCategories.flatMap((cat) =>
              cat.questions.map((q) => ({
                roomCode: code,
                category: cat.name,
                prompt: q.prompt,
                choices: q.choices,
                correctIndex: q.correctIndex,
              }))
            ),
          }),
        ]
      : []),
  ]);
}

export async function resolveTriviaPool(code: string, config: TriviaRoomConfig): Promise<TriviaQuestion[]> {
  const bankMatches = getQuestionBankSync().filter(
    (q) => config.difficulties.includes(q.difficulty) && config.categories.includes(q.category)
  );
  const customRows =
    config.customCategories.length > 0
      ? await prisma.triviaCustomQuestion.findMany({ where: { roomCode: code, category: { in: config.customCategories } } })
      : [];
  const custom: TriviaQuestion[] = customRows.map((row) => ({
    id: row.id,
    category: row.category,
    prompt: row.prompt,
    choices: row.choices,
    correctIndex: row.correctIndex,
  }));
  return [...bankMatches, ...custom];
}

// Per-host memory of which questions they've recently put in front of a
// room, so hosting again -- a replay in the same room or a brand-new room --
// draws fresh questions first instead of whatever the shuffle happens to
// land on again. Keyed by host rather than room because a host running a
// party night usually opens a new room per game.
const RECENT_TTL_SECONDS = 60 * 60 * 24 * 30;
const RECENT_MAX = 500;
const recentKey = (hostId: string) => `bahjah:trivia-recent:${hostId}`;

export async function getRecentQuestionIds(hostId: string): Promise<string[]> {
  return redis.lrange(recentKey(hostId), 0, RECENT_MAX - 1);
}

export async function recordRecentQuestionIds(hostId: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const key = recentKey(hostId);
  await redis
    .multi()
    .lpush(key, ...ids)
    .ltrim(key, 0, RECENT_MAX - 1)
    .expire(key, RECENT_TTL_SECONDS)
    .exec();
}
