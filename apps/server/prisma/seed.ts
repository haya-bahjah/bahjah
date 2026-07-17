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
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
