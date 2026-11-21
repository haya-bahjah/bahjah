// مين أنا؟ (Who Am I?) -- the starter identity packs.
//
// Each identity speaks in the first person through six clues, hardest first
// (clue 1 is worth 600 points, clue 6 is worth 100). A clue never names the
// identity. `aliases` are the spellings a guess may match, in Arabic and
// English: full names, surnames people actually use, nicknames and common
// transliterations. They are compared after normalising (see
// ./match.ts), so case, spacing, punctuation, hamza forms, taa marbuta and
// a leading "ال" do not need their own entries.
//
// `image` is optional: a picture for the masked portrait, added per identity
// later. Without one the portrait is the glowing arch with the ؟.

export const PACKS = ['global', 'arab', 'fiction'] as const;
export type PackId = (typeof PACKS)[number];

export interface Identity {
  id: string;
  pack: PackId;
  ar: { name: string; clues: [string, string, string, string, string, string] };
  en: { name: string; clues: [string, string, string, string, string, string] };
  aliases: string[];
  image?: string;
}

export const IDENTITIES: Identity[] = [
  // --- Global icons --------------------------------------------------------
  {
    id: 'gl-einstein',
    pack: 'global',
    ar: {
      name: 'ألبرت أينشتاين',
      clues: [
        'عُرضت عليّ رئاسة دولة ذات مرة، فاعتذرت.',
        'عملت موظفاً في مكتب لتسجيل براءات الاختراع في مدينة برن.',
        'نلت جائزة نوبل، لكن ليس عن أشهر أفكاري.',
        'وُلدت في ألمانيا عام ١٨٧٩، ومتّ في برينستون الأمريكية.',
        'صورتي وأنا أُخرج لساني من أشهر الصور في العالم.',
        'معادلتي الشهيرة: E = mc².',
      ],
    },
    en: {
      name: 'Albert Einstein',
      clues: [
        'I was once offered the presidency of a country, and I said no.',
        'I worked as a clerk in a patent office in Bern.',
        'I won a Nobel Prize, but not for my most famous idea.',
        'I was born in Germany in 1879 and died in Princeton.',
        'A photo of me sticking my tongue out is world famous.',
        'My famous equation is E = mc².',
      ],
    },
    aliases: ['albert einstein', 'einstein', 'ألبرت أينشتاين', 'أينشتاين', 'اينشتاين', 'آينشتاين', 'انشتاين', 'ألبرت اينشتين', 'اينشتين'],
  },
  {
    id: 'gl-davinci',
    pack: 'global',
    ar: {
      name: 'ليوناردو دافنشي',
      clues: [
        'كتبت كثيراً من ملاحظاتي بخط معكوس لا يُقرأ إلا في المرآة.',
        'رسمت آلات طائرة قبل اختراع الطائرة بقرون.',
        'اسمي مأخوذ من بلدة صغيرة في توسكانا وُلدت فيها.',
        'رسمت «العشاء الأخير» على جدار دير في ميلانو.',
        'أشهر لوحاتي معلّقة خلف زجاج في متحف اللوفر.',
        'أنا رسام الموناليزا.',
      ],
    },
    en: {
      name: 'Leonardo da Vinci',
      clues: [
        'I wrote many of my notes in mirror writing.',
        'I designed flying machines centuries before the aeroplane.',
        'My name comes from the small Tuscan town where I was born.',
        'I painted The Last Supper on a monastery wall in Milan.',
        'My most famous portrait hangs behind glass in the Louvre.',
        'I painted the Mona Lisa.',
      ],
    },
    aliases: ['leonardo da vinci', 'da vinci', 'davinci', 'leonardo', 'ليوناردو دافنشي', 'دافنشي', 'دا فينشي', 'دافينشي', 'ليوناردو', 'ليوناردو دا فينشي'],
  },
  {
    id: 'gl-ronaldo',
    pack: 'global',
    ar: {
      name: 'كريستيانو رونالدو',
      clues: [
        'وُلدت في جزيرة ماديرا.',
        'سمّاني أبي على اسم رئيس أمريكي.',
        'فزت بدوري أبطال أوروبا خمس مرات.',
        'لعبت لمانشستر يونايتد وريال مدريد ويوفنتوس.',
        'في عام ٢٠٢٣ انضممت إلى نادي النصر في الرياض.',
        'احتفالي «سيييي!» والناس يسمّونني CR7.',
      ],
    },
    en: {
      name: 'Cristiano Ronaldo',
      clues: [
        'I was born on the island of Madeira.',
        'My father named me after an American president.',
        'I have won the Champions League five times.',
        'I played for Manchester United, Real Madrid and Juventus.',
        'In 2023 I joined Al Nassr in Riyadh.',
        'My celebration is "Siuuu!" and people call me CR7.',
      ],
    },
    aliases: ['cristiano ronaldo', 'ronaldo', 'cristiano', 'cr7', 'كريستيانو رونالدو', 'رونالدو', 'كريستيانو', 'كرستيانو رونالدو', 'كرستيانو'],
  },
  {
    id: 'gl-messi',
    pack: 'global',
    ar: {
      name: 'ليونيل ميسي',
      clues: [
        'احتجت وأنا طفل إلى علاج لنقص هرمون النمو.',
        'انتقلت إلى إسبانيا في الثالثة عشرة، ووُقّع أول عقد لي على منديل ورقي.',
        'فزت بالكرة الذهبية ثماني مرات.',
        'وُلدت في مدينة روساريو.',
        'قضيت معظم مسيرتي في برشلونة، ثم باريس سان جيرمان وإنتر ميامي.',
        'قدت الأرجنتين إلى لقب كأس العالم ٢٠٢٢ في قطر.',
      ],
    },
    en: {
      name: 'Lionel Messi',
      clues: [
        'As a child I needed treatment for a growth hormone condition.',
        'I moved to Spain at 13, and my first contract was signed on a paper napkin.',
        "I have won the Ballon d'Or eight times.",
        'I was born in Rosario.',
        'I spent most of my career at Barcelona, then PSG and Inter Miami.',
        'I captained Argentina to the 2022 World Cup title in Qatar.',
      ],
    },
    aliases: ['lionel messi', 'messi', 'leo messi', 'leo', 'ليونيل ميسي', 'ميسي', 'ليو ميسي', 'ليو', 'مسي'],
  },
  {
    id: 'gl-shakespeare',
    pack: 'global',
    ar: {
      name: 'وليم شكسبير',
      clues: [
        'تركت لزوجتي في وصيتي «ثاني أفضل سرير».',
        'وُلدت ومتّ في بلدة ستراتفورد أبون آفون.',
        'كنت ممثلاً في فرقة بنت مسرح «الغلوب».',
        'كتبت نحو ٣٧ مسرحية و١٥٤ قصيدة سونيت.',
        'إحدى شخصياتي تسأل: «أكون أو لا أكون».',
        'أنا كاتب «روميو وجولييت».',
      ],
    },
    en: {
      name: 'William Shakespeare',
      clues: [
        'In my will I left my wife my "second-best bed".',
        'I was born and died in Stratford-upon-Avon.',
        'I acted in a company that built the Globe Theatre.',
        'I wrote around 37 plays and 154 sonnets.',
        'One of my characters asks, "To be, or not to be".',
        'I wrote Romeo and Juliet.',
      ],
    },
    aliases: ['william shakespeare', 'shakespeare', 'وليم شكسبير', 'ويليام شكسبير', 'شكسبير', 'شيكسبير', 'وليام شكسبير'],
  },
  {
    id: 'gl-curie',
    pack: 'global',
    ar: {
      name: 'ماري كوري',
      clues: [
        'دفاتري ما زالت مشعّة إلى اليوم، ولا تُلمس إلا بملابس واقية.',
        'سمّيت عنصراً كيميائياً على اسم البلد الذي وُلدت فيه.',
        'أول شخص ينال جائزتي نوبل في علمين مختلفين.',
        'وُلدت في وارسو، وعملت في باريس.',
        'تقاسمت أول جائزة نوبل لي مع زوجي بيير.',
        'أنا أشهر عالمة في التاريخ، رائدة أبحاث النشاط الإشعاعي.',
      ],
    },
    en: {
      name: 'Marie Curie',
      clues: [
        'My notebooks are still radioactive and can only be handled in protective gear.',
        'I named a chemical element after the country I was born in.',
        'I was the first person to win Nobel Prizes in two different sciences.',
        'I was born in Warsaw and worked in Paris.',
        'I shared my first Nobel Prize with my husband, Pierre.',
        'I am the most famous woman scientist, a pioneer of radioactivity.',
      ],
    },
    aliases: ['marie curie', 'curie', 'madame curie', 'ماري كوري', 'كوري', 'مدام كوري'],
  },
  {
    id: 'gl-mjackson',
    pack: 'global',
    ar: {
      name: 'مايكل جاكسون',
      clues: [
        'بدأت الغناء طفلاً مع أربعة من إخوتي.',
        'كانت لي مزرعة اسمها «نيفرلاند».',
        'ألبومي «ثريلر» هو الأكثر مبيعاً في التاريخ.',
        'اشتهرت بقفاز أبيض لامع في يد واحدة.',
        'أنا من جعل رقصة «المشي على القمر» مشهورة.',
        'لقّبوني بملك البوب.',
      ],
    },
    en: {
      name: 'Michael Jackson',
      clues: [
        'I started singing as a child with four of my brothers.',
        'I owned a ranch called Neverland.',
        'My album Thriller is the best-selling album of all time.',
        'I was known for one sparkly white glove.',
        'I made the moonwalk famous.',
        'They called me the King of Pop.',
      ],
    },
    aliases: ['michael jackson', 'jackson', 'mj', 'مايكل جاكسون', 'جاكسون', 'مايكل'],
  },
  {
    id: 'gl-jobs',
    pack: 'global',
    ar: {
      name: 'ستيف جوبز',
      clues: [
        'كنت طفلاً متبنّى، وتركت الجامعة بعد فصل دراسي واحد.',
        'أُخرجت من الشركة التي شاركت في تأسيسها، ثم عدت إليها بعد سنوات.',
        'أدرت أيضاً استوديو «بيكسار» صاحب فيلم «حكاية لعبة».',
        'كنت أظهر على المسرح بقميص أسود ذي ياقة عالية وبنطال جينز.',
        'قدّمت أول آيفون عام ٢٠٠٧.',
        'شاركت في تأسيس شركة «أبل».',
      ],
    },
    en: {
      name: 'Steve Jobs',
      clues: [
        'I was adopted, and I dropped out of college after one semester.',
        'I was pushed out of the company I co-founded, then came back years later.',
        'I also ran Pixar, the studio behind Toy Story.',
        'On stage I wore a black turtleneck and jeans.',
        'I introduced the first iPhone in 2007.',
        'I co-founded Apple.',
      ],
    },
    aliases: ['steve jobs', 'jobs', 'ستيف جوبز', 'جوبز', 'ستيف جوبس'],
  },
  {
    id: 'gl-musk',
    pack: 'global',
    ar: {
      name: 'إيلون ماسك',
      clues: [
        'وُلدت في بريتوريا بجنوب أفريقيا.',
        'بعت حصتي في شركة دفع إلكتروني ساعدت في بنائها.',
        'أريد أن يعيش البشر على المريخ.',
        'صواريخي تعود وتهبط على الأرض بنفسها.',
        'اشتريت «تويتر» وغيّرت اسمه إلى X.',
        'أقود شركتي «تسلا» و«سبيس إكس».',
      ],
    },
    en: {
      name: 'Elon Musk',
      clues: [
        'I was born in Pretoria, South Africa.',
        'I sold my share of an online payments company I helped build.',
        'I want people to live on Mars.',
        'My rockets fly back and land themselves.',
        'I bought Twitter and renamed it X.',
        'I lead Tesla and SpaceX.',
      ],
    },
    aliases: ['elon musk', 'musk', 'elon', 'إيلون ماسك', 'ايلون ماسك', 'ماسك', 'إيلون', 'ايلون'],
  },
  {
    id: 'gl-mandela',
    pack: 'global',
    ar: {
      name: 'نيلسون مانديلا',
      clues: [
        'اسمي عند الولادة «روليهلاهلا».',
        'قضيت ٢٧ عاماً في السجن.',
        'تقاسمت جائزة نوبل للسلام عام ١٩٩٣.',
        'يوم ميلادي، ١٨ يوليو، صار يوماً دولياً.',
        'ناضلت ضد نظام الفصل العنصري.',
        'أول رئيس أسود لجنوب أفريقيا.',
      ],
    },
    en: {
      name: 'Nelson Mandela',
      clues: [
        'My birth name was Rolihlahla.',
        'I spent 27 years in prison.',
        'I shared the Nobel Peace Prize in 1993.',
        'My birthday, 18 July, became an international day.',
        'I fought against apartheid.',
        "I was South Africa's first Black president.",
      ],
    },
    aliases: ['nelson mandela', 'mandela', 'madiba', 'نيلسون مانديلا', 'مانديلا', 'ماديبا'],
  },
  {
    id: 'gl-ali',
    pack: 'global',
    ar: {
      name: 'محمد علي كلاي',
      clues: [
        'وُلدت باسم كاسيوس كلاي.',
        'فزت بذهبية أولمبية في روما عام ١٩٦٠.',
        'أوقدت الشعلة الأولمبية في أتلانتا عام ١٩٩٦.',
        'نزالي في كينشاسا سُمّي «قتال في الأدغال».',
        'قلت: «أطير كالفراشة وألسع كالنحلة».',
        'أنا «الأعظم» في تاريخ الملاكمة.',
      ],
    },
    en: {
      name: 'Muhammad Ali',
      clues: [
        'I was born Cassius Clay.',
        'I won Olympic gold in Rome in 1960.',
        'I lit the Olympic flame in Atlanta in 1996.',
        'My fight in Kinshasa was called the "Rumble in the Jungle".',
        'I said I could "float like a butterfly, sting like a bee".',
        'I am "The Greatest" boxer of all time.',
      ],
    },
    aliases: ['muhammad ali', 'mohammed ali', 'mohamed ali', 'ali', 'cassius clay', 'محمد علي كلاي', 'محمد علي', 'كلاي', 'كاسيوس كلاي'],
  },
  {
    id: 'gl-disney',
    pack: 'global',
    ar: {
      name: 'والت ديزني',
      clues: [
        'وُلدت في شيكاغو، وكبرت في مزرعة بولاية ميزوري.',
        'نلت جوائز أوسكار أكثر من أي شخص آخر.',
        'صنعت أول فيلم رسوم متحركة طويل عن أميرة وسبعة أصدقاء صغار.',
        'افتتحت أول مدينة ملاهٍ لي في كاليفورنيا عام ١٩٥٥.',
        'كنت أول صوت لفأر مشهور.',
        'اسمي على شعار القلعة لشركة ترفيه عملاقة.',
      ],
    },
    en: {
      name: 'Walt Disney',
      clues: [
        'I was born in Chicago and grew up on a farm in Missouri.',
        'I won more Academy Awards than anyone else.',
        'I made the first full-length animated film, about a princess and seven small friends.',
        'I opened my first theme park in California in 1955.',
        'I was the first voice of a famous mouse.',
        "My name is on a giant entertainment company's castle logo.",
      ],
    },
    aliases: ['walt disney', 'disney', 'walt', 'والت ديزني', 'ديزني', 'والت'],
  },
  {
    id: 'gl-newton',
    pack: 'global',
    ar: {
      name: 'إسحاق نيوتن',
      clues: [
        'عملت مسؤولاً عن دار سكّ العملة الملكية في لندن.',
        'صنعت أول تلسكوب عاكس عملي.',
        'كتبت كتاب «المبادئ».',
        'حلّلت الضوء الأبيض إلى ألوان بمنشور زجاجي.',
        'قوانيني الثلاثة تصف الحركة.',
        'تفاحة سقطت جعلتني أفكّر في الجاذبية.',
      ],
    },
    en: {
      name: 'Isaac Newton',
      clues: [
        'I was in charge of the Royal Mint in London.',
        'I built the first practical reflecting telescope.',
        'I wrote the Principia.',
        'I split white light into colours with a prism.',
        'My three laws describe motion.',
        'A falling apple got me thinking about gravity.',
      ],
    },
    aliases: ['isaac newton', 'newton', 'إسحاق نيوتن', 'اسحاق نيوتن', 'نيوتن', 'إسحق نيوتن'],
  },
  {
    id: 'gl-bolt',
    pack: 'global',
    ar: {
      name: 'يوسين بولت',
      clues: [
        'لعبت الكريكت قبل أن أتّجه إلى ألعاب القوى.',
        'وُلدت في منطقة تريلوني في جامايكا.',
        'فزت بثماني ميداليات ذهبية أولمبية.',
        'أحمل الرقم القياسي العالمي لسباق ١٠٠ متر: ٩٫٥٨ ثانية.',
        'وقفتي الشهيرة أشير فيها إلى السماء كالبرق.',
        'أنا أسرع رجل في التاريخ.',
      ],
    },
    en: {
      name: 'Usain Bolt',
      clues: [
        'I played cricket before I turned to athletics.',
        'I was born in Trelawny, Jamaica.',
        'I won eight Olympic gold medals.',
        'I hold the 100 m world record: 9.58 seconds.',
        'My famous pose points to the sky like lightning.',
        'I am the fastest man in history.',
      ],
    },
    aliases: ['usain bolt', 'bolt', 'usain', 'يوسين بولت', 'اوسين بولت', 'أوسين بولت', 'بولت', 'يوسين'],
  },
  {
    id: 'gl-picasso',
    pack: 'global',
    ar: {
      name: 'بابلو بيكاسو',
      clues: [
        'اسمي الكامل يتكوّن من أكثر من عشرين كلمة.',
        'مررت بمرحلة زرقاء ثم مرحلة وردية.',
        'وُلدت في مالقة بإسبانيا.',
        'رسمت لوحة «غيرنيكا».',
        'شاركت في تأسيس المدرسة التكعيبية.',
        'أشهر رسام في القرن العشرين، ووجوه لوحاتي مصنوعة من أشكال هندسية.',
      ],
    },
    en: {
      name: 'Pablo Picasso',
      clues: [
        'My full name has more than twenty words.',
        'I went through a Blue Period and a Rose Period.',
        'I was born in Málaga, Spain.',
        'I painted Guernica.',
        'I co-founded Cubism.',
        "I'm the most famous painter of the 20th century; my faces are made of shapes.",
      ],
    },
    aliases: ['pablo picasso', 'picasso', 'pablo', 'بابلو بيكاسو', 'بيكاسو', 'بابلو'],
  },
  {
    id: 'gl-swift',
    pack: 'global',
    ar: {
      name: 'تايلور سويفت',
      clues: [
        'كبرت في مزرعة لأشجار عيد الميلاد في ولاية بنسلفانيا.',
        'أعدت تسجيل ألبوماتي القديمة لأمتلك حقوقها.',
        'رقم حظي هو ١٣.',
        'معجبيّ يُسمّون «سويفتيز».',
        'جولتي «إيراز» أصبحت الأعلى دخلاً في التاريخ.',
        'غنّيت «شيك إت أوف».',
      ],
    },
    en: {
      name: 'Taylor Swift',
      clues: [
        'I grew up on a Christmas tree farm in Pennsylvania.',
        'I re-recorded my old albums so I would own them.',
        'My lucky number is 13.',
        'My fans are called Swifties.',
        'My Eras Tour became the highest-grossing tour ever.',
        'I sang "Shake It Off".',
      ],
    },
    aliases: ['taylor swift', 'taylor', 'swift', 'تايلور سويفت', 'تايلر سويفت', 'تايلور', 'سويفت'],
  },
  {
    id: 'gl-chaplin',
    pack: 'global',
    ar: {
      name: 'تشارلي تشابلن',
      clues: [
        'وُلدت في لندن ونشأت في فقر شديد.',
        'شاركت في تأسيس شركة الإنتاج «يونايتد آرتستس».',
        'سخرت من هتلر في فيلم «الديكتاتور العظيم».',
        'واصلت صنع أفلام صامتة بعد ظهور السينما الناطقة.',
        'شخصيتي الشهيرة هي «المتشرّد».',
        'قبّعة مستديرة وعصا وشارب صغير: نجم الكوميديا الصامتة.',
      ],
    },
    en: {
      name: 'Charlie Chaplin',
      clues: [
        'I was born in London and grew up very poor.',
        'I co-founded the film studio United Artists.',
        'I mocked Hitler in The Great Dictator.',
        'I kept making silent films after sound arrived.',
        'My famous character is The Tramp.',
        'Bowler hat, cane and a small moustache: the star of silent comedy.',
      ],
    },
    aliases: ['charlie chaplin', 'chaplin', 'charlot', 'تشارلي تشابلن', 'شارلي شابلن', 'تشابلن', 'شابلن', 'شارلو', 'تشارلي شابلن'],
  },
  {
    id: 'gl-armstrong',
    pack: 'global',
    ar: {
      name: 'نيل آرمسترونغ',
      clues: [
        'شاركت في مهمات قتالية في الحرب الكورية.',
        'أول رحلة فضائية لي كانت «جيميني ٨».',
        'انطلقت رحلتي الأشهر في يوليو ١٩٦٩.',
        'بقي زميلي مايكل كولينز في المدار بينما نزلت.',
        'قلت: «إنها خطوة صغيرة لإنسان…».',
        'أول إنسان يمشي على سطح القمر.',
      ],
    },
    en: {
      name: 'Neil Armstrong',
      clues: [
        'I flew combat missions in the Korean War.',
        'My first spaceflight was Gemini 8.',
        'My most famous mission launched in July 1969.',
        'Michael Collins stayed in orbit while I went down.',
        'I said, "That\'s one small step for man…".',
        'I was the first person to walk on the Moon.',
      ],
    },
    aliases: ['neil armstrong', 'armstrong', 'نيل آرمسترونغ', 'نيل ارمسترونغ', 'نيل ارمسترونج', 'آرمسترونغ', 'ارمسترونغ', 'ارمسترونج'],
  },
  {
    id: 'gl-gandhi',
    pack: 'global',
    ar: {
      name: 'المهاتما غاندي',
      clues: [
        'درست المحاماة في لندن.',
        'عشت في جنوب أفريقيا ٢١ عاماً.',
        'قدت «مسيرة الملح» عام ١٩٣٠.',
        'كنت أغزل قماش ملابسي بنفسي.',
        'قدت استقلال الهند باللاعنف.',
        'يلقّبونني «المهاتما».',
      ],
    },
    en: {
      name: 'Mahatma Gandhi',
      clues: [
        'I trained as a lawyer in London.',
        'I lived in South Africa for 21 years.',
        'I led the Salt March in 1930.',
        'I spun the cloth for my own clothes.',
        "I led India's independence movement through non-violence.",
        'People call me Mahatma.',
      ],
    },
    aliases: ['mahatma gandhi', 'gandhi', 'mahatma', 'المهاتما غاندي', 'مهاتما غاندي', 'غاندي', 'المهاتما'],
  },
  {
    id: 'gl-edison',
    pack: 'global',
    ar: {
      name: 'توماس إديسون',
      clues: [
        'علّمتني أمي في البيت بعد أشهر قليلة في المدرسة.',
        'أسّست «مصنع اختراعات» في مينلو بارك.',
        'سجّلت أكثر من ألف براءة اختراع في أمريكا.',
        'اخترعت الفونوغراف لتسجيل الصوت.',
        'جعلت المصباح الكهربائي عملياً في البيوت.',
        'يسمّونني مخترع المصباح الكهربائي.',
      ],
    },
    en: {
      name: 'Thomas Edison',
      clues: [
        'My mother taught me at home after a few months at school.',
        'I set up an "invention factory" in Menlo Park.',
        'I held more than a thousand US patents.',
        'I invented the phonograph to record sound.',
        'I made the electric light bulb practical for homes.',
        'People call me the inventor of the light bulb.',
      ],
    },
    aliases: ['thomas edison', 'edison', 'توماس إديسون', 'توماس اديسون', 'إديسون', 'اديسون'],
  },

  // --- Arab & Saudi icons --------------------------------------------------
  {
    id: 'ar-salah',
    pack: 'arab',
    ar: {
      name: 'محمد صلاح',
      clues: [
        'كنت أسافر ساعات بالحافلة كل يوم لأتدرّب وأنا صغير.',
        'وُلدت في قرية نجريج في مصر.',
        'لعبت لبازل وتشيلسي وفيورنتينا وروما.',
        'فزت بدوري أبطال أوروبا عام ٢٠١٩.',
        'الجماهير تلقّبني «الملك المصري».',
        'نجم ليفربول المصري.',
      ],
    },
    en: {
      name: 'Mohamed Salah',
      clues: [
        'As a boy I spent hours on buses every day to get to training.',
        'I was born in Nagrig, a village in Egypt.',
        'I played for Basel, Chelsea, Fiorentina and Roma.',
        'I won the Champions League in 2019.',
        'Fans call me the Egyptian King.',
        "I am Liverpool's Egyptian star.",
      ],
    },
    aliases: ['mohamed salah', 'mohammed salah', 'mo salah', 'salah', 'محمد صلاح', 'صلاح', 'مو صلاح'],
  },
  {
    id: 'ar-umkulthum',
    pack: 'arab',
    ar: {
      name: 'أم كلثوم',
      clues: [
        'بدأت الغناء صغيرة متنكّرة في زيّ صبي مع فرقة أبي.',
        'حفلاتي في الخميس الأول من كل شهر كانت تُذاع في العالم العربي كله.',
        'كنت أمسك منديلاً بيدي على المسرح دائماً.',
        'لحّن لي محمد عبد الوهاب أغنية «إنت عمري».',
        'لقّبوني «كوكب الشرق».',
        'أشهر مطربة في تاريخ مصر، صوتي في كل مقهى عربي.',
      ],
    },
    en: {
      name: 'Umm Kulthum',
      clues: [
        "I started singing as a girl dressed as a boy, in my father's troupe.",
        'My first-Thursday concerts were broadcast across the Arab world.',
        'I always held a handkerchief on stage.',
        'Mohammed Abdel Wahab composed my song "Enta Omri" for me.',
        'They call me the Star of the East.',
        "Egypt's most famous singer; you'll hear me in any Arab café.",
      ],
    },
    aliases: ['umm kulthum', 'om kalthoum', 'oum kalthoum', 'umm kalthoum', 'um kulthum', 'om kolthoum', 'أم كلثوم', 'ام كلثوم', 'ثومة', 'كوكب الشرق'],
  },
  {
    id: 'ar-fairuz',
    pack: 'arab',
    ar: {
      name: 'فيروز',
      clues: [
        'اسمي الحقيقي نهاد حداد.',
        'عملت مع الأخوين رحباني، وتزوّجت أحدهما.',
        'كثير من العرب يسمعونني كل صباح.',
        'غنّيت «زهرة المدائن» للقدس.',
        'يلقّبونني «سفيرتنا إلى النجوم».',
        'أحبّ مطربة في لبنان، صوت الصباح.',
      ],
    },
    en: {
      name: 'Fairuz',
      clues: [
        'My real name is Nouhad Haddad.',
        'I worked with the Rahbani brothers and married one of them.',
        'Many Arabs listen to me every morning.',
        'I sang "Zahrat al-Madaen" for Jerusalem.',
        'They call me "our ambassador to the stars".',
        "Lebanon's best-loved singer, the voice of the morning.",
      ],
    },
    aliases: ['fairuz', 'fayrouz', 'fairouz', 'feyrouz', 'فيروز', 'فيروزه'],
  },
  {
    id: 'ar-abdu',
    pack: 'arab',
    ar: {
      name: 'محمد عبده',
      clues: [
        'وُلدت في الدرب بمنطقة جازان.',
        'غنّيت كثيراً من قصائد الأمير الشاعر بدر بن عبد المحسن.',
        'من أحبّ أغنياتي «الأماكن».',
        'عودي وصوتي على المسارح السعودية منذ أكثر من خمسين عاماً.',
        'يلقّبونني «فنان العرب».',
        'أشهر مطرب سعودي.',
      ],
    },
    en: {
      name: 'Mohammed Abdu',
      clues: [
        'I was born in Al-Darb, in the Jazan region.',
        'I have sung many poems by the poet Prince Badr bin Abdulmohsen.',
        'One of my best-loved songs is "Al-Amaken".',
        'My oud and my voice have filled Saudi stages for over fifty years.',
        'They call me the Artist of the Arabs.',
        "I'm Saudi Arabia's most famous singer.",
      ],
    },
    aliases: ['mohammed abdu', 'mohamed abdu', 'mohammad abdu', 'mohammed abdo', 'abdu', 'محمد عبده', 'عبده', 'فنان العرب'],
  },
  {
    id: 'ar-battuta',
    pack: 'arab',
    ar: {
      name: 'ابن بطوطة',
      clues: [
        'وُلدت في طنجة عام ١٣٠٤.',
        'عملت قاضياً في جزر المالديف.',
        'قطعت نحو ١٢٠ ألف كيلومتر في حياتي.',
        'دُوّنت أسفاري في كتاب اسمه «الرحلة».',
        'خرجت لأداء الحج، وواصلت السفر قرابة ثلاثين عاماً.',
        'أشهر رحّالة عربي في التاريخ.',
      ],
    },
    en: {
      name: 'Ibn Battuta',
      clues: [
        'I was born in Tangier in 1304.',
        'I served as a judge in the Maldives.',
        'I travelled about 120,000 km in my lifetime.',
        'My travels were written down in a book called the Rihla.',
        'I left to perform Hajj and kept travelling for nearly thirty years.',
        'I am the most famous Arab traveller in history.',
      ],
    },
    aliases: ['ibn battuta', 'ibn batuta', 'ibn battutah', 'battuta', 'ابن بطوطة', 'ابن بطوطه', 'بطوطة'],
  },
  {
    id: 'ar-ibnsina',
    pack: 'arab',
    ar: {
      name: 'ابن سينا',
      clues: [
        'حفظت القرآن وأنا في العاشرة.',
        'وُلدت قرب بخارى.',
        'الأوروبيون سمّوني «أفيسينا».',
        'كتابي «القانون في الطب» دُرّس في أوروبا قروناً.',
        'كنت فيلسوفاً وطبيباً، ولقّبوني «الشيخ الرئيس».',
        'أشهر طبيب في التاريخ الإسلامي.',
      ],
    },
    en: {
      name: 'Ibn Sina',
      clues: [
        'I had memorised the Quran by the age of ten.',
        'I was born near Bukhara.',
        'Europeans called me Avicenna.',
        'My Canon of Medicine was taught in Europe for centuries.',
        'I was a philosopher and a physician.',
        'I am the most famous physician in Islamic history.',
      ],
    },
    aliases: ['ibn sina', 'avicenna', 'ابن سينا', 'الشيخ الرئيس', 'ابن سيناء'],
  },
  {
    id: 'ar-khwarizmi',
    pack: 'arab',
    ar: {
      name: 'الخوارزمي',
      clues: [
        'عملت في بيت الحكمة ببغداد.',
        'عشت في عهد الخليفة المأمون.',
        'كتبت من أوائل الكتب عن الأرقام الهندية العربية.',
        'كلمة «الجبر» في كل لغات العالم جاءت من عنوان كتابي.',
        'يلقّبونني «أبو الجبر».',
        'كلمة «خوارزمية» التي تستخدمها الحواسيب مأخوذة من اسمي.',
      ],
    },
    en: {
      name: 'Al-Khwarizmi',
      clues: [
        'I worked at the House of Wisdom in Baghdad.',
        'I lived in the time of Caliph al-Mamun.',
        'I wrote one of the first books on Hindu-Arabic numerals.',
        'The word "algebra" comes from the title of my book.',
        "I'm called the father of algebra.",
        'The word "algorithm" comes from my name.',
      ],
    },
    aliases: ['al-khwarizmi', 'al khwarizmi', 'khwarizmi', 'alkhwarizmi', 'al-khawarizmi', 'الخوارزمي', 'خوارزمي', 'محمد بن موسى الخوارزمي'],
  },
  {
    id: 'ar-amrdiab',
    pack: 'arab',
    ar: {
      name: 'عمرو دياب',
      clues: [
        'وُلدت في بورسعيد.',
        'أغنيتي «نور العين» اشتهرت حتى خارج العالم العربي.',
        'فزت بجائزة الموسيقى العالمية أكثر من مرة.',
        'الجمهور يلقّبني «الهضبة».',
        'نجم بوب منذ الثمانينيات، ويقولون إني لا أكبر.',
        'أكبر نجوم البوب في مصر والعالم العربي.',
      ],
    },
    en: {
      name: 'Amr Diab',
      clues: [
        'I was born in Port Said.',
        'My song "Nour El Ein" became a hit far beyond the Arab world.',
        'I have won the World Music Award more than once.',
        'Fans call me El Hadaba, "the Plateau".',
        "I've been a pop star since the 1980s, and people say I never age.",
        "I'm the biggest pop star in Egypt and the Arab world.",
      ],
    },
    aliases: ['amr diab', 'amr', 'diab', 'عمرو دياب', 'عمرو', 'دياب', 'الهضبة'],
  },
  {
    id: 'ar-samijaber',
    pack: 'arab',
    ar: {
      name: 'سامي الجابر',
      clues: [
        'لعبت أربع بطولات كأس عالم مع منتخب بلدي.',
        'لعبت فترة قصيرة مع وولفرهامبتون في إنجلترا.',
        'قضيت مسيرتي كلها تقريباً في نادٍ واحد في الرياض.',
        'أصبحت لاحقاً رئيساً لذلك النادي.',
        'كان رقم قميصي ٩ في الهلال.',
        'أسطورة الكرة السعودية ونجم الهلال.',
      ],
    },
    en: {
      name: 'Sami Al-Jaber',
      clues: [
        'I played at four World Cups for my country.',
        'I had a short spell at Wolverhampton in England.',
        'I spent almost my whole career at one club in Riyadh.',
        "I later became that club's president.",
        'I wore the number 9 shirt for Al Hilal.',
        'A Saudi football legend and Al Hilal star.',
      ],
    },
    aliases: ['sami al-jaber', 'sami al jaber', 'sami aljaber', 'sami jaber', 'al jaber', 'سامي الجابر', 'الجابر', 'سامي'],
  },
  {
    id: 'ar-mahfouz',
    pack: 'arab',
    ar: {
      name: 'نجيب محفوظ',
      clues: [
        'عملت موظفاً حكومياً معظم حياتي.',
        'نجوت من محاولة طعن عام ١٩٩٤.',
        'روايات ثلاثيتي تحمل أسماء شوارع في القاهرة.',
        'كتبت «أولاد حارتنا».',
        'أول كاتب بالعربية ينال جائزة نوبل للآداب.',
        'أشهر روائي مصري.',
      ],
    },
    en: {
      name: 'Naguib Mahfouz',
      clues: [
        'I worked as a civil servant for most of my life.',
        'I survived a stabbing attack in 1994.',
        'The novels of my trilogy are named after Cairo streets.',
        'I wrote "Children of the Alley".',
        'I was the first Arabic-language writer to win the Nobel Prize in Literature.',
        "I am Egypt's most famous novelist.",
      ],
    },
    aliases: ['naguib mahfouz', 'najib mahfouz', 'nagib mahfouz', 'mahfouz', 'نجيب محفوظ', 'محفوظ'],
  },
  {
    id: 'ar-saladin',
    pack: 'arab',
    ar: {
      name: 'صلاح الدين الأيوبي',
      clues: [
        'وُلدت في تكريت.',
        'أصولي كردية.',
        'أسّست الدولة الأيوبية.',
        'واجهت ريتشارد قلب الأسد.',
        'استعدت القدس عام ١١٨٧ بعد معركة حطين.',
        'السلطان الذي حرّر القدس.',
      ],
    },
    en: {
      name: 'Saladin',
      clues: [
        'I was born in Tikrit.',
        'My family was of Kurdish origin.',
        'I founded the Ayyubid dynasty.',
        'I faced Richard the Lionheart.',
        'I took back Jerusalem in 1187, after the Battle of Hattin.',
        'The sultan who liberated Jerusalem.',
      ],
    },
    aliases: ['saladin', 'salah ad-din', 'salah al-din', 'salahuddin', 'salah eddine', 'salah el din', 'صلاح الدين الأيوبي', 'صلاح الدين', 'صلاح الدين الايوبي'],
  },
  {
    id: 'ar-zahahadid',
    pack: 'arab',
    ar: {
      name: 'زها حديد',
      clues: [
        'درست الرياضيات في الجامعة الأمريكية في بيروت.',
        'وُلدت في بغداد.',
        'أول امرأة تنال جائزة بريتزكر للعمارة.',
        'صمّمت مركز السباحة لأولمبياد لندن ٢٠١٢.',
        'مبانيّ تنساب بالمنحنيات بلا زوايا قائمة.',
        'أشهر معمارية عربية في العالم.',
      ],
    },
    en: {
      name: 'Zaha Hadid',
      clues: [
        'I studied mathematics at the American University of Beirut.',
        'I was born in Baghdad.',
        'I was the first woman to win the Pritzker Architecture Prize.',
        'I designed the aquatics centre for the London 2012 Olympics.',
        'My buildings flow in curves, with no right angles.',
        "I'm the world's most famous Arab architect.",
      ],
    },
    aliases: ['zaha hadid', 'zaha', 'hadid', 'زها حديد', 'زها', 'حديد'],
  },
  {
    id: 'ar-adelimam',
    pack: 'arab',
    ar: {
      name: 'عادل إمام',
      clues: [
        'درست الزراعة في جامعة القاهرة.',
        'مثّلت في مسرحية «مدرسة المشاغبين».',
        'فيلمي «عمارة يعقوبيان» مأخوذ عن رواية شهيرة.',
        'يلقّبونني «الزعيم».',
        'نجم الكوميديا الأول في السينما المصرية لعقود.',
        'أشهر ممثل كوميدي في مصر.',
      ],
    },
    en: {
      name: 'Adel Emam',
      clues: [
        'I studied agriculture at Cairo University.',
        'I acted in the play "Madraset El Moshaghebeen".',
        'My film "The Yacoubian Building" was based on a famous novel.',
        'They call me El Zaeem, "the Leader".',
        'For decades I was the top comedy star of Egyptian cinema.',
        "I am Egypt's most famous comic actor.",
      ],
    },
    aliases: ['adel emam', 'adel imam', 'adel', 'emam', 'عادل إمام', 'عادل امام', 'الزعيم'],
  },
  {
    id: 'ar-nancy',
    pack: 'arab',
    ar: {
      name: 'نانسي عجرم',
      clues: [
        'فزت في برنامج مواهب على التلفزيون اللبناني وأنا طفلة.',
        'كنت سفيرة لليونيسف.',
        'غنّيت كثيراً من الأغاني للأطفال.',
        'أغنيتي «أخاصمك آه» حققت نجاحاً ضخماً.',
        'من أشهر أغنياتي «آه ونص».',
        'من أكبر نجمات البوب في لبنان.',
      ],
    },
    en: {
      name: 'Nancy Ajram',
      clues: [
        'I won a talent show on Lebanese TV as a child.',
        'I have been a UNICEF ambassador.',
        "I've sung many songs for children.",
        'My song "Akhasmak Ah" was a huge hit.',
        'One of my best-known songs is "Ah W Noss".',
        "I'm one of Lebanon's biggest pop stars.",
      ],
    },
    aliases: ['nancy ajram', 'nancy', 'ajram', 'نانسي عجرم', 'نانسي', 'عجرم'],
  },
  {
    id: 'ar-barnawi',
    pack: 'arab',
    ar: {
      name: 'ريانة برناوي',
      clues: [
        'أنا باحثة في الخلايا الجذعية وأبحاث السرطان.',
        'سافرت ضمن مهمة «أكسيوم ٢».',
        'قضيت نحو عشرة أيام على محطة الفضاء الدولية عام ٢٠٢٣.',
        'رافقني في رحلتي زميلي علي القرني.',
        'أجريت تجارب علمية في الفضاء لصالح بلدي.',
        'أول امرأة سعودية تصعد إلى الفضاء.',
      ],
    },
    en: {
      name: 'Rayyanah Barnawi',
      clues: [
        'I research stem cells and cancer.',
        'I flew on the Axiom Mission 2.',
        'In 2023 I spent about ten days on the International Space Station.',
        'My colleague Ali AlQarni flew with me.',
        'I carried out science experiments in space for my country.',
        'The first Saudi woman to go to space.',
      ],
    },
    aliases: ['rayyanah barnawi', 'rayyana barnawi', 'rayana barnawi', 'barnawi', 'rayyanah', 'ريانة برناوي', 'ريانه برناوي', 'برناوي', 'ريانة'],
  },
  {
    id: 'ar-mutanabbi',
    pack: 'arab',
    ar: {
      name: 'المتنبي',
      clues: [
        'وُلدت في الكوفة.',
        'لقبي يعني «مدّعي النبوة».',
        'مدحت سيف الدولة في حلب.',
        'قُتلت في الطريق، وقيل إن بيتاً من شعري كان السبب.',
        'قلت: «الخيل والليل والبيداء تعرفني».',
        'أعظم شعراء العرب.',
      ],
    },
    en: {
      name: 'Al-Mutanabbi',
      clues: [
        'I was born in Kufa.',
        'My title means "the one who claimed to be a prophet".',
        'I praised Sayf al-Dawla in Aleppo.',
        'I was killed on the road; some say one of my own verses was to blame.',
        'I wrote, "The horse, the night and the desert know me".',
        'The greatest of the classical Arab poets.',
      ],
    },
    aliases: ['al-mutanabbi', 'al mutanabbi', 'mutanabbi', 'almutanabbi', 'المتنبي', 'متنبي', 'أبو الطيب المتنبي', 'ابو الطيب'],
  },
  {
    id: 'ar-ibnkhaldun',
    pack: 'arab',
    ar: {
      name: 'ابن خلدون',
      clues: [
        'وُلدت في تونس عام ١٣٣٢.',
        'عملت قاضياً في القاهرة.',
        'التقيت تيمورلنك خارج دمشق.',
        'أشهر كتبي «المقدّمة».',
        'يعدّونني مؤسس علم الاجتماع.',
        'أشهر مؤرخ عربي.',
      ],
    },
    en: {
      name: 'Ibn Khaldun',
      clues: [
        'I was born in Tunis in 1332.',
        'I served as a judge in Cairo.',
        'I met Timur outside Damascus.',
        'My most famous book is the Muqaddimah.',
        "I'm seen as a founder of sociology.",
        'The most famous Arab historian.',
      ],
    },
    aliases: ['ibn khaldun', 'ibn khaldoun', 'khaldun', 'ابن خلدون', 'خلدون'],
  },
  {
    id: 'ar-mahrez',
    pack: 'arab',
    ar: {
      name: 'رياض محرز',
      clues: [
        'وُلدت في سارسيل بفرنسا.',
        'لعبت في الدرجات الدنيا بفرنسا قبل أن أنتقل إلى إنجلترا.',
        'فزت بالدوري الإنجليزي مع ليستر سيتي عام ٢٠١٦.',
        'قدت الجزائر إلى لقب كأس أمم أفريقيا ٢٠١٩.',
        'في عام ٢٠٢٣ انضممت إلى الأهلي في جدة.',
        'نجم الجناح في منتخب الجزائر.',
      ],
    },
    en: {
      name: 'Riyad Mahrez',
      clues: [
        'I was born in Sarcelles, France.',
        'I played in the French lower leagues before moving to England.',
        'I won the Premier League with Leicester City in 2016.',
        'I captained Algeria to the 2019 Africa Cup of Nations title.',
        'In 2023 I joined Al-Ahli in Jeddah.',
        "Algeria's star winger.",
      ],
    },
    aliases: ['riyad mahrez', 'riyadh mahrez', 'mahrez', 'رياض محرز', 'محرز'],
  },
  {
    id: 'ar-abdelhalim',
    pack: 'arab',
    ar: {
      name: 'عبد الحليم حافظ',
      clues: [
        'تيتّمت وأنا رضيع.',
        'عانيت من مرض البلهارسيا طوال حياتي.',
        'مثّلت أفلاماً كثيرة في الخمسينيات والستينيات.',
        'من أغنياتي «أهواك» و«سوّاح».',
        'لقّبوني «العندليب الأسمر».',
        'مطرب مصر الرومانسي في العصر الذهبي.',
      ],
    },
    en: {
      name: 'Abdel Halim Hafez',
      clues: [
        'I was orphaned as a baby.',
        'I suffered from bilharzia all my life.',
        'I starred in many films in the 1950s and 1960s.',
        'My songs include "Ahwak" and "Sawah".',
        'They called me the Dark Nightingale.',
        "Egypt's romantic singer of the golden age.",
      ],
    },
    aliases: ['abdel halim hafez', 'abdelhalim hafez', 'abd el halim', 'abdel halim', 'halim', 'عبد الحليم حافظ', 'عبدالحليم حافظ', 'عبد الحليم', 'عبدالحليم', 'العندليب'],
  },
  {
    id: 'ar-talal',
    pack: 'arab',
    ar: {
      name: 'طلال مداح',
      clues: [
        'وُلدت في مكة عام ١٩٤٠.',
        'فارقت الحياة على المسرح وأنا أغنّي في أبها عام ٢٠٠٠.',
        'غنّيت «وطني الحبيب».',
        'كنت أعزف على العود.',
        'من مؤسسي الأغنية السعودية الحديثة.',
        'يلقّبونني «صوت الأرض».',
      ],
    },
    en: {
      name: 'Talal Maddah',
      clues: [
        'I was born in Mecca in 1940.',
        'I died on stage while singing in Abha in 2000.',
        'I sang "Watani Al Habib".',
        'I played the oud.',
        'I helped found the modern Saudi song.',
        'They call me the Voice of the Earth.',
      ],
    },
    aliases: ['talal maddah', 'talal madah', 'talal', 'maddah', 'طلال مداح', 'طلال', 'مداح', 'صوت الأرض'],
  },

  // --- Fiction & cartoons --------------------------------------------------
  {
    id: 'fi-sherlock',
    pack: 'fiction',
    ar: {
      name: 'شيرلوك هولمز',
      clues: [
        'الملايين يعرفون عنواني، مع أني لم أولد قط.',
        'أقرب أصدقائي طبيب عاد من الحرب.',
        'أعزف على الكمان حين أفكّر.',
        'عدوي اللدود أستاذ رياضيات.',
        'أسكن في شارع بيكر في لندن.',
        'أشهر محقق في الأدب الإنجليزي.',
      ],
    },
    en: {
      name: 'Sherlock Holmes',
      clues: [
        'Millions know my address, yet I was never born.',
        'My closest friend is a doctor back from war.',
        'I play the violin when I think.',
        'My arch-enemy is a maths professor.',
        'I live on Baker Street in London.',
        'I am the most famous detective in English fiction.',
      ],
    },
    aliases: ['sherlock holmes', 'sherlock', 'holmes', 'mr holmes', 'شيرلوك هولمز', 'شرلوك هولمز', 'شارلوك هولمز', 'شيرلوك', 'شرلوك', 'هولمز'],
  },
  {
    id: 'fi-harry',
    pack: 'fiction',
    ar: {
      name: 'هاري بوتر',
      clues: [
        'عشت في خزانة تحت الدرج.',
        'عيد ميلادي في ٣١ يوليو.',
        'أستطيع التحدّث مع الأفاعي.',
        'بومتي اسمها «هيدويغ».',
        'على جبيني ندبة على شكل برق.',
        'الساحر الصغير في مدرسة هوغوورتس.',
      ],
    },
    en: {
      name: 'Harry Potter',
      clues: [
        'I lived in a cupboard under the stairs.',
        'My birthday is 31 July.',
        'I can talk to snakes.',
        'My owl is called Hedwig.',
        'I have a lightning-shaped scar on my forehead.',
        'The boy wizard of Hogwarts.',
      ],
    },
    aliases: ['harry potter', 'harry', 'potter', 'هاري بوتر', 'هاري', 'بوتر'],
  },
  {
    id: 'fi-mickey',
    pack: 'fiction',
    ar: {
      name: 'ميكي ماوس',
      clues: [
        'ظهرت أول مرة في «ستيمبوت ويلي» عام ١٩٢٨.',
        'أراد صانعي أولاً أن يسمّيني «مورتيمر».',
        'عندي كلب اسمه «بلوتو».',
        'صديقتي اسمها «ميني».',
        'أرتدي سروالاً قصيراً أحمر وحذاءً أصفر كبيراً.',
        'أشهر فأر في ديزني.',
      ],
    },
    en: {
      name: 'Mickey Mouse',
      clues: [
        'I first appeared in Steamboat Willie in 1928.',
        'My creator first wanted to call me Mortimer.',
        'I have a dog called Pluto.',
        "My girlfriend's name is Minnie.",
        'I wear red shorts and big yellow shoes.',
        "Disney's most famous mouse.",
      ],
    },
    aliases: ['mickey mouse', 'mickey', 'ميكي ماوس', 'ميكي'],
  },
  {
    id: 'fi-spiderman',
    pack: 'fiction',
    ar: {
      name: 'سبايدرمان',
      clues: [
        'علّمني عمّي أن القوة العظيمة تأتي معها مسؤولية عظيمة.',
        'أسكن في حي كوينز في نيويورك.',
        'أعمل مصوّراً لصحيفة.',
        'حصلت على قواي من لدغة حيوان صغير.',
        'اسمي الحقيقي بيتر باركر.',
        'البطل الذي يتأرجح بين المباني بالخيوط.',
      ],
    },
    en: {
      name: 'Spider-Man',
      clues: [
        'My uncle taught me that great power comes with great responsibility.',
        'I live in Queens, New York.',
        'I work as a photographer for a newspaper.',
        'A small animal bite gave me my powers.',
        'My real name is Peter Parker.',
        'The hero who swings between buildings on webs.',
      ],
    },
    aliases: ['spider-man', 'spiderman', 'spider man', 'peter parker', 'سبايدرمان', 'سبايدر مان', 'الرجل العنكبوت', 'بيتر باركر'],
  },
  {
    id: 'fi-superman',
    pack: 'fiction',
    ar: {
      name: 'سوبرمان',
      clues: [
        'أُرسلت إلى الأرض رضيعاً من كوكب كان يحتضر.',
        'كبرت في مزرعة بولاية كانساس.',
        'الكريبتونايت نقطة ضعفي.',
        'أعمل صحفياً في «ديلي بلانيت» باسم كلارك كنت.',
        'أطير وأرتدي عباءة حمراء.',
        'يلقّبونني «رجل الفولاذ».',
      ],
    },
    en: {
      name: 'Superman',
      clues: [
        'I was sent to Earth as a baby from a dying planet.',
        'I grew up on a farm in Kansas.',
        'Kryptonite is my weakness.',
        'I work at the Daily Planet as Clark Kent.',
        'I can fly, and I wear a red cape.',
        'They call me the Man of Steel.',
      ],
    },
    aliases: ['superman', 'super man', 'clark kent', 'kal-el', 'سوبرمان', 'سوبر مان', 'كلارك كنت'],
  },
  {
    id: 'fi-batman',
    pack: 'fiction',
    ar: {
      name: 'باتمان',
      clues: [
        'رأيت والديّ يُقتلان في زقاق وأنا طفل.',
        'كبير خدمي اسمه «ألفريد».',
        'أعيش في مدينة غوثام.',
        'عدوي الأشهر هو الجوكر.',
        'في النهار أنا الملياردير بروس واين.',
        'الفارس الأسود في زيّ الخفاش.',
      ],
    },
    en: {
      name: 'Batman',
      clues: [
        'As a child I saw my parents killed in an alley.',
        'My butler is called Alfred.',
        'I live in Gotham City.',
        'My best-known enemy is the Joker.',
        'By day I am the billionaire Bruce Wayne.',
        'The Dark Knight in a bat costume.',
      ],
    },
    aliases: ['batman', 'bat man', 'bat-man', 'bruce wayne', 'باتمان', 'بات مان', 'الرجل الوطواط', 'بروس واين'],
  },
  {
    id: 'fi-majid',
    pack: 'fiction',
    ar: {
      name: 'كابتن ماجد',
      clues: [
        'حلمي أن ألعب كرة القدم في البرازيل.',
        'حارس المرمى المنافس لي يلبس قبّعة.',
        'الملاعب في مسلسلي تبدو بطول كيلومترات.',
        'اسمي الياباني «تسوباسا».',
        'جيل كامل من الأطفال العرب كبر وهو يشاهدني.',
        'كابتن الكرة الأشهر في الرسوم اليابانية المدبلجة.',
      ],
    },
    en: {
      name: 'Captain Majid',
      clues: [
        'My dream is to play football in Brazil.',
        'My rival goalkeeper always wears a cap.',
        'The pitches in my show look kilometres long.',
        'My Japanese name is Tsubasa.',
        'A whole generation of Arab kids grew up watching me.',
        'The most famous football captain of dubbed anime.',
      ],
    },
    aliases: ['captain majid', 'captain majed', 'captain tsubasa', 'tsubasa', 'majid', 'majed', 'كابتن ماجد', 'ماجد', 'كابتن تسوباسا', 'تسوباسا'],
  },
  {
    id: 'fi-aladdin',
    pack: 'fiction',
    ar: {
      name: 'علاء الدين',
      clues: [
        'عشت فتى فقيراً في شوارع «أغربة».',
        'أعزّ أصدقائي قرد اسمه «أبو».',
        'أحببت الأميرة ياسمين.',
        'أركب بساطاً سحرياً.',
        'جنّي يحقّق لي ثلاث أمنيات.',
        'أفرك مصباحاً سحرياً.',
      ],
    },
    en: {
      name: 'Aladdin',
      clues: [
        'I grew up poor on the streets of Agrabah.',
        'My best friend is a monkey called Abu.',
        'I fell in love with Princess Jasmine.',
        'I ride a magic carpet.',
        'A genie grants me three wishes.',
        'I rub a magic lamp.',
      ],
    },
    aliases: ['aladdin', 'alaa eddin', 'علاء الدين', 'علاءالدين'],
  },
  {
    id: 'fi-sinbad',
    pack: 'fiction',
    ar: {
      name: 'السندباد',
      clues: [
        'أنا من بغداد.',
        'حكاياتي في «ألف ليلة وليلة».',
        'في إحدى رحلاتي حملني طائر الرخّ العملاق.',
        'نجوت من كل غرق.',
        'قمت بسبع رحلات.',
        'أشهر بحّار في الحكايات العربية.',
      ],
    },
    en: {
      name: 'Sinbad',
      clues: [
        'I am from Baghdad.',
        'My tales are in One Thousand and One Nights.',
        'On one voyage, a giant bird called the roc carried me off.',
        'I survived every shipwreck.',
        'I made seven voyages.',
        'The most famous sailor of Arabian tales.',
      ],
    },
    aliases: ['sinbad', 'sindbad', 'sinbad the sailor', 'السندباد', 'سندباد', 'السندباد البحري'],
  },
  {
    id: 'fi-simba',
    pack: 'fiction',
    ar: {
      name: 'سيمبا',
      clues: [
        'علّمني أبي عن «دائرة الحياة».',
        'خدعني عمّي «سكار».',
        'ربّاني سرقاط وخنزير برّي.',
        'أصدقائي يقولون «هاكونا ماتاتا».',
        'شبل أسد يصبح ملكاً.',
        'بطل فيلم «الأسد الملك».',
      ],
    },
    en: {
      name: 'Simba',
      clues: [
        'My father taught me about the Circle of Life.',
        'My uncle Scar tricked me.',
        'A meerkat and a warthog raised me.',
        'My friends say "Hakuna Matata".',
        'A lion cub who becomes king.',
        'The hero of The Lion King.',
      ],
    },
    aliases: ['simba', 'سيمبا'],
  },
  {
    id: 'fi-mario',
    pack: 'fiction',
    ar: {
      name: 'ماريو',
      clues: [
        'ظهرت أول مرة عام ١٩٨١ في لعبة «دونكي كونغ» باسم «جمبمان».',
        'أعمل سبّاكاً.',
        'أخي اسمه «لويجي».',
        'أنقذ الأميرة «بيتش» من «باوزر» مرة بعد مرة.',
        'الفطر يجعلني أكبر.',
        'تميمة نينتندو بقبّعة حمراء وشارب.',
      ],
    },
    en: {
      name: 'Mario',
      clues: [
        'I first appeared in Donkey Kong in 1981, as Jumpman.',
        'I work as a plumber.',
        'My brother is Luigi.',
        'I keep rescuing Princess Peach from Bowser.',
        'Mushrooms make me bigger.',
        "Nintendo's mascot, with a red cap and a moustache.",
      ],
    },
    aliases: ['mario', 'super mario', 'mario bros', 'ماريو', 'سوبر ماريو'],
  },
  {
    id: 'fi-pikachu',
    pack: 'fiction',
    ar: {
      name: 'بيكاتشو',
      clues: [
        'اسمي باليابانية يجمع صوت الشرارة وصوت صرير الفأر.',
        'أرفض الدخول في كرتي.',
        'مدرّبي اسمه آش.',
        'أنا من النوع الكهربائي.',
        'لوني أصفر وخدّاي أحمران.',
        'أشهر بوكيمون.',
      ],
    },
    en: {
      name: 'Pikachu',
      clues: [
        "My Japanese name mixes the sound of a spark and a mouse's squeak.",
        'I refuse to go inside my ball.',
        'My trainer is Ash.',
        "I'm an Electric type.",
        "I'm yellow with red cheeks.",
        'The most famous Pokémon.',
      ],
    },
    aliases: ['pikachu', 'بيكاتشو'],
  },
  {
    id: 'fi-cinderella',
    pack: 'fiction',
    ar: {
      name: 'سندريلا',
      clues: [
        'زوجة أبي جعلتني أقوم بكل أعمال البيت.',
        'الطيور والفئران أصدقائي.',
        'تحوّلت يقطينة إلى عربة من أجلي.',
        'كان عليّ أن أغادر الحفل قبل منتصف الليل.',
        'أضعت حذاءً زجاجياً.',
        'تزوّجت الأمير بعد أن وجد حذائي.',
      ],
    },
    en: {
      name: 'Cinderella',
      clues: [
        'My stepmother made me do all the housework.',
        'Birds and mice are my friends.',
        'A pumpkin turned into a carriage for me.',
        'I had to leave the ball before midnight.',
        'I lost a glass slipper.',
        'I married the prince after he found my shoe.',
      ],
    },
    aliases: ['cinderella', 'سندريلا', 'سندريللا'],
  },
  {
    id: 'fi-tom',
    pack: 'fiction',
    ar: {
      name: 'توم',
      clues: [
        'ظهرت أول مرة عام ١٩٤٠.',
        'صاحبة البيت لا يظهر منها غالباً إلا قدماها.',
        'الكلب «سبايك» يكرهني.',
        'قطّ رمادي مائل إلى الزرقة.',
        'لا أمسك بالفأر أبداً.',
        'عدوّي الأبدي هو «جيري».',
      ],
    },
    en: {
      name: 'Tom',
      clues: [
        'I first appeared in 1940.',
        'You mostly see only the legs of the lady of the house.',
        'Spike the bulldog hates me.',
        "I'm a grey-blue cat.",
        'I never catch the mouse.',
        'My eternal enemy is Jerry.',
      ],
    },
    aliases: ['tom', 'tom cat', 'tom the cat', 'توم', 'القط توم'],
  },
  {
    id: 'fi-popeye',
    pack: 'fiction',
    ar: {
      name: 'باباي',
      clues: [
        'ظهرت أول مرة في شريط مصوّر في صحيفة عام ١٩٢٩.',
        'حبيبتي اسمها «زيتونة».',
        'منافسي اسمه «بلوتو» الضخم.',
        'ساعداي ضخمان وعليهما وشم مرساة.',
        'بحّار يدخّن الغليون.',
        'السبانخ تمنحني القوة.',
      ],
    },
    en: {
      name: 'Popeye',
      clues: [
        'I first appeared in a newspaper comic strip in 1929.',
        'My girlfriend is Olive Oyl.',
        'My big rival is Bluto.',
        'My forearms are huge, with anchor tattoos.',
        "I'm a sailor with a pipe.",
        'Spinach makes me strong.',
      ],
    },
    aliases: ['popeye', 'popeye the sailor', 'باباي', 'بوباي'],
  },
  {
    id: 'fi-pinocchio',
    pack: 'fiction',
    ar: {
      name: 'بينوكيو',
      clues: [
        'صُنعت من قطعة خشب كانت تتكلّم.',
        'صرصار يحاول أن يكون ضميري.',
        'ابتلعني مخلوق بحري عملاق.',
        'أبي «جيبيتو» نجّار.',
        'أريد أن أصبح ولداً حقيقياً.',
        'أنفي يطول حين أكذب.',
      ],
    },
    en: {
      name: 'Pinocchio',
      clues: [
        'I was carved from a piece of wood that could talk.',
        'A cricket tries to be my conscience.',
        'A giant sea creature swallowed me.',
        'My father, Geppetto, is a carpenter.',
        'I want to become a real boy.',
        'My nose grows when I lie.',
      ],
    },
    aliases: ['pinocchio', 'pinochio', 'بينوكيو', 'بينوكيو الخشبي'],
  },
  {
    id: 'fi-elsa',
    pack: 'fiction',
    ar: {
      name: 'إلسا',
      clues: [
        'أخفيت قواي عن أختي سنوات.',
        'مملكتي اسمها «أرندل».',
        'أختي اسمها «آنا».',
        'بنيت لنفسي قصراً من الجليد.',
        'غنّيت «Let It Go».',
        'ملكة الثلج في فيلم «فروزن».',
      ],
    },
    en: {
      name: 'Elsa',
      clues: [
        'I hid my powers from my sister for years.',
        'My kingdom is Arendelle.',
        'My sister is Anna.',
        'I built myself an ice palace.',
        'I sang "Let It Go".',
        'The Snow Queen of Frozen.',
      ],
    },
    aliases: ['elsa', 'queen elsa', 'إلسا', 'السا', 'الملكة إلسا'],
  },
  {
    id: 'fi-shrek',
    pack: 'fiction',
    ar: {
      name: 'شريك',
      clues: [
        'أعزّ أصدقائي حمار يتكلّم.',
        'تزوّجت الأميرة فيونا.',
        'أعيش في مستنقع.',
        'أقول إن الغيلان مثل البصل: طبقات.',
        'غول أخضر ضخم.',
        'سلسلة أفلامي تحمل اسمي.',
      ],
    },
    en: {
      name: 'Shrek',
      clues: [
        'My best friend is a talking donkey.',
        'I married Princess Fiona.',
        'I live in a swamp.',
        'I say ogres are like onions: they have layers.',
        "I'm a big green ogre.",
        'My film series is named after me.',
      ],
    },
    aliases: ['shrek', 'شريك', 'شرك', 'شريك الغول'],
  },
  {
    id: 'fi-bond',
    pack: 'fiction',
    ar: {
      name: 'جيمس بوند',
      clues: [
        'ابتكرني الكاتب إيان فليمنغ.',
        'أحبّ شرابي «مخضوضاً لا مقلّباً».',
        'رئيسي يُرمز له بحرف M.',
        'عندي رخصة بالقتل.',
        'رقمي السري ٠٠٧.',
        'أشهر جاسوس في العالم.',
      ],
    },
    en: {
      name: 'James Bond',
      clues: [
        'The writer Ian Fleming created me.',
        'I like my drink "shaken, not stirred".',
        'My boss is known as M.',
        'I have a licence to kill.',
        'My code number is 007.',
        "The world's most famous spy.",
      ],
    },
    aliases: ['james bond', 'bond', '007', 'جيمس بوند', 'بوند', 'العميل 007'],
  },
  {
    id: 'fi-conan',
    pack: 'fiction',
    ar: {
      name: 'المحقق كونان',
      clues: [
        'مادة سامّة جعلتني أصغر حتى عدت طفلاً.',
        'أرتدي نظارة، وربطة عنق تغيّر صوتي.',
        'أسكن عند محقق ينسب الفضل إلى نفسه في قضاياي.',
        'اسمي الحقيقي «شينئتشي كودو».',
        'أقول: «الحقيقة واحدة فقط!».',
        'المحقق الطفل في الأنمي.',
      ],
    },
    en: {
      name: 'Detective Conan',
      clues: [
        'A poison shrank me back into a child.',
        'I wear glasses and a bow tie that changes my voice.',
        'I live with a detective who takes credit for my cases.',
        'My real name is Shinichi Kudo.',
        'I say, "There is only one truth!"',
        'The child detective of anime.',
      ],
    },
    aliases: ['detective conan', 'conan', 'conan edogawa', 'shinichi kudo', 'shinichi', 'المحقق كونان', 'كونان', 'شينتشي', 'شينيتشي'],
  },
];
