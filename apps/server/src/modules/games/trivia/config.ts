import { prisma } from '../../../db/prisma';
import { redis } from '../../../db/redis';
import { getBankCategoriesSync, getQuestionBankSync, type TriviaDifficulty, type TriviaQuestion } from './questionBank';

export interface TriviaRoomConfig {
  difficulty: TriviaDifficulty;
  categories: string[];
  customCategories: string[];
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
    difficulty: 'medium',
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
  return raw ? (JSON.parse(raw) as TriviaRoomConfig) : null;
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
    (q) => q.difficulty === config.difficulty && config.categories.includes(q.category)
  );
  const customRows =
    config.customCategories.length > 0
      ? await prisma.triviaCustomQuestion.findMany({ where: { roomCode: code, category: { in: config.customCategories } } })
      : [];
  const custom: TriviaQuestion[] = customRows.map((row) => ({
    id: row.id,
    category: row.category,
    difficulty: config.difficulty,
    prompt: row.prompt,
    choices: row.choices,
    correctIndex: row.correctIndex,
  }));
  return [...bankMatches, ...custom];
}
