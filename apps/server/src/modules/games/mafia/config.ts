import { redis } from '../../../db/redis';

export type MafiaTieRule = 'none' | 'revote' | 'random';

// A role the deal is rigged to hand one specific player. Purely a testing
// aid -- there is no way to see all four roles' screens otherwise, since
// the deal is random -- so the engine only honours it in a room that has
// practice bots in it (see assignRoles). It is never a way to pick your
// role in a game with real players.
export interface MafiaForcedRole {
  userId: string;
  role: 'mafia' | 'detective' | 'doctor' | 'villager';
}

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
  forcedRole?: MafiaForcedRole | null;
}

// Used when a host starts the game without ever visiting the config panel.
// Matches the flow doc's stated defaults (2 min day/night, 60s vote,
// random pick on a tie so an untouched game can't stall on repeated ties,
// role reveal on).
export function defaultMafiaConfig(): MafiaRoomConfig {
  return {
    daySeconds: 120,
    nightSeconds: 120,
    voteSeconds: 60,
    mafiaCountOverride: null,
    tieRule: 'random',
    revealEliminatedRole: true,
    includeDoctor: true,
    includeDetective: true,
    doctorCanProtectSelf: true,
    forcedRole: null,
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
