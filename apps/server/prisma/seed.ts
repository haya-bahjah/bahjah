import { PrismaClient } from '@prisma/client';

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

const QUESTIONS: SeedQuestion[] = [
  // --- Geography ---
  { category: 'Geography', difficulty: 'easy', prompt: 'What is the capital of France?', promptAr: 'ما هي عاصمة فرنسا؟', choices: ['Paris', 'Rome', 'Madrid', 'Berlin'], choicesAr: ['باريس', 'روما', 'مدريد', 'برلين'], correctIndex: 0 },
  { category: 'Geography', difficulty: 'easy', prompt: 'Which continent is Egypt located in?', promptAr: 'في أي قارة تقع مصر؟', choices: ['Asia', 'Africa', 'Europe', 'South America'], choicesAr: ['آسيا', 'أفريقيا', 'أوروبا', 'أمريكا الجنوبية'], correctIndex: 1 },
  { category: 'Geography', difficulty: 'easy', prompt: 'What is the largest country by area?', promptAr: 'ما هي أكبر دولة من حيث المساحة؟', choices: ['China', 'USA', 'Canada', 'Russia'], choicesAr: ['الصين', 'الولايات المتحدة', 'كندا', 'روسيا'], correctIndex: 3 },
  { category: 'Geography', difficulty: 'easy', prompt: 'Which country is shaped like a boot?', promptAr: 'أي دولة على شكل حذاء؟', choices: ['Spain', 'Italy', 'Greece', 'Portugal'], choicesAr: ['إسبانيا', 'إيطاليا', 'اليونان', 'البرتغال'], correctIndex: 1 },
  { category: 'Geography', difficulty: 'easy', prompt: 'What is the smallest country in the world?', promptAr: 'ما هي أصغر دولة في العالم؟', choices: ['Monaco', 'Vatican City', 'San Marino', 'Liechtenstein'], choicesAr: ['موناكو', 'الفاتيكان', 'سان مارينو', 'ليختنشتاين'], correctIndex: 1 },
  { category: 'Geography', difficulty: 'easy', prompt: 'Which river is the longest in the world?', promptAr: 'ما هو أطول نهر في العالم؟', choices: ['Amazon', 'Nile', 'Yangtze', 'Mississippi'], choicesAr: ['الأمازون', 'النيل', 'يانغتسي', 'المسيسيبي'], correctIndex: 1 },
  { category: 'Geography', difficulty: 'medium', prompt: 'Which planet is known as the Red Planet?', promptAr: 'ما هو الكوكب المعروف بالكوكب الأحمر؟', choices: ['Venus', 'Mars', 'Jupiter', 'Saturn'], choicesAr: ['الزهرة', 'المريخ', 'المشتري', 'زحل'], correctIndex: 1 },
  { category: 'Geography', difficulty: 'medium', prompt: 'What is the largest ocean on Earth?', promptAr: 'ما هو أكبر محيط على وجه الأرض؟', choices: ['Atlantic', 'Indian', 'Arctic', 'Pacific'], choicesAr: ['الأطلسي', 'الهندي', 'المتجمد الشمالي', 'الهادئ'], correctIndex: 3 },
  { category: 'Geography', difficulty: 'medium', prompt: 'Which country has the most natural lakes?', promptAr: 'أي دولة تضم أكبر عدد من البحيرات الطبيعية؟', choices: ['Canada', 'Russia', 'Finland', 'USA'], choicesAr: ['كندا', 'روسيا', 'فنلندا', 'الولايات المتحدة'], correctIndex: 0 },
  { category: 'Geography', difficulty: 'medium', prompt: 'What is the capital of Australia?', promptAr: 'ما هي عاصمة أستراليا؟', choices: ['Sydney', 'Melbourne', 'Canberra', 'Perth'], choicesAr: ['سيدني', 'ملبورن', 'كانبيرا', 'بيرث'], correctIndex: 2 },
  { category: 'Geography', difficulty: 'medium', prompt: 'Which desert is the largest in the world?', promptAr: 'ما هي أكبر صحراء في العالم؟', choices: ['Sahara', 'Gobi', 'Antarctic', 'Arabian'], choicesAr: ['الصحراء الكبرى', 'صحراء غوبي', 'الصحراء القطبية الجنوبية', 'الصحراء العربية'], correctIndex: 2 },
  { category: 'Geography', difficulty: 'medium', prompt: 'The Nile river flows through which country?', promptAr: 'يمر نهر النيل عبر أي دولة؟', choices: ['Kenya', 'Egypt', 'Morocco', 'Nigeria'], choicesAr: ['كينيا', 'مصر', 'المغرب', 'نيجيريا'], correctIndex: 1 },
  { category: 'Geography', difficulty: 'hard', prompt: 'Which African country has three capital cities?', promptAr: 'أي دولة أفريقية لديها ثلاث عواصم؟', choices: ['Nigeria', 'South Africa', 'Kenya', 'Ghana'], choicesAr: ['نيجيريا', 'جنوب أفريقيا', 'كينيا', 'غانا'], correctIndex: 1 },
  { category: 'Geography', difficulty: 'hard', prompt: 'What is the only sea without any coastline?', promptAr: 'ما هو البحر الوحيد الذي لا يحده أي ساحل؟', choices: ['Sargasso Sea', 'Coral Sea', 'Caspian Sea', 'Red Sea'], choicesAr: ['بحر السرغاسو', 'بحر المرجان', 'بحر قزوين', 'البحر الأحمر'], correctIndex: 0 },
  { category: 'Geography', difficulty: 'hard', prompt: 'Which country has the most time zones?', promptAr: 'أي دولة لديها أكبر عدد من المناطق الزمنية؟', choices: ['Russia', 'USA', 'France', 'China'], choicesAr: ['روسيا', 'الولايات المتحدة', 'فرنسا', 'الصين'], correctIndex: 2 },
  { category: 'Geography', difficulty: 'hard', prompt: 'What is the deepest point in the ocean called?', promptAr: 'ما اسم أعمق نقطة في المحيط؟', choices: ['Mariana Trench', 'Puerto Rico Trench', 'Java Trench', 'Tonga Trench'], choicesAr: ['خندق ماريانا', 'خندق بورتوريكو', 'خندق جاوة', 'خندق تونغا'], correctIndex: 0 },
  { category: 'Geography', difficulty: 'hard', prompt: 'Which strait separates Europe from Africa?', promptAr: 'أي مضيق يفصل بين أوروبا وأفريقيا؟', choices: ['Bosphorus', 'Strait of Gibraltar', 'Strait of Hormuz', 'Bering Strait'], choicesAr: ['مضيق البوسفور', 'مضيق جبل طارق', 'مضيق هرمز', 'مضيق بيرينغ'], correctIndex: 1 },
  { category: 'Geography', difficulty: 'hard', prompt: 'Which landlocked country is bordered by exactly two countries, both of which are also landlocked?', promptAr: 'أي دولة غير ساحلية تحدها دولتان فقط، وكلتاهما غير ساحليتين أيضًا؟', choices: ['Uzbekistan', 'Liechtenstein', 'Mongolia', 'Bolivia'], choicesAr: ['أوزبكستان', 'ليختنشتاين', 'منغوليا', 'بوليفيا'], correctIndex: 1 },

  // --- Science ---
  { category: 'Science', difficulty: 'easy', prompt: 'What do bees produce?', promptAr: 'ماذا تنتج النحل؟', choices: ['Milk', 'Honey', 'Silk', 'Wax only'], choicesAr: ['حليب', 'عسل', 'حرير', 'شمع فقط'], correctIndex: 1 },
  { category: 'Science', difficulty: 'easy', prompt: 'How many legs does a spider have?', promptAr: 'كم عدد أرجل العنكبوت؟', choices: ['6', '8', '10', '12'], choicesAr: ['6', '8', '10', '12'], correctIndex: 1 },
  { category: 'Science', difficulty: 'easy', prompt: 'What planet do we live on?', promptAr: 'على أي كوكب نعيش؟', choices: ['Mars', 'Venus', 'Earth', 'Mercury'], choicesAr: ['المريخ', 'الزهرة', 'الأرض', 'عطارد'], correctIndex: 2 },
  { category: 'Science', difficulty: 'easy', prompt: 'What is water made of?', promptAr: 'مم يتكون الماء؟', choices: ['Hydrogen and Oxygen', 'Carbon and Oxygen', 'Hydrogen and Nitrogen', 'Oxygen only'], choicesAr: ['الهيدروجين والأكسجين', 'الكربون والأكسجين', 'الهيدروجين والنيتروجين', 'الأكسجين فقط'], correctIndex: 0 },
  { category: 'Science', difficulty: 'easy', prompt: 'What organ pumps blood through the body?', promptAr: 'ما هو العضو الذي يضخ الدم في الجسم؟', choices: ['Lungs', 'Liver', 'Heart', 'Kidney'], choicesAr: ['الرئتان', 'الكبد', 'القلب', 'الكلى'], correctIndex: 2 },
  { category: 'Science', difficulty: 'easy', prompt: 'What force pulls objects toward Earth?', promptAr: 'ما هي القوة التي تجذب الأجسام نحو الأرض؟', choices: ['Magnetism', 'Gravity', 'Friction', 'Tension'], choicesAr: ['المغناطيسية', 'الجاذبية', 'الاحتكاك', 'الشد'], correctIndex: 1 },
  { category: 'Science', difficulty: 'medium', prompt: 'What is the chemical symbol for gold?', promptAr: 'ما هو الرمز الكيميائي للذهب؟', choices: ['Ag', 'Au', 'Gd', 'Go'], choicesAr: ['Ag', 'Au', 'Gd', 'Go'], correctIndex: 1 },
  { category: 'Science', difficulty: 'medium', prompt: 'How many bones are in the adult human body?', promptAr: 'كم عدد عظام جسم الإنسان البالغ؟', choices: ['186', '206', '226', '246'], choicesAr: ['186', '206', '226', '246'], correctIndex: 1 },
  { category: 'Science', difficulty: 'medium', prompt: 'What gas do plants primarily absorb from the atmosphere?', promptAr: 'ما هو الغاز الذي تمتصه النباتات بشكل أساسي من الغلاف الجوي؟', choices: ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Hydrogen'], choicesAr: ['الأكسجين', 'النيتروجين', 'ثاني أكسيد الكربون', 'الهيدروجين'], correctIndex: 2 },
  { category: 'Science', difficulty: 'medium', prompt: 'What is the speed of light approximately?', promptAr: 'ما هي سرعة الضوء تقريبًا؟', choices: ['300,000 km/s', '150,000 km/s', '3,000 km/s', '30,000 km/s'], choicesAr: ['300,000 كم/ث', '150,000 كم/ث', '3,000 كم/ث', '30,000 كم/ث'], correctIndex: 0 },
  { category: 'Science', difficulty: 'medium', prompt: 'Which planet has the most moons?', promptAr: 'أي كوكب لديه أكبر عدد من الأقمار؟', choices: ['Jupiter', 'Saturn', 'Uranus', 'Neptune'], choicesAr: ['المشتري', 'زحل', 'أورانوس', 'نبتون'], correctIndex: 1 },
  { category: 'Science', difficulty: 'medium', prompt: 'What is the hardest natural substance on Earth?', promptAr: 'ما هي أصلب مادة طبيعية على وجه الأرض؟', choices: ['Gold', 'Iron', 'Diamond', 'Quartz'], choicesAr: ['الذهب', 'الحديد', 'الألماس', 'الكوارتز'], correctIndex: 2 },
  { category: 'Science', difficulty: 'hard', prompt: 'What is the powerhouse of the cell?', promptAr: 'ما هو مركز الطاقة في الخلية؟', choices: ['Nucleus', 'Ribosome', 'Mitochondria', 'Golgi apparatus'], choicesAr: ['النواة', 'الريبوسوم', 'الميتوكوندريا', 'جهاز غولجي'], correctIndex: 2 },
  { category: 'Science', difficulty: 'hard', prompt: 'What is the SI unit of electrical resistance?', promptAr: 'ما هي وحدة قياس المقاومة الكهربائية؟', choices: ['Volt', 'Ohm', 'Watt', 'Ampere'], choicesAr: ['فولت', 'أوم', 'واط', 'أمبير'], correctIndex: 1 },
  { category: 'Science', difficulty: 'hard', prompt: 'Which element has the atomic number 1?', promptAr: 'أي عنصر يحمل العدد الذري 1؟', choices: ['Helium', 'Hydrogen', 'Lithium', 'Carbon'], choicesAr: ['الهيليوم', 'الهيدروجين', 'الليثيوم', 'الكربون'], correctIndex: 1 },
  { category: 'Science', difficulty: 'hard', prompt: 'What type of bond involves the sharing of electron pairs?', promptAr: 'أي نوع من الروابط يتضمن مشاركة أزواج الإلكترونات؟', choices: ['Ionic', 'Covalent', 'Metallic', 'Hydrogen'], choicesAr: ['أيونية', 'تساهمية', 'فلزية', 'هيدروجينية'], correctIndex: 1 },
  { category: 'Science', difficulty: 'hard', prompt: "What is the most abundant gas in Earth's atmosphere?", promptAr: 'ما هو أكثر الغازات وفرة في الغلاف الجوي للأرض؟', choices: ['Oxygen', 'Carbon Dioxide', 'Nitrogen', 'Argon'], choicesAr: ['الأكسجين', 'ثاني أكسيد الكربون', 'النيتروجين', 'الأرغون'], correctIndex: 2 },
  { category: 'Science', difficulty: 'hard', prompt: 'Which scientist proposed the theory of general relativity?', promptAr: 'أي عالم اقترح نظرية النسبية العامة؟', choices: ['Newton', 'Bohr', 'Einstein', 'Curie'], choicesAr: ['نيوتن', 'بور', 'أينشتاين', 'كوري'], correctIndex: 2 },

  // --- History ---
  { category: 'History', difficulty: 'easy', prompt: 'Who was the first man to walk on the moon?', promptAr: 'من كان أول رجل يمشي على سطح القمر؟', choices: ['Buzz Aldrin', 'Neil Armstrong', 'Yuri Gagarin', 'John Glenn'], choicesAr: ['باز ألدرين', 'نيل أرمسترونغ', 'يوري غاغارين', 'جون غلين'], correctIndex: 1 },
  { category: 'History', difficulty: 'easy', prompt: 'In which century did the Titanic sink?', promptAr: 'في أي قرن غرقت سفينة تايتانيك؟', choices: ['19th', '20th', '21st', '18th'], choicesAr: ['التاسع عشر', 'العشرون', 'الحادي والعشرون', 'الثامن عشر'], correctIndex: 1 },
  { category: 'History', difficulty: 'easy', prompt: 'Which war involved the Allies fighting the Axis powers?', promptAr: 'أي حرب شهدت قتال الحلفاء ضد دول المحور؟', choices: ['World War I', 'World War II', 'Cold War', 'Vietnam War'], choicesAr: ['الحرب العالمية الأولى', 'الحرب العالمية الثانية', 'الحرب الباردة', 'حرب فيتنام'], correctIndex: 1 },
  { category: 'History', difficulty: 'easy', prompt: 'Which ancient wonder was located in Egypt?', promptAr: 'أي عجيبة قديمة كانت تقع في مصر؟', choices: ['Colossus of Rhodes', 'Great Pyramid of Giza', 'Hanging Gardens', 'Lighthouse of Alexandria'], choicesAr: ['تمثال رودس العملاق', 'هرم الجيزة الأكبر', 'حدائق بابل المعلقة', 'منارة الإسكندرية'], correctIndex: 1 },
  { category: 'History', difficulty: 'easy', prompt: 'What year did World War I begin?', promptAr: 'في أي عام بدأت الحرب العالمية الأولى؟', choices: ['1912', '1914', '1916', '1918'], choicesAr: ['1912', '1914', '1916', '1918'], correctIndex: 1 },
  { category: 'History', difficulty: 'easy', prompt: 'Which empire was ruled by Julius Caesar?', promptAr: 'أي إمبراطورية حكمها يوليوس قيصر؟', choices: ['Greek Empire', 'Roman Empire', 'Ottoman Empire', 'Persian Empire'], choicesAr: ['الإمبراطورية اليونانية', 'الإمبراطورية الرومانية', 'الإمبراطورية العثمانية', 'الإمبراطورية الفارسية'], correctIndex: 1 },
  { category: 'History', difficulty: 'medium', prompt: 'Who wrote the plays Hamlet and Macbeth?', promptAr: 'من كتب مسرحيتي هاملت وماكبث؟', choices: ['Dickens', 'Shakespeare', 'Tolstoy', 'Homer'], choicesAr: ['ديكنز', 'شكسبير', 'تولستوي', 'هوميروس'], correctIndex: 1 },
  { category: 'History', difficulty: 'medium', prompt: 'In which year did World War II end?', promptAr: 'في أي عام انتهت الحرب العالمية الثانية؟', choices: ['1943', '1944', '1945', '1946'], choicesAr: ['1943', '1944', '1945', '1946'], correctIndex: 2 },
  { category: 'History', difficulty: 'medium', prompt: 'Which ancient civilization built the pyramids of Giza?', promptAr: 'أي حضارة قديمة بنت أهرامات الجيزة؟', choices: ['Romans', 'Greeks', 'Egyptians', 'Persians'], choicesAr: ['الرومان', 'الإغريق', 'المصريون', 'الفرس'], correctIndex: 2 },
  { category: 'History', difficulty: 'medium', prompt: 'Who was the first President of the United States?', promptAr: 'من كان أول رئيس للولايات المتحدة؟', choices: ['Jefferson', 'Washington', 'Adams', 'Lincoln'], choicesAr: ['جيفرسون', 'واشنطن', 'آدامز', 'لينكولن'], correctIndex: 1 },
  { category: 'History', difficulty: 'medium', prompt: 'The Great Wall was built primarily to defend which country?', promptAr: 'بُني سور الصين العظيم بشكل أساسي للدفاع عن أي دولة؟', choices: ['Japan', 'Mongolia', 'China', 'Korea'], choicesAr: ['اليابان', 'منغوليا', 'الصين', 'كوريا'], correctIndex: 2 },
  { category: 'History', difficulty: 'medium', prompt: 'Which document did the American colonies sign in 1776?', promptAr: 'أي وثيقة وقعتها المستعمرات الأمريكية عام 1776؟', choices: ['Bill of Rights', 'Declaration of Independence', 'Constitution', 'Magna Carta'], choicesAr: ['وثيقة الحقوق', 'إعلان الاستقلال', 'الدستور', 'ماغنا كارتا'], correctIndex: 1 },
  { category: 'History', difficulty: 'hard', prompt: 'In which year did the Berlin Wall fall?', promptAr: 'في أي عام سقط جدار برلين؟', choices: ['1987', '1989', '1991', '1993'], choicesAr: ['1987', '1989', '1991', '1993'], correctIndex: 1 },
  { category: 'History', difficulty: 'hard', prompt: 'Who was the last Pharaoh of Egypt?', promptAr: 'من كانت آخر فرعون لمصر؟', choices: ['Nefertiti', 'Cleopatra VII', 'Hatshepsut', 'Tutankhamun'], choicesAr: ['نفرتيتي', 'كليوباترا السابعة', 'حتشبسوت', 'توت عنخ آمون'], correctIndex: 1 },
  { category: 'History', difficulty: 'hard', prompt: 'The Treaty of Versailles ended which conflict?', promptAr: 'أي نزاع أنهته معاهدة فرساي؟', choices: ['World War I', 'World War II', 'Franco-Prussian War', 'Napoleonic Wars'], choicesAr: ['الحرب العالمية الأولى', 'الحرب العالمية الثانية', 'الحرب الفرنسية البروسية', 'الحروب النابليونية'], correctIndex: 0 },
  { category: 'History', difficulty: 'hard', prompt: 'Which explorer led the first expedition to circumnavigate the globe?', promptAr: 'أي مستكشف قاد أول رحلة للطواف حول الكرة الأرضية؟', choices: ['Christopher Columbus', 'Vasco da Gama', 'Ferdinand Magellan', 'James Cook'], choicesAr: ['كريستوفر كولومبوس', 'فاسكو دا غاما', 'فرديناند ماجلان', 'جيمس كوك'], correctIndex: 2 },
  { category: 'History', difficulty: 'hard', prompt: 'What was the name of the ship that brought the Pilgrims to America in 1620?', promptAr: 'ما اسم السفينة التي نقلت الحجاج إلى أمريكا عام 1620؟', choices: ['Mayflower', 'Santa Maria', 'Endeavour', 'Beagle'], choicesAr: ['مايفلاور', 'سانتا ماريا', 'إنديفر', 'بيغل'], correctIndex: 0 },
  { category: 'History', difficulty: 'hard', prompt: 'The Rosetta Stone helped decipher which ancient script?', promptAr: 'ساعد حجر رشيد في فك رموز أي كتابة قديمة؟', choices: ['Cuneiform', 'Egyptian hieroglyphs', 'Linear B', 'Sanskrit'], choicesAr: ['الكتابة المسمارية', 'الهيروغليفية المصرية', 'الخط الخطي ب', 'السنسكريتية'], correctIndex: 1 },

  // --- Movies ---
  { category: 'Movies', difficulty: 'easy', prompt: 'Which animated movie features a snowman named Olaf?', promptAr: 'أي فيلم رسوم متحركة يظهر فيه رجل ثلج اسمه أولاف؟', choices: ['Moana', 'Frozen', 'Tangled', 'Encanto'], choicesAr: ['موانا', 'فروزن', 'تانغلد', 'إنكانتو'], correctIndex: 1 },
  { category: 'Movies', difficulty: 'easy', prompt: 'Who plays Iron Man in the Marvel movies?', promptAr: 'من يلعب دور الرجل الحديدي في أفلام مارفل؟', choices: ['Chris Evans', 'Robert Downey Jr.', 'Chris Hemsworth', 'Mark Ruffalo'], choicesAr: ['كريس إيفانز', 'روبرت داوني جونيور', 'كريس هيمسورث', 'مارك رافالو'], correctIndex: 1 },
  { category: 'Movies', difficulty: 'easy', prompt: 'What is the name of the boy wizard in the Harry Potter films?', promptAr: 'ما اسم الساحر الصبي في أفلام هاري بوتر؟', choices: ['Ron Weasley', 'Harry Potter', 'Neville Longbottom', 'Draco Malfoy'], choicesAr: ['رون ويزلي', 'هاري بوتر', 'نيفيل لونغبوتوم', 'دراكو مالفوي'], correctIndex: 1 },
  { category: 'Movies', difficulty: 'easy', prompt: 'Which movie features a clownfish searching for his son?', promptAr: 'أي فيلم يظهر فيه سمكة مهرج تبحث عن ابنها؟', choices: ['Finding Nemo', 'Shark Tale', 'Moana', 'The Little Mermaid'], choicesAr: ['البحث عن نيمو', 'حكاية سمكة قرش', 'موانا', 'حورية البحر الصغيرة'], correctIndex: 0 },
  { category: 'Movies', difficulty: 'easy', prompt: 'What kind of animal is Simba in The Lion King?', promptAr: 'ما نوع الحيوان الذي يمثله سيمبا في فيلم الأسد الملك؟', choices: ['Tiger', 'Lion', 'Leopard', 'Cheetah'], choicesAr: ['نمر', 'أسد', 'فهد مرقط', 'فهد صياد'], correctIndex: 1 },
  { category: 'Movies', difficulty: 'easy', prompt: 'In Toy Story, what type of toy is Woody?', promptAr: 'في فيلم توي ستوري، ما نوع لعبة وودي؟', choices: ['Astronaut', 'Cowboy', 'Robot', 'Dinosaur'], choicesAr: ['رائد فضاء', 'راعي بقر', 'روبوت', 'ديناصور'], correctIndex: 1 },
  { category: 'Movies', difficulty: 'medium', prompt: 'Who directed the movie "Jaws"?', promptAr: 'من أخرج فيلم "الفك المفترس"؟', choices: ['George Lucas', 'Steven Spielberg', 'Martin Scorsese', 'James Cameron'], choicesAr: ['جورج لوكاس', 'ستيفن سبيلبرغ', 'مارتن سكورسيزي', 'جيمس كاميرون'], correctIndex: 1 },
  { category: 'Movies', difficulty: 'medium', prompt: 'Which movie features the song "Let It Go"?', promptAr: 'أي فيلم تظهر فيه أغنية "Let It Go"؟', choices: ['Moana', 'Tangled', 'Frozen', 'Encanto'], choicesAr: ['موانا', 'تانغلد', 'فروزن', 'إنكانتو'], correctIndex: 2 },
  { category: 'Movies', difficulty: 'medium', prompt: 'What is the highest-grossing film of all time (unadjusted)?', promptAr: 'ما هو الفيلم الأعلى ربحًا في التاريخ (دون تعديل التضخم)؟', choices: ['Titanic', 'Avatar', 'Avengers: Endgame', 'Star Wars'], choicesAr: ['تايتانيك', 'أفاتار', 'المنتقمون: نهاية اللعبة', 'حرب النجوم'], correctIndex: 1 },
  { category: 'Movies', difficulty: 'medium', prompt: 'Which trilogy is set in Middle-earth?', promptAr: 'أي ثلاثية تدور أحداثها في الأرض الوسطى؟', choices: ['The Lord of the Rings', 'Star Wars', 'The Matrix', 'Chronicles of Narnia'], choicesAr: ['سيد الخواتم', 'حرب النجوم', 'المصفوفة', 'سجلات نارنيا'], correctIndex: 0 },
  { category: 'Movies', difficulty: 'medium', prompt: 'Who directed "Inception" and "The Dark Knight"?', promptAr: 'من أخرج فيلمي "إنسبشن" و"ذا دارك نايت"؟', choices: ['Christopher Nolan', 'Quentin Tarantino', 'Ridley Scott', 'David Fincher'], choicesAr: ['كريستوفر نولان', 'كوينتين تارانتينو', 'ريدلي سكوت', 'ديفيد فينشر'], correctIndex: 0 },
  { category: 'Movies', difficulty: 'medium', prompt: "Which studio produces the 'Toy Story' films?", promptAr: 'أي استوديو ينتج أفلام "توي ستوري"؟', choices: ['DreamWorks', 'Pixar', 'Illumination', 'Warner Bros.'], choicesAr: ['دريم وركس', 'بيكسار', 'إيلوميناشن', 'وارنر براذرز'], correctIndex: 1 },
  { category: 'Movies', difficulty: 'hard', prompt: 'Which film won the first-ever Academy Award for Best Picture?', promptAr: 'أي فيلم فاز بأول جائزة أوسكار لأفضل فيلم؟', choices: ['Wings', 'Metropolis', 'Sunrise', 'The Jazz Singer'], choicesAr: ['وينغز', 'متروبوليس', 'صنرايز', 'مغني الجاز'], correctIndex: 0 },
  { category: 'Movies', difficulty: 'hard', prompt: "Who composed the iconic score for 'Star Wars'?", promptAr: 'من ألّف الموسيقى التصويرية الشهيرة لفيلم "حرب النجوم"؟', choices: ['Hans Zimmer', 'John Williams', 'Danny Elfman', 'James Horner'], choicesAr: ['هانز زيمر', 'جون ويليامز', 'داني إلفمان', 'جيمس هورنر'], correctIndex: 1 },
  { category: 'Movies', difficulty: 'hard', prompt: "In which year was 'Snow White and the Seven Dwarfs' released?", promptAr: 'في أي عام صدر فيلم "بياض الثلج والأقزام السبعة"؟', choices: ['1933', '1937', '1941', '1945'], choicesAr: ['1933', '1937', '1941', '1945'], correctIndex: 1 },
  { category: 'Movies', difficulty: 'hard', prompt: "Which film is famously known for the line 'I'll be back'?", promptAr: 'أي فيلم اشتهر بجملة "سأعود"؟', choices: ['Predator', 'The Terminator', 'RoboCop', 'Total Recall'], choicesAr: ['المفترس', 'المدمر', 'روبوكوب', 'توتال ريكول'], correctIndex: 1 },
  { category: 'Movies', difficulty: 'hard', prompt: "Who directed the 1994 film 'Pulp Fiction'?", promptAr: 'من أخرج فيلم "بالب فيكشن" عام 1994؟', choices: ['Martin Scorsese', 'Quentin Tarantino', 'Oliver Stone', 'Spike Lee'], choicesAr: ['مارتن سكورسيزي', 'كوينتين تارانتينو', 'أوليفر ستون', 'سبايك لي'], correctIndex: 1 },
  { category: 'Movies', difficulty: 'hard', prompt: 'Which 1975 film is considered the first summer blockbuster?', promptAr: 'أي فيلم من عام 1975 يُعتبر أول فيلم صيفي ضخم الإيرادات؟', choices: ['Star Wars', 'Jaws', 'Rocky', 'Alien'], choicesAr: ['حرب النجوم', 'الفك المفترس', 'روكي', 'الغريب'], correctIndex: 1 },

  // --- Sports ---
  { category: 'Sports', difficulty: 'easy', prompt: 'How many players are on a basketball team on the court at once?', promptAr: 'كم عدد لاعبي فريق كرة السلة على الملعب في آنٍ واحد؟', choices: ['4', '5', '6', '7'], choicesAr: ['4', '5', '6', '7'], correctIndex: 1 },
  { category: 'Sports', difficulty: 'easy', prompt: 'In which sport do you use a racket to hit a shuttlecock?', promptAr: 'في أي رياضة تُستخدم المضرب لضرب الريشة الطائرة؟', choices: ['Tennis', 'Badminton', 'Squash', 'Table Tennis'], choicesAr: ['التنس', 'الريشة الطائرة', 'الاسكواش', 'تنس الطاولة'], correctIndex: 1 },
  { category: 'Sports', difficulty: 'easy', prompt: 'What shape is a soccer field?', promptAr: 'ما هو شكل ملعب كرة القدم؟', choices: ['Circle', 'Rectangle', 'Square', 'Triangle'], choicesAr: ['دائرة', 'مستطيل', 'مربع', 'مثلث'], correctIndex: 1 },
  { category: 'Sports', difficulty: 'easy', prompt: "Which sport is known as 'America's pastime'?", promptAr: 'أي رياضة تُعرف بـ"هواية أمريكا المفضلة"؟', choices: ['Basketball', 'Baseball', 'Football', 'Hockey'], choicesAr: ['كرة السلة', 'البيسبول', 'كرة القدم الأمريكية', 'الهوكي'], correctIndex: 1 },
  { category: 'Sports', difficulty: 'easy', prompt: 'In swimming, what stroke involves swimming on your back?', promptAr: 'في السباحة، ما هي الطريقة التي تتضمن السباحة على الظهر؟', choices: ['Freestyle', 'Backstroke', 'Breaststroke', 'Butterfly'], choicesAr: ['السباحة الحرة', 'سباحة الظهر', 'سباحة الصدر', 'الفراشة'], correctIndex: 1 },
  { category: 'Sports', difficulty: 'easy', prompt: 'How many points is a touchdown worth in American football?', promptAr: 'كم عدد النقاط التي تساويها "التاتشداون" في كرة القدم الأمريكية؟', choices: ['3', '5', '6', '7'], choicesAr: ['3', '5', '6', '7'], correctIndex: 2 },
  { category: 'Sports', difficulty: 'medium', prompt: 'How many players are on a standard soccer team on the field?', promptAr: 'كم عدد لاعبي فريق كرة القدم القياسي على أرض الملعب؟', choices: ['9', '10', '11', '12'], choicesAr: ['9', '10', '11', '12'], correctIndex: 2 },
  { category: 'Sports', difficulty: 'medium', prompt: 'In which sport would you perform a slam dunk?', promptAr: 'في أي رياضة يمكنك تنفيذ "صمة قوية"؟', choices: ['Volleyball', 'Basketball', 'Tennis', 'Badminton'], choicesAr: ['الكرة الطائرة', 'كرة السلة', 'التنس', 'الريشة الطائرة'], correctIndex: 1 },
  { category: 'Sports', difficulty: 'medium', prompt: 'How often are the Summer Olympic Games held?', promptAr: 'كل كم سنة تُقام الألعاب الأولمبية الصيفية؟', choices: ['Every 2 years', 'Every 3 years', 'Every 4 years', 'Every 5 years'], choicesAr: ['كل سنتين', 'كل 3 سنوات', 'كل 4 سنوات', 'كل 5 سنوات'], correctIndex: 2 },
  { category: 'Sports', difficulty: 'medium', prompt: 'How many strings does a standard guitar have?', promptAr: 'كم عدد أوتار الغيتار القياسي؟', choices: ['4', '5', '6', '7'], choicesAr: ['4', '5', '6', '7'], correctIndex: 2 },
  { category: 'Sports', difficulty: 'medium', prompt: 'How many rings are on the Olympic flag?', promptAr: 'كم عدد الحلقات في العلم الأولمبي؟', choices: ['4', '5', '6', '7'], choicesAr: ['4', '5', '6', '7'], correctIndex: 1 },
  { category: 'Sports', difficulty: 'medium', prompt: 'In tennis, what is a score of zero called?', promptAr: 'في التنس، ماذا تُسمى نتيجة الصفر؟', choices: ['Deuce', 'Love', 'Ace', 'Fault'], choicesAr: ['ديوس', 'لوف', 'إيس', 'فولت'], correctIndex: 1 },
  { category: 'Sports', difficulty: 'hard', prompt: 'Which country has won the most FIFA World Cup titles?', promptAr: 'أي دولة فازت بأكبر عدد من ألقاب كأس العالم لكرة القدم؟', choices: ['Germany', 'Argentina', 'Brazil', 'Italy'], choicesAr: ['ألمانيا', 'الأرجنتين', 'البرازيل', 'إيطاليا'], correctIndex: 2 },
  { category: 'Sports', difficulty: 'hard', prompt: 'How many Grand Slam tennis tournaments are there in a year?', promptAr: 'كم عدد بطولات الغراند سلام في التنس خلال العام؟', choices: ['2', '3', '4', '5'], choicesAr: ['2', '3', '4', '5'], correctIndex: 2 },
  { category: 'Sports', difficulty: 'hard', prompt: 'In golf, what term describes one stroke under par?', promptAr: 'في الغولف، ما المصطلح الذي يصف ضربة واحدة أقل من المعدل؟', choices: ['Bogey', 'Birdie', 'Eagle', 'Albatross'], choicesAr: ['بوغي', 'بيردي', 'إيغل', 'ألباتروس'], correctIndex: 1 },
  { category: 'Sports', difficulty: 'hard', prompt: "Which boxer was known as 'The Greatest' and famously fought Joe Frazier?", promptAr: 'أي ملاكم عُرف بـ"الأعظم" وخاض مباراة شهيرة ضد جو فريزر؟', choices: ['Mike Tyson', 'Muhammad Ali', 'George Foreman', 'Sugar Ray Robinson'], choicesAr: ['مايك تايسون', 'محمد علي كلاي', 'جورج فورمان', 'سوغار راي روبنسون'], correctIndex: 1 },
  { category: 'Sports', difficulty: 'hard', prompt: 'How many players are on a cricket team?', promptAr: 'كم عدد لاعبي فريق الكريكيت؟', choices: ['9', '10', '11', '12'], choicesAr: ['9', '10', '11', '12'], correctIndex: 2 },
  { category: 'Sports', difficulty: 'hard', prompt: 'In which year were the first modern Olympic Games held?', promptAr: 'في أي عام أُقيمت أول ألعاب أولمبية حديثة؟', choices: ['1892', '1896', '1900', '1904'], choicesAr: ['1892', '1896', '1900', '1904'], correctIndex: 1 },

  // --- General Knowledge ---
  { category: 'General Knowledge', difficulty: 'easy', prompt: 'How many days are there in a leap year?', promptAr: 'كم عدد أيام السنة الكبيسة؟', choices: ['364', '365', '366', '367'], choicesAr: ['364', '365', '366', '367'], correctIndex: 2 },
  { category: 'General Knowledge', difficulty: 'easy', prompt: 'What color do you get when you mix blue and yellow?', promptAr: 'ما اللون الذي تحصل عليه عند مزج الأزرق والأصفر؟', choices: ['Purple', 'Green', 'Orange', 'Brown'], choicesAr: ['بنفسجي', 'أخضر', 'برتقالي', 'بني'], correctIndex: 1 },
  { category: 'General Knowledge', difficulty: 'easy', prompt: 'How many sides does a hexagon have?', promptAr: 'كم عدد أضلاع الشكل السداسي؟', choices: ['5', '6', '7', '8'], choicesAr: ['5', '6', '7', '8'], correctIndex: 1 },
  { category: 'General Knowledge', difficulty: 'easy', prompt: "What is the opposite of 'hot'?", promptAr: 'ما هو عكس كلمة "ساخن"؟', choices: ['Warm', 'Cold', 'Mild', 'Cool'], choicesAr: ['دافئ', 'بارد', 'معتدل', 'منعش'], correctIndex: 1 },
  { category: 'General Knowledge', difficulty: 'easy', prompt: 'How many hours are in a day?', promptAr: 'كم عدد ساعات اليوم؟', choices: ['12', '24', '36', '48'], choicesAr: ['12', '24', '36', '48'], correctIndex: 1 },
  { category: 'General Knowledge', difficulty: 'easy', prompt: 'What do you call a baby dog?', promptAr: 'ماذا يُطلق على صغير الكلب؟', choices: ['Kitten', 'Puppy', 'Cub', 'Foal'], choicesAr: ['قطة صغيرة', 'جرو', 'شبل', 'مهر'], correctIndex: 1 },
  { category: 'General Knowledge', difficulty: 'medium', prompt: 'What is the largest organ in the human body?', promptAr: 'ما هو أكبر عضو في جسم الإنسان؟', choices: ['Liver', 'Heart', 'Skin', 'Lungs'], choicesAr: ['الكبد', 'القلب', 'الجلد', 'الرئتان'], correctIndex: 2 },
  { category: 'General Knowledge', difficulty: 'medium', prompt: 'How many continents are there?', promptAr: 'كم عدد القارات؟', choices: ['5', '6', '7', '8'], choicesAr: ['5', '6', '7', '8'], correctIndex: 2 },
  { category: 'General Knowledge', difficulty: 'medium', prompt: 'What is the main language spoken in Brazil?', promptAr: 'ما هي اللغة الرئيسية المستخدمة في البرازيل؟', choices: ['Spanish', 'Portuguese', 'French', 'Italian'], choicesAr: ['الإسبانية', 'البرتغالية', 'الفرنسية', 'الإيطالية'], correctIndex: 1 },
  { category: 'General Knowledge', difficulty: 'medium', prompt: 'Which fruit is known for keeping the doctor away?', promptAr: 'أي فاكهة تشتهر بمقولة "تُبعد الطبيب عنك"؟', choices: ['Banana', 'Apple', 'Orange', 'Grape'], choicesAr: ['الموز', 'التفاح', 'البرتقال', 'العنب'], correctIndex: 1 },
  { category: 'General Knowledge', difficulty: 'medium', prompt: 'What is the currency of Japan?', promptAr: 'ما هي عملة اليابان؟', choices: ['Yuan', 'Won', 'Yen', 'Ringgit'], choicesAr: ['اليوان', 'الوون', 'الين', 'الرينغيت'], correctIndex: 2 },
  { category: 'General Knowledge', difficulty: 'medium', prompt: 'How many colors are in a rainbow?', promptAr: 'كم عدد ألوان قوس قزح؟', choices: ['5', '6', '7', '8'], choicesAr: ['5', '6', '7', '8'], correctIndex: 2 },
  { category: 'General Knowledge', difficulty: 'hard', prompt: 'What is the only mammal capable of true flight?', promptAr: 'ما هو الثديي الوحيد القادر على الطيران الحقيقي؟', choices: ['Flying squirrel', 'Bat', 'Colugo', 'Sugar glider'], choicesAr: ['السنجاب الطائر', 'الخفاش', 'الكولوغو', 'الأبوسوم الطائر'], correctIndex: 1 },
  { category: 'General Knowledge', difficulty: 'hard', prompt: "Which element has the chemical symbol 'Fe'?", promptAr: 'أي عنصر يحمل الرمز الكيميائي "Fe"؟', choices: ['Fluorine', 'Iron', 'Lead', 'Tin'], choicesAr: ['الفلور', 'الحديد', 'الرصاص', 'القصدير'], correctIndex: 1 },
  { category: 'General Knowledge', difficulty: 'hard', prompt: 'What is the tallest mountain in the world measured from sea level?', promptAr: 'ما هو أعلى جبل في العالم مقاسًا من سطح البحر؟', choices: ['K2', 'Kangchenjunga', 'Mount Everest', 'Denali'], choicesAr: ['كي2', 'كانغتشنجونغا', 'إفرست', 'دينالي'], correctIndex: 2 },
  { category: 'General Knowledge', difficulty: 'hard', prompt: "What is the world's most spoken native language?", promptAr: 'ما هي اللغة الأم الأكثر تحدثًا في العالم؟', choices: ['English', 'Hindi', 'Mandarin Chinese', 'Spanish'], choicesAr: ['الإنجليزية', 'الهندية', 'الصينية الماندرين', 'الإسبانية'], correctIndex: 2 },
  { category: 'General Knowledge', difficulty: 'hard', prompt: 'What is the study of earthquakes called?', promptAr: 'ماذا يُسمى علم دراسة الزلازل؟', choices: ['Seismology', 'Geology', 'Meteorology', 'Volcanology'], choicesAr: ['علم الزلازل', 'علم الجيولوجيا', 'علم الأرصاد الجوية', 'علم البراكين'], correctIndex: 0 },
  { category: 'General Knowledge', difficulty: 'hard', prompt: 'Which country gifted the Statue of Liberty to the United States?', promptAr: 'أي دولة أهدت تمثال الحرية للولايات المتحدة؟', choices: ['United Kingdom', 'France', 'Spain', 'Netherlands'], choicesAr: ['المملكة المتحدة', 'فرنسا', 'إسبانيا', 'هولندا'], correctIndex: 1 },

  // --- Saudi National Day (اليوم الوطني السعودي) ---
  // A real bank category, matching the other six in shape (6 per difficulty).
  // Before this, picking Saudi National Day in the lobby opened the custom
  // category modal and the host had to type their own questions.
  { category: 'Saudi National Day', difficulty: 'easy', prompt: 'In which year was the Kingdom of Saudi Arabia officially given its name?', promptAr: 'في أي عام سُمّيت المملكة العربية السعودية بهذا الاسم رسميًا؟', choices: ['1902', '1932', '1953', '1979'], choicesAr: ['١٩٠٢', '١٩٣٢', '١٩٥٣', '١٩٧٩'], correctIndex: 1 },
  { category: 'Saudi National Day', difficulty: 'easy', prompt: 'Who was the founder of the modern Kingdom of Saudi Arabia?', promptAr: 'من هو مؤسس المملكة العربية السعودية الحديثة؟', choices: ['King Faisal', 'King Abdulaziz Al Saud', 'King Saud', 'King Khalid'], choicesAr: ['الملك فيصل', 'الملك عبدالعزيز آل سعود', 'الملك سعود', 'الملك خالد'], correctIndex: 1 },
  { category: 'Saudi National Day', difficulty: 'easy', prompt: 'On what date is Saudi National Day celebrated each year?', promptAr: 'في أي تاريخ يُحتفل باليوم الوطني السعودي كل عام؟', choices: ['22 February', '23 September', '1 May', '11 November'], choicesAr: ['٢٢ فبراير', '٢٣ سبتمبر', '١ مايو', '١١ نوفمبر'], correctIndex: 1 },
  { category: 'Saudi National Day', difficulty: 'easy', prompt: 'What is the capital of Saudi Arabia?', promptAr: 'ما هي عاصمة المملكة العربية السعودية؟', choices: ['Jeddah', 'Riyadh', 'Dammam', 'Makkah'], choicesAr: ['جدة', 'الرياض', 'الدمام', 'مكة المكرمة'], correctIndex: 1 },
  { category: 'Saudi National Day', difficulty: 'easy', prompt: 'What is the main colour of the Saudi flag?', promptAr: 'ما هو اللون الأساسي للعلم السعودي؟', choices: ['Red', 'Black', 'Green', 'Blue'], choicesAr: ['الأحمر', 'الأسود', 'الأخضر', 'الأزرق'], correctIndex: 2 },
  { category: 'Saudi National Day', difficulty: 'easy', prompt: 'What two symbols appear on the Saudi national emblem?', promptAr: 'ما الرمزان اللذان يظهران في شعار المملكة؟', choices: ['A falcon and a star', 'Two crossed swords and a palm tree', 'A lion and a crown', 'A crescent and a sword'], choicesAr: ['صقر ونجمة', 'سيفان متقاطعان ونخلة', 'أسد وتاج', 'هلال وسيف'], correctIndex: 1 },

  { category: 'Saudi National Day', difficulty: 'medium', prompt: 'Which Riyadh fortress is associated with King Abdulaziz recapturing the city in 1902?', promptAr: 'أي قصر في الرياض يرتبط باستعادة الملك عبدالعزيز للمدينة عام ١٩٠٢؟', choices: ['Masmak Fortress', 'Tuwaiq Palace', 'Murabba Palace', 'Salwa Palace'], choicesAr: ['قصر المصمك', 'قصر طويق', 'قصر المربع', 'قصر سلوى'], correctIndex: 0 },
  { category: 'Saudi National Day', difficulty: 'medium', prompt: 'What is written across the Saudi flag?', promptAr: 'ماذا كُتب على العلم السعودي؟', choices: ['The Shahada', 'The national anthem', 'The name of the king', 'A line of poetry'], choicesAr: ['الشهادة', 'النشيد الوطني', 'اسم الملك', 'بيت شعر'], correctIndex: 0 },
  { category: 'Saudi National Day', difficulty: 'medium', prompt: 'In which year was Saudi Vision 2030 launched?', promptAr: 'في أي عام أُطلقت رؤية السعودية ٢٠٣٠؟', choices: ['2012', '2016', '2019', '2021'], choicesAr: ['٢٠١٢', '٢٠١٦', '٢٠١٩', '٢٠٢١'], correctIndex: 1 },
  { category: 'Saudi National Day', difficulty: 'medium', prompt: 'How many administrative regions does Saudi Arabia have?', promptAr: 'كم عدد مناطق المملكة العربية السعودية الإدارية؟', choices: ['9', '11', '13', '17'], choicesAr: ['٩', '١١', '١٣', '١٧'], correctIndex: 2 },
  { category: 'Saudi National Day', difficulty: 'medium', prompt: 'What is the currency of Saudi Arabia?', promptAr: 'ما هي عملة المملكة العربية السعودية؟', choices: ['Dirham', 'Dinar', 'Riyal', 'Pound'], choicesAr: ['الدرهم', 'الدينار', 'الريال', 'الجنيه'], correctIndex: 2 },
  { category: 'Saudi National Day', difficulty: 'medium', prompt: 'Which two holy mosques are located in Saudi Arabia?', promptAr: 'ما هما الحرمان الشريفان الموجودان في المملكة؟', choices: ['Al-Masjid al-Haram and Al-Masjid an-Nabawi', 'Al-Aqsa and Al-Masjid al-Haram', 'Quba and Al-Aqsa', 'Al-Masjid an-Nabawi and Al-Aqsa'], choicesAr: ['المسجد الحرام والمسجد النبوي', 'المسجد الأقصى والمسجد الحرام', 'مسجد قباء والمسجد الأقصى', 'المسجد النبوي والمسجد الأقصى'], correctIndex: 0 },

  { category: 'Saudi National Day', difficulty: 'hard', prompt: 'Saudi National Day marks a royal decree issued in which Hijri year?', promptAr: 'يوافق اليوم الوطني السعودي مرسومًا ملكيًا صدر في أي عام هجري؟', choices: ['1319 AH', '1351 AH', '1373 AH', '1400 AH'], choicesAr: ['١٣١٩ هـ', '١٣٥١ هـ', '١٣٧٣ هـ', '١٤٠٠ هـ'], correctIndex: 1 },
  { category: 'Saudi National Day', difficulty: 'hard', prompt: "Which site was Saudi Arabia's first UNESCO World Heritage Site?", promptAr: 'ما هو أول موقع سعودي يُدرج في قائمة اليونسكو للتراث العالمي؟', choices: ['Historic Jeddah', 'Hegra (Mada’in Salih)', 'At-Turaif in Diriyah', 'Rock art of Hail'], choicesAr: ['جدة التاريخية', 'الحِجر (مدائن صالح)', 'الطريف في الدرعية', 'الفنون الصخرية في حائل'], correctIndex: 1 },
  { category: 'Saudi National Day', difficulty: 'hard', prompt: 'Which desert in Saudi Arabia is the largest continuous sand desert in the world?', promptAr: 'أي صحراء في المملكة تُعد أكبر صحراء رملية متصلة في العالم؟', choices: ['An-Nafud', 'Ad-Dahna', 'Rub’ al Khali', 'Al-Jafurah'], choicesAr: ['النفود', 'الدهناء', 'الربع الخالي', 'الجافورة'], correctIndex: 2 },
  { category: 'Saudi National Day', difficulty: 'hard', prompt: 'Saudi Founding Day on 22 February commemorates the establishment of which state?', promptAr: 'يوم التأسيس في ٢٢ فبراير يخلّد تأسيس أي دولة؟', choices: ['The First Saudi State', 'The Second Saudi State', 'The Third Saudi State', 'The Emirate of Riyadh'], choicesAr: ['الدولة السعودية الأولى', 'الدولة السعودية الثانية', 'الدولة السعودية الثالثة', 'إمارة الرياض'], correctIndex: 0 },
  { category: 'Saudi National Day', difficulty: 'hard', prompt: 'Who founded the First Saudi State in Diriyah?', promptAr: 'من أسس الدولة السعودية الأولى في الدرعية؟', choices: ['Imam Muhammad bin Saud', 'Imam Turki bin Abdullah', 'Imam Faisal bin Turki', 'King Abdulaziz'], choicesAr: ['الإمام محمد بن سعود', 'الإمام تركي بن عبدالله', 'الإمام فيصل بن تركي', 'الملك عبدالعزيز'], correctIndex: 0 },
  { category: 'Saudi National Day', difficulty: 'hard', prompt: 'Why is the Saudi flag never flown at half-mast?', promptAr: 'لماذا لا يُنكّس العلم السعودي أبدًا؟', choices: ['It is made of a single piece', 'Because it bears the Shahada', 'It has no pole fitting', 'It is always flown indoors'], choicesAr: ['لأنه مصنوع من قطعة واحدة', 'لأنه يحمل الشهادة', 'لأنه بلا حامل', 'لأنه يُرفع داخليًا فقط'], correctIndex: 1 },

  // Twelve per difficulty rather than the six the other categories carry:
  // both the client panel and POST /start refuse a pool under MIN_POOL (10),
  // so at six a host picking only Saudi National Day could never start.
  { category: 'Saudi National Day', difficulty: 'easy', prompt: 'What is the largest city in Saudi Arabia?', promptAr: 'ما هي أكبر مدينة في المملكة العربية السعودية؟', choices: ['Jeddah', 'Riyadh', 'Makkah', 'Madinah'], choicesAr: ['جدة', 'الرياض', 'مكة المكرمة', 'المدينة المنورة'], correctIndex: 1 },
  { category: 'Saudi National Day', difficulty: 'easy', prompt: 'Which sea lies to the west of Saudi Arabia?', promptAr: 'أي بحر يقع غرب المملكة العربية السعودية؟', choices: ['The Red Sea', 'The Mediterranean', 'The Caspian Sea', 'The Black Sea'], choicesAr: ['البحر الأحمر', 'البحر المتوسط', 'بحر قزوين', 'البحر الأسود'], correctIndex: 0 },
  { category: 'Saudi National Day', difficulty: 'easy', prompt: 'What is the official language of Saudi Arabia?', promptAr: 'ما هي اللغة الرسمية للمملكة العربية السعودية؟', choices: ['Arabic', 'English', 'Persian', 'Turkish'], choicesAr: ['العربية', 'الإنجليزية', 'الفارسية', 'التركية'], correctIndex: 0 },
  { category: 'Saudi National Day', difficulty: 'easy', prompt: 'On which continent is Saudi Arabia located?', promptAr: 'في أي قارة تقع المملكة العربية السعودية؟', choices: ['Africa', 'Europe', 'Asia', 'Oceania'], choicesAr: ['أفريقيا', 'أوروبا', 'آسيا', 'أوقيانوسيا'], correctIndex: 2 },
  { category: 'Saudi National Day', difficulty: 'easy', prompt: 'Which tree appears on the Saudi national emblem?', promptAr: 'أي شجرة تظهر في شعار المملكة؟', choices: ['An olive tree', 'A palm tree', 'A cedar tree', 'An acacia tree'], choicesAr: ['شجرة زيتون', 'نخلة', 'شجرة أرز', 'شجرة سَمُر'], correctIndex: 1 },
  { category: 'Saudi National Day', difficulty: 'easy', prompt: 'In which city is the Kaaba located?', promptAr: 'في أي مدينة تقع الكعبة المشرفة؟', choices: ['Madinah', 'Makkah', 'Taif', 'Riyadh'], choicesAr: ['المدينة المنورة', 'مكة المكرمة', 'الطائف', 'الرياض'], correctIndex: 1 },

  { category: 'Saudi National Day', difficulty: 'medium', prompt: 'Which Saudi city is known as the Bride of the Red Sea?', promptAr: 'أي مدينة سعودية تُلقّب بعروس البحر الأحمر؟', choices: ['Yanbu', 'Jeddah', 'Jazan', 'Rabigh'], choicesAr: ['ينبع', 'جدة', 'جازان', 'رابغ'], correctIndex: 1 },
  { category: 'Saudi National Day', difficulty: 'medium', prompt: 'Which Saudi region is known for its green mountains and cool mist?', promptAr: 'أي منطقة سعودية تشتهر بجبالها الخضراء والضباب؟', choices: ['Asir', 'Al-Qassim', 'Hail', 'Tabuk'], choicesAr: ['عسير', 'القصيم', 'حائل', 'تبوك'], correctIndex: 0 },
  { category: 'Saudi National Day', difficulty: 'medium', prompt: 'Which body of water lies to the east of Saudi Arabia?', promptAr: 'أي مسطح مائي يقع شرق المملكة العربية السعودية؟', choices: ['The Arabian Gulf', 'The Red Sea', 'The Arabian Sea', 'The Gulf of Aden'], choicesAr: ['الخليج العربي', 'البحر الأحمر', 'بحر العرب', 'خليج عدن'], correctIndex: 0 },
  { category: 'Saudi National Day', difficulty: 'medium', prompt: 'Which historic district of Diriyah is on the UNESCO World Heritage list?', promptAr: 'أي حي تاريخي في الدرعية مُدرج في قائمة اليونسكو للتراث العالمي؟', choices: ['At-Turaif', 'Al-Bujairi', 'Ghasibah', 'Al-Malqa'], choicesAr: ['حي الطريف', 'حي البجيري', 'غصيبة', 'الملقا'], correctIndex: 0 },
  { category: 'Saudi National Day', difficulty: 'medium', prompt: 'Roughly how large is Saudi Arabia in area?', promptAr: 'ما هي مساحة المملكة العربية السعودية تقريبًا؟', choices: ['About 500,000 km²', 'About 1 million km²', 'About 2 million km²', 'About 4 million km²'], choicesAr: ['نحو ٥٠٠ ألف كم²', 'نحو مليون كم²', 'نحو مليوني كم²', 'نحو ٤ ملايين كم²'], correctIndex: 2 },
  { category: 'Saudi National Day', difficulty: 'medium', prompt: 'Saudi Arabia is the largest country in which region?', promptAr: 'المملكة العربية السعودية هي أكبر دولة في أي منطقة؟', choices: ['North Africa', 'The Middle East', 'Central Asia', 'The Horn of Africa'], choicesAr: ['شمال أفريقيا', 'الشرق الأوسط', 'آسيا الوسطى', 'القرن الأفريقي'], correctIndex: 1 },

  { category: 'Saudi National Day', difficulty: 'hard', prompt: 'In which year did King Abdulaziz recapture Riyadh?', promptAr: 'في أي عام استعاد الملك عبدالعزيز الرياض؟', choices: ['1902', '1912', '1921', '1926'], choicesAr: ['١٩٠٢', '١٩١٢', '١٩٢١', '١٩٢٦'], correctIndex: 0 },
  { category: 'Saudi National Day', difficulty: 'hard', prompt: 'What was the state called immediately before it was renamed Saudi Arabia?', promptAr: 'ماذا كانت تُسمى الدولة قبل أن تُسمى المملكة العربية السعودية مباشرة؟', choices: ['The Emirate of Nejd', 'The Kingdom of Hejaz and Nejd', 'The Sultanate of Nejd', 'The Emirate of Diriyah'], choicesAr: ['إمارة نجد', 'مملكة الحجاز ونجد', 'سلطنة نجد', 'إمارة الدرعية'], correctIndex: 1 },
  { category: 'Saudi National Day', difficulty: 'hard', prompt: 'Which son of King Abdulaziz was the first to rule after him?', promptAr: 'أي أبناء الملك عبدالعزيز تولى الحكم بعده مباشرة؟', choices: ['King Faisal', 'King Saud', 'King Khalid', 'King Fahd'], choicesAr: ['الملك فيصل', 'الملك سعود', 'الملك خالد', 'الملك فهد'], correctIndex: 1 },
  { category: 'Saudi National Day', difficulty: 'hard', prompt: 'In which year was the Saudi Council of Ministers established?', promptAr: 'في أي عام تأسس مجلس الوزراء السعودي؟', choices: ['1932', '1953', '1965', '1975'], choicesAr: ['١٩٣٢', '١٩٥٣', '١٩٦٥', '١٩٧٥'], correctIndex: 1 },
  { category: 'Saudi National Day', difficulty: 'hard', prompt: 'The First Saudi State was founded in which year?', promptAr: 'في أي عام تأسست الدولة السعودية الأولى؟', choices: ['1727', '1744', '1818', '1824'], choicesAr: ['١٧٢٧', '١٧٤٤', '١٨١٨', '١٨٢٤'], correctIndex: 0 },
  { category: 'Saudi National Day', difficulty: 'hard', prompt: 'Which city was the capital of the First Saudi State?', promptAr: 'ما هي عاصمة الدولة السعودية الأولى؟', choices: ['Riyadh', 'Diriyah', 'Makkah', 'Hail'], choicesAr: ['الرياض', 'الدرعية', 'مكة المكرمة', 'حائل'], correctIndex: 1 },
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
// Arabic source, Knows_You_Best_Questions_Bank.docx) -- supersedes
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

  // --- Imagine If… (تخيل لو) ---
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

  // --- Close Friends Only (للمقربين فقط) ---
  { category: 'Close Friends Only', text: 'When do you know you\'ve "succeeded"?', textAr: 'متى تعرف أنك "نجحت"؟' },
  { category: 'Close Friends Only', text: 'How do you picture your life in retirement?', textAr: 'كيف تتخيل حياتك في التقاعد؟' },
  { category: 'Close Friends Only', text: 'What is the most important quality you want in a life partner?', textAr: 'أكثر صفة مهمة بالنسبة لك في شريك الحياة؟' },
  { category: 'Close Friends Only', text: "What's the best advice your mother gave you?", textAr: 'أفضل نصيحة أعطتها لك والدتك؟' },
  { category: 'Close Friends Only', text: "What's the best advice your father gave you?", textAr: 'أفضل نصيحة أعطاها لك والدك؟' },
  { category: 'Close Friends Only', text: 'If you had a family business, what field would it be in?', textAr: 'إذا كانت عندك شركة عائلية، في أي مجال بتكون؟' },
  { category: 'Close Friends Only', text: 'If a stranger helped you a great deal, how would you repay them?', textAr: 'لو شخص غريب ساعدك بشكل كبير، كيف ترد الجميل؟' },
  { category: 'Close Friends Only', text: "What's the most beautiful girl's name to you?", textAr: 'أجمل اسم بنت بالنسبة لك؟' },
  { category: 'Close Friends Only', text: "What's the most beautiful boy's name to you?", textAr: 'أجمل اسم ولد بالنسبة لك؟' },
  { category: 'Close Friends Only', text: 'What is the most important quality in a parent?', textAr: 'أهم صفة في الوالدين؟' },
  { category: 'Close Friends Only', text: 'If you could erase one day from your life, which would it be?', textAr: 'لو كنت تقدر تمحي يوم واحد من حياتك، ايش بيكون؟' },
  { category: 'Close Friends Only', text: 'What scares you the most?', textAr: 'أكثر شيء يخوفك؟' },
  { category: 'Close Friends Only', text: "What's your favorite fictional character?", textAr: 'أكثر شخصية خيالية تعجبك؟' },
  { category: 'Close Friends Only', text: "What's the game you enjoy the most?", textAr: 'أكثر لعبة تستمتع فيها؟' },
  { category: 'Close Friends Only', text: "What's your favorite emoji?", textAr: 'أكثر ايموجي تحبه؟' },
  { category: 'Close Friends Only', text: "What's your favorite fruit?", textAr: 'أكثر فواكه تحبها؟' },
  { category: 'Close Friends Only', text: "What's your favorite dessert?", textAr: 'الحلى المفضل عندك؟' },
  { category: 'Close Friends Only', text: "What's a new experience you'd like to try?", textAr: 'تجربة جديدة ودك تعيشها؟' },
  { category: 'Close Friends Only', text: 'What do you love most about your appearance?', textAr: 'أكثر شيء تحبه في شكلك؟' },
  { category: 'Close Friends Only', text: "What's your favorite scent?", textAr: 'أكثر رائحة تعجبك؟' },
  { category: 'Close Friends Only', text: 'How would you react if your family refused to let you marry the person you love?', textAr: 'كيف تتصرف لو أهلك رفضوا زواجك من الشخص اللي تحبه؟' },
  { category: 'Close Friends Only', text: 'If you could change one thing about yourself, what would it be?', textAr: 'لو تقدر تغير شيء واحد فيك ايش بيكون؟' },
  { category: 'Close Friends Only', text: 'What do you spend your money on the most?', textAr: 'أكثر شيء تصرف فلوسك عليه؟' },
  { category: 'Close Friends Only', text: 'Which celebrity do you feel you resemble the most?', textAr: 'مين أكثر مشهور تحس إنك تشبهه؟' },
  { category: 'Close Friends Only', text: 'What would be the first decision you would make if you became a head of state?', textAr: 'ايش بيكون أول قرار تتخذه لو صرت رئيس دولة؟' },
  { category: 'Close Friends Only', text: 'If you were founding a country, what would you name it?', textAr: 'لو بتأسس دولة ايش رح تسميها؟' },
  { category: 'Close Friends Only', text: 'If there was one thing you could get for free for life, what would it be?', textAr: 'لو فيه شيء تقدر تحصله مجانًا مدى الحياة ايش بيكون؟' },
  { category: 'Close Friends Only', text: 'If you could commit one crime with no consequences, what would it be?', textAr: 'لو قدرت ترتكب جريمة بدون أي عواقب، ايش بتكون؟' },
  { category: 'Close Friends Only', text: "What's the first thing you notice about someone when you meet them?", textAr: 'أول شيء تنتبه له في الشخص لما تقابله لأول مرة؟' },
  { category: 'Close Friends Only', text: "What's the best joke you've ever heard?", textAr: 'ايش هي أفضل نكتة سمعتها بحياتك؟' },
  { category: 'Close Friends Only', text: 'What would you do if everyone was watching you 24/7?', textAr: 'وش بتسوي لو كل الناس تراقبك 24/7؟' },
  { category: 'Close Friends Only', text: 'How would you react if your closest friend suddenly became your enemy?', textAr: 'كيف تتصرف لو أعز صديق لك صار عدوك فجأة؟' },
  { category: 'Close Friends Only', text: 'What would you do if you could never lie again?', textAr: 'وش بتسوي لو ما عاد تقدر تكذب أبدًا؟' },
  { category: 'Close Friends Only', text: 'What would you do if you had to redo your life from the start but keep your current memories?', textAr: 'وش بتسوي لو كان لازم تعيد حياتك من البداية بس بذاكرتك الحالية؟' },
  { category: 'Close Friends Only', text: "What's the most important goal you hope to achieve in life?", textAr: 'ايش هو أهم هدف تأمل تحققه في حياتك؟' },
  { category: 'Close Friends Only', text: 'When do you feel true contentment and satisfaction?', textAr: 'متى تشعر بالرضا الحقيقي و الاكتفاء؟' },
  { category: 'Close Friends Only', text: 'What would you change about your life if you knew no one could judge you?', textAr: 'ايش ممكن تغير بحياتك لو تأكدت ولا أحد ممكن يحكم عليك؟' },
  { category: 'Close Friends Only', text: "Do you have an opinion that goes against most people's?", textAr: 'هل عندك رأي معاكس لأغلب الناس؟' },
  { category: 'Close Friends Only', text: "What's the strangest dream you've ever had?", textAr: 'ايش أغرب حلم قد حلمته في حياتك؟' },
  { category: 'Close Friends Only', text: "What was the moment you realized you'd grown up?", textAr: 'ايش كانت اللحظة اللي أدركت فيها أنك كبرت؟' },
  { category: 'Close Friends Only', text: 'If you had the chance to send one message to future generations, what would it be?', textAr: 'لو توفرت لك فرصة إرسال رسالة واحدة إلى الأجيال المستقبلية، ايش بتكون؟' },
  { category: 'Close Friends Only', text: "Who's the person that makes you laugh the most, and why?", textAr: 'مين أكثر شخص يضحكك و ليه؟' },
  { category: 'Close Friends Only', text: 'Are you at peace with yourself?', textAr: 'هل أنت متصالح مع ذاتك؟' },
  { category: 'Close Friends Only', text: 'After a long life, what do you want to be remembered for most of all?', textAr: 'بعد عمر طويل، بماذا تريد أن تُذكر أكثر من أي شيء آخر؟' },
  { category: 'Close Friends Only', text: 'What does true friendship look like to you?', textAr: 'كيف تبدو الصداقة الحقيقية بالنسبة لك؟' },
  { category: 'Close Friends Only', text: 'What was the most unforgettable trip of your life?', textAr: 'ايش كانت أكثر رحلة لا تُنسى في حياتك؟' },
  { category: 'Close Friends Only', text: "What's your dream job?", textAr: 'ما هي وظيفة أحلامك؟' },
  { category: 'Close Friends Only', text: 'How do you express your love for the people closest to you?', textAr: 'كيف تُعبّر عن حبّك للأشخاص الأقرب إليك؟' },
  { category: 'Close Friends Only', text: 'What is the most important lesson you learned from a hard experience you went through?', textAr: 'ايش أهم درس تعلمته من تجربة صعبة مريت فيها؟' },
  { category: 'Close Friends Only', text: "What's a habit you've built that you're genuinely proud of?", textAr: 'ايش العادة اللي بنيتها وتفخر فيها فعلاً؟' },
];

async function main() {
  // Additive + idempotent (matched by prompt text) rather than "skip if any
  // rows exist" -- this file is re-run on every boot in production
  // (start:prod), so growing QUESTIONS over time must pick up new rows
  // without duplicating ones already seeded. Existing rows missing an
  // Arabic translation (i.e. seeded before promptAr/choicesAr existed) get
  // backfilled in place rather than skipped, so a redeploy alone finishes
  // the translation rollout without a one-off script.
  const existingRows = await prisma.triviaQuestion.findMany({ select: { id: true, prompt: true, promptAr: true } });
  const existingByPrompt = new Map(existingRows.map((r) => [r.prompt, r]));

  const toCreate = QUESTIONS.filter((q) => !existingByPrompt.has(q.prompt));
  if (toCreate.length > 0) {
    await prisma.triviaQuestion.createMany({ data: toCreate });
  }

  const toBackfill = QUESTIONS.filter((q) => {
    const existing = existingByPrompt.get(q.prompt);
    return existing && !existing.promptAr;
  });
  if (toBackfill.length > 0) {
    await prisma.$transaction(
      toBackfill.map((q) =>
        prisma.triviaQuestion.update({
          where: { id: existingByPrompt.get(q.prompt)!.id },
          data: { promptAr: q.promptAr, choicesAr: q.choicesAr },
        })
      )
    );
  }

  console.log(
    `Trivia questions: ${toCreate.length} created, ${toBackfill.length} backfilled with Arabic, ${QUESTIONS.length - toCreate.length - toBackfill.length} already up to date.`
  );

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
