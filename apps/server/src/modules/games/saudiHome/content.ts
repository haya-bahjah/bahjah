// Welcome to a Saudi Home: the rooms, the challenges and the scoring.
//
// This file is the content system for the first event. Everything a content
// editor would change lives here as data -- questions, options, answers,
// explanations, timers, points, which challenges are switched on -- and the
// engine reads it without anything about a particular room hard-coded.
//
// CONTENT STATUS: PENDING CULTURAL REVIEW. Every challenge below was drafted
// for the first build and carries `reviewed: false` until the content team
// has checked it. Arabic text is stored alongside the English for every
// string so the game can be switched to Arabic or bilingual later; the event
// version shows English only.

export interface Loc {
  en: string;
  ar: string;
}

export type RoomId =
  | 'majlis'
  | 'kitchen'
  | 'library'
  | 'office'
  | 'garage'
  | 'closet'
  | 'living-room'
  | 'courtyard';

// The Final Challenge asks one question from each of these, in this order.
export type FinalCategory = 'hospitality' | 'food' | 'heritage' | 'modern' | 'social-regions';

export type ChallengeType = 'single' | 'multi' | 'true_false';
export type Difficulty = 'easy' | 'medium' | 'hard';

export interface ChallengeOption {
  id: string;
  text: Loc;
}

export interface Challenge {
  id: string;
  // A room's challenges are drawn for that room; 'final' ones only for the
  // Final Challenge.
  roomId: RoomId | 'final';
  // Only read for 'final' challenges: which of the five slots it can fill.
  finalCategory?: FinalCategory;
  type: ChallengeType;
  question: Loc;
  options: ChallengeOption[];
  // Option ids. One for 'single' and 'true_false'; the exact set for 'multi'.
  correct: string[];
  // One or two short sentences, shown with the answer.
  explanation: Loc;
  // `emoji` is drawn large beside the question. `image` is a URL under
  // /assets/ for when rights-cleared photos are added; the screens fall back
  // to the emoji (or nothing) if it is missing or fails to load.
  media?: { emoji?: string; image?: string };
  // Seconds. Falls back to SCORING.timers for the challenge's type.
  timeLimit?: number;
  difficulty: Difficulty;
  active: boolean;
  reviewed: boolean;
}

export interface RoomDef {
  id: RoomId;
  name: Loc;
  theme: Loc;
  emoji: string;
  active: boolean;
}

// The Majlis always opens the house; the other rooms are the random pool.
export const FIRST_ROOM: RoomId = 'majlis';
export const ROOMS_PER_SESSION = 5;

export const ROOMS: RoomDef[] = [
  { id: 'majlis', name: { en: 'Majlis', ar: 'المجلس' }, theme: { en: 'Hospitality', ar: 'الضيافة' }, emoji: '☕', active: true },
  { id: 'kitchen', name: { en: 'Kitchen', ar: 'المطبخ' }, theme: { en: 'Food', ar: 'الأكل' }, emoji: '🍲', active: true },
  { id: 'library', name: { en: 'Library', ar: 'المكتبة' }, theme: { en: 'Culture & Heritage', ar: 'الثقافة والتراث' }, emoji: '📜', active: true },
  { id: 'office', name: { en: 'Office', ar: 'المكتب' }, theme: { en: 'Modern Saudi Arabia', ar: 'السعودية الحديثة' }, emoji: '💼', active: true },
  { id: 'garage', name: { en: 'Garage', ar: 'الكراج' }, theme: { en: 'Manufacturing & Innovation', ar: 'الصناعة والابتكار' }, emoji: '🔧', active: true },
  { id: 'closet', name: { en: 'Closet', ar: 'الدولاب' }, theme: { en: 'Fashion & Identity', ar: 'الأزياء والهوية' }, emoji: '👘', active: true },
  { id: 'living-room', name: { en: 'Living Room', ar: 'الصالة' }, theme: { en: 'Social Life & Humor', ar: 'الحياة الاجتماعية' }, emoji: '🛋️', active: true },
  { id: 'courtyard', name: { en: 'Courtyard', ar: 'الحوش' }, theme: { en: 'Regions & Landscapes', ar: 'المناطق والطبيعة' }, emoji: '🌴', active: true },
];

export const FINAL_ORDER: FinalCategory[] = ['hospitality', 'food', 'heritage', 'modern', 'social-regions'];

// Configurable scoring (spec section 10). Speed bonus is the bonus maximum
// scaled by how much of the timer was left when the answer arrived.
export const SCORING = {
  base: 1000,
  speedBonusMax: 500,
  hardMultiplier: 1.25,
  finalBase: 1500,
  timers: { single: 20, true_false: 15, multi: 25, final: 12 } as Record<ChallengeType | 'final', number>,
};

// True/false options are the same everywhere.
const TF: ChallengeOption[] = [
  { id: 'true', text: { en: 'True', ar: 'صح' } },
  { id: 'false', text: { en: 'False', ar: 'خطأ' } },
];

function opts(...pairs: Array<[string, string]>): ChallengeOption[] {
  return pairs.map(([en, ar], i) => ({ id: String.fromCharCode(97 + i), text: { en, ar } }));
}

