import { redis } from '../../../db/redis';
import { PACK_STATEMENTS, STATEMENT_CATEGORIES, type StatementCategory } from './statements';

// The host's session setup (wireframe 01), saved per room while it waits in
// the lobby and read once when the game starts.
export type StatementSource = 'packs' | 'mine' | 'both';

export interface CustomStatement {
  id: string;
  // The host's own statements are single-language, written as they want them
  // read.
  text: string;
}

export interface ForOrAgainstConfig {
  source: StatementSource;
  // Empty means every category.
  categories: StatementCategory[];
  custom: CustomStatement[];
  count: number;
  // Active seconds each team gets to argue.
  sideSeconds: number;
  // Whether a player may vote the other way in the final vote.
  allowSwitch: boolean;
}

export const MIN_COUNT = 1;
export const MAX_COUNT = 20;
export const DEFAULT_COUNT = 10;
export const MIN_SIDE_SECONDS = 30;
export const MAX_SIDE_SECONDS = 300;
export const SIDE_SECONDS_STEP = 30;
export const DEFAULT_SIDE_SECONDS = 150;
export const MAX_CUSTOM = 30;
export const MAX_STATEMENT_LENGTH = 140;

export function defaultConfig(): ForOrAgainstConfig {
  return { source: 'packs', categories: [], custom: [], count: DEFAULT_COUNT, sideSeconds: DEFAULT_SIDE_SECONDS, allowSwitch: true };
}

const TTL_SECONDS = 60 * 60 * 6;
const key = (code: string) => `bahjah:foa-config:${code}`;

export async function getConfig(code: string): Promise<ForOrAgainstConfig> {
  const raw = await redis.get(key(code));
  return raw ? { ...defaultConfig(), ...(JSON.parse(raw) as Partial<ForOrAgainstConfig>) } : defaultConfig();
}

export async function saveConfig(code: string, config: ForOrAgainstConfig): Promise<void> {
  await redis.set(key(code), JSON.stringify(config), 'EX', TTL_SECONDS);
}

export async function clearConfig(code: string): Promise<void> {
  await redis.del(key(code));
}

// One statement as the game carries it: both wordings for a pack statement,
// the host's own text in both slots for theirs.
export interface GameStatement {
  id: string;
  category: StatementCategory | 'mine';
  ar: string;
  en: string;
  mine?: boolean;
}

function shuffled<T>(list: T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// The statements a game will play, in order. The host's own come first --
// they wrote them for this evening -- then the packs, shuffled, from the
// picked categories. "Mine" with nothing written falls back to the packs
// rather than starting a game with nothing to say.
export function resolveStatements(config: ForOrAgainstConfig): GameStatement[] {
  const mine: GameStatement[] = config.custom.map((c) => ({ id: c.id, category: 'mine', ar: c.text, en: c.text, mine: true }));
  const cats = config.categories.length ? config.categories : STATEMENT_CATEGORIES;
  const packs: GameStatement[] = shuffled(PACK_STATEMENTS.filter((s) => cats.includes(s.category)));
  let list: GameStatement[];
  if (config.source === 'mine') list = mine.length ? mine : packs;
  else if (config.source === 'both') list = [...mine, ...packs];
  else list = packs;
  if (!list.length) list = shuffled(PACK_STATEMENTS);
  return list.slice(0, Math.max(MIN_COUNT, Math.min(MAX_COUNT, config.count)));
}
