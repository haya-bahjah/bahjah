import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

type Difficulty = 'easy' | 'medium' | 'hard';

interface SeedQuestion {
  category: string;
  difficulty: Difficulty;
  prompt: string;
  promptAr: string;
  choices: string[];
  choicesAr: string[];
  correctIndex: number;
}

// The trivia bank, generated from the question library spreadsheets. The
// five general categories come from "BahjahTriviaQuestions - Updated
// FINAL.xlsx" (six per category per difficulty); Saudi National Day comes
// from "BahjahTriviaQuestions - Saudi.xlsx" (120 questions: 37 easy, 43
// medium, 40 hard -- that sheet's Geography/History/People/Culture/Dialects
// column is a sub-topic within the one Saudi National Day category). Those
// sheets are the only source for these. Do not hand-edit rows
// here and do not add questions the sheet does not have -- main() below
// makes the database match this list exactly on every boot, so anything
// added elsewhere (including through the admin editor at
// /admin-questions.html) is removed on the next deploy. To change the bank,
// change the spreadsheet and regenerate.
const QUESTIONS: SeedQuestion[] = [
  // --- General Knowledge ---
  { category: 'General Knowledge', difficulty: 'easy', prompt: 'How many days are there in a leap year?', promptAr: 'كم عدد أيام السنة الكبيسة؟', choices: ['364', '365', '366', '367'], choicesAr: ['364', '365', '366', '367'], correctIndex: 2 },
  { category: 'General Knowledge', difficulty: 'easy', prompt: 'How many hours are in a day?', promptAr: 'كم عدد ساعات اليوم؟', choices: ['12', '24', '36', '48'], choicesAr: ['12', '24', '36', '48'], correctIndex: 1 },
  { category: 'General Knowledge', difficulty: 'easy', prompt: 'How many sides does a hexagon have?', promptAr: 'كم عدد أضلاع الشكل السداسي؟', choices: ['5', '6', '7', '8'], choicesAr: ['5', '6', '7', '8'], correctIndex: 1 },
  { category: 'General Knowledge', difficulty: 'easy', prompt: 'What color do you get when you mix blue and yellow?', promptAr: 'ما اللون الذي تحصل عليه عند مزج الأزرق والأصفر؟', choices: ['Purple', 'Green', 'Orange', 'Brown'], choicesAr: ['بنفسجي', 'أخضر', 'برتقالي', 'بني'], correctIndex: 1 },
  { category: 'General Knowledge', difficulty: 'easy', prompt: 'What do you call a baby dog?', promptAr: 'ماذا يُطلق على صغير الكلب؟', choices: ['Kitten', 'Puppy', 'Cub', 'Foal'], choicesAr: ['قطيط', 'جرو', 'شبل', 'مهر'], correctIndex: 1 },
  { category: 'General Knowledge', difficulty: 'easy', prompt: 'What is the opposite of \'hot\'?', promptAr: 'ما هو عكس كلمة "ساخن"؟', choices: ['Warm', 'Cold', 'Mild', 'Cool'], choicesAr: ['دافئ', 'بارد', 'معتدل', 'منعش'], correctIndex: 1 },
  { category: 'General Knowledge', difficulty: 'medium', prompt: 'How many colors are primary?', promptAr: 'كم عدد الألوان الرئيسية؟', choices: ['5', '4', '3', '6'], choicesAr: ['5', '4', '3', '6'], correctIndex: 2 },
  { category: 'General Knowledge', difficulty: 'medium', prompt: 'How many continents are there?', promptAr: 'كم عدد القارات؟', choices: ['5', '6', '7', '8'], choicesAr: ['5', '6', '7', '8'], correctIndex: 2 },
  { category: 'General Knowledge', difficulty: 'medium', prompt: 'What is the currency of Japan?', promptAr: 'ما هي عملة اليابان؟', choices: ['Yuan', 'Won', 'Yen', 'Ringgit'], choicesAr: ['اليوان', 'الوون', 'الين', 'الرينغيت'], correctIndex: 2 },
  { category: 'General Knowledge', difficulty: 'medium', prompt: 'What is the largest organ in the human body?', promptAr: 'ما هو أكبر عضو في جسم الإنسان؟', choices: ['Liver', 'Heart', 'Skin', 'Lungs'], choicesAr: ['الكبد', 'القلب', 'الجلد', 'الرئتان'], correctIndex: 2 },
  { category: 'General Knowledge', difficulty: 'medium', prompt: 'What is the main language spoken in Brazil?', promptAr: 'ما هي اللغة الرئيسية المستخدمة في البرازيل؟', choices: ['Spanish', 'Portuguese', 'French', 'Italian'], choicesAr: ['الإسبانية', 'البرتغالية', 'الفرنسية', 'الإيطالية'], correctIndex: 1 },
  { category: 'General Knowledge', difficulty: 'medium', prompt: 'What is the smallest planet in our solar system?', promptAr: 'ما هو أصغر كوكب في نظامنا الشمسي؟', choices: ['Mars', 'Mercury', 'Venus', 'Neptune'], choicesAr: ['المريخ', 'عطارد', 'الزهرة', 'نبتون'], correctIndex: 1 },
  { category: 'General Knowledge', difficulty: 'hard', prompt: 'What is the only mammal capable of true flight?', promptAr: 'ما هو الثدي الوحيد القادر على الطيران الحقيقي؟', choices: ['Flying squirrel', 'Bat', 'Colugo', 'Sugar glider'], choicesAr: ['السنجاب الطائر', 'الخفاش', 'الكولوغو', 'الأبوسوم الطائر'], correctIndex: 1 },
  { category: 'General Knowledge', difficulty: 'hard', prompt: 'In which language does the word “Aloha” mean “Hello” and "Bye"?', promptAr: 'في أي لغة تعني كلمة "الوها" كلًا من "مرحبًا" و"وداعًا"؟', choices: ['Hawaiian', 'Māori', 'Samoan', 'Tahitian'], choicesAr: ['الهاواية', 'الماورية', 'الساموية', 'التاهيتية'], correctIndex: 0 },
  { category: 'General Knowledge', difficulty: 'hard', prompt: 'What is the tallest mountain in the world measured from sea level?', promptAr: 'ما هو أعلى جبل في العالم مقاسًا من سطح البحر؟', choices: ['K2', 'Kangchenjunga', 'Mount Everest', 'Denali'], choicesAr: ['كي2', 'كانغتشنجونغا', 'إفرست', 'دينالي'], correctIndex: 2 },
  { category: 'General Knowledge', difficulty: 'hard', prompt: 'What is the world\'s most spoken native language?', promptAr: 'ما هي اللغة الأم الأكثر تحدثًا في العالم؟', choices: ['English', 'Hindi', 'Mandarin Chinese', 'Spanish'], choicesAr: ['الإنجليزية', 'الهندية', 'الصينية الماندرين', 'الإسبانية'], correctIndex: 2 },
  { category: 'General Knowledge', difficulty: 'hard', prompt: 'Which country gifted the Statue of Liberty to the United States?', promptAr: 'أي دولة أهدت تمثال الحرية للولايات المتحدة؟', choices: ['United Kingdom', 'France', 'Spain', 'Netherlands'], choicesAr: ['المملكة المتحدة', 'فرنسا', 'إسبانيا', 'هولندا'], correctIndex: 1 },
  { category: 'General Knowledge', difficulty: 'hard', prompt: 'Which element has the chemical symbol \'Fe\'?', promptAr: 'أي عنصر يحمل الرمز الكيميائي "Fe"؟', choices: ['Fluorine', 'Iron', 'Lead', 'Tin'], choicesAr: ['الفلور', 'الحديد', 'الرصاص', 'القصدير'], correctIndex: 1 },
  // --- Geography ---
  { category: 'Geography', difficulty: 'easy', prompt: 'What is the capital of France?', promptAr: 'ما هي عاصمة فرنسا؟', choices: ['Paris', 'Rome', 'Madrid', 'Berlin'], choicesAr: ['باريس', 'روما', 'مدريد', 'برلين'], correctIndex: 0 },
  { category: 'Geography', difficulty: 'easy', prompt: 'What is the largest country by area?', promptAr: 'ما هي أكبر دولة من حيث المساحة؟', choices: ['China', 'USA', 'Canada', 'Russia'], choicesAr: ['الصين', 'الولايات المتحدة', 'كندا', 'روسيا'], correctIndex: 3 },
  { category: 'Geography', difficulty: 'easy', prompt: 'What is the smallest country in the world?', promptAr: 'ما هي أصغر دولة في العالم؟', choices: ['Monaco', 'Vatican City', 'San Marino', 'Liechtenstein'], choicesAr: ['موناكو', 'الفاتيكان', 'سان مارينو', 'ليختنشتاين'], correctIndex: 1 },
  { category: 'Geography', difficulty: 'easy', prompt: 'Which continent is Egypt located in?', promptAr: 'في أي قارة تقع مصر؟', choices: ['Asia', 'Africa', 'Europe', 'South America'], choicesAr: ['آسيا', 'أفريقيا', 'أوروبا', 'أمريكا الجنوبية'], correctIndex: 1 },
  { category: 'Geography', difficulty: 'easy', prompt: 'Which country is shaped like a boot?', promptAr: 'أي دولة على شكل حذاء؟', choices: ['Spain', 'Italy', 'Greece', 'Portugal'], choicesAr: ['إسبانيا', 'إيطاليا', 'اليونان', 'البرتغال'], correctIndex: 1 },
  { category: 'Geography', difficulty: 'easy', prompt: 'Which river is the longest in the world?', promptAr: 'ما هو أطول نهر في العالم؟', choices: ['Amazon', 'Nile', 'Yangtze', 'Mississippi'], choicesAr: ['الأمازون', 'النيل', 'يانغتسي', 'المسيسيبي'], correctIndex: 1 },
  { category: 'Geography', difficulty: 'medium', prompt: 'The Nile river flows through which country?', promptAr: 'يمر نهر النيل عبر أي دولة؟', choices: ['Kenya', 'Egypt', 'Morocco', 'Nigeria'], choicesAr: ['كينيا', 'مصر', 'المغرب', 'نيجيريا'], correctIndex: 1 },
  { category: 'Geography', difficulty: 'medium', prompt: 'What is the capital of Australia?', promptAr: 'ما هي عاصمة أستراليا؟', choices: ['Sydney', 'Melbourne', 'Canberra', 'Perth'], choicesAr: ['سيدني', 'ملبورن', 'كانبيرا', 'بيرث'], correctIndex: 2 },
  { category: 'Geography', difficulty: 'medium', prompt: 'What is the largest ocean on Earth?', promptAr: 'ما هو أكبر محيط على وجه الأرض؟', choices: ['Atlantic', 'Indian', 'Arctic', 'Pacific'], choicesAr: ['الأطلسي', 'الهندي', 'المتجمد الشمالي', 'الهادئ'], correctIndex: 3 },
  { category: 'Geography', difficulty: 'medium', prompt: 'Which country has the most natural lakes?', promptAr: 'أي دولة تضم أكبر عدد من البحيرات الطبيعية؟', choices: ['Canada', 'Russia', 'Finland', 'USA'], choicesAr: ['كندا', 'روسيا', 'فنلندا', 'الولايات المتحدة'], correctIndex: 0 },
  { category: 'Geography', difficulty: 'medium', prompt: 'Which desert is the largest in the world?', promptAr: 'ما هي أكبر صحراء في العالم؟', choices: ['Sahara', 'Gobi', 'Antarctic', 'Arabian'], choicesAr: ['الصحراء الكبرى', 'صحراء غوبي', 'الصحراء القطبية الجنوبية', 'الصحراء العربية'], correctIndex: 2 },
  { category: 'Geography', difficulty: 'medium', prompt: 'Which country is home to the ancient city of Machu Picchu?', promptAr: 'ي أي دولة تقع مدينة ماتشو بيتشو الأثرية؟', choices: ['Bolivia', 'Peru', 'Chile', 'Ecuador'], choicesAr: ['بوليفيا', 'بيرو', 'تشيلي', 'الإكوادور'], correctIndex: 1 },
  { category: 'Geography', difficulty: 'hard', prompt: 'Where is the deepest point in the ocean located?', promptAr: 'أين تقع أعمق نقطة في المحيط؟', choices: ['Mariana Trench', 'Puerto Rico Trench', 'Java Trench', 'Tonga Trench'], choicesAr: ['خندق ماريانا', 'خندق بورتوريكو', 'خندق جاوة', 'خندق تونغا'], correctIndex: 0 },
  { category: 'Geography', difficulty: 'hard', prompt: 'What is the only sea without any coastline?', promptAr: 'ما هو البحر الوحيد الذي لا يحده أي ساحل؟', choices: ['Sargasso Sea', 'Coral Sea', 'Caspian Sea', 'Red Sea'], choicesAr: ['بحر السرغاسو', 'بحر المرجان', 'بحر قزوين', 'البحر الأحمر'], correctIndex: 0 },
  { category: 'Geography', difficulty: 'hard', prompt: 'Which African country has three capital cities?', promptAr: 'أي دولة أفريقية لديها ثلاث عواصم؟', choices: ['Nigeria', 'South Africa', 'Kenya', 'Ghana'], choicesAr: ['نيجيريا', 'جنوب أفريقيا', 'كينيا', 'غانا'], correctIndex: 1 },
  { category: 'Geography', difficulty: 'hard', prompt: 'Which country has the most time zones?', promptAr: 'أي دولة لديها أكبر عدد من المناطق الزمنية؟', choices: ['Russia', 'USA', 'France', 'China'], choicesAr: ['روسيا', 'الولايات المتحدة', 'فرنسا', 'الصين'], correctIndex: 2 },
  { category: 'Geography', difficulty: 'hard', prompt: 'Which landlocked country is bordered by exactly two countries, both of which are also landlocked?', promptAr: 'أي دولة غير ساحلية تحدها دولتان فقط، وكلتاهما غير ساحليتين أيضًا؟', choices: ['Uzbekistan', 'Liechtenstein', 'Mongolia', 'Bolivia'], choicesAr: ['أوزبكستان', 'ليختنشتاين', 'منغوليا', 'بوليفيا'], correctIndex: 1 },
  { category: 'Geography', difficulty: 'hard', prompt: 'Which strait separates Europe from Africa?', promptAr: 'أي مضيق يفصل بين أوروبا وأفريقيا؟', choices: ['Bosphorus', 'Strait of Gibraltar', 'Strait of Hormuz', 'Bering Strait'], choicesAr: ['مضيق البوسفور', 'مضيق جبل طارق', 'مضيق هرمز', 'مضيق بيرينغ'], correctIndex: 1 },
  // --- History ---
  { category: 'History', difficulty: 'easy', prompt: 'In which century did the Titanic sink?', promptAr: 'في أي قرن غرقت سفينة تايتانيك؟', choices: ['19th', '20th', '21st', '18th'], choicesAr: ['التاسع عشر', 'العشرون', 'الحادي والعشرون', 'الثامن عشر'], correctIndex: 1 },
  { category: 'History', difficulty: 'easy', prompt: 'What year did World War I begin?', promptAr: 'في أي عام بدأت الحرب العالمية الأولى؟', choices: ['1912', '1914', '1916', '1918'], choicesAr: ['1912', '1914', '1916', '1918'], correctIndex: 1 },
  { category: 'History', difficulty: 'easy', prompt: 'Which ancient wonder was located in Egypt?', promptAr: 'أي عجيبة قديمة كانت تقع في مصر؟', choices: ['Colossus of Rhodes', 'Great Pyramid of Giza', 'Hanging Gardens', 'Lighthouse of Alexandria'], choicesAr: ['تمثال رودس العملاق', 'هرم الجيزة الأكبر', 'حدائق بابل المعلقة', 'منارة الإسكندرية'], correctIndex: 1 },
  { category: 'History', difficulty: 'easy', prompt: 'Which empire was ruled by Julius Caesar?', promptAr: 'أي إمبراطورية حكمها يوليوس قيصر؟', choices: ['Greek Empire', 'Roman Empire', 'Ottoman Empire', 'Persian Empire'], choicesAr: ['الإمبراطورية اليونانية', 'الإمبراطورية الرومانية', 'الإمبراطورية العثمانية', 'الإمبراطورية الفارسية'], correctIndex: 1 },
  { category: 'History', difficulty: 'easy', prompt: 'Which war involved the Allies fighting the Axis powers?', promptAr: 'أي حرب شهدت دول الحلفاء ضد دول المحور؟', choices: ['World War I', 'World War II', 'Cold War', 'Vietnam War'], choicesAr: ['الحرب العالمية الأولى', 'الحرب العالمية الثانية', 'الحرب الباردة', 'حرب فيتنام'], correctIndex: 1 },
  { category: 'History', difficulty: 'easy', prompt: 'Who was the first man to walk on the moon?', promptAr: 'من كان أول رجل يمشي على سطح القمر؟', choices: ['Buzz Aldrin', 'Neil Armstrong', 'Yuri Gagarin', 'John Glenn'], choicesAr: ['باز ألدرين', 'نيل أرمسترونغ', 'يوري غاغارين', 'جون غلين'], correctIndex: 1 },
  { category: 'History', difficulty: 'medium', prompt: 'In which year did World War II end?', promptAr: 'في أي عام انتهت الحرب العالمية الثانية؟', choices: ['1943', '1944', '1945', '1946'], choicesAr: ['1943', '1944', '1945', '1946'], correctIndex: 2 },
  { category: 'History', difficulty: 'medium', prompt: 'The Great Wall was built primarily to defend which country?', promptAr: 'بُني السور العظيم بشكل أساسي للدفاع عن أي دولة؟', choices: ['Japan', 'Mongolia', 'China', 'Korea'], choicesAr: ['اليابان', 'منغوليا', 'الصين', 'كوريا'], correctIndex: 2 },
  { category: 'History', difficulty: 'medium', prompt: 'Which ancient civilization built the pyramids of Giza?', promptAr: 'أي حضارة قديمة بنت أهرامات الجيزة؟', choices: ['Romans', 'Greeks', 'Egyptians', 'Persians'], choicesAr: ['الرومان', 'الإغريق', 'المصريون', 'الفرس'], correctIndex: 2 },
  { category: 'History', difficulty: 'medium', prompt: 'Which document did the American colonies sign in 1776?', promptAr: 'أي وثيقة وقعتها المستعمرات الأمريكية عام 1776؟', choices: ['Bill of Rights', 'Declaration of Independence', 'Constitution', 'Magna Carta'], choicesAr: ['وثيقة الحقوق', 'إعلان الاستقلال', 'الدستور', 'ماغنا كارتا'], correctIndex: 1 },
  { category: 'History', difficulty: 'medium', prompt: 'Who authored the famous "Al-Muqaddimah"?', promptAr: 'من هو كاتب "المقدمة"؟', choices: ['Ibn Sina', 'Ibn Khaldun', 'Al-Farabi', 'Ibn Battuta'], choicesAr: ['ابن سينا', 'ابن خلدون', 'الفرابي', 'ابن بطوطة'], correctIndex: 1 },
  { category: 'History', difficulty: 'medium', prompt: 'Who wrote the plays Hamlet and Macbeth?', promptAr: 'من كتب مسرحيتي هاملت وماكبث؟', choices: ['Dickens', 'Shakespeare', 'Tolstoy', 'Homer'], choicesAr: ['ديكنز', 'شكسبير', 'تولستوي', 'هوميروس'], correctIndex: 1 },
  { category: 'History', difficulty: 'hard', prompt: 'In which year did the Berlin Wall fall?', promptAr: 'في أي عام سقط جدار برلين؟', choices: ['1987', '1989', '1991', '1993'], choicesAr: ['1987', '1989', '1991', '1993'], correctIndex: 1 },
  { category: 'History', difficulty: 'hard', prompt: 'The Rosetta Stone helped decipher which ancient script?', promptAr: 'ساعد حجر رشيد في فك رموز أي كتابة قديمة؟', choices: ['Cuneiform', 'Egyptian hieroglyphs', 'Linear B', 'Sanskrit'], choicesAr: ['الكتابة المسمارية', 'الهيروغليفية المصرية', 'الخط الخطي ب', 'السنسكريتية'], correctIndex: 1 },
  { category: 'History', difficulty: 'hard', prompt: 'Which Abbasid caliph founded the House of Wisdom (Bayt al-Hikmah) in Baghdad?', promptAr: 'أي خليفة عباسي ارتبط بتأسيس بيت الحكمة في بغداد وازدهار حركة الترجمة؟', choices: ['Al-Ma\'mun', 'Harun al-Rashid', 'Al-Mu\'tasim', 'Al-Mansur'], choicesAr: ['المأمون', 'هارون الرشيد', 'المعتصم بالله', 'المنصور'], correctIndex: 0 },
  { category: 'History', difficulty: 'hard', prompt: 'Which battle in 636 CE marked a decisive Muslim victory over the Byzantine Empire?', promptAr: 'أي معركة وقعت عام ٦٣٦م وكانت انتصارًا حاسمًا للمسلمين على البيزنطيين في بلاد الشام؟', choices: ['Battle of Yarmouk', 'Battle of Qadisiyyah', 'Battle of Mu\'tah', 'Battle of Nahavand'], choicesAr: ['معركة اليرموك', 'معركة القادسية', 'معركة مؤتة', 'معركة نهاوند'], correctIndex: 0 },
  { category: 'History', difficulty: 'hard', prompt: 'Which explorer led the first expedition to circumnavigate the globe?', promptAr: 'أي مستكشف قاد أول رحلة حول الكرة الأرضية؟', choices: ['Christopher Columbus', 'Vasco da Gama', 'Ferdinand Magellan', 'James Cook'], choicesAr: ['كريستوفر كولومبوس', 'فاسكو دا غاما', 'فرديناند ماجلان', 'جيمس كوك'], correctIndex: 2 },
  { category: 'History', difficulty: 'hard', prompt: 'Who was the last Pharaoh of Egypt?', promptAr: 'من آخر من حكم الفراعنة في مصر؟', choices: ['Nefertiti', 'Cleopatra VII', 'Hatshepsut', 'Tutankhamun'], choicesAr: ['نفرتيتي', 'كليوباترا السابعة', 'حتشبسوت', 'توت عنخ آمون'], correctIndex: 1 },
  // --- Saudi National Day ---
  { category: 'Saudi National Day', difficulty: 'easy', prompt: 'In which city is the Kaaba located?', promptAr: 'في أي مدينة تقع الكعبة المشرفة؟', choices: ['Madinah', 'Makkah', 'Taif', 'Riyadh'], choicesAr: ['المدينة المنورة', 'مكة المكرمة', 'الطائف', 'الرياض'], correctIndex: 1 },
  { category: 'Saudi National Day', difficulty: 'easy', prompt: 'In which year was the Kingdom of Saudi Arabia officially given its name?', promptAr: 'في أي عام سُمّيت المملكة العربية السعودية بهذا الاسم رسميًا؟', choices: ['1902', '1932', '1953', '1979'], choicesAr: ['١٩٠٢', '١٩٣٢', '١٩٥٣', '١٩٧٩'], correctIndex: 1 },
  { category: 'Saudi National Day', difficulty: 'easy', prompt: 'On what date is Saudi National Day celebrated each year?', promptAr: 'في أي تاريخ يُحتفل باليوم الوطني السعودي كل عام؟', choices: ['22 February', '23 September', '1 May', '11 November'], choicesAr: ['٢٢ فبراير', '٢٣ سبتمبر', '١ مايو', '١١ نوفمبر'], correctIndex: 1 },
  { category: 'Saudi National Day', difficulty: 'easy', prompt: 'On which continent is Saudi Arabia located?', promptAr: 'في أي قارة تقع المملكة العربية السعودية؟', choices: ['Africa', 'Europe', 'Asia', 'Oceania'], choicesAr: ['أفريقيا', 'أوروبا', 'آسيا', 'أوقيانوسيا'], correctIndex: 2 },
  { category: 'Saudi National Day', difficulty: 'easy', prompt: 'What is the capital of Saudi Arabia?', promptAr: 'ما هي عاصمة المملكة العربية السعودية؟', choices: ['Jeddah', 'Riyadh', 'Dammam', 'Makkah'], choicesAr: ['جدة', 'الرياض', 'الدمام', 'مكة المكرمة'], correctIndex: 1 },
  { category: 'Saudi National Day', difficulty: 'easy', prompt: 'What is the largest city in Saudi Arabia?', promptAr: 'ما هي أكبر مدينة في المملكة العربية السعودية؟', choices: ['Jeddah', 'Riyadh', 'Makkah', 'Madinah'], choicesAr: ['جدة', 'الرياض', 'مكة المكرمة', 'المدينة المنورة'], correctIndex: 1 },
  { category: 'Saudi National Day', difficulty: 'easy', prompt: 'What is the main colour of the Saudi flag?', promptAr: 'ما هو اللون الأساسي للعلم السعودي؟', choices: ['Red', 'Black', 'Green', 'Blue'], choicesAr: ['الأحمر', 'الأسود', 'الأخضر', 'الأزرق'], correctIndex: 2 },
  { category: 'Saudi National Day', difficulty: 'easy', prompt: 'What is the official language of Saudi Arabia?', promptAr: 'ما هي اللغة الرسمية للمملكة العربية السعودية؟', choices: ['Arabic', 'English', 'Persian', 'Turkish'], choicesAr: ['العربية', 'الإنجليزية', 'الفارسية', 'التركية'], correctIndex: 0 },
  { category: 'Saudi National Day', difficulty: 'easy', prompt: 'What two symbols appear on the Saudi national emblem?', promptAr: 'ما الرمزان اللذان يظهران في شعار المملكة؟', choices: ['A falcon and a star', 'Two crossed swords and a palm tree', 'A lion and a crown', 'A crescent and a sword'], choicesAr: ['صقر ونجمة', 'سيفان متقاطعان ونخلة', 'أسد وتاج', 'هلال وسيف'], correctIndex: 1 },
  { category: 'Saudi National Day', difficulty: 'easy', prompt: 'Which sea lies to the west of Saudi Arabia?', promptAr: 'أي بحر يقع غرب المملكة العربية السعودية؟', choices: ['The Red Sea', 'The Mediterranean', 'The Caspian Sea', 'The Black Sea'], choicesAr: ['البحر الأحمر', 'البحر المتوسط', 'بحر قزوين', 'البحر الأسود'], correctIndex: 0 },
  { category: 'Saudi National Day', difficulty: 'easy', prompt: 'Which tree appears on the Saudi national emblem?', promptAr: 'أي شجرة تظهر في شعار المملكة؟', choices: ['An olive tree', 'A palm tree', 'A cedar tree', 'An acacia tree'], choicesAr: ['شجرة زيتون', 'نخلة', 'شجرة أرز', 'شجرة سَمُر'], correctIndex: 1 },
  { category: 'Saudi National Day', difficulty: 'easy', prompt: 'Who was the founder of the modern Kingdom of Saudi Arabia?', promptAr: 'من هو مؤسس المملكة العربية السعودية الحديثة؟', choices: ['King Faisal', 'King Abdulaziz Al Saud', 'King Saud', 'King Khalid'], choicesAr: ['الملك فيصل', 'الملك عبدالعزيز آل سعود', 'الملك سعود', 'الملك خالد'], correctIndex: 1 },
  { category: 'Saudi National Day', difficulty: 'easy', prompt: 'What is the second-largest city in Saudi Arabia by population?', promptAr: 'ما هي ثاني أكبر مدينة في السعودية من حيث عدد السكان؟', choices: ['Makkah', 'Madinah', 'Jeddah', 'Dammam'], choicesAr: ['مكة المكرمة', 'المدينة المنورة', 'جدة', 'الدمام'], correctIndex: 2 },
  { category: 'Saudi National Day', difficulty: 'easy', prompt: 'In which region is the city of Abha located?', promptAr: 'في أي منطقة تقع مدينة أبها؟', choices: ['Jazan Region', 'Makkah Region', 'Al-Jouf Region', 'Asir Region'], choicesAr: ['في منطقة جازان', 'في منطقة مكة المكرمة', 'في منطقة الجوف', 'في منطقة عسير'], correctIndex: 3 },
  { category: 'Saudi National Day', difficulty: 'easy', prompt: 'Which mountain in Madinah gave its name to a battle in the time of the Prophet ﷺ?', promptAr: 'ما اسم الجبل الذي يوجد في المدينة المنورة و سميت عليه غزوة في عهد الرسول ﷺ؟', choices: ['Mount Tuwaiq', 'Mount Al-Qarah', 'Mount Uhud', 'Mount Radwa'], choicesAr: ['جبل طويق', 'جبل القارة', 'جبل أحد', 'جبل رضوى'], correctIndex: 2 },
  { category: 'Saudi National Day', difficulty: 'easy', prompt: 'Where is the largest palm oasis in the world?', promptAr: 'ما هي المدينة التي تقع فيها أكبر واحة نخيل في العالم؟', choices: ['Al-Qassim', 'Al-Ahsa', 'Al-Jouf', 'Hafar Al-Batin'], choicesAr: ['القصيم', 'الأحساء', 'الجوف', 'حفر الباطن'], correctIndex: 1 },
  { category: 'Saudi National Day', difficulty: 'easy', prompt: 'Which Saudi city is known as the "City of Roses"?', promptAr: 'ما هي المدينة السعودية التي تُعرف بمدينة الورود؟', choices: ['Jeddah', 'Taif', 'Tabuk', 'Abha'], choicesAr: ['جدة', 'الطائف', 'تبوك', 'أبها'], correctIndex: 1 },
  { category: 'Saudi National Day', difficulty: 'easy', prompt: 'Which country did Saudi Arabia beat at the 2022 World Cup?', promptAr: 'ما هي الدولة التي فازت عليها السعودية في كأس العالم ٢٠٢٢؟', choices: ['Argentina', 'Brazil', 'Netherlands', 'Belgium'], choicesAr: ['الأرجنتين', 'البرازيل', 'هولندا', 'بلجيكا'], correctIndex: 0 },
  { category: 'Saudi National Day', difficulty: 'easy', prompt: 'Saudi Arabia is the only Arab country in which international group?', promptAr: 'المملكة العربية السعودية هي الدولة العربية الوحيدة ضمن أي مؤسسة عالمية؟', choices: ['The United Nations', 'The G20', 'The World Health Organization', 'The Muslim World League'], choicesAr: ['الأمم المتحدة', 'مجموعة العشرين - G٢٠', 'منظمة الصحة العالمية', 'رابطة العالم الإسلامي'], correctIndex: 1 },
  { category: 'Saudi National Day', difficulty: 'easy', prompt: 'Who was the first Saudi astronaut?', promptAr: 'من هو أول رائد فضاء سعودي؟', choices: ['Prince Abdulaziz bin Salman bin Abdulaziz', 'Prince Sultan bin Salman bin Abdulaziz', 'Prince Mishal bin Sultan bin Abdulaziz', 'Prince Saud bin Nayef bin Abdulaziz'], choicesAr: ['الأمير عبدالعزيز بن سلمان بن عبدالعزيز', 'الأمير سلطان بن سلمان بن عبدالعزيز', 'الأمير مشعل بن سلطان بن عبدالعزيز', 'الأمير سعود بن نايف بن عبدالعزيز'], correctIndex: 1 },
  { category: 'Saudi National Day', difficulty: 'easy', prompt: 'Which Saudi singer is nicknamed "Fannan Al-Arab" (Artist of the Arabs)?', promptAr: 'من هو السعودي الملقب "فنان العرب"؟', choices: ['Talal Maddah', 'Mohammed Abdu', 'Abadi Al-Johar', 'Rashed Al-Majed'], choicesAr: ['طلال مداح', 'محمد عبده', 'عبادي الجوهر', 'راشد الماجد'], correctIndex: 1 },
  { category: 'Saudi National Day', difficulty: 'easy', prompt: 'Which player scored the winning goal against Argentina at the 2022 World Cup?', promptAr: 'من هو اللاعب الذي سجل هدف الفوز على المنتخب الأرجنتيني في كأس العالم ٢٠٢٢؟', choices: ['Salman Al-Faraj', 'Saleh Al-Shehri', 'Salem Al-Dawsari', 'Firas Al-Buraikan'], choicesAr: ['سلمان الفرج', 'صالح الشهري', 'سالم الدوسري', 'فراس البريكان'], correctIndex: 2 },
  { category: 'Saudi National Day', difficulty: 'easy', prompt: 'What is the first name of Sheikh Al-Sudais, imam and preacher of the Grand Mosque in Makkah?', promptAr: 'ما هو الاسم الأول للشيخ السديس إمام وخطيب الحرم المكي الشريف؟', choices: ['Abdulaziz', 'Abdullah', 'Abdulrahman', 'Abdulkarim'], choicesAr: ['عبدالعزيز', 'عبدالله', 'عبدالرحمن', 'عبدالكريم'], correctIndex: 2 },
  { category: 'Saudi National Day', difficulty: 'easy', prompt: 'What is Saudi Arabia\'s famous traditional folk dance?', promptAr: 'ما هي الرقصة الشعبية المشهورة في السعودية؟', choices: ['Breakdance', 'Al-Ardah', 'Dabke', 'Al-Jubi'], choicesAr: ['البريك دانس', 'العرضة', 'الدبكة', 'الجوبي'], correctIndex: 1 },
  { category: 'Saudi National Day', difficulty: 'easy', prompt: 'What is the name of the famous traditional market in Riyadh that sells heritage products?', promptAr: 'ما اسم السوق الشعبي الشهير في الرياض الذي يعرض منتجات تقليدية؟', choices: ['Souq Okaz', 'Al-Qaisariya Souq', 'Souq Al-Zal', 'Souq Al-Majaz'], choicesAr: ['سوق عكاظ', 'سوق القيصرية', 'سوق الزل', 'سوق المجاز'], correctIndex: 2 },
  { category: 'Saudi National Day', difficulty: 'easy', prompt: 'What is the most popular sport in Saudi Arabia?', promptAr: 'ما هي الرياضة الشعبية الأولى في السعودية؟', choices: ['Football', 'Basketball', 'Volleyball', 'Tennis'], choicesAr: ['كرة القدم', 'كرة السلة', 'الكرة الطائرة', 'كرة المضرب'], correctIndex: 0 },
  { category: 'Saudi National Day', difficulty: 'easy', prompt: 'What is the Kingdom\'s traditional coffee called?', promptAr: 'ما اسم القهوة التقليدية في المملكة؟', choices: ['Arabic Coffee', 'Folk Coffee', 'Heritage Coffee', 'Saudi Coffee'], choicesAr: ['القهوة العربية', 'القهوة الشعبية', 'القهوة التراثية', 'القهوة السعودية'], correctIndex: 3 },
  { category: 'Saudi National Day', difficulty: 'easy', prompt: 'What is the nickname of the Saudi national football team?', promptAr: 'ما هو لقب المنتخب السعودي؟', choices: ['The Green Eagles', 'The Green Tigers', 'The Green Lions', 'The Green Falcons'], choicesAr: ['النسور الخضر', 'النمور الخضر', 'الأسود الخضر', 'الصقور الخضر'], correctIndex: 3 },
  { category: 'Saudi National Day', difficulty: 'easy', prompt: 'What is the most famous show starring comedy duo Abdullah Al-Sadhan and Nasser Al-Qasabi?', promptAr: 'ما هو أشهر برنامج ظهر فيه الثنائي الكوميدي عبدالله السدحان و ناصر القصبي؟', choices: ['Selfie', 'Tash Ma Tash', 'Al-Asouf', 'Shabab Al-Bomb'], choicesAr: ['سيلفي', 'طاش ما طاش', 'العاصوف', 'شباب البومب'], correctIndex: 1 },
  { category: 'Saudi National Day', difficulty: 'easy', prompt: 'Saudi Arabia is one of the world\'s leading producers of which crop?', promptAr: 'تعد السعودية من الدول الرائدة في إنتاج أية محاصيل زراعية؟', choices: ['Oranges', 'Dates', 'Cantaloupe', 'Strawberries'], choicesAr: ['البرتقال', 'التمور', 'الشمام', 'الفراولة'], correctIndex: 1 },
  { category: 'Saudi National Day', difficulty: 'easy', prompt: 'What is the name of the camel race held in Saudi Arabia?', promptAr: 'ما هو اسم سباق الإبل الذي يقام في السعودية؟', choices: ['Formula racing', 'Equestrian racing', 'Foot racing', 'Hajn racing'], choicesAr: ['سباق الفورملا', 'سباق الفروسية', 'سباق الجري', 'سباق الهجن'], correctIndex: 3 },
  { category: 'Saudi National Day', difficulty: 'easy', prompt: 'In Saudi culture, what does it mean when a guest shakes the coffee cup after drinking?', promptAr: 'في الثقافة السعودية ما المقصود بهز فنجان القهوة بعد شربها؟', choices: ['They want more coffee', 'They did not like the coffee', 'They liked the coffee', 'They have had enough coffee'], choicesAr: ['يقصد الضيف بأنه يرغب بالمزيد من القهوة', 'يقصد الضيف بأن القهوة لم تعجبه', 'يقصد الضيف بأن القهوة أعجبته', 'يقصد الضيف بأنه اكتفى من القهوة'], correctIndex: 3 },
  { category: 'Saudi National Day', difficulty: 'easy', prompt: 'What does the Hijazi word "اشبك" (ashbak) mean?', promptAr: 'ما معنى كلمة "اشبك" باللهجة الحجازية؟', choices: ['What\'s wrong with you?', 'Where are you?', 'Who are you?', 'When?'], choicesAr: ['ماذا بك؟', 'أين مكانك؟', 'من أنت؟', 'متى؟'], correctIndex: 0 },
  { category: 'Saudi National Day', difficulty: 'easy', prompt: 'What does the Hijazi word "دحين" (daheen) mean?', promptAr: 'ما معنى "دحين" باللهجة الحجازية؟', choices: ['Soon', 'Previously', 'Right now', 'Usually'], choicesAr: ['قريبًا', 'سابقًا', 'حالًا', 'غالبًا'], correctIndex: 2 },
  { category: 'Saudi National Day', difficulty: 'easy', prompt: 'What does the Hijazi word "كمان" (kaman) mean?', promptAr: 'ما معنى كلمة "كمان" باللهجة الحجازية؟', choices: ['Without', 'Also', 'Above', 'Far'], choicesAr: ['بدون', 'أيضًا', 'فوق', 'بعيد'], correctIndex: 1 },
  { category: 'Saudi National Day', difficulty: 'easy', prompt: 'Complete the Saudi proverb: "He who doesn\'t know the ___ grills it." (اللي ما يعرف الـ… يشويه)', promptAr: 'أكمل المثل السعودي الآتي: اللي ما يعرف الـ………. يشويه', choices: ['Falcon', 'Camels', 'Bird', 'Horses'], choicesAr: ['الصقر', 'الإبل', 'الطير', 'الخيل'], correctIndex: 0 },
  { category: 'Saudi National Day', difficulty: 'easy', prompt: 'Complete the Saudi proverb: "He who can\'t reach the ___ says it\'s sour." (اللي ما يطول الـ… حامضٍ عنه يقول)', promptAr: 'أكمل المثل السعودي الآتي: اللي ما يطول الـ………. حامضٍ عنه يقول', choices: ['Fresh dates', 'Berries', 'Pomegranates', 'Grapes'], choicesAr: ['الرطب', 'التوت', 'الرمان', 'العنب'], correctIndex: 3 },
  { category: 'Saudi National Day', difficulty: 'medium', prompt: 'How many administrative regions does Saudi Arabia have?', promptAr: 'كم عدد مناطق المملكة العربية السعودية الإدارية؟', choices: ['9', '11', '13', '17'], choicesAr: ['٩', '١١', '١٣', '١٧'], correctIndex: 2 },
  { category: 'Saudi National Day', difficulty: 'medium', prompt: 'In which year was Saudi Vision 2030 launched?', promptAr: 'في أي عام أُطلقت رؤية السعودية ٢٠٣٠؟', choices: ['2012', '2016', '2019', '2021'], choicesAr: ['٢٠١٢', '٢٠١٦', '٢٠١٩', '٢٠٢١'], correctIndex: 1 },
  { category: 'Saudi National Day', difficulty: 'medium', prompt: 'Roughly how large is Saudi Arabia in area?', promptAr: 'ما هي مساحة المملكة العربية السعودية تقريبًا؟', choices: ['About 500,000 km²', 'About 1 million km²', 'About 2 million km²', 'About 4 million km²'], choicesAr: ['نحو ٥٠٠ ألف كم²', 'نحو مليون كم²', 'نحو مليوني كم²', 'نحو ٤ ملايين كم²'], correctIndex: 2 },
  { category: 'Saudi National Day', difficulty: 'medium', prompt: 'Saudi Arabia is the largest country in which region?', promptAr: 'المملكة العربية السعودية هي أكبر دولة في أي منطقة؟', choices: ['North Africa', 'The Middle East', 'Central Asia', 'The Horn of Africa'], choicesAr: ['شمال أفريقيا', 'الشرق الأوسط', 'آسيا الوسطى', 'القرن الأفريقي'], correctIndex: 1 },
  { category: 'Saudi National Day', difficulty: 'medium', prompt: 'What is the currency of Saudi Arabia?', promptAr: 'ما هي عملة المملكة العربية السعودية؟', choices: ['Dirham', 'Dinar', 'Riyal', 'Pound'], choicesAr: ['الدرهم', 'الدينار', 'الريال', 'الجنيه'], correctIndex: 2 },
  { category: 'Saudi National Day', difficulty: 'medium', prompt: 'What is written across the Saudi flag?', promptAr: 'ماذا كُتب على العلم السعودي؟', choices: ['The Shahada', 'The national anthem', 'The name of the king', 'A line of poetry'], choicesAr: ['الشهادة', 'النشيد الوطني', 'اسم الملك', 'بيت شعر'], correctIndex: 0 },
  { category: 'Saudi National Day', difficulty: 'medium', prompt: 'Which Riyadh fortress is associated with King Abdulaziz recapturing the city in 1902?', promptAr: 'أي قصر في الرياض يرتبط باستعادة الملك عبدالعزيز للمدينة عام ١٩٠٢؟', choices: ['Masmak Fortress', 'Tuwaiq Palace', 'Murabba Palace', 'Salwa Palace'], choicesAr: ['قصر المصمك', 'قصر طويق', 'قصر المربع', 'قصر سلوى'], correctIndex: 0 },
  { category: 'Saudi National Day', difficulty: 'medium', prompt: 'Which Saudi city is known as the Bride of the Red Sea?', promptAr: 'أي مدينة سعودية تُلقّب بعروس البحر الأحمر؟', choices: ['Yanbu', 'Jeddah', 'Jazan', 'Rabigh'], choicesAr: ['ينبع', 'جدة', 'جازان', 'رابغ'], correctIndex: 1 },
  { category: 'Saudi National Day', difficulty: 'medium', prompt: 'Which Saudi region is known for its green mountains and cool mist?', promptAr: 'أي منطقة سعودية تشتهر بجبالها الخضراء والضباب؟', choices: ['Asir', 'Al-Qassim', 'Hail', 'Tabuk'], choicesAr: ['عسير', 'القصيم', 'حائل', 'تبوك'], correctIndex: 0 },
  { category: 'Saudi National Day', difficulty: 'medium', prompt: 'Which body of water lies to the east of Saudi Arabia?', promptAr: 'أي مسطح مائي يقع شرق المملكة العربية السعودية؟', choices: ['The Arabian Gulf', 'The Red Sea', 'The Arabian Sea', 'The Gulf of Aden'], choicesAr: ['الخليج العربي', 'البحر الأحمر', 'بحر العرب', 'خليج عدن'], correctIndex: 0 },
  { category: 'Saudi National Day', difficulty: 'medium', prompt: 'Which historic district of Diriyah is on the UNESCO World Heritage list?', promptAr: 'أي حي تاريخي في الدرعية مُدرج في قائمة اليونسكو للتراث العالمي؟', choices: ['At-Turaif', 'Al-Bujairi', 'Ghasibah', 'Al-Malqa'], choicesAr: ['حي الطريف', 'حي البجيري', 'غصيبة', 'الملقا'], correctIndex: 0 },
  { category: 'Saudi National Day', difficulty: 'medium', prompt: 'Which two holy mosques are located in Saudi Arabia?', promptAr: 'ما هما الحرمان الشريفان الموجودان في المملكة؟', choices: ['Al-Masjid al-Haram and Al-Masjid an-Nabawi', 'Al-Aqsa and Al-Masjid al-Haram', 'Quba and Al-Aqsa', 'Al-Masjid an-Nabawi and Al-Aqsa'], choicesAr: ['المسجد الحرام والمسجد النبوي', 'المسجد الأقصى والمسجد الحرام', 'مسجد قباء والمسجد الأقصى', 'المسجد النبوي والمسجد الأقصى'], correctIndex: 0 },
  { category: 'Saudi National Day', difficulty: 'medium', prompt: 'What is the highest mountain in Saudi Arabia?', promptAr: 'ما هو أعلى جبل في السعودية؟', choices: ['Jabal Radwa', 'Jabal Al-Majaz', 'Jabal Fayfa', 'Jabal Sawda'], choicesAr: ['جبل رضوى', 'جبل المجاز', 'جبل فيفا', 'جبل السودة'], correctIndex: 3 },
  { category: 'Saudi National Day', difficulty: 'medium', prompt: 'Which valley (wadi) runs through the capital, Riyadh?', promptAr: 'ما هو الوادي الذي يمر بالعاصمة الرياض؟', choices: ['Wadi Al-Aqiq', 'Wadi Hanifa', 'Wadi Al-Batha', 'Wadi Afal'], choicesAr: ['وادي العقيق', 'وادي حنيفة', 'وادي البطحاء', 'وادي عفال'], correctIndex: 1 },
  { category: 'Saudi National Day', difficulty: 'medium', prompt: 'In which city was oil first discovered in Saudi Arabia?', promptAr: 'ما هي أول مدينة اكتشف فيها النفط؟', choices: ['Hafar Al-Batin', 'Al-Ahsa', 'Dhahran', 'Al-Udhailiyah'], choicesAr: ['حفر الباطن', 'الأحساء', 'الظهران', 'العضيلية'], correctIndex: 2 },
  { category: 'Saudi National Day', difficulty: 'medium', prompt: 'How many countries share a land border with Saudi Arabia?', promptAr: 'كم يحد المملكة من دول بريًا؟', choices: ['8 countries', '9 countries', '7 countries', '10 countries'], choicesAr: ['٨ دول', '٩ دول', '٧ دول', '١٠ دول'], correctIndex: 2 },
  { category: 'Saudi National Day', difficulty: 'medium', prompt: 'What is the name of the large plateau in the centre of the Kingdom?', promptAr: 'ما اسم الهضبة الكبرى التي تمتد في وسط المملكة؟', choices: ['Riyadh Plateau', 'Najd Plateau', 'As-Summan Plateau', 'Hamad Plateau'], choicesAr: ['هضبة الرياض', 'هضبة نجد', 'هضبة الصمان', 'هضبة حماد'], correctIndex: 1 },
  { category: 'Saudi National Day', difficulty: 'medium', prompt: 'What is the largest mountain range running along the Kingdom\'s west coast?', promptAr: 'ما اسم أكبر سلسلة جبلية التي تمتد على الساحل الغربي للمملكة؟', choices: ['Hijaz Mountains', 'Tihamah Mountains', 'Sarawat Mountains', 'Northern Mountains'], choicesAr: ['جبال الحجاز', 'جبال تهامة', 'جبال السروات', 'جبال الشمال'], correctIndex: 2 },
  { category: 'Saudi National Day', difficulty: 'medium', prompt: 'Which Saudi islands lie in the Red Sea?', promptAr: 'ما اسم الجزر التابعة للمملكة في البحر الأحمر؟', choices: ['Farasan Islands', 'Tarut Islands', 'Jana Islands', 'Al-Bardami Islands'], choicesAr: ['جزر فرسان', 'جزر تاروت', 'جزر جنة', 'جزر البردمي'], correctIndex: 0 },
  { category: 'Saudi National Day', difficulty: 'medium', prompt: 'Which Saudi region records the lowest temperatures in winter?', promptAr: 'ما هي أكثر منطقة سعودية تسجل درجات حرارة منخفضة شتاءً؟', choices: ['Eastern Province', 'Tabuk Region', 'Makkah Region', 'Riyadh Region'], choicesAr: ['المنطقة الشرقية', 'منطقة تبوك', 'مكة المكرمة', 'منطقة الرياض'], correctIndex: 1 },
  { category: 'Saudi National Day', difficulty: 'medium', prompt: 'In which year did Saudi Arabia host the G20?', promptAr: 'في أي عام استضافت السعودية دول ال G٢٠؟', choices: ['2022', '2018', '2024', '2020'], choicesAr: ['٢٠٢٢ م', '٢٠١٨ م', '٢٠٢٤ م', '٢٠٢٠ م'], correctIndex: 3 },
  { category: 'Saudi National Day', difficulty: 'medium', prompt: 'What was the first Saudi university to be established?', promptAr: 'ما هي أول جامعة سعودية تم إنشاؤها؟', choices: ['King Faisal University', 'King Abdulaziz University', 'Prince Sultan University', 'King Saud University'], choicesAr: ['جامعة الملك فيصل', 'جامعة الملك عبدالعزيز', 'جامعة الأمير سلطان', 'جامعة الملك سعود'], correctIndex: 3 },
  { category: 'Saudi National Day', difficulty: 'medium', prompt: 'Who was the sixth king of Saudi Arabia?', promptAr: 'من هو الملك السادس للمملكة العربية السعودية؟', choices: ['King Fahd bin Abdulaziz', 'King Salman bin Abdulaziz', 'King Khalid bin Abdulaziz', 'King Abdullah bin Abdulaziz'], choicesAr: ['الملك فهد بن عبدالعزيز', 'الملك سلمان بن عبدالعزيز', 'الملك خالد بن عبدالعزيز', 'الملك عبد الله بن عبد العزيز'], correctIndex: 3 },
  { category: 'Saudi National Day', difficulty: 'medium', prompt: 'In which year did the Saudi national team first qualify for the World Cup?', promptAr: 'في أي عام تأهل المنتخب الوطني السعودي لكأس العالم لأول مرة؟', choices: ['1990', '1998', '1994', '1986'], choicesAr: ['١٩٩٠م', '١٩٩٨م', '١٩٩٤م', '١٩٨٦م'], correctIndex: 2 },
  { category: 'Saudi National Day', difficulty: 'medium', prompt: 'How many times has the Saudi national team qualified for the World Cup?', promptAr: 'كم مرة تأهل المنتخب السعودي لكأس العالم؟', choices: ['7 times', '5 times', '4 times', '6 times'], choicesAr: ['٧ مرات', '٥ مرات', '٤ مرات', '٦ مرات'], correctIndex: 0 },
  { category: 'Saudi National Day', difficulty: 'medium', prompt: 'The King Abdulaziz Center for World Culture (Ithra) in Dhahran stands on the site of which discovery?', promptAr: 'يتميز مركز الملك عبدالعزيز الثقافي "إثراء" في مدينة الظهران بأنه يقع في ذات البقعة التي تم اكتشاف فيه:', choices: ['The first oil well', 'The first gas field', 'The first water well', 'The first iron mine'], choicesAr: ['أول ينبوع للنفط', 'أول حقل غاز', 'أول بئر مياه', 'أول منجم حديد'], correctIndex: 0 },
  { category: 'Saudi National Day', difficulty: 'medium', prompt: 'Who is the most famous Saudi calligrapher to have handwritten the Holy Quran?', promptAr: 'من هو أشهر خطاط سعودي خط المصحف الشريف؟', choices: ['Nasser Al-Maimoun', 'Fahd Al-Majhadi', 'Obaid Al-Nufaie', 'Uthman Taha'], choicesAr: ['ناصر الميمون', 'فهد المجحدي', 'عبيد النفيعي', 'عثمان طه'], correctIndex: 3 },
  { category: 'Saudi National Day', difficulty: 'medium', prompt: 'Who was the first Saudi woman to climb Mount Everest?', promptAr: 'من هي أول سعودية تتسلق قمة إفرست؟', choices: ['Mona Shahab', 'Haila Al-Qusayer', 'Raha Moharrak', 'Susan Al-Hoobi'], choicesAr: ['منى شهاب', 'هيلة القصير', 'رها محرق', 'سوزان الهوبي'], correctIndex: 2 },
  { category: 'Saudi National Day', difficulty: 'medium', prompt: 'Who was the first Saudi woman to serve as an ambassador?', promptAr: 'من هي أول امرأة سعودية تشغل منصب سفير في تاريخ المملكة؟', choices: ['Haifa bint Faisal Al Saud', 'Amal Al-Moallimi', 'Haifa Al-Jedea', 'Reema bint Bandar Al Saud'], choicesAr: ['هيفاء بنت فيصل آل سعود', 'آمال المعلمي', 'هيفاء الجديع', 'ريما بنت بندر آل سعود'], correctIndex: 3 },
  { category: 'Saudi National Day', difficulty: 'medium', prompt: 'Which world-famous doctor is known for separating conjoined twins?', promptAr: 'من هو الطبيب الشهير عالميًا في عمليات فصل التوائم السيامية؟', choices: ['Tawfiq Al-Rabiah', 'Abdullah Al-Rabeeah', 'Fahd Al-Hebdan', 'Ahmed Al-Harbi'], choicesAr: ['توفيق الربيعة', 'عبدالله الربيعة', 'فهد الهبدان', 'أحمد الحربي'], correctIndex: 1 },
  { category: 'Saudi National Day', difficulty: 'medium', prompt: 'Who was the first player in FIFA video game history to win the world title twice in one season?', promptAr: 'من هو أول لاعب في تاريخ لعبة الفيفا يحقق بطولة العالم مرتين في موسم واحد؟', choices: ['Mohammed Al-Arfaj', 'Mosaad Al-Dossary', 'Mishal Al-Hubaishi', 'Yasser Al-Harthi'], choicesAr: ['محمد العرفج', 'مساعد الدوسري', 'مشعل الحبيشي', 'ياسر الحارثي'], correctIndex: 1 },
  { category: 'Saudi National Day', difficulty: 'medium', prompt: 'Which Saudi woman led a military campaign against the Ottoman Empire during the First Saudi State?', promptAr: 'من هي السعودية التي قادت مهمة عسكرية في عهد الدولة السعودية الأولى ضد الدولة العثمانية؟', choices: ['Al-Jawhara bint Turki', 'Noura bint Abdulrahman', 'Hessa Al-Sudairi', 'Ghaliya Al-Bogami'], choicesAr: ['الجوهرة بنت تركي', 'نورة بنت عبدالرحمن', 'حصة السديري', 'غالية البقمي'], correctIndex: 3 },
  { category: 'Saudi National Day', difficulty: 'medium', prompt: 'What is the most famous Saudi handicraft?', promptAr: 'ما هي أشهر الحرف اليدوية السعودية؟', choices: ['Al-Sadu weaving', 'Khayamiya (tentmaking appliqué)', 'Mosaic', 'Zarbiya (carpet weaving)'], choicesAr: ['السدو', 'الخيامية', 'الفسيفساء', 'الزربية'], correctIndex: 0 },
  { category: 'Saudi National Day', difficulty: 'medium', prompt: 'On which date is Saudi Flag Day marked?', promptAr: 'أي يوم هو يوم العلم؟', choices: ['11 March', '10 March', '12 March', '13 March'], choicesAr: ['١١ مارس', '١٠ مارس', '١٢ مارس', '١٣ مارس'], correctIndex: 0 },
  { category: 'Saudi National Day', difficulty: 'medium', prompt: 'When is the Kaaba\'s Kiswa (covering) replaced each year?', promptAr: 'متى يتم تغيير كسوة الكعبة سنويًا؟', choices: ['Every Ramadan', 'Every Dhu al-Hijjah', 'Every Sha\'ban', 'Every Muharram'], choicesAr: ['كل رمضان', 'كل ذي الحجة', 'كل شعبان', 'كل محرم'], correctIndex: 3 },
  { category: 'Saudi National Day', difficulty: 'medium', prompt: 'Which people settled Mada\'in Salih in AlUla?', promptAr: 'أي قوم استوطنوا مدائن صالح و التي تقع في العلا؟', choices: ['The people of Madyan', 'The people of Lut', 'The people of Thamud', 'The people of Pharaoh'], choicesAr: ['قوم مدين', 'قوم لوط', 'قوم ثمود', 'قوم فرعون'], correctIndex: 2 },
  { category: 'Saudi National Day', difficulty: 'medium', prompt: 'Unlike most flags in the world, the Saudi flag…', promptAr: 'يتميز العلم السعودي عن معظم أعلام دول العالم بأنه:', choices: ['is never flown at half-mast for mourning or disasters', 'contains written words', 'includes the colour green', 'may not be flown horizontally'], choicesAr: ['لا يتم تنكيسه في حالات الحداد أو الكوارث', 'يحتوي عبارات لغوية', 'يتواجد فيه اللون الأخضر', 'يحظر استخدامه كعلم أفقي'], correctIndex: 0 },
  { category: 'Saudi National Day', difficulty: 'medium', prompt: 'What was the first football club in Saudi Arabia?', promptAr: 'ما هو أول نادي كرة قدم في السعودية؟', choices: ['Al-Ittihad', 'Al-Wehda', 'Al-Shabab', 'Al-Ettifaq'], choicesAr: ['نادي الاتحاد', 'نادي الوحدة', 'نادي الشباب', 'نادي الاتفاق'], correctIndex: 0 },
  { category: 'Saudi National Day', difficulty: 'medium', prompt: 'What does the Najdi word "تهقى" (tehga) mean?', promptAr: 'ما معنى كلمة "تهقى" باللهجة النجدية؟', choices: ['You think / believe', 'You chase away', 'You run', 'You rise'], choicesAr: ['تعتقد', 'تطرد', 'تركض', 'ترتفع'], correctIndex: 0 },
  { category: 'Saudi National Day', difficulty: 'medium', prompt: 'What does the Hassawi word "سبيتار" (sbitar) mean?', promptAr: 'ما معنى كلمة "سبيتار" باللهجة الحساوية؟', choices: ['School', 'Stadium', 'Hospital', 'Building'], choicesAr: ['مدرسة', 'ملعب', 'مستشفى', 'مبنى'], correctIndex: 2 },
  { category: 'Saudi National Day', difficulty: 'medium', prompt: 'What does the Hijazi word "برمان" (barman) mean?', promptAr: 'ما معنى كلمة "برمان" باللهجة الحجازية؟', choices: ['Rising', 'Shaking', 'Moving', 'Turning around'], choicesAr: ['ارتفاع', 'ارتجاج', 'حركة', 'دوران'], correctIndex: 3 },
  { category: 'Saudi National Day', difficulty: 'medium', prompt: 'In the Northern dialect, what is "الدبشية" (ad-dabshiya)?', promptAr: 'ما هي "الدبشية" باللهجة الشمالية؟', choices: ['Apple', 'Watermelon', 'Potatoes', 'Lemon'], choicesAr: ['التفاح', 'البطيخ', 'البطاطس', 'الليمون'], correctIndex: 1 },
  { category: 'Saudi National Day', difficulty: 'medium', prompt: 'What does the Northern word "منلهد" (minlahid) mean?', promptAr: 'ما معنى كلمة "منلهد" باللهجة الشمالية؟', choices: ['Upset', 'Surprised', 'Happy', 'Confused'], choicesAr: ['متضايق', 'مستغرب', 'مبسوط', 'محتار'], correctIndex: 0 },
  { category: 'Saudi National Day', difficulty: 'hard', prompt: 'In which year did King Abdulaziz recapture Riyadh?', promptAr: 'في أي عام استعاد الملك عبدالعزيز الرياض؟', choices: ['1902', '1912', '1921', '1926'], choicesAr: ['١٩٠٢', '١٩١٢', '١٩٢١', '١٩٢٦'], correctIndex: 0 },
  { category: 'Saudi National Day', difficulty: 'hard', prompt: 'In which year was the Saudi Council of Ministers established?', promptAr: 'في أي عام تأسس مجلس الوزراء السعودي؟', choices: ['1932', '1953', '1965', '1975'], choicesAr: ['١٩٣٢', '١٩٥٣', '١٩٦٥', '١٩٧٥'], correctIndex: 1 },
  { category: 'Saudi National Day', difficulty: 'hard', prompt: 'Saudi Founding Day on 22 February commemorates the establishment of which state?', promptAr: 'يوم التأسيس في ٢٢ فبراير يخلّد تأسيس أي دولة؟', choices: ['The First Saudi State', 'The Second Saudi State', 'The Third Saudi State', 'The Emirate of Riyadh'], choicesAr: ['الدولة السعودية الأولى', 'الدولة السعودية الثانية', 'الدولة السعودية الثالثة', 'إمارة الرياض'], correctIndex: 0 },
  { category: 'Saudi National Day', difficulty: 'hard', prompt: 'Saudi National Day marks a royal decree issued in which Hijri year?', promptAr: 'يوافق اليوم الوطني السعودي مرسومًا ملكيًا صدر في أي عام هجري؟', choices: ['1319 AH', '1351 AH', '1373 AH', '1400 AH'], choicesAr: ['١٣١٩ هـ', '١٣٥١ هـ', '١٣٧٣ هـ', '١٤٠٠ هـ'], correctIndex: 1 },
  { category: 'Saudi National Day', difficulty: 'hard', prompt: 'The First Saudi State was founded in which year?', promptAr: 'في أي عام تأسست الدولة السعودية الأولى؟', choices: ['1727', '1744', '1818', '1824'], choicesAr: ['١٧٢٧', '١٧٤٤', '١٨١٨', '١٨٢٤'], correctIndex: 0 },
  { category: 'Saudi National Day', difficulty: 'hard', prompt: 'Who wrote the lyrics of the Saudi national anthem?', promptAr: 'من هو كاتب كلمات النشيد الوطني السعودي؟', choices: ['Talal Madah', 'Ibrahim Khafaji', 'Ghazi Algosaibi', 'Tariq Abdulhakeem'], choicesAr: ['طلال مداح', 'إبراهيم خفاجي', 'غازي القصيبي', 'طارق عبدالحكيم'], correctIndex: 1 },
  { category: 'Saudi National Day', difficulty: 'hard', prompt: 'Which city was the capital of the First Saudi State?', promptAr: 'ما هي عاصمة الدولة السعودية الأولى؟', choices: ['Riyadh', 'Diriyah', 'Makkah', 'Hail'], choicesAr: ['الرياض', 'الدرعية', 'مكة المكرمة', 'حائل'], correctIndex: 1 },
  { category: 'Saudi National Day', difficulty: 'hard', prompt: 'Which desert in Saudi Arabia is the largest continuous sand desert in the world?', promptAr: 'أي صحراء في المملكة تُعد أكبر صحراء رملية متصلة في العالم؟', choices: ['An-Nafud', 'Ad-Dahna', 'Rub’ al Khali', 'Al-Jafurah'], choicesAr: ['النفود', 'الدهناء', 'الربع الخالي', 'الجافورة'], correctIndex: 2 },
  { category: 'Saudi National Day', difficulty: 'hard', prompt: 'Which site was Saudi Arabia\'s first UNESCO World Heritage Site?', promptAr: 'ما هو أول موقع سعودي يُدرج في قائمة اليونسكو للتراث العالمي؟', choices: ['Historic Jeddah', 'Hegra (Mada’in Salih)', 'At-Turaif in Diriyah', 'Rock art of Hail'], choicesAr: ['جدة التاريخية', 'الحِجر (مدائن صالح)', 'الطريف في الدرعية', 'الفنون الصخرية في حائل'], correctIndex: 1 },
  { category: 'Saudi National Day', difficulty: 'hard', prompt: 'Which son of King Abdulaziz was the first to rule after him?', promptAr: 'أي أبناء الملك عبدالعزيز تولى الحكم بعده مباشرة؟', choices: ['King Faisal', 'King Saud', 'King Khalid', 'King Fahd'], choicesAr: ['الملك فيصل', 'الملك سعود', 'الملك خالد', 'الملك فهد'], correctIndex: 1 },
  { category: 'Saudi National Day', difficulty: 'hard', prompt: 'Who founded the First Saudi State in Diriyah?', promptAr: 'من أسس الدولة السعودية الأولى في الدرعية؟', choices: ['Imam Muhammad bin Saud', 'Imam Turki bin Abdullah', 'Imam Faisal bin Turki', 'King Abdulaziz'], choicesAr: ['الإمام محمد بن سعود', 'الإمام تركي بن عبدالله', 'الإمام فيصل بن تركي', 'الملك عبدالعزيز'], correctIndex: 0 },
  { category: 'Saudi National Day', difficulty: 'hard', prompt: 'What is the name of the coastal plain along the Arabian Gulf?', promptAr: 'ما هو اسم السهل الساحلي المطل على الخليج العربي؟', choices: ['Dammam Plain', 'Al-Ahsa Plain', 'Western Plain', 'Gulf Plain'], choicesAr: ['سهل الدمام', 'سهل الأحساء', 'السهل الغربي', 'سهل الخليج'], correctIndex: 1 },
  { category: 'Saudi National Day', difficulty: 'hard', prompt: 'Which Saudi city is known as the "Pearl of the North"?', promptAr: 'ما هي المدينة السعودية التي تُعرف باسم "لؤلؤة الشمال"؟', choices: ['Haql', 'Arar', 'Rafha', 'Al-Qurayyat'], choicesAr: ['حقل', 'عرعر', 'رفحاء', 'القريات'], correctIndex: 0 },
  { category: 'Saudi National Day', difficulty: 'hard', prompt: 'Who was the famous desert guide who helped discover oil in the early 20th century?', promptAr: 'من هو الدليل الشهير الذي ساهم باكتشاف النفط في مطلع القرن العشرين؟', choices: ['Fred Davison', 'Ali Al-Naimi', 'Khamis bin Rimthan', 'Abdullah Al-Tariki'], choicesAr: ['فريد دافيسون', 'علي النعيمي', 'خميس بن رمثان', 'عبدالله الطريقي'], correctIndex: 2 },
  { category: 'Saudi National Day', difficulty: 'hard', prompt: 'Who was the Kingdom\'s first foreign minister?', promptAr: 'من هو أول وزير خارجية في تاريخ المملكة؟', choices: ['King Faisal bin Abdulaziz', 'King Saud bin Abdulaziz', 'Prince Khalid Al-Faisal', 'Prince Saud Al-Faisal'], choicesAr: ['الملك فيصل بن عبدالعزيز', 'الملك سعود بن عبدالعزيز', 'الأمير خالد الفيصل', 'الأمير سعود الفيصل'], correctIndex: 0 },
  { category: 'Saudi National Day', difficulty: 'hard', prompt: 'What was the name of the first company to produce oil in Saudi Arabia?', promptAr: 'ما اسم أول شركة بدأت في إنتاج النفط بالسعودية؟', choices: ['Ma\'aden', 'Aramco', 'SABIC', 'SOCAL'], choicesAr: ['شركة معادن', 'شركة أرامكو', 'شركة سابك', 'شركة سوكال'], correctIndex: 3 },
  { category: 'Saudi National Day', difficulty: 'hard', prompt: 'What was the first bank established in Saudi Arabia?', promptAr: 'ما هو أول بنك أنشئ في المملكة العربية السعودية؟', choices: ['The French Bank', 'The Arab Bank', 'The Dutch Bank', 'The British Bank'], choicesAr: ['البنك الفرنسي', 'البنك العربي', 'البنك الهولندي', 'البنك البريطاني'], correctIndex: 2 },
  { category: 'Saudi National Day', difficulty: 'hard', prompt: 'In which year was oil discovered in Saudi Arabia?', promptAr: 'في أي عام اكتشف النفط في السعودية؟', choices: ['1938', '1944', '1936', '1940'], choicesAr: ['١٩٣٨م', '١٩٤٤م', '١٩٣٦م', '١٩٤٠م'], correctIndex: 0 },
  { category: 'Saudi National Day', difficulty: 'hard', prompt: 'In which year was Masmak Palace built?', promptAr: 'في أي عام تم بناء قصر المصمك؟', choices: ['1899', '1890', '1865', '1892'], choicesAr: ['١٨٩٩م', '١٨٩٠م', '١٨٦٥م', '١٨٩٢م'], correctIndex: 2 },
  { category: 'Saudi National Day', difficulty: 'hard', prompt: 'Who was the first Saudi presenter to appear on television?', promptAr: 'من هو أول مذيع سعودي ظهر في التلفزيون؟', choices: ['Majid Al-Shibl', 'Ghalib Kamel', 'Abdulrahman Yaghmour', 'Muhammad Subaihi'], choicesAr: ['ماجد الشبل', 'غالب كامل', 'عبدالرحمن يغمور', 'محمد صبيحي'], correctIndex: 3 },
  { category: 'Saudi National Day', difficulty: 'hard', prompt: 'Who was Saudi Arabia\'s first oil minister?', promptAr: 'من هو أول وزير للنفط في السعودية؟', choices: ['Ahmed Zaki Yamani', 'Ali Al-Naimi', 'Khalid Al-Falih', 'Abdullah Al-Tariki'], choicesAr: ['أحمد زكي يماني', 'علي النعيمي', 'خالد الفالح', 'عبدالله الطريقي'], correctIndex: 3 },
  { category: 'Saudi National Day', difficulty: 'hard', prompt: 'Who was the Kingdom\'s first health minister?', promptAr: 'من هو أول وزير صحة في المملكة؟', choices: ['Rashad Pharaon', 'Hassan Nassif', 'Abdullah Al-Faisal', 'Hamid Al-Harsani'], choicesAr: ['رشاد فرعون', 'حسن نصيف', 'عبدالله الفيصل', 'حامد الهرساني'], correctIndex: 2 },
  { category: 'Saudi National Day', difficulty: 'hard', prompt: 'Who was the first Saudi to climb Mount Everest?', promptAr: 'من هو أول سعودي يتسلق قمة إفرست؟', choices: ['Bandar bin Khalid Al Saud', 'Saud Al-Aidi', 'Abdulaziz Al-Nimr', 'Farouq Al-Zoman'], choicesAr: ['بندر بن خالد آل سعود', 'سعود العيدي', 'عبدالعزيز النمر', 'فاروق الزومان'], correctIndex: 3 },
  { category: 'Saudi National Day', difficulty: 'hard', prompt: 'Which Saudi scientist holds a patent for a light-activated (photon) medical technology?', promptAr: 'من هي العالمة السعودية التي اكتشفت تقنية براءة اختراع في الفوتون الطبي؟', choices: ['Samia Maimani', 'Mishaal Ashemimry', 'Hayat Sindi', 'Ghada Al-Mutairi'], choicesAr: ['سامية ميمني', 'مشاعل الشميمري', 'حياة سندي', 'غادة المطيري'], correctIndex: 3 },
  { category: 'Saudi National Day', difficulty: 'hard', prompt: 'Which Saudi engineer specialises in aerospace and rocket engineering and has worked with NASA?', promptAr: 'من هي المهندسة السعودية المتخصصة في هندسة الطيران والصواريخ في ناسا؟', choices: ['Norah Al-Faiz', 'Samar Al-Mogren', 'Sarah Al-Shaya', 'Mishaal Ashemimry'], choicesAr: ['نورة الفايز', 'سمر المقرن', 'سارة الشايع', 'مشاعل الشميمري'], correctIndex: 3 },
  { category: 'Saudi National Day', difficulty: 'hard', prompt: 'Which poet wrote the operetta "Faris Al-Tawheed" for the Janadriyah Festival?', promptAr: 'من هو الشاعر الذي كتب أوبريت فارس التوحيد لمهرجان الجنادرية؟', choices: ['Badr bin Abdulmohsen', 'Abdullah Al-Faisal', 'Khalid Al-Faisal', 'Turki Al-Faisal'], choicesAr: ['بدر بن عبدالمحسن', 'عبدالله الفيصل', 'خالد الفيصل', 'تركي الفيصل'], correctIndex: 0 },
  { category: 'Saudi National Day', difficulty: 'hard', prompt: 'Who wrote the poem "Ajal nahnu al-Hijaz wa nahnu Najd" (Yes, we are Hijaz and we are Najd)?', promptAr: 'من هو كاتب قصيدة "أجل نحن الحجاز ونحن نجد"؟', choices: ['Musaed Al-Rashidi', 'Fahd bin Fasla', 'Ghazi Al-Gosaibi', 'Khalaf bin Hathal'], choicesAr: ['مساعد الرشيدي', 'فهد بن فصلا', 'غازي القصيبي', 'خلف بن هذال'], correctIndex: 2 },
  { category: 'Saudi National Day', difficulty: 'hard', prompt: 'Which Saudi woman was nicknamed "Umm Al-Masakin" (Mother of the Poor) for her charity work?', promptAr: 'من هي السعودية الملقبة "أم المساكين" لعطائها و أعمالها الخيرية؟', choices: ['Ruqayya Al-Hajji', 'Moudi Al-Bassam', 'Thuraya Al-Muzaini', 'Noura Al-Ruhait'], choicesAr: ['رقية الحجي', 'موضي البسام', 'ثريا المزيني', 'نورة الرهيط'], correctIndex: 1 },
  { category: 'Saudi National Day', difficulty: 'hard', prompt: 'Which Saudi region is home to the largest olive farm in the world?', promptAr: 'ما هي المنطقة السعودية التي تحتوي على أكبر مزرعة زيتون في العالم؟', choices: ['Al-Jouf Region', 'Eastern Province', 'Asir Region', 'Makkah Region'], choicesAr: ['منطقة الجوف', 'المنطقة الشرقية', 'منطقة عسير', 'منطقة مكة المكرمة'], correctIndex: 0 },
  { category: 'Saudi National Day', difficulty: 'hard', prompt: 'Majnun Layla mentioned a place called "Rama" in one of his verses. Where is it?', promptAr: 'ذكر مجنون ليلى منطقة "رامة" في أحد أبياته الشعرية، أين تقع هذه المنطقة؟', choices: ['Jeddah', 'Al-Qassim', 'Al-Ahsa', 'Abha'], choicesAr: ['جدة', 'القصيم', 'الأحساء', 'أبها'], correctIndex: 1 },
  { category: 'Saudi National Day', difficulty: 'hard', prompt: 'What was the first newspaper published in Saudi Arabia?', promptAr: 'ما هي أول جريدة تم إصدارها في المملكة العربية السعودية؟', choices: ['Al-Nadwa', 'Umm Al-Qura', 'Okaz', 'Al-Riyadh'], choicesAr: ['جريدة الندوة', 'جريدة أم القرى', 'جريدة عكاظ', 'جريدة الرياض'], correctIndex: 1 },
  { category: 'Saudi National Day', difficulty: 'hard', prompt: 'What does the Najdi word "مصع" (masa\') mean?', promptAr: 'ما معنى كلمة "مصع" باللهجة النجدية؟', choices: ['Pulled hard', 'Ate greedily', 'Ran fast', 'Shouted loudly'], choicesAr: ['شد بقوة', 'أكل بشرهة', 'ركض بسرعة', 'صرخ بصوت عالي'], correctIndex: 0 },
  { category: 'Saudi National Day', difficulty: 'hard', prompt: 'What does the Qassimi word "احترين" (ihtareen) mean?', promptAr: 'ما معنى كلمة "احترين" باللهجة القصيمية؟', choices: ['I was surprised', 'Go away from me', 'Wait for me', 'Help me'], choicesAr: ['استغربت', 'اذهب عني', 'انتظرني', 'ساعدني'], correctIndex: 2 },
  { category: 'Saudi National Day', difficulty: 'hard', prompt: 'What does the Qassimi word "خرمس" (khurmus) mean?', promptAr: 'ما معنى كلمة "خرمس" باللهجة القصيمية؟', choices: ['Light', 'Noise', 'Darkness', 'Quiet'], choicesAr: ['النور', 'الإزعاج', 'الظلام', 'الهدوء'], correctIndex: 2 },
  { category: 'Saudi National Day', difficulty: 'hard', prompt: 'What does the Saudi expression "سردادي مردادي" (sirdadi mirdadi) mean?', promptAr: 'ما معنى مصطلح "سردادي مردادي" باللهجة السعودية؟', choices: ['Coming and going', 'Front and back', 'Up and down', 'Left and right'], choicesAr: ['ذهاب وإياب', 'أمام و خلف', 'فوق و تحت', 'يمين و يسار'], correctIndex: 0 },
  { category: 'Saudi National Day', difficulty: 'hard', prompt: 'The sound feature "الدزدزة" (ad-dazdaza) appears in which Saudi dialect?', promptAr: '"الدزدزة" ظاهرة صوتية تظهر في أي لهجة سعودية؟', choices: ['Hassawi', 'Hijazi', 'Qassimi', 'Southern'], choicesAr: ['الحساوية', 'الحجازية', 'القصيمية', 'الجنوبية'], correctIndex: 2 },
  { category: 'Saudi National Day', difficulty: 'hard', prompt: 'What does the Qassimi word "كود" (kood) mean?', promptAr: 'ما معنى كلمة "كود" باللهجة القصيمية؟', choices: ['Mind you', 'Hopefully / perhaps', 'On', 'To'], choicesAr: ['ترى', 'عسى', 'على', 'إلى'], correctIndex: 1 },
  { category: 'Saudi National Day', difficulty: 'hard', prompt: 'What does the Southern word "يفتق" (yiftiq) mean?', promptAr: 'ما معنى كلمة "يفتق" باللهجة الجنوبية؟', choices: ['Sweet / nice', 'Ugly', 'Painful', 'Strange'], choicesAr: ['حلو', 'قبيح', 'مؤلم', 'غريب'], correctIndex: 0 },
  { category: 'Saudi National Day', difficulty: 'hard', prompt: 'What does the Southern word "تخنطل" (takhantal) mean?', promptAr: 'ما معنى كلمة "تخنطل" باللهجة الجنوبية؟', choices: ['Stumbled', 'Acted clever', 'Played dumb', 'Kept his balance'], choicesAr: ['تعثر', 'تذاكى', 'تغابى', 'اتزن'], correctIndex: 0 },
  { category: 'Saudi National Day', difficulty: 'hard', prompt: 'The sound feature "الكشكشة" (al-kashkasha) appears in which Saudi dialect?', promptAr: '"الكشكشة" ظاهرة صوتية تظهر في أي لهجة سعودية؟', choices: ['Najdi dialect', 'Southern dialect', 'Qassimi dialect', 'Hijazi dialect'], choicesAr: ['اللهجة النجدية', 'اللهجة الجنوبية', 'اللهجة القصيمية', 'اللهجة الحجازية'], correctIndex: 1 },
  // --- Science ---
  { category: 'Science', difficulty: 'easy', prompt: 'How many legs does a spider have?', promptAr: 'كم عدد أرجل العنكبوت؟', choices: ['6', '8', '10', '12'], choicesAr: ['6', '8', '10', '12'], correctIndex: 1 },
  { category: 'Science', difficulty: 'easy', prompt: 'What do bees produce?', promptAr: 'ماذا تنتج النحل؟', choices: ['Milk', 'Honey', 'Silk', 'Wax only'], choicesAr: ['حليب', 'عسل', 'حرير', 'شمع فقط'], correctIndex: 1 },
  { category: 'Science', difficulty: 'easy', prompt: 'What force pulls objects toward Earth?', promptAr: 'ما هي القوة التي تجذب الأجسام نحو الأرض؟', choices: ['Magnetism', 'Gravity', 'Friction', 'Tension'], choicesAr: ['المغناطيسية', 'الجاذبية', 'الاحتكاك', 'الشد'], correctIndex: 1 },
  { category: 'Science', difficulty: 'easy', prompt: 'What is water made of?', promptAr: 'مم يتكون الماء؟', choices: ['Hydrogen and Oxygen', 'Carbon and Oxygen', 'Hydrogen and Nitrogen', 'Oxygen only'], choicesAr: ['الهيدروجين والأكسجين', 'الكربون والأكسجين', 'الهيدروجين والنيتروجين', 'الأكسجين فقط'], correctIndex: 0 },
  { category: 'Science', difficulty: 'easy', prompt: 'What organ pumps blood through the body?', promptAr: 'ما هو العضو الذي يضخ الدم في الجسم؟', choices: ['Lungs', 'Liver', 'Heart', 'Kidney'], choicesAr: ['الرئتان', 'الكبد', 'القلب', 'الكلى'], correctIndex: 2 },
  { category: 'Science', difficulty: 'easy', prompt: 'What planet do we live on?', promptAr: 'على أي كوكب نعيش؟', choices: ['Mars', 'Venus', 'Earth', 'Mercury'], choicesAr: ['المريخ', 'الزهرة', 'الأرض', 'عطارد'], correctIndex: 2 },
  { category: 'Science', difficulty: 'medium', prompt: 'How many bones are in the adult human body?', promptAr: 'كم عدد عظام جسم الإنسان البالغ؟', choices: ['186', '206', '226', '246'], choicesAr: ['186', '206', '226', '246'], correctIndex: 1 },
  { category: 'Science', difficulty: 'medium', prompt: 'What gas do plants primarily absorb from the atmosphere?', promptAr: 'ما هو الغاز الذي تمتصه النباتات بشكل أساسي من الغلاف الجوي؟', choices: ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Hydrogen'], choicesAr: ['الأكسجين', 'النيتروجين', 'ثاني أكسيد الكربون', 'الهيدروجين'], correctIndex: 2 },
  { category: 'Science', difficulty: 'medium', prompt: 'What is the chemical symbol for gold?', promptAr: 'ما هو الرمز الكيميائي للذهب؟', choices: ['Ag', 'Au', 'Gd', 'Go'], choicesAr: ['Ag', 'Au', 'Gd', 'Go'], correctIndex: 1 },
  { category: 'Science', difficulty: 'medium', prompt: 'What is the hardest natural substance on Earth?', promptAr: 'ما هي أصلب مادة طبيعية على وجه الأرض؟', choices: ['Gold', 'Iron', 'Diamond', 'Quartz'], choicesAr: ['الذهب', 'الحديد', 'الألماس', 'الكوارتز'], correctIndex: 2 },
  { category: 'Science', difficulty: 'medium', prompt: 'What is the speed of light approximately?', promptAr: 'ما هي سرعة الضوء تقريبًا؟', choices: ['300,000 km/s', '150,000 km/s', '3,000 km/s', '30,000 km/s'], choicesAr: ['300,000 كم/ث', '150,000 كم/ث', '3,000 كم/ث', '30,000 كم/ث'], correctIndex: 0 },
  { category: 'Science', difficulty: 'medium', prompt: 'Which planet has the most moons?', promptAr: 'أي كوكب لديه أكبر عدد من الأقمار؟', choices: ['Jupiter', 'Saturn', 'Uranus', 'Neptune'], choicesAr: ['المشتري', 'زحل', 'أورانوس', 'نبتون'], correctIndex: 1 },
  { category: 'Science', difficulty: 'hard', prompt: 'What is the SI unit of electrical resistance?', promptAr: 'ما هي وحدة قياس المقاومة الكهربائية؟', choices: ['Volt', 'Ohm', 'Watt', 'Ampere'], choicesAr: ['فولت', 'أوم', 'واط', 'أمبير'], correctIndex: 1 },
  { category: 'Science', difficulty: 'hard', prompt: 'What is the most abundant gas in Earth\'s atmosphere?', promptAr: 'ما هو أكثر الغازات وفرة في الغلاف الجوي للأرض؟', choices: ['Oxygen', 'Carbon Dioxide', 'Nitrogen', 'Argon'], choicesAr: ['الأكسجين', 'ثاني أكسيد الكربون', 'النيتروجين', 'الأرغون'], correctIndex: 2 },
  { category: 'Science', difficulty: 'hard', prompt: 'What is the powerhouse of the cell?', promptAr: 'ما هو مركز الطاقة في الخلية؟', choices: ['Nucleus', 'Ribosome', 'Mitochondria', 'Golgi apparatus'], choicesAr: ['النواة', 'الريبوسوم', 'الميتوكوندريا', 'جهاز غولجي'], correctIndex: 2 },
  { category: 'Science', difficulty: 'hard', prompt: 'What type of bond involves the sharing of electron pairs?', promptAr: 'أي نوع من الروابط يتضمن مشاركة أزواج الإلكترونات؟', choices: ['Ionic', 'Covalent', 'Metallic', 'Hydrogen'], choicesAr: ['أيونية', 'تساهمية', 'فلزية', 'هيدروجينية'], correctIndex: 1 },
  { category: 'Science', difficulty: 'hard', prompt: 'Which element has the atomic number 1?', promptAr: 'أي عنصر يحمل العدد الذري 1؟', choices: ['Helium', 'Hydrogen', 'Lithium', 'Carbon'], choicesAr: ['الهيليوم', 'الهيدروجين', 'الليثيوم', 'الكربون'], correctIndex: 1 },
  { category: 'Science', difficulty: 'hard', prompt: 'Which scientist proposed the theory of general relativity?', promptAr: 'أي عالم اقترح نظرية النسبية العامة؟', choices: ['Newton', 'Bohr', 'Einstein', 'Curie'], choicesAr: ['نيوتن', 'بور', 'أينشتاين', 'كوري'], correctIndex: 2 },
  // --- Sports ---
  { category: 'Sports', difficulty: 'easy', prompt: 'How many players are on a basketball team on the court at once?', promptAr: 'كم عدد لاعبي فريق كرة السلة على الملعب في آنٍ واحد؟', choices: ['4', '5', '6', '7'], choicesAr: ['4', '5', '6', '7'], correctIndex: 1 },
  { category: 'Sports', difficulty: 'easy', prompt: 'How many points is a touchdown worth in American football?', promptAr: 'كم عدد النقاط التي تساويها "التاتشداون" في كرة القدم الأمريكية؟', choices: ['3', '5', '6', '7'], choicesAr: ['3', '5', '6', '7'], correctIndex: 2 },
  { category: 'Sports', difficulty: 'easy', prompt: 'In swimming, what stroke involves swimming on your back?', promptAr: 'في السباحة، ما هي الطريقة التي تتضمن السباحة على الظهر؟', choices: ['Freestyle', 'Backstroke', 'Breaststroke', 'Butterfly'], choicesAr: ['السباحة الحرة', 'سباحة الظهر', 'سباحة الصدر', 'الفراشة'], correctIndex: 1 },
  { category: 'Sports', difficulty: 'easy', prompt: 'In which sport do you use a racket to hit a shuttlecock?', promptAr: 'في أي رياضة تُستخدم المضرب لضرب الريشة؟', choices: ['Tennis', 'Badminton', 'Squash', 'Table Tennis'], choicesAr: ['التنس', 'البادمنتون', 'الاسكواش', 'تنس الطاولة'], correctIndex: 1 },
  { category: 'Sports', difficulty: 'easy', prompt: 'What shape is a soccer field?', promptAr: 'ما هو شكل ملعب كرة القدم؟', choices: ['Circle', 'Rectangle', 'Square', 'Triangle'], choicesAr: ['دائرة', 'مستطيل', 'مربع', 'مثلث'], correctIndex: 1 },
  { category: 'Sports', difficulty: 'easy', prompt: 'Which sport is known as \'America\'s pastime\'?', promptAr: 'أي رياضة تُعرف بـ"هواية أمريكا المفضلة"؟', choices: ['Basketball', 'Baseball', 'Football', 'Hockey'], choicesAr: ['كرة السلة', 'البيسبول', 'كرة القدم الأمريكية', 'الهوكي'], correctIndex: 1 },
  { category: 'Sports', difficulty: 'medium', prompt: 'How many players are on a standard soccer team on the field?', promptAr: 'كم عدد لاعبي فريق كرة القدم القياسي على أرض الملعب؟', choices: ['9', '10', '11', '12'], choicesAr: ['9', '10', '11', '12'], correctIndex: 2 },
  { category: 'Sports', difficulty: 'medium', prompt: 'How many rings are on the Olympic flag?', promptAr: 'كم عدد الحلقات في العلم الأولمبي؟', choices: ['4', '5', '6', '7'], choicesAr: ['4', '5', '6', '7'], correctIndex: 1 },
  { category: 'Sports', difficulty: 'medium', prompt: 'Which country hosted the 2016 Summer Olympics?', promptAr: 'أي دولة استضافت دورة الألعاب الأولمبية الصيفية لعام 2016؟', choices: ['China', 'United Kingdom', 'Brazil', 'Japan'], choicesAr: ['الصين', 'المملكة المتحدة', 'البرازيل', 'اليابان'], correctIndex: 2 },
  { category: 'Sports', difficulty: 'medium', prompt: 'How often are the Summer Olympic Games held?', promptAr: 'كل كم سنة تُقام الألعاب الأولمبية الصيفية؟', choices: ['Every 2 years', 'Every 3 years', 'Every 4 years', 'Every 5 years'], choicesAr: ['كل سنتين', 'كل 3 سنوات', 'كل 4 سنوات', 'كل 5 سنوات'], correctIndex: 2 },
  { category: 'Sports', difficulty: 'medium', prompt: 'In tennis, what is a score of zero called?', promptAr: 'في التنس، ماذا تُسمى نتيجة الصفر؟', choices: ['Deuce', 'Love', 'Ace', 'Fault'], choicesAr: ['ديوس', 'لوف', 'إيس', 'فولت'], correctIndex: 1 },
  { category: 'Sports', difficulty: 'medium', prompt: 'In which sport would you perform a slam dunk?', promptAr: 'في أي رياضة يمكنك تنفيذ "صمة قوية"؟', choices: ['Volleyball', 'Basketball', 'Tennis', 'Badminton'], choicesAr: ['الكرة الطائرة', 'كرة السلة', 'التنس', 'البادمنتون'], correctIndex: 1 },
  { category: 'Sports', difficulty: 'hard', prompt: 'How many Grand Slam tennis tournaments are there in a year?', promptAr: 'كم عدد بطولات الغراند سلام في التنس خلال العام؟', choices: ['2', '3', '4', '5'], choicesAr: ['2', '3', '4', '5'], correctIndex: 2 },
  { category: 'Sports', difficulty: 'hard', prompt: 'How many players are on a cricket team?', promptAr: 'كم عدد لاعبي فريق الكريكيت؟', choices: ['9', '10', '11', '12'], choicesAr: ['9', '10', '11', '12'], correctIndex: 2 },
  { category: 'Sports', difficulty: 'hard', prompt: 'In golf, what term describes one stroke under par?', promptAr: 'في الغولف، ما المصطلح الذي يصف ضربة واحدة أقل من المعدل؟', choices: ['Bogey', 'Birdie', 'Eagle', 'Albatross'], choicesAr: ['بوغي', 'بيردي', 'إيغل', 'ألباتروس'], correctIndex: 1 },
  { category: 'Sports', difficulty: 'hard', prompt: 'In which year were the first modern Olympic Games held?', promptAr: 'في أي عام أُقيمت أول ألعاب أولمبية حديثة؟', choices: ['1892', '1896', '1900', '1904'], choicesAr: ['1892', '1896', '1900', '1904'], correctIndex: 1 },
  { category: 'Sports', difficulty: 'hard', prompt: 'Which boxer was known as \'The Greatest\' and famously fought Joe Frazier?', promptAr: 'أي ملاكم عُرف بـ"الأعظم" وخاض مباراة شهيرة ضد جو فريزر؟', choices: ['Mike Tyson', 'Muhammad Ali', 'George Foreman', 'Sugar Ray Robinson'], choicesAr: ['مايك تايسون', 'محمد علي كلاي', 'جورج فورمان', 'سوغار راي روبنسون'], correctIndex: 1 },
  { category: 'Sports', difficulty: 'hard', prompt: 'Which country has won the most FIFA World Cup titles?', promptAr: 'أي دولة فازت بأكبر عدد من ألقاب كأس العالم لكرة القدم؟', choices: ['Germany', 'Argentina', 'Brazil', 'Italy'], choicesAr: ['ألمانيا', 'الأرجنتين', 'البرازيل', 'إيطاليا'], correctIndex: 2 },
];

const KYB_PROMPTS: Array<{ category: string; text: string }> = [
  { category: 'Favorites', text: 'What is your favorite comfort food?' },
  { category: 'Favorites', text: 'What movie could you watch on repeat forever?' },
  { category: 'Favorites', text: 'What is your favorite childhood memory?' },
  { category: 'Favorites', text: 'What song instantly puts you in a good mood?' },
  { category: 'Personality', text: 'Are you more of a morning person or a night owl, and why?' },
  { category: 'Personality', text: 'What is a small thing that always makes you smile?' },
  { category: 'Personality', text: 'What is your biggest pet peeve?' },
  { category: 'Memories', text: 'What is the best birthday you can remember?' },
  { category: 'Memories', text: 'What is the funniest thing that has happened to you this year?' },
  { category: 'Memories', text: 'What was your first concert or live show?' },
  { category: 'Relationships', text: 'Who is someone who inspires you, and why?' },
  { category: 'Relationships', text: 'Describe your best friend in three words.' },
  { category: 'Fun', text: 'If you could have one superpower, what would it be?' },
  { category: 'Fun', text: 'What is your dream (even if impractical) pet?' },
  { category: 'Fun', text: 'If you won the lottery tomorrow, what is the first thing you would buy?' },
  { category: 'Deep questions', text: 'What motivates you to get up in the morning?' },
  { category: 'Deep questions', text: 'What does success mean to you?' },
  { category: 'Deep questions', text: 'What is a piece of advice that changed how you think?' },
  { category: 'Deep questions', text: 'What is something you are proud of that most people do not know about?' },
  { category: 'Fun', text: 'What is the most useless talent you have?' },
];

// The real bilingual question bank (translated from the user-supplied
// Arabic source, Knows_You_Best_Questions_Bank.docx, whose three sections are
// اكسروا الجليد / تخيل لو … / للمقربين فقط) -- supersedes
// KYB_PROMPTS above in practice (that stays seeded for continuity, nothing
// deletes existing rows, but this dwarfs it). One source line had two
// questions merged with no separator ("ايش هي اللعبة اللي محد يفوز عليك
// فيها؟أكثر بلد تحب أهلها؟") which is split into two entries below.
const KYB_PROMPTS_V2: Array<{ category: string; text: string; textAr: string }> = [
  // --- Break the Ice (اكسروا الجليد) ---
  { category: 'Break the Ice', text: "What's your favorite color?", textAr: 'ايش هو لونك المفضل؟' },
  { category: 'Break the Ice', text: "What's your favorite food?", textAr: 'ايش هي أكلتك المفضلة؟' },
  { category: 'Break the Ice', text: 'How do you spend your weekend off?', textAr: 'كيف تقضي إجازة نهاية الأسبوع؟' },
  { category: 'Break the Ice', text: "What's your favorite song?", textAr: 'ايش هي أغنيتك المفضلة؟' },
  { category: 'Break the Ice', text: "Where's a place you'd love to travel to?", textAr: 'مكان ودك تسافر له؟' },
  { category: 'Break the Ice', text: "What's your favorite hobby?", textAr: 'ايش هي هوايتك المفضلة؟' },
  { category: 'Break the Ice', text: "What's the last thing you read?", textAr: 'آخر شيء قرأته؟' },
  { category: 'Break the Ice', text: "What's the one word that best describes you?", textAr: 'أكثر كلمة توصفك؟' },
  { category: 'Break the Ice', text: "What's your favorite movie?", textAr: 'ايش أفضل فيلم بالنسبة لك؟' },
  { category: 'Break the Ice', text: "What's your favorite TV show?", textAr: 'ايش أفضل مسلسل بالنسبة لك؟' },
  { category: 'Break the Ice', text: "What's your favorite summer activity?", textAr: 'أكثر فعالية تحبها في الصيف؟' },
  { category: 'Break the Ice', text: "What's your favorite winter activity?", textAr: 'أكثر فعالية تحبها في الشتاء؟' },
  { category: 'Break the Ice', text: "What's your favorite type of exercise?", textAr: 'ايش هو النوع المفضل من التمارين بالنسبة لك؟' },
  { category: 'Break the Ice', text: "What's the app you use most on your phone?", textAr: 'ايش هو أكثر تطبيق تستخدمه على الجوال؟' },
  { category: 'Break the Ice', text: "What's the drink you always order?", textAr: 'ايش هو المشروب اللي تطلبه دائمًا؟' },
  { category: 'Break the Ice', text: "What's the best dish you make when you cook for yourself?", textAr: 'ايش هو أفضل طبق تضبطه لما تطبخه بنفسك؟' },
  { category: 'Break the Ice', text: "What's your favorite saying or quote?", textAr: 'ايش هي المقولة المفضلة بالنسبة لك؟' },
  { category: 'Break the Ice', text: "What's the one thing that can instantly make your day better?", textAr: 'ايش هو الشيء الوحيد اللي ممكن يجعل يومك أفضل على طول؟' },
  { category: 'Break the Ice', text: "What's the thing that instantly calms you down?", textAr: 'ايش هو الشيء اللي يهدي أعصابك على طول؟' },
  { category: 'Break the Ice', text: "What's the best age you've been so far in your life?", textAr: 'أحلى فترة عمرية مرت عليك في حياتك؟' },
  { category: 'Break the Ice', text: 'How do you spend your commute to work?', textAr: 'كيف تقضي طريق الدوام؟' },
  { category: 'Break the Ice', text: 'Have you ever hated something and then changed your mind about it?', textAr: 'قد كرهت شيء لكن بعدها غيرت رأيك عنه؟' },
  { category: 'Break the Ice', text: "What's your favorite café?", textAr: 'أكثر مقهى تحبه؟' },
  { category: 'Break the Ice', text: "What's the most valuable thing you own?", textAr: 'ايش هو أغلى شيء تملكه؟' },
  { category: 'Break the Ice', text: "What's the one thing you can't live without?", textAr: 'ايش هو الشيء اللي لا يمكن تعيش بدونه؟' },
  { category: 'Break the Ice', text: 'If you could own any exotic animal as a pet, what would it be?', textAr: 'إذا كان بإمكانك اقتناء أي حيوان غريب كحيوان أليف، ايش بيكون؟' },
  { category: 'Break the Ice', text: "What's the first thing you'd do if you got a million dollars?", textAr: 'ايش هو أول شيء بتسويه إذا حصلت على مليون دولار؟' },
  { category: 'Break the Ice', text: 'What do you love most about your job?', textAr: 'ايش أكثر شيء تحبه في وظيفتك؟' },
  { category: 'Break the Ice', text: 'What trait annoys you the most?', textAr: 'ايش أكثر صفة تزعجك؟' },
  { category: 'Break the Ice', text: "What's the achievement you're most proud of?", textAr: 'ايش أبرز إنجاز تفتخر به؟' },
  { category: 'Break the Ice', text: 'What quality do you look for in your boss?', textAr: 'ايش الصفة التي تبحث عنها في رئيسك؟' },
  { category: 'Break the Ice', text: 'How do you motivate yourself in life?', textAr: 'كيف تحفز نفسك في الحياة؟' },
  { category: 'Break the Ice', text: "Who's the person you love spending time with most?", textAr: 'مين هو أكثر شخص تحب قضاء الوقت معه؟' },
  { category: 'Break the Ice', text: "Who's your role model in life?", textAr: 'مين قدوتك في الحياة؟' },
  { category: 'Break the Ice', text: 'What quality do you look for in a friend?', textAr: 'صفة تبحث عنها في صديقك؟' },
  { category: 'Break the Ice', text: 'What superpower do you wish you had?', textAr: 'قوة خارقة تتمنى تكون عندك؟' },
  { category: 'Break the Ice', text: "What's the most important skill a person can have?", textAr: 'أهم مهارة تكون عند الشخص؟' },
  { category: 'Break the Ice', text: 'If you had a time machine, which era would you travel to?', textAr: 'لو صار عندك آلة زمن، إلى أي حقبة بتسافر؟' },
  { category: 'Break the Ice', text: 'If you could live one day as someone else, who would it be?', textAr: 'لو توفرت لك الفرصة تعيش حياة شخص واحد لمدة يوم، مين بيكون؟' },
  { category: 'Break the Ice', text: "What's the best gift you've ever received?", textAr: 'أجمل هدية وصلتك في حياتك؟' },
  { category: 'Break the Ice', text: 'What talent do you wish you had?', textAr: 'ايش الموهبة اللي تتمنى لو كانت عندك؟' },
  { category: 'Break the Ice', text: "What's the strangest place you've ever visited?", textAr: 'أغرب مكان زرته في حياتك؟' },
  { category: 'Break the Ice', text: "What's a new experience you'd like to try?", textAr: 'ايش تجربة جديدة ودك تعيشها؟' },
  { category: 'Break the Ice', text: 'In your opinion, what is the most important invention in human history?', textAr: 'برأيك، ايش أهم اختراع في تاريخ البشرية؟' },
  { category: 'Break the Ice', text: 'In your opinion, what is the most important discovery in human history?', textAr: 'برأيك، ايش أهم اكتشاف في تاريخ البشرية؟' },
  { category: 'Break the Ice', text: "What's the goal you most want to achieve this year?", textAr: 'أكثر هدف ودك تحققه هذه السنة؟' },
  { category: 'Break the Ice', text: "What's the one game nobody can beat you at?", textAr: 'ايش هي اللعبة اللي محد يفوز عليك فيها؟' },
  { category: 'Break the Ice', text: "Which country's people do you like the most?", textAr: 'أكثر بلد تحب أهلها؟' },
  { category: 'Break the Ice', text: "What's the compliment you love hearing most?", textAr: 'أكثر مدحة تحب تسمعها؟' },
  { category: 'Break the Ice', text: "What's the strangest fact you know?", textAr: 'أغرب معلومة تعرفها؟' },
  { category: 'Break the Ice', text: 'What behavior in people annoys you the most?', textAr: 'ايش أكثر تصرف يستفزك من الناس؟' },
  { category: 'Break the Ice', text: "What's the word you say the most?", textAr: 'ايش أكثر كلمة تقولها؟' },
  { category: 'Break the Ice', text: 'What language do you wish you could master?', textAr: 'ايش أكثر لغة تتمنى لو تتقنها؟' },

  // --- Imagine If (تخيل لو …) ---
  { category: 'Imagine If', text: 'If you could learn the truth about one mystery in the world, what would it be?', textAr: 'لو قدرت تعرف حقيقة شيء واحد غامض بالعالم، ايش بيكون؟' },
  { category: 'Imagine If', text: 'If you could have any job in the world, what would you choose?', textAr: 'لو توفرت لك كل وظيفة بالعالم ايش تختار تشتغل؟' },
  { category: 'Imagine If', text: 'If you went back in time and met your 10-year-old self, what advice would you give them?', textAr: 'لو رجعت بالزمن و قابلت نفسك البالغة من العمر 10 سنوات ايش راح تنصحها؟' },
  { category: 'Imagine If', text: 'If any wish in life could come true, what would it be?', textAr: 'لو ممكن تتحقق لك أي أمنية بالحياة، ايش بتكون؟' },
  { category: 'Imagine If', text: 'If you were given a million riyals you had to spend in one day with no investing, how would you spend it?', textAr: 'لو أعطوك مليون ريال لازم تصرفها خلال يوم بدون استثمار، كيف بتصرفها؟' },
  { category: 'Imagine If', text: 'If you could live inside a TV show as one of the characters, which show would you choose?', textAr: 'لو قدرت تعيش داخل مسلسل كواحد من الشخصيات، أي مسلسل بتختار؟' },
  { category: 'Imagine If', text: 'If you found out your close friend was talking about you behind your back, what would you do?', textAr: 'لو صاحبك المقرّب انكشف إنه يتكلم عليك من وراك، وش بتسوي؟' },
  { category: 'Imagine If', text: 'If you saw someone being bullied in front of you, how would you react?', textAr: 'لو شفت أحد يتعرض للتنمر قدامك، كيف تتصرف؟' },
  { category: 'Imagine If', text: 'If a friend asked for your help with something against your principles, what would you do?', textAr: 'لو أحد أصدقائك طلب مساعدتك في شيء ضد مبادئك، وش بتسوي؟' },
  { category: 'Imagine If', text: 'If your boss asked you to lie in a report, what would you do?', textAr: 'لو مديرك طلب منك تكذب في تقرير، وش بتسوي؟' },
  { category: 'Imagine If', text: 'If you got a job offer in another country, where would you go?', textAr: 'لو جتك فرصة عمل في بلد ثاني، وين بتروح؟' },
  { category: 'Imagine If', text: 'If you forgot to prepare an important presentation and had only 10 minutes left, what would you do?', textAr: 'لو نسيت تحضير عرض تقديمي مهم وقدامك 10 دقائق، كيف تتصرف؟' },
  { category: 'Imagine If', text: 'If you found a large sum of money on the street, what would you do?', textAr: 'لو لقيت مبلغ كبير في الشارع، وش بتسوي؟' },
  { category: 'Imagine If', text: "If you suddenly lost all your money, what's the first thing you'd do?", textAr: 'لو خسرت كل فلوسك فجأة، وش أول شي تسويه؟' },
  { category: 'Imagine If', text: "If someone close to you asked for a large sum of money and you didn't trust them, what would you do?", textAr: 'لو أحد قريب منك طلب مبلغ كبير وأنت ما تثق فيه، وش بتسوي؟' },
  { category: 'Imagine If', text: 'If you woke up one day and found yourself sent back in time, what would you do?', textAr: 'لو صحيت يوم ولقيت نفسك رجعت لزمن في الماضي، وش بتسوي؟' },
  { category: 'Imagine If', text: 'If you woke up one day and found yourself sent to the future, what would you do?', textAr: 'لو صحيت يوم ولقيت نفسك رحلت لزمن في المستقبل، وش بتسوي؟' },
  { category: 'Imagine If', text: 'If you could stop time for a whole day without anyone knowing, what would you do with it?', textAr: 'لو قدرت توقف الزمن يوم كامل بدون ما أحد يعرف، وش بتسوي فيه؟' },
  { category: 'Imagine If', text: 'If you were the only one who knew about an upcoming disaster, what would you do?', textAr: 'لو كنت الوحيد اللي يعرف عن كارثة قادمة، وش بتسوي؟' },
  { category: 'Imagine If', text: "If you could read people's minds for a week, whose mind would you read?", textAr: 'لو قدرت تقرأ أفكار الناس لمدة أسبوع، بتقرأ أفكار مين؟' },
  { category: 'Imagine If', text: 'If you met a future version of yourself, what would you ask them?', textAr: 'لو قابلت نسخة منك من المستقبل، ايش بتسألها؟' },
  { category: 'Imagine If', text: 'If everyone forgot about you overnight, what would you do?', textAr: 'لو كل الناس نسوا عنك في يوم وليلة، كيف بتتصرف؟' },
  { category: 'Imagine If', text: 'What would you do if you woke up as a corn kernel?', textAr: 'وش بتسوي لو صحيت وصرت حبة ذرة؟' },
  { category: 'Imagine If', text: "What would you do if your voice suddenly became a penguin's voice?", textAr: 'وش بتسوي لو فجأة صار صوتك صوت بطريق؟' },
  { category: 'Imagine If', text: 'If you could suddenly understand all animals, how would you act?', textAr: 'لو صرت تفهم كلام الحيوانات كلها، كيف بتتصرف؟' },
  { category: 'Imagine If', text: 'What would you do if everything you touched turned into a cookie?', textAr: 'وش بتسوي لو كل شي تلمسه يتحول لبسكويت؟' },
  { category: 'Imagine If', text: 'If everyone started dressing exactly like you every day, how would you react?', textAr: 'لو صاروا كل الناس يلبسون زيك بالضبط كل يوم، كيف بتتصرف؟' },
  { category: 'Imagine If', text: 'If you had a watch that could stop time, how would you use it?', textAr: 'لو كان عندك ساعة توقف الوقت، كيف بتستخدمها؟' },
  { category: 'Imagine If', text: 'If you could change one decision from your past, what would it be?', textAr: 'لو قدرت تغير قرار واحد في الماضي، ايش بيكون؟' },
  { category: 'Imagine If', text: 'If you were given a billion riyals but had to live alone on an island, would you take it?', textAr: 'لو أعطوك مليار ريال بس لازم تعيش بجزيرة لحالك، بتأخذها؟' },
  { category: 'Imagine If', text: 'If you had to eat only one food for the rest of your life, what would it be?', textAr: 'لو لازم تاكل أكل واحد بس طول عمرك، ايش بيكون؟' },
  { category: 'Imagine If', text: 'What would you do if you were the last person on Earth?', textAr: 'وش بتسوي لو كنت آخر شخص على وجه الأرض؟' },
  { category: 'Imagine If', text: 'If you won a free trip to Mars, how would you react?', textAr: 'لو فزت برحلة مجانية لكوكب المريخ، كيف بتتصرف؟' },
  { category: 'Imagine If', text: 'What would you do if you got your dream job but in a place you hate?', textAr: 'وش بتسوي لو عطوك وظيفة أحلامك بس بمكان تكرهه؟' },
  { category: 'Imagine If', text: 'If money were no longer needed in the world, how would you spend your time?', textAr: 'لو ما كان فيه حاجة للفلوس بالعالم، كيف بتقضي وقتك؟' },
  { category: 'Imagine If', text: 'If you had the chance for the whole planet to hear you for one minute, what would you say?', textAr: 'لو جتك فرصة كل سكان الكوكب يسمعونك لمدة دقيقة، ايش بتقول؟' },
  { category: 'Imagine If', text: "If you had to live as someone else's identity for a year, who would you choose to be?", textAr: 'لو لازم تعيش بهوية شخص ثاني لمدة سنة، مين بتختار تكون؟' },
  { category: 'Imagine If', text: 'If you could create one law to apply worldwide, what would it be?', textAr: 'لو قدرت تسوي قانون واحد يطبق عالميًا، ايش بيكون؟' },
  { category: 'Imagine If', text: 'If every language merged into one, which language would you choose it to be?', textAr: 'لو كل اللغات اندمجت بلغة وحدة، ايش اللغة اللي بتختارها؟' },
  { category: 'Imagine If', text: 'If the internet suddenly disappeared, what would affect you the most?', textAr: 'لو ما عاد فيه إنترنت فجأة، ايش أكثر شيء بيأثر فيك؟' },
  { category: 'Imagine If', text: "If you got to rule the world for one day, what's the first thing you'd do?", textAr: 'لو كان عندك فرصة تحكم العالم ليوم واحد، ايش أول شيء بتسويه؟' },
  { category: 'Imagine If', text: 'If you were chosen to give a TED talk, what topic would you choose?', textAr: 'لو اختاروك تلقي محاضرة TED، بتختار أي موضوع؟' },
  { category: 'Imagine If', text: 'If any meal could have zero calories, which one would you choose?', textAr: 'لو فيه وجبة ممكن تكون صفر سعرات، ايش بتختار؟' },
  { category: 'Imagine If', text: 'If you could own any app for free, which one would it be?', textAr: 'لو فيه تطبيق ممكن يكون ملكك مجانًا، ايش بيكون؟' },
  { category: 'Imagine If', text: 'If you were founding a museum, what would it contain?', textAr: 'لو بتأسس متحف، ايش بتكون محتوياته؟' },
  { category: 'Imagine If', text: 'If you could hold the world record for something, what would it be?', textAr: 'لو بيكون عندك الرقم القياسي لشيء معين، ايش بيكون؟' },
  { category: 'Imagine If', text: "If your house caught fire and everyone was safe, what's the one thing you'd save?", textAr: 'لو اشتعل النار في منزلك وكان الجميع بأمان، ايش الشيء الوحيد اللي بتنقذه؟' },
  { category: 'Imagine If', text: 'If you suddenly became famous, what would you be famous for?', textAr: 'لو صرت مشهور فجأة، ايش بيكون سبب شهرتك؟' },
  { category: 'Imagine If', text: 'If you suddenly went back to the Stone Age, what skill would keep you alive?', textAr: 'لو رجعت فجأة إلى العصور الحجرية، ايش عندك مهارة ستُبقيك على قيد الحياة؟' },
  { category: 'Imagine If', text: 'If your life story were written as a book, what would the title be?', textAr: 'لو كتبوا قصة حياتك في كتاب، ايش بيكون العنوان؟' },
  { category: 'Imagine If', text: 'If you had the chance to meet any historical figure, who would it be?', textAr: 'لو توفرت لك الفرصة تقابل أي شخصية من التاريخ، مين بتكون؟' },

  // --- For Close Ones Only (للمقربين فقط) ---
  { category: 'For Close Ones Only', text: 'When do you know you\'ve "succeeded"?', textAr: 'متى تعرف أنك "نجحت"؟' },
  { category: 'For Close Ones Only', text: 'How do you picture your life in retirement?', textAr: 'كيف تتخيل حياتك في التقاعد؟' },
  { category: 'For Close Ones Only', text: 'What is the most important quality you want in a life partner?', textAr: 'أكثر صفة مهمة بالنسبة لك في شريك الحياة؟' },
  { category: 'For Close Ones Only', text: "What's the best advice your mother gave you?", textAr: 'أفضل نصيحة أعطتها لك والدتك؟' },
  { category: 'For Close Ones Only', text: "What's the best advice your father gave you?", textAr: 'أفضل نصيحة أعطاها لك والدك؟' },
  { category: 'For Close Ones Only', text: 'If you had a family business, what field would it be in?', textAr: 'إذا كانت عندك شركة عائلية، في أي مجال بتكون؟' },
  { category: 'For Close Ones Only', text: 'If a stranger helped you a great deal, how would you repay them?', textAr: 'لو شخص غريب ساعدك بشكل كبير، كيف ترد الجميل؟' },
  { category: 'For Close Ones Only', text: "What's the most beautiful girl's name to you?", textAr: 'أجمل اسم بنت بالنسبة لك؟' },
  { category: 'For Close Ones Only', text: "What's the most beautiful boy's name to you?", textAr: 'أجمل اسم ولد بالنسبة لك؟' },
  { category: 'For Close Ones Only', text: 'What is the most important quality in a parent?', textAr: 'أهم صفة في الوالدين؟' },
  { category: 'For Close Ones Only', text: 'If you could erase one day from your life, which would it be?', textAr: 'لو كنت تقدر تمحي يوم واحد من حياتك، ايش بيكون؟' },
  { category: 'For Close Ones Only', text: 'What scares you the most?', textAr: 'أكثر شيء يخوفك؟' },
  { category: 'For Close Ones Only', text: "What's your favorite fictional character?", textAr: 'أكثر شخصية خيالية تعجبك؟' },
  { category: 'For Close Ones Only', text: "What's the game you enjoy the most?", textAr: 'أكثر لعبة تستمتع فيها؟' },
  { category: 'For Close Ones Only', text: "What's your favorite emoji?", textAr: 'أكثر ايموجي تحبه؟' },
  { category: 'For Close Ones Only', text: "What's your favorite fruit?", textAr: 'أكثر فواكه تحبها؟' },
  { category: 'For Close Ones Only', text: "What's your favorite dessert?", textAr: 'الحلى المفضل عندك؟' },
  { category: 'For Close Ones Only', text: "What's a new experience you'd like to try?", textAr: 'تجربة جديدة ودك تعيشها؟' },
  { category: 'For Close Ones Only', text: 'What do you love most about your appearance?', textAr: 'أكثر شيء تحبه في شكلك؟' },
  { category: 'For Close Ones Only', text: "What's your favorite scent?", textAr: 'أكثر رائحة تعجبك؟' },
  { category: 'For Close Ones Only', text: 'How would you react if your family refused to let you marry the person you love?', textAr: 'كيف تتصرف لو أهلك رفضوا زواجك من الشخص اللي تحبه؟' },
  { category: 'For Close Ones Only', text: 'If you could change one thing about yourself, what would it be?', textAr: 'لو تقدر تغير شيء واحد فيك ايش بيكون؟' },
  { category: 'For Close Ones Only', text: 'What do you spend your money on the most?', textAr: 'أكثر شيء تصرف فلوسك عليه؟' },
  { category: 'For Close Ones Only', text: 'Which celebrity do you feel you resemble the most?', textAr: 'مين أكثر مشهور تحس إنك تشبهه؟' },
  { category: 'For Close Ones Only', text: 'What would be the first decision you would make if you became a head of state?', textAr: 'ايش بيكون أول قرار تتخذه لو صرت رئيس دولة؟' },
  { category: 'For Close Ones Only', text: 'If you were founding a country, what would you name it?', textAr: 'لو بتأسس دولة ايش رح تسميها؟' },
  { category: 'For Close Ones Only', text: 'If there was one thing you could get for free for life, what would it be?', textAr: 'لو فيه شيء تقدر تحصله مجانًا مدى الحياة ايش بيكون؟' },
  { category: 'For Close Ones Only', text: 'If you could commit one crime with no consequences, what would it be?', textAr: 'لو قدرت ترتكب جريمة بدون أي عواقب، ايش بتكون؟' },
  { category: 'For Close Ones Only', text: "What's the first thing you notice about someone when you meet them?", textAr: 'أول شيء تنتبه له في الشخص لما تقابله لأول مرة؟' },
  { category: 'For Close Ones Only', text: "What's the best joke you've ever heard?", textAr: 'ايش هي أفضل نكتة سمعتها بحياتك؟' },
  { category: 'For Close Ones Only', text: 'What would you do if everyone was watching you 24/7?', textAr: 'وش بتسوي لو كل الناس تراقبك 24/7؟' },
  { category: 'For Close Ones Only', text: 'How would you react if your closest friend suddenly became your enemy?', textAr: 'كيف تتصرف لو أعز صديق لك صار عدوك فجأة؟' },
  { category: 'For Close Ones Only', text: 'What would you do if you could never lie again?', textAr: 'وش بتسوي لو ما عاد تقدر تكذب أبدًا؟' },
  { category: 'For Close Ones Only', text: 'What would you do if you had to redo your life from the start but keep your current memories?', textAr: 'وش بتسوي لو كان لازم تعيد حياتك من البداية بس بذاكرتك الحالية؟' },
  { category: 'For Close Ones Only', text: "What's the most important goal you hope to achieve in life?", textAr: 'ايش هو أهم هدف تأمل تحققه في حياتك؟' },
  { category: 'For Close Ones Only', text: 'When do you feel true contentment and satisfaction?', textAr: 'متى تشعر بالرضا الحقيقي و الاكتفاء؟' },
  { category: 'For Close Ones Only', text: 'What would you change about your life if you knew no one could judge you?', textAr: 'ايش ممكن تغير بحياتك لو تأكدت ولا أحد ممكن يحكم عليك؟' },
  { category: 'For Close Ones Only', text: "Do you have an opinion that goes against most people's?", textAr: 'هل عندك رأي معاكس لأغلب الناس؟' },
  { category: 'For Close Ones Only', text: "What's the strangest dream you've ever had?", textAr: 'ايش أغرب حلم قد حلمته في حياتك؟' },
  { category: 'For Close Ones Only', text: "What was the moment you realized you'd grown up?", textAr: 'ايش كانت اللحظة اللي أدركت فيها أنك كبرت؟' },
  { category: 'For Close Ones Only', text: 'If you had the chance to send one message to future generations, what would it be?', textAr: 'لو توفرت لك فرصة إرسال رسالة واحدة إلى الأجيال المستقبلية، ايش بتكون؟' },
  { category: 'For Close Ones Only', text: "Who's the person that makes you laugh the most, and why?", textAr: 'مين أكثر شخص يضحكك و ليه؟' },
  { category: 'For Close Ones Only', text: 'Are you at peace with yourself?', textAr: 'هل أنت متصالح مع ذاتك؟' },
  { category: 'For Close Ones Only', text: 'After a long life, what do you want to be remembered for most of all?', textAr: 'بعد عمر طويل، بماذا تريد أن تُذكر أكثر من أي شيء آخر؟' },
  { category: 'For Close Ones Only', text: 'What does true friendship look like to you?', textAr: 'كيف تبدو الصداقة الحقيقية بالنسبة لك؟' },
  { category: 'For Close Ones Only', text: 'What was the most unforgettable trip of your life?', textAr: 'ايش كانت أكثر رحلة لا تُنسى في حياتك؟' },
  { category: 'For Close Ones Only', text: "What's your dream job?", textAr: 'ما هي وظيفة أحلامك؟' },
  { category: 'For Close Ones Only', text: 'How do you express your love for the people closest to you?', textAr: 'كيف تُعبّر عن حبّك للأشخاص الأقرب إليك؟' },
  { category: 'For Close Ones Only', text: 'What is the most important lesson you learned from a hard experience you went through?', textAr: 'ايش أهم درس تعلمته من تجربة صعبة مريت فيها؟' },
  { category: 'For Close Ones Only', text: "What's a habit you've built that you're genuinely proud of?", textAr: 'ايش العادة اللي بنيتها وتفخر فيها فعلاً؟' },
];


// Seeds a ready-to-use admin account, so a fresh database is testable without
// signing up first. Runs only when both env vars are set: production never
// sets them, so this cannot put a known-password account on the live site by
// accident. The password is never in this file -- render.yaml has Render
// generate one, and it is readable (and changeable) in the service's
// Environment tab.
//
// The password is re-applied on every boot. That is the point: whatever the
// dashboard says is always what works, so a staging environment cannot lock
// you out. It also means changing the password in-app does not stick -- edit
// the env var instead.
async function seedAdmin() {
  const email = (process.env.SEED_ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD || '';
  if (!email || !password) {
    console.log('Admin seed: skipped (SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set).');
    return;
  }
  if (password.length < 8) {
    console.log('Admin seed: skipped (SEED_ADMIN_PASSWORD is shorter than 8 characters).');
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  // paidUntil is set far out as a belt-and-braces measure: the email is also
  // on the unlimited-access allowlist (payments/access.ts), but that list is
  // config and this account is meant to work no matter what it says.
  const paidUntil = new Date('2099-12-31T00:00:00.000Z');
  const existing = await prisma.user.findUnique({ where: { email } });

  await prisma.user.upsert({
    where: { email },
    update: { passwordHash, isGuest: false, paidUntil },
    create: {
      email,
      fullName: 'Bahjah Admin',
      countryCode: '+966',
      phone: '500000000',
      dob: new Date('1990-01-01T00:00:00.000Z'),
      passwordHash,
      isGuest: false,
      paidUntil,
    },
  });
  console.log(`Admin seed: ${existing ? 'password reset for' : 'created'} ${email}.`);
}

async function main() {
  await seedAdmin();

  // The bank is made to match QUESTIONS exactly, not merely topped up. This
  // file re-runs on every boot in production (start:prod), so a question
  // dropped from the spreadsheet has to leave the game rather than linger in
  // a table nothing prunes -- which is what used to happen when this step was
  // additive-only. Rows are matched by their English prompt, so an edit to a
  // prompt reads as a new question replacing the old one; edits to anything
  // else (choices, translation, difficulty, which answer is right) are
  // applied in place, keeping the row and its id.
  //
  // The consequence worth knowing: a question added through the admin editor
  // at /admin-questions.html does not survive the next deploy, because it is
  // not in the spreadsheet. The spreadsheet is how a question is added for
  // good. Host-authored custom questions are a different table
  // (TriviaCustomQuestion) and are untouched by any of this.
  const existingRows = await prisma.triviaQuestion.findMany();
  const wantedByPrompt = new Map(QUESTIONS.map((q) => [q.prompt, q]));

  const sameChoices = (a: string[], b: string[]) =>
    a.length === b.length && a.every((choice, i) => choice === b[i]);

  const kept = new Set<string>();
  const toDelete: string[] = [];
  const toUpdate: Array<{ id: string; question: SeedQuestion }> = [];

  for (const row of existingRows) {
    const wanted = wantedByPrompt.get(row.prompt);
    // Not in the sheet, or a second copy of something already matched -- a
    // duplicate is as wrong as a stranger when the sheets list each question once.
    if (!wanted || kept.has(row.prompt)) {
      toDelete.push(row.id);
      continue;
    }
    kept.add(row.prompt);
    const drifted =
      row.category !== wanted.category ||
      row.difficulty !== wanted.difficulty ||
      row.promptAr !== wanted.promptAr ||
      row.correctIndex !== wanted.correctIndex ||
      !sameChoices(row.choices, wanted.choices) ||
      !sameChoices(row.choicesAr, wanted.choicesAr);
    if (drifted) toUpdate.push({ id: row.id, question: wanted });
  }

  const toCreate = QUESTIONS.filter((q) => !kept.has(q.prompt));

  if (toDelete.length > 0) {
    await prisma.triviaQuestion.deleteMany({ where: { id: { in: toDelete } } });
  }
  if (toCreate.length > 0) {
    await prisma.triviaQuestion.createMany({ data: toCreate });
  }
  if (toUpdate.length > 0) {
    await prisma.$transaction(
      toUpdate.map(({ id, question }) =>
        prisma.triviaQuestion.update({
          where: { id },
          data: {
            category: question.category,
            difficulty: question.difficulty,
            promptAr: question.promptAr,
            choices: question.choices,
            choicesAr: question.choicesAr,
            correctIndex: question.correctIndex,
          },
        })
      )
    );
  }

  console.log(
    `Trivia questions: ${toCreate.length} created, ${toUpdate.length} updated, ${toDelete.length} removed, ` +
      `${QUESTIONS.length - toCreate.length - toUpdate.length} already up to date (bank is now ${QUESTIONS.length}).`
  );

  // The three question banks are named for what is in them, not for how hard
  // they are. They were briefly relabelled as a difficulty ladder
  // (Easy/Moderate/Hard); rows in the database still carry whichever label was
  // current when they were written, and the dedupe below only matches on text,
  // so rename them in place rather than leaving a split bank where half the
  // prompts answer to a category nobody can pick.
  //
  // Both the ladder labels and the older 'Close Friends Only' spelling are
  // covered, so a database from any point in this history lands on the same
  // three names. Left/right never overlap, so the order of these is irrelevant
  // and no rename can cascade into another.
  const KYB_CATEGORY_RENAMES: Array<[string, string]> = [
    ['Easy', 'Break the Ice'],
    ['Moderate', 'Imagine If'],
    ['Hard', 'For Close Ones Only'],
    ['Close Friends Only', 'For Close Ones Only'],
  ];
  for (const [from, to] of KYB_CATEGORY_RENAMES) {
    const renamed = await prisma.knowsYouBestPrompt.updateMany({ where: { category: from }, data: { category: to } });
    if (renamed.count > 0) console.log(`Renamed ${renamed.count} knows-you-best prompts: ${from} -> ${to}.`);
  }

  const existingKybTexts = new Set((await prisma.knowsYouBestPrompt.findMany({ select: { text: true } })).map((r) => r.text));
  const newPrompts = KYB_PROMPTS.filter((p) => !existingKybTexts.has(p.text));
  if (newPrompts.length > 0) {
    await prisma.knowsYouBestPrompt.createMany({ data: newPrompts });
    console.log(`Seeded ${newPrompts.length} new knows-you-best prompts (${KYB_PROMPTS.length - newPrompts.length} already present).`);
  } else {
    console.log(`All ${KYB_PROMPTS.length} knows-you-best prompts already present — skipping.`);
  }

  // Same additive + backfill-in-place pattern as the trivia bank above.
  const existingKybRows = await prisma.knowsYouBestPrompt.findMany({ select: { id: true, text: true, textAr: true } });
  const existingKybByText = new Map(existingKybRows.map((r) => [r.text, r]));

  const kybToCreate = KYB_PROMPTS_V2.filter((p) => !existingKybByText.has(p.text));
  if (kybToCreate.length > 0) {
    await prisma.knowsYouBestPrompt.createMany({ data: kybToCreate });
  }

  const kybToBackfill = KYB_PROMPTS_V2.filter((p) => {
    const existing = existingKybByText.get(p.text);
    return existing && !existing.textAr;
  });
  if (kybToBackfill.length > 0) {
    await prisma.$transaction(
      kybToBackfill.map((p) =>
        prisma.knowsYouBestPrompt.update({
          where: { id: existingKybByText.get(p.text)!.id },
          data: { textAr: p.textAr },
        })
      )
    );
  }

  console.log(
    `Knows You Best v2 questions: ${kybToCreate.length} created, ${kybToBackfill.length} backfilled with Arabic, ${KYB_PROMPTS_V2.length - kybToCreate.length - kybToBackfill.length} already up to date.`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
