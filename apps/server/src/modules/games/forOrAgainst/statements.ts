// مع أو ضد -- the built-in statement packs ("ready packs" in the setup).
//
// A starter bank, written for the launch: light, arguable, and safe for a
// family gathering -- nothing political or religious, nothing that puts a
// person in the room on the spot. Every statement has an Arabic and an
// English wording so a room plays in whichever language its screens show.
//
// To add or reword one, edit this list; ids are stable keys, so keep them.

export type StatementCategory = 'everyday' | 'food' | 'tech' | 'sport';

export interface PackStatement {
  id: string;
  category: StatementCategory;
  ar: string;
  en: string;
}

export const STATEMENT_CATEGORIES: StatementCategory[] = ['everyday', 'food', 'tech', 'sport'];

export const PACK_STATEMENTS: PackStatement[] = [
  // --- Everyday life ---
  { id: 'ev-01', category: 'everyday', ar: 'العمل من البيت أفضل من المكتب.', en: 'Working from home beats the office.' },
  { id: 'ev-02', category: 'everyday', ar: 'الصيف أجمل من الشتاء.', en: 'Summer is better than winter.' },
  { id: 'ev-03', category: 'everyday', ar: 'السهر أحلى من الصحيان بدري.', en: 'Staying up late beats waking up early.' },
  { id: 'ev-04', category: 'everyday', ar: 'الرسائل الصوتية أفضل من الكتابة.', en: 'Voice notes are better than texting.' },
  { id: 'ev-05', category: 'everyday', ar: 'السفر بالسيارة أمتع من الطيارة.', en: 'Road trips are more fun than flying.' },
  { id: 'ev-06', category: 'everyday', ar: 'لازم الكل يرد على الرسائل خلال ساعة.', en: 'Everyone should reply to messages within an hour.' },
  { id: 'ev-07', category: 'everyday', ar: 'الجلسة في البيت أحسن من الطلعة.', en: 'A night in beats a night out.' },
  { id: 'ev-08', category: 'everyday', ar: 'الهدية المفاجأة أحسن من الهدية اللي تختارها بنفسك.', en: 'A surprise gift is better than one you pick yourself.' },
  { id: 'ev-09', category: 'everyday', ar: 'المدينة أحلى من البر.', en: 'The city is better than the desert.' },
  { id: 'ev-10', category: 'everyday', ar: 'التخطيط للإجازة أمتع من الإجازة نفسها.', en: 'Planning a holiday is more fun than the holiday itself.' },
  // --- Food ---
  { id: 'fd-01', category: 'food', ar: 'القهوة أفضل من الشاي في الصباح.', en: 'Coffee beats tea in the morning.' },
  { id: 'fd-02', category: 'food', ar: 'الكبسة أفضل من المندي.', en: 'Kabsa is better than mandi.' },
  { id: 'fd-03', category: 'food', ar: 'الأكل في البيت أطيب من المطاعم.', en: 'Home cooking beats eating out.' },
  { id: 'fd-04', category: 'food', ar: 'الحلا قبل الأكل مو غلط.', en: 'Dessert before dinner is perfectly fine.' },
  { id: 'fd-05', category: 'food', ar: 'البيتزا أحسن من البرجر.', en: 'Pizza is better than burgers.' },
  { id: 'fd-06', category: 'food', ar: 'الفطور أهم وجبة في اليوم.', en: 'Breakfast is the most important meal of the day.' },
  { id: 'fd-07', category: 'food', ar: 'الأكل الحار أطيب من العادي.', en: 'Spicy food tastes better than mild.' },
  { id: 'fd-08', category: 'food', ar: 'التمر أطيب حلا في العالم.', en: 'Dates are the best sweet in the world.' },
  { id: 'fd-09', category: 'food', ar: 'طلب الأكل أونلاين أفضل من الذهاب للمطعم.', en: 'Ordering in beats going to a restaurant.' },
  { id: 'fd-10', category: 'food', ar: 'الشاورما وجبة كاملة.', en: 'Shawarma is a complete meal.' },
  // --- Tech ---
  { id: 'tc-01', category: 'tech', ar: 'الجوال الكبير أحسن من الصغير.', en: 'A big phone is better than a small one.' },
  { id: 'tc-02', category: 'tech', ar: 'الكتاب الورقي أحسن من الإلكتروني.', en: 'Paper books beat e-books.' },
  { id: 'tc-03', category: 'tech', ar: 'الذكاء الاصطناعي بيسهّل حياتنا أكثر ما يعقّدها.', en: 'AI will make our lives easier, not harder.' },
  { id: 'tc-04', category: 'tech', ar: 'الأطفال ما يحتاجون جوال قبل ١٢ سنة.', en: 'Kids do not need a phone before age twelve.' },
  { id: 'tc-05', category: 'tech', ar: 'الوضع الليلي أحسن من الوضع النهاري.', en: 'Dark mode beats light mode.' },
  { id: 'tc-06', category: 'tech', ar: 'الألعاب الإلكترونية رياضة حقيقية.', en: 'Esports are real sports.' },
  { id: 'tc-07', category: 'tech', ar: 'السماعات اللاسلكية أفضل من السلكية.', en: 'Wireless earbuds beat wired ones.' },
  { id: 'tc-08', category: 'tech', ar: 'وسائل التواصل خلتنا أقرب لبعض.', en: 'Social media has brought us closer together.' },
  { id: 'tc-09', category: 'tech', ar: 'السيارة الكهربائية أفضل من البنزين.', en: 'Electric cars are better than petrol cars.' },
  { id: 'tc-10', category: 'tech', ar: 'مكالمة الفيديو أحسن من المكالمة العادية.', en: 'A video call beats a voice call.' },
  // --- Sport ---
  { id: 'sp-01', category: 'sport', ar: 'كرة القدم أمتع رياضة للمشاهدة.', en: 'Football is the most fun sport to watch.' },
  { id: 'sp-02', category: 'sport', ar: 'المشي أفضل من الجري.', en: 'Walking is better than running.' },
  { id: 'sp-03', category: 'sport', ar: 'التمرين الصباحي أفضل من المسائي.', en: 'Morning workouts beat evening workouts.' },
  { id: 'sp-04', category: 'sport', ar: 'مشاهدة المباراة في الملعب أمتع من التلفزيون.', en: 'Watching a match in the stadium beats watching on TV.' },
  { id: 'sp-05', category: 'sport', ar: 'الرياضة الجماعية أمتع من الفردية.', en: 'Team sports are more fun than solo sports.' },
  { id: 'sp-06', category: 'sport', ar: 'ركلات الترجيح طريقة عادلة لحسم المباراة.', en: 'Penalty shootouts are a fair way to settle a match.' },
  { id: 'sp-07', category: 'sport', ar: 'النادي الرياضي أفضل من التمرين في البيت.', en: 'The gym beats working out at home.' },
  { id: 'sp-08', category: 'sport', ar: 'الحكم بالفيديو (VAR) أفاد كرة القدم.', en: 'VAR has made football better.' },
  { id: 'sp-09', category: 'sport', ar: 'السباحة أفضل رياضة على الإطلاق.', en: 'Swimming is the best sport there is.' },
  { id: 'sp-10', category: 'sport', ar: 'المشجع الحقيقي ما يغيّر فريقه أبداً.', en: 'A true fan never changes teams.' },
];
