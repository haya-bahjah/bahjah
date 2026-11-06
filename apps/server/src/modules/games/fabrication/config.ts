import { redis } from '../../../db/redis';
import { getFabricationBankSync, type FabricationQuestion } from './questionBank';

export interface FabricationRoomConfig {
  rounds: number;
  // How long players have to write their lie: the host's pick in the lobby.
  // Optional because configs saved before it existed lack it (60s then).
  writeSeconds?: FabricationWriteSeconds;
  // The one language the whole game is played in: questions, the real
  // answer on the board, the reveal. The host picks it in the lobby (it
  // starts as the language their screen is in), and it is locked once the
  // game starts. Optional because configs saved before it existed lack it.
  language?: FabricationLanguage;
}

export type FabricationLanguage = 'en' | 'ar';

export const MIN_ROUNDS = 3;
export const MAX_ROUNDS = 8;
export const DEFAULT_ROUNDS = 6;

// The writing timer's choices, in seconds.
export const WRITE_SECONDS_CHOICES = [45, 60, 90] as const;
export type FabricationWriteSeconds = (typeof WRITE_SECONDS_CHOICES)[number];
export const DEFAULT_WRITE_SECONDS: FabricationWriteSeconds = 60;

export function writeSecondsOf(config: FabricationRoomConfig | null | undefined): FabricationWriteSeconds {
  const s = config?.writeSeconds;
  return s && (WRITE_SECONDS_CHOICES as readonly number[]).includes(s) ? s : DEFAULT_WRITE_SECONDS;
}

export function defaultFabricationConfig(): FabricationRoomConfig {
  return {
    rounds: DEFAULT_ROUNDS,
    writeSeconds: DEFAULT_WRITE_SECONDS,
    language: 'en',
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

// The questions a room can be dealt: the whole bank, at random. Categories
// and difficulty are gone from the game, so there is nothing to filter by.
export function resolveFabricationPool(_config: FabricationRoomConfig): FabricationQuestion[] {
  return getFabricationBankSync();
}

// No repeats within a room: every question a room has been dealt is kept
// here, and its next game (a Rematch) is dealt only from the rest. Once too
// few are left for a full game the list starts again, so a room can keep
// playing past the bank's end. Same lifetime as the config, and cleared with
// it when the room closes.
const usedKey = (code: string) => `bahjah:fabrication-used:${code}`;

export async function dealFabricationQuestions(code: string, rounds: number): Promise<FabricationQuestion[]> {
  const bank = getFabricationBankSync();
  const used = new Set(await redis.smembers(usedKey(code)));
  let fresh = bank.filter((q) => !used.has(q.id));
  if (fresh.length < Math.min(rounds, bank.length)) {
    await redis.del(usedKey(code));
    fresh = bank;
  }
  const dealt = shuffle(fresh).slice(0, Math.min(rounds, fresh.length));
  if (dealt.length > 0) {
    await redis.sadd(usedKey(code), ...dealt.map((q) => q.id));
    await redis.expire(usedKey(code), CONFIG_TTL_SECONDS);
  }
  return dealt;
}

export async function clearFabricationUsedQuestions(code: string): Promise<void> {
  await redis.del(usedKey(code));
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