export const CHALLENGES: Challenge[] = [
  // ---------------------------------------------------------------- Majlis
  {
    id: 'majlis-1',
    roomId: 'majlis',
    type: 'single',
    question: { en: 'A guest has arrived. What would you expect to be offered first?', ar: 'وصل ضيف. وش تتوقع ينقدّم له أول شي؟' },
    options: opts(['Saudi coffee and dates', 'قهوة سعودية وتمر'], ['A can of cola', 'علبة كولا'], ['A full dinner straight away', 'عشاء كامل على طول'], ['Nothing until they ask', 'ولا شي لين يطلب']),
    correct: ['a'],
    explanation: {
      en: 'In many Saudi homes, gahwa (Saudi coffee) and dates are the classic welcome: a sign of generosity and respect.',
      ar: 'في كثير من البيوت السعودية، القهوة والتمر هي الترحيب المعتاد، وعلامة كرم واحترام.',
    },
    media: { emoji: '☕' },
    difficulty: 'easy',
    active: true,
    reviewed: false,
  },
  {
    id: 'majlis-2',
    roomId: 'majlis',
    type: 'single',
    question: { en: 'Saudi coffee is usually flavoured with which spice?', ar: 'القهوة السعودية عادةً تُنكّه بأي بهار؟' },
    options: opts(['Cardamom', 'الهيل'], ['Cinnamon', 'القرفة'], ['Vanilla', 'الفانيلا'], ['Chili', 'الفلفل الحار']),
    correct: ['a'],
    explanation: {
      en: 'Gahwa is lightly roasted coffee brewed with cardamom, sometimes with saffron or cloves, which is why it is often golden rather than dark.',
      ar: 'القهوة السعودية بن محمّص تحميصاً خفيفاً يُطبخ مع الهيل، وأحياناً الزعفران أو القرنفل، ولهذا لونها غالباً ذهبي.',
    },
    media: { emoji: '🫘' },
    difficulty: 'easy',
    active: true,
    reviewed: false,
  },
  {
    id: 'majlis-3',
    roomId: 'majlis',
    type: 'true_false',
    question: {
      en: 'When you have had enough coffee, a gentle shake of the cup tells the host "no more, thank you".',
      ar: 'إذا اكتفيت من القهوة، هزّ الفنجان بخفة يعني للمضيف "كفاية، شكراً".',
    },
    options: TF,
    correct: ['true'],
    explanation: {
      en: 'In many homes a little shake of the finjan says you are done; otherwise the host will keep pouring!',
      ar: 'في كثير من البيوت، هزّة الفنجان تعني إنك اكتفيت، وإلا بيستمر المضيف يصب لك!',
    },
    media: { emoji: '🫖' },
    difficulty: 'medium',
    active: true,
    reviewed: false,
  },
  {
    id: 'majlis-4',
    roomId: 'majlis',
    type: 'single',
    question: { en: 'What is the traditional pot used to serve Saudi coffee called?', ar: 'وش اسم الإبريق التقليدي اللي تُقدّم فيه القهوة السعودية؟' },
    options: opts(['Dallah', 'الدلّة'], ['Tagine', 'الطاجين'], ['Samovar', 'السماور'], ['Teapot', 'البرّاد']),
    correct: ['a'],
    explanation: {
      en: 'The dallah, with its long curved spout, is one of the best-known symbols of Arabian hospitality.',
      ar: 'الدلّة بخشمها الطويل المنحني من أشهر رموز الضيافة العربية.',
    },
    media: { emoji: '🫖' },
    difficulty: 'easy',
    active: true,
    reviewed: false,
  },
  {
    id: 'majlis-5',
    roomId: 'majlis',
    type: 'multi',
    question: { en: 'Which of these are common ways to honour a guest?', ar: 'أي من هذي طرق معروفة لإكرام الضيف؟' },
    options: opts(['Serve coffee and dates', 'تقديم القهوة والتمر'], ['Pass around fragrant incense (bakhoor)', 'تمرير البخور'], ['Seat them in the best spot', 'إجلاسه في صدر المجلس'], ['Ask them to pay for the coffee', 'تطلب منه يدفع حق القهوة']),
    correct: ['a', 'b', 'c'],
    explanation: {
      en: 'Coffee, dates, bakhoor and the best seat in the majlis are all ways hosts make guests feel honoured.',
      ar: 'القهوة والتمر والبخور وصدر المجلس كلها طرق يكرم فيها المضيف ضيفه.',
    },
    media: { emoji: '🤝' },
    difficulty: 'medium',
    active: true,
    reviewed: false,
  },

  // --------------------------------------------------------------- Kitchen
  {
    id: 'kitchen-1',
    roomId: 'kitchen',
    type: 'single',
    question: { en: 'Which spiced rice dish, cooked with meat or chicken, is often called the Saudi national dish?', ar: 'أي طبق رز متبّل باللحم أو الدجاج يُعتبر غالباً الطبق الوطني السعودي؟' },
    options: opts(['Kabsa', 'الكبسة'], ['Paella', 'الباييا'], ['Risotto', 'الريزوتو'], ['Fried rice', 'الرز المقلي']),
    correct: ['a'],
    explanation: {
      en: 'Kabsa is the best-known Saudi rice dish, flavoured with a spice blend and often shared from one big platter.',
      ar: 'الكبسة أشهر أطباق الرز السعودية، تُتبّل بخلطة بهارات وغالباً تُقدّم في صحن كبير يجتمع عليه الكل.',
    },
    media: { emoji: '🍛' },
    difficulty: 'easy',
    active: true,
    reviewed: false,
  },
  {
    id: 'kitchen-2',
    roomId: 'kitchen',
    type: 'single',
    question: { en: 'Jareesh, a comforting dish loved in Najd, is made mainly from…', ar: 'الجريش، الطبق المحبوب في نجد، مصنوع أساساً من…' },
    options: opts(['Crushed wheat', 'القمح المجروش'], ['Rice', 'الرز'], ['Lentils', 'العدس'], ['Corn', 'الذرة']),
    correct: ['a'],
    explanation: {
      en: 'Jareesh is cracked wheat slow-cooked with broth or yogurt: simple, filling and a staple across central Saudi Arabia.',
      ar: 'الجريش قمح مجروش يُطبخ على مهل بالمرق أو اللبن، طبق بسيط ومشبع وأساسي في وسط المملكة.',
    },
    media: { emoji: '🌾' },
    difficulty: 'medium',
    active: true,
    reviewed: false,
  },
  {
    id: 'kitchen-3',
    roomId: 'kitchen',
    type: 'single',
    question: { en: 'Saleeg, creamy rice cooked in broth and milk, is closely linked to which region?', ar: 'السليق، الرز الكريمي المطبوخ بالمرق والحليب، مرتبط بأي منطقة؟' },
    options: opts(['Hijaz (the west)', 'الحجاز (الغربية)'], ['Eastern Province', 'المنطقة الشرقية'], ['Northern Borders', 'الحدود الشمالية'], ['Jazan', 'جازان']),
    correct: ['a'],
    explanation: {
      en: 'Saleeg comes from the Hijaz, especially Taif. Saudi cuisine changes from region to region.',
      ar: 'السليق من الحجاز وخصوصاً الطائف، والمطبخ السعودي يختلف من منطقة لمنطقة.',
    },
    media: { emoji: '🥣' },
    difficulty: 'hard',
    active: true,
    reviewed: false,
  },
  {
    id: 'kitchen-4',
    roomId: 'kitchen',
    type: 'true_false',
    question: { en: 'Saudi Arabia grows hundreds of different varieties of dates.', ar: 'السعودية تزرع مئات الأنواع من التمور.' },
    options: TF,
    correct: ['true'],
    explanation: {
      en: 'Saudi Arabia is one of the world’s biggest date producers, with famous varieties like Sukkari, Ajwa and Khalas.',
      ar: 'السعودية من أكبر منتجي التمور في العالم، ومن أشهر أنواعها السكري والعجوة والخلاص.',
    },
    media: { emoji: '🌴' },
    difficulty: 'easy',
    active: true,
    reviewed: false,
  },
  {
    id: 'kitchen-5',
    roomId: 'kitchen',
    type: 'multi',
    question: { en: 'Which of these are traditional Saudi foods?', ar: 'أي من هذي أكلات سعودية تقليدية؟' },
    options: opts(['Jareesh', 'الجريش'], ['Saleeg', 'السليق'], ['Kleija (date-filled cookies)', 'الكليجا'], ['Croissant', 'الكرواسون']),
    correct: ['a', 'b', 'c'],
    explanation: {
      en: 'Jareesh from Najd, Saleeg from the Hijaz and Kleija from Qassim: every region brings its own flavour.',
      ar: 'الجريش من نجد، والسليق من الحجاز، والكليجا من القصيم. كل منطقة لها نكهتها.',
    },
    media: { emoji: '🍪' },
    difficulty: 'medium',
    active: true,
    reviewed: false,
  },

  // --------------------------------------------------------------- Library
  {
    id: 'library-1',
    roomId: 'library',
    type: 'single',
    question: { en: 'Hegra, near AlUla, with its tombs carved by the Nabataeans, was the first Saudi site added to which list?', ar: 'الحِجر قرب العُلا، بمقابرها المنحوتة من الأنباط، كانت أول موقع سعودي يُضاف لأي قائمة؟' },
    options: opts(['UNESCO World Heritage List', 'قائمة اليونسكو للتراث العالمي'], ['The Seven Wonders of the World', 'عجائب الدنيا السبع'], ['Olympic host cities', 'المدن المستضيفة للأولمبياد'], ['Guinness World Records', 'موسوعة غينيس']),
    correct: ['a'],
    explanation: {
      en: 'Hegra, with more than 100 monumental tombs, became Saudi Arabia’s first UNESCO World Heritage Site in 2008.',
      ar: 'الحِجر بأكثر من ١٠٠ مقبرة منحوتة صارت أول موقع سعودي في قائمة التراث العالمي لليونسكو عام ٢٠٠٨.',
    },
    media: { emoji: '🏛️' },
    difficulty: 'medium',
    active: true,
    reviewed: false,
  },
  {
    id: 'library-2',
    roomId: 'library',
    type: 'single',
    question: { en: 'Al Sadu is a traditional Bedouin craft. What is it?', ar: 'السدو حرفة بدوية تقليدية. وش هي؟' },
    options: opts(['Weaving', 'النسيج'], ['Pottery', 'الفخار'], ['Metalwork', 'الحدادة'], ['Glass blowing', 'نفخ الزجاج']),
    correct: ['a'],
    explanation: {
      en: 'Al Sadu weaving turns sheep, camel and goat wool into bold geometric patterns, and it is on UNESCO’s intangible heritage list.',
      ar: 'السدو نسيج من صوف الغنم ووبر الإبل وشعر الماعز بنقوش هندسية جريئة، ومسجّل في قائمة اليونسكو للتراث غير المادي.',
    },
    media: { emoji: '🧶' },
    difficulty: 'easy',
    active: true,
    reviewed: false,
  },
  {
    id: 'library-3',
    roomId: 'library',
    type: 'true_false',
    question: {
      en: 'Al-Qatt Al-Asiri, the colourful wall art traditionally painted by women in Asir, is recognised by UNESCO.',
      ar: 'القط العسيري، الرسم الملوّن على الجدران اللي ترسمه نساء عسير، معترف فيه من اليونسكو.',
    },
    options: TF,
    correct: ['true'],
    explanation: {
      en: 'Women in Asir decorate their homes with bright geometric designs, a tradition UNESCO recognised in 2017.',
      ar: 'نساء عسير يزيّنّ بيوتهن بنقوش هندسية زاهية، وسجّلت اليونسكو هذا التقليد عام ٢٠١٧.',
    },
    media: { emoji: '🎨' },
    difficulty: 'medium',
    active: true,
    reviewed: false,
  },
  {
    id: 'library-4',
    roomId: 'library',
    type: 'single',
    question: { en: 'Historic Diriyah, birthplace of the first Saudi state, is on the edge of which city?', ar: 'الدرعية التاريخية، منطلق الدولة السعودية الأولى، على أطراف أي مدينة؟' },
    options: opts(['Riyadh', 'الرياض'], ['Jeddah', 'جدة'], ['Dammam', 'الدمام'], ['Tabuk', 'تبوك']),
    correct: ['a'],
    explanation: {
      en: 'At-Turaif in Diriyah, built from mud brick in the Najdi style, is a UNESCO World Heritage Site.',
      ar: 'حي الطريف في الدرعية، المبني بالطين على الطراز النجدي، موقع تراث عالمي لليونسكو.',
    },
    media: { emoji: '🧱' },
    difficulty: 'easy',
    active: true,
    reviewed: false,
  },
  {
    id: 'library-5',
    roomId: 'library',
    type: 'single',
    question: { en: 'Saudi Founding Day, which celebrates the beginning of the first Saudi state in 1727, falls on…', ar: 'يوم التأسيس، اللي يحتفل ببداية الدولة السعودية الأولى عام ١٧٢٧م، يوافق…' },
    options: opts(['22 February', '٢٢ فبراير'], ['23 September', '٢٣ سبتمبر'], ['1 January', '١ يناير'], ['14 October', '١٤ أكتوبر']),
    correct: ['a'],
    explanation: {
      en: 'Founding Day (22 February) marks 1727. National Day (23 September) marks the unification of the Kingdom in 1932.',
      ar: 'يوم التأسيس (٢٢ فبراير) يرمز لعام ١٧٢٧م، واليوم الوطني (٢٣ سبتمبر) يرمز لتوحيد المملكة عام ١٩٣٢م.',
    },
    media: { emoji: '📅' },
    difficulty: 'hard',
    active: true,
    reviewed: false,
  },

  // ---------------------------------------------------------------- Office
  {
    id: 'office-1',
    roomId: 'office',
    type: 'multi',
    question: { en: 'Which of these are part of Saudi Arabia’s growing non-oil economy?', ar: 'أي من هذي قطاعات في الاقتصاد السعودي غير النفطي المتنامي؟' },
    options: opts(['Tourism', 'السياحة'], ['Entertainment', 'الترفيه'], ['Technology', 'التقنية'], ['Whaling', 'صيد الحيتان']),
    correct: ['a', 'b', 'c'],
    explanation: {
      en: 'Under Vision 2030, tourism, entertainment and technology are growing fast alongside energy.',
      ar: 'ضمن رؤية ٢٠٣٠، تنمو السياحة والترفيه والتقنية بسرعة جنب قطاع الطاقة.',
    },
    media: { emoji: '📈' },
    difficulty: 'easy',
    active: true,
    reviewed: false,
  },
  {
    id: 'office-2',
    roomId: 'office',
    type: 'single',
    question: { en: 'What is the name of the national transformation plan Saudi Arabia launched in 2016?', ar: 'وش اسم خطة التحول الوطني اللي أطلقتها السعودية عام ٢٠١٦؟' },
    options: opts(['Vision 2030', 'رؤية ٢٠٣٠'], ['Plan 2020', 'خطة ٢٠٢٠'], ['Horizon 2050', 'أفق ٢٠٥٠'], ['Future 2040', 'مستقبل ٢٠٤٠']),
    correct: ['a'],
    explanation: {
      en: 'Vision 2030 sets out plans to diversify the economy and grow sectors like tourism, culture and technology.',
      ar: 'رؤية ٢٠٣٠ ترسم خطة لتنويع الاقتصاد وتنمية قطاعات مثل السياحة والثقافة والتقنية.',
    },
    media: { emoji: '🎯' },
    difficulty: 'easy',
    active: true,
    reviewed: false,
  },
  {
    id: 'office-3',
    roomId: 'office',
    type: 'single',
    question: { en: 'Which city will host World Expo 2030?', ar: 'أي مدينة بتستضيف إكسبو العالمي ٢٠٣٠؟' },
    options: opts(['Riyadh', 'الرياض'], ['Jeddah', 'جدة'], ['Rome', 'روما'], ['Busan', 'بوسان']),
    correct: ['a'],
    explanation: {
      en: 'Riyadh won the vote in 2023 to host World Expo 2030.',
      ar: 'فازت الرياض في تصويت عام ٢٠٢٣ باستضافة إكسبو العالمي ٢٠٣٠.',
    },
    media: { emoji: '🌐' },
    difficulty: 'medium',
    active: true,
    reviewed: false,
  },
  {
    id: 'office-4',
    roomId: 'office',
    type: 'single',
    question: { en: 'Saudi Arabia will host which global tournament in 2034?', ar: 'السعودية بتستضيف أي بطولة عالمية في ٢٠٣٤؟' },
    options: opts(['FIFA World Cup', 'كأس العالم لكرة القدم'], ['Summer Olympics', 'الألعاب الأولمبية الصيفية'], ['Rugby World Cup', 'كأس العالم للرجبي'], ['Tour de France', 'طواف فرنسا']),
    correct: ['a'],
    explanation: {
      en: 'FIFA confirmed in 2024 that Saudi Arabia will host the 2034 World Cup.',
      ar: 'أكد الفيفا عام ٢٠٢٤ استضافة السعودية لكأس العالم ٢٠٣٤.',
    },
    media: { emoji: '⚽' },
    difficulty: 'easy',
    active: true,
    reviewed: false,
  },
  {
    id: 'office-5',
    roomId: 'office',
    type: 'true_false',
    question: { en: 'Saudi Arabia started offering tourist e-visas in 2019.', ar: 'بدأت السعودية تمنح التأشيرة السياحية الإلكترونية عام ٢٠١٩.' },
    options: TF,
    correct: ['true'],
    explanation: {
      en: 'In 2019 Saudi Arabia opened to leisure tourists with e-visas for visitors from dozens of countries.',
      ar: 'في ٢٠١٩ فتحت السعودية أبوابها للسياح بتأشيرة إلكترونية لزوار من عشرات الدول.',
    },
    media: { emoji: '✈️' },
    difficulty: 'medium',
    active: true,
    reviewed: false,
  },

  // ---------------------------------------------------------------- Garage
  {
    id: 'garage-1',
    roomId: 'garage',
    type: 'single',
    question: { en: 'Jubail, on the Gulf coast, is famous for which kind of industry?', ar: 'الجبيل على ساحل الخليج مشهورة بأي نوع من الصناعة؟' },
    options: opts(['Petrochemicals', 'البتروكيماويات'], ['Film production', 'إنتاج الأفلام'], ['Fashion', 'الأزياء'], ['Watchmaking', 'صناعة الساعات']),
    correct: ['a'],
    explanation: {
      en: 'Jubail Industrial City is one of the largest industrial cities in the world and home to major petrochemical plants.',
      ar: 'مدينة الجبيل الصناعية من أكبر المدن الصناعية في العالم، وفيها مصانع بتروكيماويات كبرى.',
    },
    media: { emoji: '🏭' },
    difficulty: 'easy',
    active: true,
    reviewed: false,
  },
  {
    id: 'garage-2',
    roomId: 'garage',
    type: 'single',
    question: { en: 'Ceer is a Saudi brand that makes what?', ar: 'سير (Ceer) علامة سعودية تصنع وش؟' },
    options: opts(['Electric cars', 'سيارات كهربائية'], ['Smartphones', 'جوالات'], ['Airplanes', 'طائرات'], ['Sneakers', 'أحذية رياضية']),
    correct: ['a'],
    explanation: {
      en: 'Ceer is Saudi Arabia’s first electric-vehicle brand, a venture between the Public Investment Fund and Foxconn.',
      ar: 'سير أول علامة سعودية للسيارات الكهربائية، مشروع مشترك بين صندوق الاستثمارات العامة وفوكسكون.',
    },
    media: { emoji: '🚗' },
    difficulty: 'medium',
    active: true,
    reviewed: false,
  },
  {
    id: 'garage-3',
    roomId: 'garage',
    type: 'single',
    question: { en: 'Ma’aden runs a huge smelter at Ras Al-Khair. Which metal does it produce?', ar: 'معادن تشغّل مصهراً ضخماً في رأس الخير. أي معدن ينتج؟' },
    options: opts(['Aluminium', 'الألمنيوم'], ['Silver', 'الفضة'], ['Tin', 'القصدير'], ['Platinum', 'البلاتين']),
    correct: ['a'],
    explanation: {
      en: 'Ma’aden’s Ras Al-Khair complex produces aluminium used in cars, cans and construction.',
      ar: 'مجمّع معادن في رأس الخير ينتج الألمنيوم المستخدم في السيارات والعلب والبناء.',
    },
    media: { emoji: '⚙️' },
    difficulty: 'hard',
    active: true,
    reviewed: false,
  },
  {
    id: 'garage-4',
    roomId: 'garage',
    type: 'true_false',
    question: { en: 'Much of Saudi Arabia’s drinking water comes from turning seawater into fresh water.', ar: 'جزء كبير من مياه الشرب في السعودية يجي من تحلية مياه البحر.' },
    options: TF,
    correct: ['true'],
    explanation: {
      en: 'Saudi Arabia has one of the largest desalination industries in the world, with plants on both the Red Sea and Gulf coasts.',
      ar: 'السعودية عندها من أكبر صناعات التحلية في العالم، بمحطات على ساحلي البحر الأحمر والخليج.',
    },
    media: { emoji: '💧' },
    difficulty: 'easy',
    active: true,
    reviewed: false,
  },
  {
    id: 'garage-5',
    roomId: 'garage',
    type: 'single',
    question: { en: 'The electric-car maker Lucid opened a factory in which Saudi city?', ar: 'شركة لوسِد للسيارات الكهربائية افتتحت مصنعاً في أي مدينة سعودية؟' },
    options: opts(['King Abdullah Economic City', 'مدينة الملك عبدالله الاقتصادية'], ['Hail', 'حائل'], ['Najran', 'نجران'], ['Al-Baha', 'الباحة']),
    correct: ['a'],
    explanation: {
      en: 'Lucid’s plant in King Abdullah Economic City opened in 2023, its first factory outside the United States.',
      ar: 'افتُتح مصنع لوسِد في مدينة الملك عبدالله الاقتصادية عام ٢٠٢٣، وهو أول مصانعها خارج أمريكا.',
    },
    media: { emoji: '🔋' },
    difficulty: 'hard',
    active: true,
    reviewed: false,
  },

  // ---------------------------------------------------------------- Closet
  {
    id: 'closet-1',
    roomId: 'closet',
    type: 'single',
    question: { en: 'What is the long garment worn by many Saudi men called?', ar: 'وش اسم اللبس الطويل اللي يلبسه كثير من الرجال السعوديين؟' },
    options: opts(['Thobe', 'الثوب'], ['Kimono', 'الكيمونو'], ['Sari', 'الساري'], ['Kilt', 'التنورة الاسكتلندية']),
    correct: ['a'],
    explanation: {
      en: 'The thobe is light and breathable. White is popular in summer, while darker colours and heavier fabrics appear in winter.',
      ar: 'الثوب خفيف ومريح؛ الأبيض منتشر في الصيف، والألوان الغامقة والأقمشة الثقيلة تطلع في الشتاء.',
    },
    media: { emoji: '👔' },
    difficulty: 'easy',
    active: true,
    reviewed: false,
  },
  {
    id: 'closet-2',
    roomId: 'closet',
    type: 'single',
    question: { en: 'The red-and-white checked headscarf many Saudi men wear is called the…', ar: 'غطاء الرأس الأحمر والأبيض المربّع اللي يلبسه كثير من الرجال اسمه…' },
    options: opts(['Shemagh', 'الشماغ'], ['Beret', 'البيريه'], ['Fedora', 'الفيدورا'], ['Bandana', 'الباندانا']),
    correct: ['a'],
    explanation: {
      en: 'The shemagh, or the plain white ghutra, is held in place by a black cord called the agal.',
      ar: 'الشماغ، أو الغترة البيضاء، يثبّته حبل أسود اسمه العقال.',
    },
    media: { emoji: '🧣' },
    difficulty: 'easy',
    active: true,
    reviewed: false,
  },
  {
    id: 'closet-3',
    roomId: 'closet',
    type: 'single',
    question: { en: 'The abaya, a flowing outer robe worn by many Saudi women, today comes in…', ar: 'العباءة اللي تلبسها كثير من السعوديات، اليوم تجي بـ…' },
    options: opts(['Many colours, cuts and designer styles', 'ألوان وقصّات وتصاميم كثيرة'], ['One single official design', 'تصميم رسمي واحد بس'], ['Only one size', 'مقاس واحد بس'], ['Paper only', 'ورق بس']),
    correct: ['a'],
    explanation: {
      en: 'Black remains classic, but Saudi designers now create abayas in many colours, fabrics and styles.',
      ar: 'الأسود يظل كلاسيكياً، لكن المصممات السعوديات اليوم يصممن عبايات بألوان وأقمشة وأساليب متنوعة.',
    },
    media: { emoji: '🧵' },
    difficulty: 'easy',
    active: true,
    reviewed: false,
  },
  {
    id: 'closet-4',
    roomId: 'closet',
    type: 'single',
    question: { en: 'You are invited to a Saudi wedding celebration. Which look fits best?', ar: 'انعزمت على زواج سعودي. أي لبس يناسب أكثر؟' },
    options: opts(['Your smartest formal outfit', 'أفخم لبس رسمي عندك'], ['Gym clothes', 'لبس النادي'], ['Beachwear', 'لبس البحر'], ['Pyjamas', 'البيجاما']),
    correct: ['a'],
    explanation: {
      en: 'Weddings are big, glamorous occasions: guests dress up, and many celebrations are real fashion moments.',
      ar: 'الأعراس مناسبات كبيرة وفخمة، والضيوف يتأنقون، وكثير منها مناسبات أزياء بامتياز.',
    },
    media: { emoji: '💍' },
    difficulty: 'easy',
    active: true,
    reviewed: false,
  },
  {
    id: 'closet-5',
    roomId: 'closet',
    type: 'true_false',
    question: { en: 'The bisht is a cloak worn over the thobe for special occasions like weddings and graduations.', ar: 'البشت عباءة رجالية تُلبس فوق الثوب في المناسبات مثل الأعراس والتخرج.' },
    options: TF,
    correct: ['true'],
    explanation: {
      en: 'The bisht, often edged with gold thread, is worn for formal and celebratory occasions.',
      ar: 'البشت، المطرّز غالباً بخيوط الزري الذهبية، يُلبس في المناسبات الرسمية والاحتفالات.',
    },
    media: { emoji: '🎓' },
    difficulty: 'medium',
    active: true,
    reviewed: false,
  },

  // ----------------------------------------------------------- Living Room
  {
    id: 'living-1',
    roomId: 'living-room',
    type: 'single',
    question: { en: 'A Saudi friend shouts “Yalla!” What do they mean?', ar: 'صاحبك السعودي صرخ "يلا!" وش يقصد؟' },
    options: opts(['Let’s go! / Come on!', 'هيا! / يلا بسرعة!'], ['Goodbye forever', 'مع السلامة للأبد'], ['I’m hungry', 'أنا جوعان'], ['Be quiet', 'اسكت']),
    correct: ['a'],
    explanation: {
      en: '“Yalla” is the all-purpose “let’s go / hurry up” you’ll hear everywhere, from kitchens to football stadiums.',
      ar: '"يلا" كلمة لكل شي: "هيا" و"استعجل"، تسمعها في كل مكان من المطبخ للملعب.',
    },
    media: { emoji: '🏃' },
    difficulty: 'easy',
    active: true,
    reviewed: false,
  },
  {
    id: 'living-2',
    roomId: 'living-room',
    type: 'single',
    question: { en: 'You ask if your friend is coming tonight and they say “Inshallah.” What does it literally mean?', ar: 'سألت صاحبك إذا بيجي الليلة وقال "إن شاء الله". وش معناها الحرفي؟' },
    options: opts(['God willing', 'إن أراد الله'], ['Definitely not', 'أكيد لا'], ['I’m busy', 'أنا مشغول'], ['See you tomorrow', 'أشوفك بكرة']),
    correct: ['a'],
    explanation: {
      en: 'It literally means “God willing”, and yes, friends love to joke about how flexible an “inshallah” can be!',
      ar: 'معناها الحرفي "إذا أراد الله"، والأصحاب يحبون يمزحون عن مرونة "إن شاء الله"!',
    },
    media: { emoji: '🤲' },
    difficulty: 'easy',
    active: true,
    reviewed: false,
  },
  {
    id: 'living-3',
    roomId: 'living-room',
    type: 'single',
    question: { en: 'Your host offers you more food. You say you’re full. What usually happens next?', ar: 'المضيف يعرض عليك أكل زيادة وتقول إنك شبعان. وش يصير غالباً؟' },
    options: opts(['They offer again… and again!', 'يعرض عليك مرة ثانية… وثالثة!'], ['They take your plate at once', 'يشيل صحنك على طول'], ['They ask you to do the dishes', 'يطلب منك تغسل الصحون'], ['They hand you the bill', 'يعطيك الفاتورة']),
    correct: ['a'],
    explanation: {
      en: 'Generous hosts often insist a few times as a sign of care. A hand on the chest with a smile is a polite “truly, I’m full.”',
      ar: 'المضيف الكريم يلحّ أكثر من مرة من باب الاهتمام، ووضع اليد على الصدر مع ابتسامة يعني بأدب "والله شبعت".',
    },
    media: { emoji: '🍽️' },
    difficulty: 'easy',
    active: true,
    reviewed: false,
  },
  {
    id: 'living-4',
    roomId: 'living-room',
    type: 'single',
    question: { en: 'Baloot is a hugely popular pastime in Saudi living rooms. What is it?', ar: 'البلوت من أشهر التسليات في المجالس السعودية. وش هو؟' },
    options: opts(['A card game', 'لعبة ورق'], ['A dance', 'رقصة'], ['A dessert', 'حلى'], ['A TV show', 'برنامج تلفزيوني']),
    correct: ['a'],
    explanation: {
      en: 'Baloot is a team card game, usually played with plenty of friendly trash talk.',
      ar: 'البلوت لعبة ورق جماعية، وقلّما تخلو من "الطقطقة" الودية.',
    },
    media: { emoji: '🃏' },
    difficulty: 'medium',
    active: true,
    reviewed: false,
  },
  {
    id: 'living-5',
    roomId: 'living-room',
    type: 'true_false',
    question: { en: 'When greeting someone, it is common to ask “How are you?” several times in a row.', ar: 'عند السلام، من الطبيعي تسأل "كيف حالك؟" أكثر من مرة ورا بعض.' },
    options: TF,
    correct: ['true'],
    explanation: {
      en: 'Greetings can be wonderfully long: “How are you? How’s the family? All good?” It shows genuine interest.',
      ar: 'السلام ممكن يطوّل: "كيف حالك؟ كيف الأهل؟ عساك طيب؟" وهذا يعكس اهتماماً حقيقياً.',
    },
    media: { emoji: '👋' },
    difficulty: 'easy',
    active: true,
    reviewed: false,
  },

  // ------------------------------------------------------------- Courtyard
  {
    id: 'courtyard-1',
    roomId: 'courtyard',
    type: 'single',
    question: { en: 'Which southwestern region is known for green mountains, cool weather and terraced farms?', ar: 'أي منطقة في الجنوب الغربي معروفة بالجبال الخضراء والجو البارد والمدرجات الزراعية؟' },
    options: opts(['Asir', 'عسير'], ['Eastern Province', 'المنطقة الشرقية'], ['Al-Qassim', 'القصيم'], ['Northern Borders', 'الحدود الشمالية']),
    correct: ['a'],
    explanation: {
      en: 'Asir’s mountains rise to around 3,000 m, and Abha is a favourite summer escape with cool, misty weather.',
      ar: 'جبال عسير ترتفع لحوالي ٣٠٠٠ متر، وأبها وجهة صيفية محبوبة بجوها البارد والضبابي.',
    },
    media: { emoji: '⛰️' },
    difficulty: 'easy',
    active: true,
    reviewed: false,
  },
  {
    id: 'courtyard-2',
    roomId: 'courtyard',
    type: 'single',
    question: { en: 'AlUla, famous for sandstone formations like Elephant Rock, is in which region?', ar: 'العُلا، المشهورة بتكويناتها الصخرية مثل جبل الفيل، في أي منطقة؟' },
    options: opts(['Madinah Region', 'منطقة المدينة المنورة'], ['Eastern Province', 'المنطقة الشرقية'], ['Asir', 'عسير'], ['Jazan', 'جازان']),
    correct: ['a'],
    explanation: {
      en: 'AlUla, in the Madinah Region, mixes desert canyons, oases and thousands of years of history.',
      ar: 'العُلا في منطقة المدينة المنورة تجمع الأودية الصحراوية والواحات وآلاف السنين من التاريخ.',
    },
    media: { emoji: '🐘' },
    difficulty: 'medium',
    active: true,
    reviewed: false,
  },
  {
    id: 'courtyard-3',
    roomId: 'courtyard',
    type: 'single',
    question: { en: 'Which sea, known for its coral reefs, lies along Saudi Arabia’s west coast?', ar: 'أي بحر، معروف بشعابه المرجانية، يمتد على الساحل الغربي للسعودية؟' },
    options: opts(['The Red Sea', 'البحر الأحمر'], ['The Mediterranean', 'البحر المتوسط'], ['The Caspian Sea', 'بحر قزوين'], ['The Black Sea', 'البحر الأسود']),
    correct: ['a'],
    explanation: {
      en: 'The Red Sea coast is lined with vibrant coral reefs; the Arabian Gulf lies on the east coast.',
      ar: 'ساحل البحر الأحمر مليان شعاب مرجانية زاهية، والخليج العربي على الساحل الشرقي.',
    },
    media: { emoji: '🐠' },
    difficulty: 'easy',
    active: true,
    reviewed: false,
  },
  {
    id: 'courtyard-4',
    roomId: 'courtyard',
    type: 'true_false',
    question: { en: 'Snow sometimes falls in parts of Saudi Arabia.', ar: 'أحياناً ينزل ثلج في بعض مناطق السعودية.' },
    options: TF,
    correct: ['true'],
    explanation: {
      en: 'Mountains near Tabuk, like Jabal Al-Lawz, can see snow in winter. Saudi Arabia is far more than desert!',
      ar: 'الجبال قرب تبوك، مثل جبل اللوز، ممكن يتساقط عليها الثلج في الشتاء. السعودية أكثر بكثير من صحراء!',
    },
    media: { emoji: '❄️' },
    difficulty: 'medium',
    active: true,
    reviewed: false,
  },
  {
    id: 'courtyard-5',
    roomId: 'courtyard',
    type: 'single',
    question: { en: 'Al-Ahsa, one of the largest oases in the world, is in which province?', ar: 'الأحساء، من أكبر الواحات في العالم، في أي منطقة؟' },
    options: opts(['Eastern Province', 'المنطقة الشرقية'], ['Asir', 'عسير'], ['Tabuk', 'تبوك'], ['Al-Jawf', 'الجوف']),
    correct: ['a'],
    explanation: {
      en: 'Al-Ahsa’s oasis has millions of date palms and is a UNESCO World Heritage Site.',
      ar: 'واحة الأحساء فيها ملايين النخيل، وهي موقع تراث عالمي لليونسكو.',
    },
    media: { emoji: '🌴' },
    difficulty: 'medium',
    active: true,
    reviewed: false,
  },

  // ------------------------------------------------------- Final Challenge
  {
    id: 'final-hosp-1',
    roomId: 'final',
    finalCategory: 'hospitality',
    type: 'true_false',
    question: { en: 'Dates are often served alongside Saudi coffee.', ar: 'التمر غالباً يُقدّم مع القهوة السعودية.' },
    options: TF,
    correct: ['true'],
    explanation: { en: 'Coffee and dates go hand in hand: the sweetness balances the coffee.', ar: 'القهوة والتمر رفقاء، وحلاوة التمر توازن مرارة القهوة.' },
    media: { emoji: '☕' },
    difficulty: 'easy',
    active: true,
    reviewed: false,
  },
  {
    id: 'final-hosp-2',
    roomId: 'final',
    finalCategory: 'hospitality',
    type: 'single',
    question: { en: 'Bakhoor, often passed around during a visit, is…', ar: 'البخور اللي يُدار في الزيارات هو…' },
    options: opts(['Fragrant incense', 'عود وطيب يُبخَّر'], ['A dessert', 'حلى'], ['A song', 'أغنية'], ['A carpet', 'سجادة']),
    correct: ['a'],
    explanation: { en: 'Bakhoor is scented wood chips burned to perfume the room and the guests.', ar: 'البخور رقائق خشب معطّرة تُحرق لتعطير المكان والضيوف.' },
    media: { emoji: '🪔' },
    difficulty: 'easy',
    active: true,
    reviewed: false,
  },
  {
    id: 'final-hosp-3',
    roomId: 'final',
    finalCategory: 'hospitality',
    type: 'single',
    question: { en: '“Hayakom!” is something you hear when you arrive. It means…', ar: '"حياكم!" كلمة تسمعها لما توصل. معناها…' },
    options: opts(['Welcome!', 'أهلاً وسهلاً!'], ['Goodbye', 'مع السلامة'], ['Sorry', 'آسف'], ['Hurry up', 'استعجل']),
    correct: ['a'],
    explanation: { en: '“Hayakom” is a warm welcome, roughly “you’re most welcome here”.', ar: '"حياكم" ترحيب حار، يعني "أهلاً بكم ومرحباً".' },
    media: { emoji: '🏠' },
    difficulty: 'easy',
    active: true,
    reviewed: false,
  },
  {
    id: 'final-food-1',
    roomId: 'final',
    finalCategory: 'food',
    type: 'single',
    question: { en: 'Sukkari, Ajwa and Khalas are all types of…', ar: 'السكري والعجوة والخلاص كلها أنواع من…' },
    options: opts(['Dates', 'التمر'], ['Rice', 'الرز'], ['Coffee', 'القهوة'], ['Bread', 'الخبز']),
    correct: ['a'],
    explanation: { en: 'All three are famous Saudi date varieties.', ar: 'الثلاثة من أشهر أنواع التمور السعودية.' },
    media: { emoji: '🌴' },
    difficulty: 'easy',
    active: true,
    reviewed: false,
  },
  {
    id: 'final-food-2',
    roomId: 'final',
    finalCategory: 'food',
    type: 'true_false',
    question: { en: 'Kabsa is made with rice.', ar: 'الكبسة تُطبخ بالرز.' },
    options: TF,
    correct: ['true'],
    explanation: { en: 'Kabsa is spiced rice cooked with meat, chicken or fish.', ar: 'الكبسة رز متبّل يُطبخ مع اللحم أو الدجاج أو السمك.' },
    media: { emoji: '🍛' },
    difficulty: 'easy',
    active: true,
    reviewed: false,
  },
  {
    id: 'final-food-3',
    roomId: 'final',
    finalCategory: 'food',
    type: 'single',
    question: { en: 'Kleija, the date-filled cookie, is a specialty of which region?', ar: 'الكليجا، البسكويت المحشي بالتمر، من أشهر أكلات أي منطقة؟' },
    options: opts(['Al-Qassim', 'القصيم'], ['Jazan', 'جازان'], ['Tabuk', 'تبوك'], ['Najran', 'نجران']),
    correct: ['a'],
    explanation: { en: 'Qassim even holds a festival for Kleija every year.', ar: 'القصيم تقيم مهرجاناً للكليجا كل سنة.' },
    media: { emoji: '🍪' },
    difficulty: 'medium',
    active: true,
    reviewed: false,
  },
  {
    id: 'final-heritage-1',
    roomId: 'final',
    finalCategory: 'heritage',
    type: 'single',
    question: { en: 'The traditional sword dance performed at celebrations is called…', ar: 'رقصة السيوف التقليدية في الاحتفالات اسمها…' },
    options: opts(['Al-Ardah', 'العرضة'], ['Flamenco', 'الفلامنكو'], ['Haka', 'الهاكا'], ['Tango', 'التانغو']),
    correct: ['a'],
    explanation: { en: 'Al-Ardah combines drums, poetry and swords, and is on UNESCO’s intangible heritage list.', ar: 'العرضة تجمع الطبول والشعر والسيوف، ومسجّلة في قائمة اليونسكو للتراث غير المادي.' },
    media: { emoji: '⚔️' },
    difficulty: 'medium',
    active: true,
    reviewed: false,
  },
  {
    id: 'final-heritage-2',
    roomId: 'final',
    finalCategory: 'heritage',
    type: 'true_false',
    question: { en: 'Arabic is written from right to left.', ar: 'العربية تُكتب من اليمين لليسار.' },
    options: TF,
    correct: ['true'],
    explanation: { en: 'Arabic script runs right to left, and Arabic calligraphy is a celebrated art form.', ar: 'الخط العربي يُكتب من اليمين لليسار، وفن الخط العربي من الفنون العريقة.' },
    media: { emoji: '✍️' },
    difficulty: 'easy',
    active: true,
    reviewed: false,
  },
  {
    id: 'final-heritage-3',
    roomId: 'final',
    finalCategory: 'heritage',
    type: 'single',
    question: { en: 'Which bird is a treasured part of Saudi heritage, with festivals and competitions?', ar: 'أي طير جزء عزيز من التراث السعودي، وله مهرجانات ومسابقات؟' },
    options: opts(['The falcon', 'الصقر'], ['The penguin', 'البطريق'], ['The parrot', 'الببغاء'], ['The flamingo', 'الفلامنغو']),
    correct: ['a'],
    explanation: { en: 'Falconry is an ancient tradition, and festivals celebrate it every year.', ar: 'الصقارة تقليد عريق، وتُقام له مهرجانات كل سنة.' },
    media: { emoji: '🦅' },
    difficulty: 'easy',
    active: true,
    reviewed: false,
  },
  {
    id: 'final-modern-1',
    roomId: 'final',
    finalCategory: 'modern',
    type: 'single',
    question: { en: 'Riyadh Season is a huge yearly festival of…', ar: 'موسم الرياض مهرجان سنوي ضخم لـ…' },
    options: opts(['Entertainment', 'الترفيه'], ['Exams', 'الاختبارات'], ['Tax filing', 'تقديم الضرائب'], ['Silence', 'الصمت']),
    correct: ['a'],
    explanation: { en: 'Riyadh Season brings concerts, shows, sport and food events to the capital every year.', ar: 'موسم الرياض يجمع الحفلات والعروض والرياضة والمطاعم في العاصمة كل سنة.' },
    media: { emoji: '🎆' },
    difficulty: 'easy',
    active: true,
    reviewed: false,
  },
  {
    id: 'final-modern-2',
    roomId: 'final',
    finalCategory: 'modern',
    type: 'single',
    question: { en: 'NEOM is being developed in which part of Saudi Arabia?', ar: 'نيوم يُطوَّر في أي جزء من السعودية؟' },
    options: opts(['The northwest', 'الشمال الغربي'], ['The southeast', 'الجنوب الشرقي'], ['The centre', 'الوسط'], ['The Empty Quarter', 'الربع الخالي']),
    correct: ['a'],
    explanation: { en: 'NEOM sits in the Tabuk region in the northwest, along the Red Sea.', ar: 'نيوم في منطقة تبوك في الشمال الغربي على البحر الأحمر.' },
    media: { emoji: '🏙️' },
    difficulty: 'medium',
    active: true,
    reviewed: false,
  },
  {
    id: 'final-modern-3',
    roomId: 'final',
    finalCategory: 'modern',
    type: 'true_false',
    question: { en: 'Riyadh is the capital of Saudi Arabia.', ar: 'الرياض عاصمة السعودية.' },
    options: TF,
    correct: ['true'],
    explanation: { en: 'Riyadh is the capital and the Kingdom’s largest city.', ar: 'الرياض العاصمة وأكبر مدن المملكة.' },
    media: { emoji: '🏢' },
    difficulty: 'easy',
    active: true,
    reviewed: false,
  },
  {
    id: 'final-social-1',
    roomId: 'final',
    finalCategory: 'social-regions',
    type: 'single',
    question: { en: 'The Rub’ al Khali, the largest sand desert in the world, is better known as…', ar: 'الربع الخالي، أكبر صحراء رملية في العالم، يُعرف بالإنجليزية بـ…' },
    options: opts(['The Empty Quarter', 'الربع الخالي'], ['The Golden Valley', 'الوادي الذهبي'], ['The Blue Plains', 'السهول الزرقاء'], ['The Silent Sea', 'البحر الصامت']),
    correct: ['a'],
    explanation: { en: 'The Empty Quarter covers much of southern Saudi Arabia, with dunes over 200 m high.', ar: 'الربع الخالي يغطي جزءاً كبيراً من جنوب السعودية، وكثبانه تتجاوز ٢٠٠ متر.' },
    media: { emoji: '🏜️' },
    difficulty: 'easy',
    active: true,
    reviewed: false,
  },
  {
    id: 'final-social-2',
    roomId: 'final',
    finalCategory: 'social-regions',
    type: 'true_false',
    question: { en: 'Saudi Arabia has coastlines on both the Red Sea and the Arabian Gulf.', ar: 'السعودية لها سواحل على البحر الأحمر والخليج العربي.' },
    options: TF,
    correct: ['true'],
    explanation: { en: 'The Red Sea is to the west and the Arabian Gulf to the east.', ar: 'البحر الأحمر في الغرب والخليج العربي في الشرق.' },
    media: { emoji: '🌊' },
    difficulty: 'easy',
    active: true,
    reviewed: false,
  },
  {
    id: 'final-social-3',
    roomId: 'final',
    finalCategory: 'social-regions',
    type: 'single',
    question: { en: 'Which two days make up the weekend in Saudi Arabia?', ar: 'أي يومين هم عطلة نهاية الأسبوع في السعودية؟' },
    options: opts(['Friday and Saturday', 'الجمعة والسبت'], ['Sunday and Monday', 'الأحد والاثنين'], ['Tuesday and Wednesday', 'الثلاثاء والأربعاء'], ['Thursday only', 'الخميس بس']),
    correct: ['a'],
    explanation: { en: 'The weekend is Friday and Saturday, so Thursday night is the big night out!', ar: 'العطلة الجمعة والسبت، عشان كذا ليلة الخميس هي ليلة الطلعات!' },
    media: { emoji: '📆' },
    difficulty: 'easy',
    active: true,
    reviewed: false,
  },
];

export function getRoomDef(id: RoomId): RoomDef | undefined {
  return ROOMS.find((r) => r.id === id);
}
