import { redis } from '../../../db/redis';

export type MafiaTieRule = 'none' | 'revote' | 'random';

export interface MafiaRoomConfig {
  daySeconds: number;
  nightSeconds: number;
  voteSeconds: number;
  mafiaCountOverride: number | null;
  tieRule: MafiaTieRule;
  revealEliminatedRole: boolean;
  includeDoctor: boolean;
  includeDetective: boolean;
  doctorCanProtectSelf: boolean;
}

// Used when a host starts the game without ever visiting the config panel.
// Matches the flow doc's stated defaults (2 min day/night, 60s vote,
// no-elimination on a tie, role reveal on).
export function defaultMafiaConfig(): MafiaRoomConfig {
  return {
    daySeconds: 120,
    nightSeconds: 120,
    voteSeconds: 60,
    mafiaCountOverride: null,
    tieRule: 'none',
    revealEliminatedRole: true,
    includeDoctor: true,
    includeDetective: true,
    doctorCanProtectSelf: true,
  };
}

// Config lives alongside the room, not the in-progress game state -- same 6h
// ballpark as trivia/knows-you-best's room config.
const CONFIG_TTL_SECONDS = 60 * 60 * 6;
const configKey = (code: string) => `bahjah:mafia-config:${code}`;

export async function saveMafiaRoomConfig(code: string, config: MafiaRoomConfig): Promise<void> {
  await redis.set(configKey(code), JSON.stringify(config), 'EX', CONFIG_TTL_SECONDS);
}

export async function getMafiaRoomConfig(code: string): Promise<MafiaRoomConfig | null> {
  const raw = await redis.get(configKey(code));
  return raw ? (JSON.parse(raw) as MafiaRoomConfig) : null;
}

export async function clearMafiaRoomConfig(code: string): Promise<void> {
  await redis.del(configKey(code));
}
