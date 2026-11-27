import type { Question } from './model';

// How an answer scores. Only questions the host set up as scored count (see
// model.ts isScored); photos and unscored questions never do.
//
// Speed: on a timed question a right answer earns between half and all of
// its points, sliding with the time that was left when it came in. Untimed
// questions pay in full.
// Checklist: the ticked set must match the right set exactly.
// Match: points for each right pair, as a share of the pairs.
// Text: right if it equals an accepted answer once case, spacing,
// punctuation and Arabic letter forms are set aside.

export type AnswerValue =
  | { choice: number }
  | { choices: number[] }
  | { pairs: number[] }
  | { text: string }
  | { photoId: string };

export function normalizeText(s: string): string {
  return String(s ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function speedFactor(q: Question, remainingMs: number | null): number {
  if (!q.timerSec || remainingMs === null) return 1;
  const share = Math.max(0, Math.min(1, remainingMs / (q.timerSec * 1000)));
  return 0.5 + 0.5 * share;
}

// { correct, fraction } for an answer, before points and speed.
export function judge(q: Question, value: AnswerValue | null): { correct: boolean; fraction: number } {
  if (!value) return { correct: false, fraction: 0 };
  switch (q.format) {
    case 'mc': {
      const ok = 'choice' in value && value.choice === q.correct[0];
      return { correct: ok, fraction: ok ? 1 : 0 };
    }
    case 'checklist': {
      if (!('choices' in value)) return { correct: false, fraction: 0 };
      const want = new Set(q.correct);
      const got = new Set(value.choices);
      const ok = want.size === got.size && [...want].every((i) => got.has(i));
      return { correct: ok, fraction: ok ? 1 : 0 };
    }
    case 'match': {
      if (!('pairs' in value) || !q.pairs.length) return { correct: false, fraction: 0 };
      const right = q.pairs.filter((_, i) => value.pairs[i] === i).length;
      return { correct: right === q.pairs.length, fraction: right / q.pairs.length };
    }
    case 'text': {
      if (!('text' in value)) return { correct: false, fraction: 0 };
      const t = normalizeText(value.text);
      const ok = Boolean(t) && q.accepted.some((a) => normalizeText(a) === t);
      return { correct: ok, fraction: ok ? 1 : 0 };
    }
    default:
      return { correct: false, fraction: 0 };
  }
}

export function pointsFor(q: Question, value: AnswerValue | null, remainingMs: number | null, scored: boolean): { correct: boolean; points: number } {
  const { correct, fraction } = judge(q, value);
  if (!scored) return { correct, points: 0 };
  return { correct, points: Math.round(q.points * fraction * speedFactor(q, remainingMs)) };
}
