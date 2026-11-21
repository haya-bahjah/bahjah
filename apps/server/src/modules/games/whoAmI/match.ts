// Judging a free-text guess against an identity's accepted names.
//
//   correct  -- the guess is one of the names, or one with a small slip
//               (a typo allowance that grows with the name's length).
//   review   -- plausibly right but not certain: a near miss just past the
//               typo allowance, or a guess that contains an accepted name
//               among other words ("I think it's Messi"). The host decides.
//   wrong    -- anything else.
//
// Both sides are normalised first, so case, spacing, punctuation, Latin
// accents, Arabic diacritics and tatweel, hamza and alef forms, taa marbuta,
// alef maqsura, Arabic-Indic digits and a leading "ال" or "the" never decide
// a guess on their own.

export type Verdict = 'correct' | 'review' | 'wrong';

const ARABIC_DIACRITICS = /[ً-ٰٟـ]/g;
const LATIN_MARKS = /[̀-ͯ]/g;

export function normalize(text: string): string {
  let s = String(text ?? '').normalize('NFKC').toLowerCase();
  s = s.normalize('NFD').replace(LATIN_MARKS, '').normalize('NFC');
  s = s.replace(ARABIC_DIACRITICS, '');
  s = s
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
  // Anything that is not a letter or a digit is a word break.
  s = s.replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
  return s;
}

// The same words without a leading definite article, so "المتنبي" matches
// "متنبي" and "the joker" matches "joker".
function stripArticles(s: string): string {
  return s
    .split(' ')
    .map((w) => (w.length > 3 && w.startsWith('ال') ? w.slice(2) : w))
    .filter((w) => w !== 'the')
    .join(' ');
}

function forms(s: string): string[] {
  const n = normalize(s);
  const bare = stripArticles(n);
  // Joined-up spellings are handled in closeness(), word counts intact.
  return [...new Set([n, bare])].filter(Boolean);
}

// Edit distance where two swapped neighbours ("Einstien") count as one slip
// (optimal string alignment).
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j += 1) d[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

// How many slips a name of this length forgives.
function allowance(length: number): number {
  if (length <= 4) return 0;
  if (length <= 8) return 1;
  if (length <= 12) return 2;
  return 3;
}

// How far a guess is from a name, word by word: each word may slip only as
// much as its own length allows, so one shared word ("Mohammed ...") cannot
// carry a different name. Joined-up spellings ("spiderman" / "spider man")
// are compared whole.
function closeness(x: string, y: string): 'exact' | 'typo' | 'near' | 'far' {
  if (x === y) return 'exact';
  const xw = x.split(' ');
  const yw = y.split(' ');
  if (xw.length === yw.length) {
    // The whole name has a slip budget for its length, and no single word
    // may use more than one step beyond its own allowance.
    let total = 0;
    let typo = true;
    let near = true;
    for (let i = 0; i < yw.length; i += 1) {
      const d = levenshtein(xw[i], yw[i]);
      const allow = allowance(yw[i].length);
      total += d;
      if (d > allow + (yw.length > 1 ? 1 : 0)) typo = false;
      if (d > allow + (yw.length > 1 ? 1 : yw[i].length >= 5 ? 2 : 1)) near = false;
    }
    const budget = allowance(y.length);
    if (typo && total <= budget) return 'typo';
    return near && total <= budget + 2 && y.length >= 4 ? 'near' : 'far';
  }
  const xs = x.replace(/ /g, '');
  const ys = y.replace(/ /g, '');
  if (xs === ys) return 'exact';
  if (xw.length > 1 && yw.length > 1) return 'far';
  // Spaces differ, so the words cannot be lined up: only an exact match
  // counts on its own, and a slip goes to the host.
  const d = levenshtein(xs, ys);
  return ys.length >= 4 && d <= allowance(ys.length) ? 'near' : 'far';
}

export function judge(guess: string, aliases: string[]): Verdict {
  const g = forms(guess);
  if (!g.length) return 'wrong';
  let review = false;
  for (const alias of aliases) {
    for (const y of forms(alias)) {
      for (const x of g) {
        const c = closeness(x, y);
        if (c === 'exact' || c === 'typo') return 'correct';
        if (c === 'near') review = true;
      }
    }
  }
  if (review) return 'review';
  // An accepted name sitting among other words.
  const words = new Set(g.flatMap((x) => x.split(' ')));
  for (const alias of aliases) {
    for (const y of forms(alias)) {
      if (y.length < 4) continue;
      if (y.includes(' ')) {
        if (g.some((x) => x.includes(y))) return 'review';
      } else if (words.has(y)) {
        return 'review';
      }
    }
  }
  return 'wrong';
}
