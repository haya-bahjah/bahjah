// إنسان حيوان جماد's letter pool and categories.
//
// §5 rules out blindly randomising all twenty-eight letters, because some of
// them make a round nobody can finish. The test applied here is simple and
// strict: a letter is in the pool only if every one of the five default
// categories can be answered with it by an ordinary player. That is what
// keeps the following letters out, and each is out for a concrete reason
// rather than because it felt hard:
//
//   ث  no country begins with it
//   ح  no country begins with it
//   خ  no country begins with it
//   ض  no plant and no country
//   ظ  no animal, no plant, no country
//   و  no country
//   ء  not a word-initial letter at all
//
// `weight` then shapes how often the rest come up: a letter a room can answer
// five times over comes up three times as often as one that will make them
// groan. It is not difficulty -- difficulty is recorded separately, for the
// host's picker and for anyone tuning the pool later.
export interface IhjSeedLetter {
  letter: string;
  difficulty: 'easy' | 'medium' | 'hard';
  weight: number;
}

export const IHJ_LETTERS: IhjSeedLetter[] = [
  // Easy: every category answers itself. أحمد، أرنب، إبريق، أناناس، ألمانيا.
  { letter: 'ا', difficulty: 'easy', weight: 3 },
  { letter: 'ب', difficulty: 'easy', weight: 3 },
  { letter: 'ج', difficulty: 'easy', weight: 3 },
  { letter: 'س', difficulty: 'easy', weight: 3 },
  { letter: 'ع', difficulty: 'easy', weight: 3 },
  { letter: 'م', difficulty: 'easy', weight: 3 },
  // Medium: every category has an answer, but at least one of them takes a
  // second's thought.
  { letter: 'ت', difficulty: 'medium', weight: 2 },
  { letter: 'د', difficulty: 'medium', weight: 2 },
  { letter: 'ر', difficulty: 'medium', weight: 2 },
  { letter: 'ز', difficulty: 'medium', weight: 2 },
  { letter: 'ش', difficulty: 'medium', weight: 2 },
  { letter: 'ص', difficulty: 'medium', weight: 2 },
  { letter: 'ط', difficulty: 'medium', weight: 2 },
  { letter: 'ف', difficulty: 'medium', weight: 2 },
  { letter: 'ق', difficulty: 'medium', weight: 2 },
  { letter: 'ك', difficulty: 'medium', weight: 2 },
  { letter: 'ل', difficulty: 'medium', weight: 2 },
  { letter: 'ن', difficulty: 'medium', weight: 2 },
  // Hard: answerable throughout, but thin enough that a room will feel it.
  // غار and غانا are what keep غ in; هيل and هولندا keep ه in; اليمن keeps ي.
  { letter: 'غ', difficulty: 'hard', weight: 1 },
  { letter: 'ه', difficulty: 'hard', weight: 1 },
  { letter: 'ي', difficulty: 'hard', weight: 1 },
];

// The five the spec names are the defaults. The rest exist so a host can swap
// one out for variety -- there is no proposal flow, and the board is always
// five columns wide.
export interface IhjSeedCategory {
  name: string;
  isDefault: boolean;
}

export const IHJ_CATEGORIES: IhjSeedCategory[] = [
  { name: 'إنسان', isDefault: true },
  { name: 'حيوان', isDefault: true },
  { name: 'جماد', isDefault: true },
  { name: 'نبات', isDefault: true },
  { name: 'بلاد', isDefault: true },
  { name: 'مهنة', isDefault: false },
  { name: 'أكلة', isDefault: false },
  { name: 'ماركة', isDefault: false },
  { name: 'لون', isDefault: false },
  { name: 'مدينة', isDefault: false },
  { name: 'فاكهة', isDefault: false },
  { name: 'رياضة', isDefault: false },
  { name: 'فيلم أو مسلسل', isDefault: false },
  { name: 'شيء في البيت', isDefault: false },
  { name: 'اسم مشهور', isDefault: false },
];
