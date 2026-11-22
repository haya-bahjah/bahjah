import { redis } from '../../../db/redis';
import { forPlay, type Question } from './model';

// A room launched from a saved مجلسك game carries a snapshot of that game,
// taken at launch: edits made afterwards apply to the next session and can
// never disturb one already running.

export interface SessionConfig {
  gameId: string;
  title: string;
  honoree: string;
  occasion: string;
  language: 'ar' | 'en' | 'both';
  themeId: string;
  themeImageId: string | null;
  questions: Question[];
  // The host answers like a guest, but is left off the leaderboard.
  hostPlays: boolean;
}

const TTL_SECONDS = 60 * 60 * 12;
const key = (code: string) => `bahjah:maj-room:${code}`;

export async function saveSession(code: string, config: SessionConfig): Promise<void> {
  await redis.set(key(code), JSON.stringify({ ...config, questions: config.questions.map(forPlay) }), 'EX', TTL_SECONDS);
}

export async function getSession(code: string): Promise<SessionConfig | null> {
  const raw = await redis.get(key(code));
  return raw ? (JSON.parse(raw) as SessionConfig) : null;
}

export async function clearSession(code: string): Promise<void> {
  await redis.del(key(code));
}
