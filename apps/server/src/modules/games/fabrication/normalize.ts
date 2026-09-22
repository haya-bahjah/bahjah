// Answer normalization, used for the two places فبركة compares one piece of
// free text against another: catching a fabrication that is really the truth,
// and merging two players who wrote the same lie.
//
// It is deliberately forgiving in both directions of the language. Arabic
// needs the diacritics, tatweel and alef/yaa/taa-marbuta variants folded away
// or "الإسكندرية" and "الاسكندرية" read as different words; English needs case
// and articles folded or "Everest" and "the everest" do. What it must never do
// is decide a player's answer is *wrong* -- nothing here rejects text, it only
// decides whether two texts are the same text.
const ARABIC_DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۭ]/g;
const TATWEEL = /ـ/g;
const PUNCTUATION = /["'`´’‘“”.,!?;:()[\]{}<>؛،؟/\\_-]/g;
const LEADING_ARTICLE = /^(the|a|an|ال)\s+/;

export function normalizeAnswer(input: string): string {
  let text = (input ?? '').toString().trim().toLowerCase();
  if (!text) return '';

  text = text.normalize('NFKC');
  text = text.replace(ARABIC_DIACRITICS, '').replace(TATWEEL, '');
  // Alef forms, then the yaa/alef-maqsura and taa-marbuta/haa pairs people
  // type interchangeably on a phone keyboard.
  text = text
    .replace(/[آأإٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه');
  // Arabic-Indic digits to Latin, so "١٩٨٠" and "1980" are one answer.
  text = text.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
  text = text.replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));

  text = text.replace(PUNCTUATION, ' ');
  text = text.replace(/\s+/g, ' ').trim();
  text = text.replace(LEADING_ARTICLE, '');

  return text;
}
