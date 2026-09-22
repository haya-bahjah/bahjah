// مزاد | Auction's categories.
//
// A category is only a prompt: this game has no answer database, because the
// winning bidder's list is ruled on by the host rather than by a dictionary.
// What matters instead is that every category here is one a room can name
// dozens of things in without argument, and that it is immediately
// understood -- the spec rules out anything specialist or ambiguous, since a
// player has to decide what they can bid within a second or two of reading it.
//
// Arabic and English are written independently rather than translated, and a
// few categories exist only because they are good in this region: "Arabic
// boys' names" and "Saudi cities" are deeper and more fun here than a
// translated "Boys' names" would be.
//
// minAnswers is the spec's "minimum recommended answer count" -- roughly how
// deep the category goes. It is the number the host's picker shows, and it is
// what keeps a category nobody could bid 30 on out of a room. These are
// conservative estimates of what a group could actually name, not counts of
// any list.
export interface AuctionSeedCategory {
  name: string;
  nameAr: string;
  minAnswers: number;
}

export const AUCTION_CATEGORIES: AuctionSeedCategory[] = [
  { name: 'Colours', nameAr: 'ألوان', minAnswers: 50 },
  { name: 'Countries', nameAr: 'دول', minAnswers: 190 },
  { name: 'Capital cities', nameAr: 'عواصم', minAnswers: 190 },
  { name: 'Animals', nameAr: 'حيوانات', minAnswers: 200 },
  { name: 'Birds', nameAr: 'طيور', minAnswers: 60 },
  { name: 'Fruits and vegetables', nameAr: 'فواكه وخضار', minAnswers: 80 },
  { name: 'Things in a kitchen', nameAr: 'أشياء في المطبخ', minAnswers: 70 },
  { name: 'Furniture', nameAr: 'أثاث', minAnswers: 50 },
  { name: 'Items of clothing', nameAr: 'قطع ملابس', minAnswers: 60 },
  { name: 'Cuisines of the world', nameAr: 'مطابخ العالم', minAnswers: 50 },
  { name: 'Sports', nameAr: 'رياضات', minAnswers: 70 },
  { name: 'Football clubs', nameAr: 'أندية كرة قدم', minAnswers: 100 },
  { name: 'Professions', nameAr: 'مهن', minAnswers: 120 },
  { name: 'School subjects', nameAr: 'مواد دراسية', minAnswers: 50 },
  { name: 'Things in a car', nameAr: 'أشياء في السيارة', minAnswers: 50 },
  { name: 'Car brands', nameAr: 'ماركات سيارات', minAnswers: 60 },
  { name: 'Things at the beach', nameAr: 'أشياء على الشاطئ', minAnswers: 50 },
  { name: 'Things in a hospital', nameAr: 'أشياء في المستشفى', minAnswers: 50 },
  { name: 'Musical instruments', nameAr: 'آلات موسيقية', minAnswers: 60 },
  { name: 'Board games and card games', nameAr: 'ألعاب لوحية وورقية', minAnswers: 50 },
  { name: 'Things that fly', nameAr: 'أشياء تطير', minAnswers: 50 },
  { name: 'Things that are cold', nameAr: 'أشياء باردة', minAnswers: 50 },
  { name: 'Sweets and desserts', nameAr: 'حلويات', minAnswers: 70 },
  { name: 'Drinks', nameAr: 'مشروبات', minAnswers: 60 },
  { name: 'Body parts', nameAr: 'أجزاء الجسم', minAnswers: 70 },
  { name: 'Languages', nameAr: 'لغات', minAnswers: 80 },
  { name: 'Arabic boys’ names', nameAr: 'أسماء أولاد عربية', minAnswers: 200 },
  { name: 'Arabic girls’ names', nameAr: 'أسماء بنات عربية', minAnswers: 200 },
  { name: 'Saudi cities and towns', nameAr: 'مدن وبلدات سعودية', minAnswers: 90 },
  { name: 'Arab cities', nameAr: 'مدن عربية', minAnswers: 150 },
  { name: 'Things in a phone', nameAr: 'أشياء في الجوال', minAnswers: 50 },
  { name: 'Cartoon characters', nameAr: 'شخصيات كرتونية', minAnswers: 120 },
];
