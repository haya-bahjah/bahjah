import { z } from 'zod';

// مجلسك (Your Gatherings) -- what a host's saved game is made of, and the
// rules a game must meet before it can be published.

export const THEMES = ['graduation', 'bridal', 'birthday', 'eid', 'mothers'] as const;
export type ThemeId = (typeof THEMES)[number] | 'custom';
export const OCCASIONS = ['graduation', 'bridal', 'farewell', 'baby', 'custom'] as const;
export const FORMATS = ['mc', 'text', 'checklist', 'match', 'photo'] as const;
export type Format = (typeof FORMATS)[number];

const plain = (max: number, min = 1) =>
  z
    .string()
    .trim()
    .min(min)
    .max(max)
    .refine((s) => !/[<>]/.test(s) && !/[\u0000-\u001F\u007F]/.test(s), { message: 'Plain text only.' });

// One question, as saved. Every field a format does not use is ignored.
export const questionSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{4,40}$/),
  format: z.enum(FORMATS),
  prompt: plain(200, 0),
  // mc / checklist
  options: z.array(plain(60, 0)).max(6).default([]),
  // mc: the one right option; checklist: every option that should be ticked.
  correct: z.array(z.number().int().min(0).max(5)).max(6).default([]),
  // match
  pairs: z.array(z.object({ left: plain(40, 0), right: plain(40, 0) })).max(5).default([]),
  // text: answers that count, when the question is scored.
  accepted: z.array(plain(60, 0)).max(6).default([]),
  maxLength: z.number().int().min(20).max(280).default(120),
  scored: z.boolean().default(false),
  points: z.number().int().min(10).max(1000).default(100),
  // Seconds, or null for no timer.
  timerSec: z.number().int().min(5).max(120).nullable().default(null),
});
export type Question = z.infer<typeof questionSchema>;

export const detailsSchema = z.object({
  title: plain(60, 0).optional(),
  occasion: z.enum(OCCASIONS).optional(),
  honoree: plain(40, 0).optional(),
  description: plain(200, 0).optional(),
  language: z.enum(['ar', 'en', 'both']).optional(),
  themeId: z.enum([...THEMES, 'custom'] as [string, ...string[]]).optional(),
  themeImageId: z.string().uuid().nullable().optional(),
  questions: z.array(questionSchema).max(30).optional(),
});

export const MAX_QUESTIONS = 30;

// Whether a question can count towards the leaderboard, given how it is set up.
export function isScored(q: Question): boolean {
  if (!q.scored) return false;
  if (q.format === 'photo') return false;
  if (q.format === 'text') return q.accepted.some((a) => a.trim());
  if (q.format === 'mc') return q.correct.length === 1 && q.correct[0] < q.options.length;
  if (q.format === 'checklist') return q.correct.length > 0 && q.correct.every((i) => i < q.options.length);
  if (q.format === 'match') return true;
  return false;
}

// What stops a game from being published, as a list of { index, problem }.
// An empty list means it is ready.
export function problems(game: { title: string; honoree: string; questions: Question[] }): Array<{ index: number | null; code: string }> {
  const out: Array<{ index: number | null; code: string }> = [];
  if (!game.title.trim()) out.push({ index: null, code: 'NO_TITLE' });
  if (!game.honoree.trim()) out.push({ index: null, code: 'NO_HONOREE' });
  if (!game.questions.length) out.push({ index: null, code: 'NO_QUESTIONS' });
  game.questions.forEach((q, index) => {
    if (!q.prompt.trim()) out.push({ index, code: 'NO_PROMPT' });
    const opts = q.options.filter((o) => o.trim());
    if (q.format === 'mc' && opts.length < 2) out.push({ index, code: 'NEED_TWO_OPTIONS' });
    if (q.format === 'checklist' && opts.length < 1) out.push({ index, code: 'NEED_ONE_OPTION' });
    if (q.format === 'match') {
      const pairs = q.pairs.filter((p) => p.left.trim() && p.right.trim());
      if (pairs.length < 2) out.push({ index, code: 'NEED_TWO_PAIRS' });
      const lefts = new Set(pairs.map((p) => p.left.trim().toLowerCase()));
      const rights = new Set(pairs.map((p) => p.right.trim().toLowerCase()));
      if (lefts.size !== pairs.length || rights.size !== pairs.length) out.push({ index, code: 'PAIRS_NOT_UNIQUE' });
    }
    if (q.scored && q.format === 'mc' && q.correct.length !== 1) out.push({ index, code: 'MARK_CORRECT' });
    if (q.scored && q.format === 'checklist' && !q.correct.length) out.push({ index, code: 'MARK_CORRECT' });
    if (q.scored && q.format === 'text' && !q.accepted.some((a) => a.trim())) out.push({ index, code: 'ADD_ACCEPTED' });
  });
  return out;
}

// A question cleaned for play: empty options and pairs dropped, and the
// correct-answer indices remapped to match.
export function forPlay(q: Question): Question {
  if (q.format === 'mc' || q.format === 'checklist') {
    const keep = q.options.map((o, i) => ({ o: o.trim(), i })).filter((x) => x.o);
    const remap = new Map(keep.map((x, j) => [x.i, j]));
    return { ...q, options: keep.map((x) => x.o), correct: q.correct.filter((i) => remap.has(i)).map((i) => remap.get(i)!) };
  }
  if (q.format === 'match') return { ...q, pairs: q.pairs.filter((p) => p.left.trim() && p.right.trim()).map((p) => ({ left: p.left.trim(), right: p.right.trim() })) };
  return q;
}
