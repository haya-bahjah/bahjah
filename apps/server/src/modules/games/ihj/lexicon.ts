import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

// إنسان حيوان جماد's two automatic checks on an answer, run when the board is
// built:
//
//   - does it start with the round's letter? An answer that does not scores
//     nothing, and the player cannot mark it otherwise.
//   - is it made of real words? Checked against a list of ~630k Arabic words
//     (data/ihj-words-ar.txt.gz, see data/README.md). A word the list does not
//     know is suggested as a zero; the player can still mark it, because no
//     list has every name, plant and village in it.
//
// Both compare in one folded form, the same one the list is stored in: no
// diacritics or tatweel, أ/إ/آ/ٱ as ا, ى as ي, ة as ه.

// Harakat, Quranic marks and tatweel.
const DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;
const PUNCTUATION = /["'`´’‘“”.,!?;:()[\]{}<>؛،؟/\\_-]/g;

export function foldArabic(input: string): string {
  return (input ?? '')
    .toString()
    .normalize('NFKC')
    .replace(DIACRITICS, '')
    .replace(/[آأإٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(PUNCTUATION, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// The article is not the word: "السعودية" is a س country, and "الليمون" an ل
// fruit. Only stripped when something is left after it.
function withoutArticle(word: string): string {
  return word.startsWith('ال') && word.length > 3 ? word.slice(2) : word;
}

export function startsWithLetter(answer: string, letter: string): boolean {
  const target = foldArabic(letter).charAt(0);
  const first = foldArabic(answer).split(' ')[0] ?? '';
  if (!target || !first) return false;
  return withoutArticle(first).charAt(0) === target;
}

// The list, held as one sorted string with the start of each word in an
// index -- a third of the memory a Set of the same words would take.
let words: string | null = null;
let starts: Uint32Array | null = null;
let unavailable = false;

function load(): boolean {
  if (words) return true;
  if (unavailable) return false;
  try {
    // src/modules/games/ihj and dist/modules/games/ihj sit at the same depth.
    const file = path.resolve(__dirname, '../../../../data/ihj-words-ar.txt.gz');
    words = zlib.gunzipSync(fs.readFileSync(file)).toString('utf8');
    const offsets: number[] = [0];
    for (let i = 0; i < words.length; i += 1) if (words.charCodeAt(i) === 10) offsets.push(i + 1);
    starts = Uint32Array.from(offsets);
    return true;
  } catch (err) {
    // Without the list nothing is marked down for being unknown: a missing
    // file must not zero every answer in the room.
    unavailable = true;
    console.error('[ihj] word list unavailable; answers will not be checked against it', err);
    return false;
  }
}

// Called with the letter bank at startup, so the first board of the day
// does not pause a quarter of a second to read the list.
export function warmLexicon(): void {
  load();
}

function wordAt(i: number): string {
  const from = starts![i];
  const to = i + 1 < starts!.length ? starts![i + 1] - 1 : words!.length;
  return words!.slice(from, to);
}

function has(word: string): boolean {
  let lo = 0;
  let hi = starts!.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const at = wordAt(mid);
    if (at === word) return true;
    if (at < word) lo = mid + 1;
    else hi = mid - 1;
  }
  return false;
}

// Every word of the answer has to be a real one, so "سمك القرش" passes and
// "سمك قثصض" does not. Anything but Arabic letters (Latin, digits) is not
// something the list can vouch for.
export function isKnownAnswer(answer: string): boolean {
  if (!load()) return true;
  const parts = foldArabic(answer).split(' ').filter(Boolean);
  if (parts.length === 0 || parts.length > 5) return false;
  return parts.every((part) => /^[\u0621-\u063A\u0641-\u064A]+$/.test(part) && (has(part) || has(withoutArticle(part))));
}
