import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type Difficulty = 'easy' | 'medium' | 'hard';

const QUESTIONS: Array<{ category: string; difficulty: Difficulty; prompt: string; choices: string[]; correctIndex: number }> = [
  // --- Geography ---
  { category: 'Geography', difficulty: 'easy', prompt: 'What is the capital of France?', choices: ['Paris', 'Rome', 'Madrid', 'Berlin'], correctIndex: 0 },
  { category: 'Geography', difficulty: 'easy', prompt: 'Which continent is Egypt located in?', choices: ['Asia', 'Africa', 'Europe', 'South America'], correctIndex: 1 },
  { category: 'Geography', difficulty: 'easy', prompt: 'What is the largest country by area?', choices: ['China', 'USA', 'Canada', 'Russia'], correctIndex: 3 },
  { category: 'Geography', difficulty: 'easy', prompt: 'Which country is shaped like a boot?', choices: ['Spain', 'Italy', 'Greece', 'Portugal'], correctIndex: 1 },
  { category: 'Geography', difficulty: 'easy', prompt: 'What is the smallest country in the world?', choices: ['Monaco', 'Vatican City', 'San Marino', 'Liechtenstein'], correctIndex: 1 },
  { category: 'Geography', difficulty: 'easy', prompt: 'Which river is the longest in the world?', choices: ['Amazon', 'Nile', 'Yangtze', 'Mississippi'], correctIndex: 1 },
  { category: 'Geography', difficulty: 'medium', prompt: 'Which planet is known as the Red Planet?', choices: ['Venus', 'Mars', 'Jupiter', 'Saturn'], correctIndex: 1 },
  { category: 'Geography', difficulty: 'medium', prompt: 'What is the largest ocean on Earth?', choices: ['Atlantic', 'Indian', 'Arctic', 'Pacific'], correctIndex: 3 },
  { category: 'Geography', difficulty: 'medium', prompt: 'Which country has the most natural lakes?', choices: ['Canada', 'Russia', 'Finland', 'USA'], correctIndex: 0 },
  { category: 'Geography', difficulty: 'medium', prompt: 'What is the capital of Australia?', choices: ['Sydney', 'Melbourne', 'Canberra', 'Perth'], correctIndex: 2 },
  { category: 'Geography', difficulty: 'medium', prompt: 'Which desert is the largest in the world?', choices: ['Sahara', 'Gobi', 'Antarctic', 'Arabian'], correctIndex: 2 },
  { category: 'Geography', difficulty: 'medium', prompt: 'The Nile river flows through which country?', choices: ['Kenya', 'Egypt', 'Morocco', 'Nigeria'], correctIndex: 1 },
  { category: 'Geography', difficulty: 'hard', prompt: 'Which African country has three capital cities?', choices: ['Nigeria', 'South Africa', 'Kenya', 'Ghana'], correctIndex: 1 },
  { category: 'Geography', difficulty: 'hard', prompt: 'What is the only sea without any coastline?', choices: ['Sargasso Sea', 'Coral Sea', 'Caspian Sea', 'Red Sea'], correctIndex: 0 },
  { category: 'Geography', difficulty: 'hard', prompt: 'Which country has the most time zones?', choices: ['Russia', 'USA', 'France', 'China'], correctIndex: 2 },
  { category: 'Geography', difficulty: 'hard', prompt: 'What is the deepest point in the ocean called?', choices: ['Mariana Trench', 'Puerto Rico Trench', 'Java Trench', 'Tonga Trench'], correctIndex: 0 },
  { category: 'Geography', difficulty: 'hard', prompt: 'Which strait separates Europe from Africa?', choices: ['Bosphorus', 'Strait of Gibraltar', 'Strait of Hormuz', 'Bering Strait'], correctIndex: 1 },
  { category: 'Geography', difficulty: 'hard', prompt: 'Which landlocked country is bordered by exactly two countries, both of which are also landlocked?', choices: ['Uzbekistan', 'Liechtenstein', 'Mongolia', 'Bolivia'], correctIndex: 1 },

  // --- Science ---
  { category: 'Science', difficulty: 'easy', prompt: 'What do bees produce?', choices: ['Milk', 'Honey', 'Silk', 'Wax only'], correctIndex: 1 },
  { category: 'Science', difficulty: 'easy', prompt: 'How many legs does a spider have?', choices: ['6', '8', '10', '12'], correctIndex: 1 },
  { category: 'Science', difficulty: 'easy', prompt: 'What planet do we live on?', choices: ['Mars', 'Venus', 'Earth', 'Mercury'], correctIndex: 2 },
  { category: 'Science', difficulty: 'easy', prompt: 'What is water made of?', choices: ['Hydrogen and Oxygen', 'Carbon and Oxygen', 'Hydrogen and Nitrogen', 'Oxygen only'], correctIndex: 0 },
  { category: 'Science', difficulty: 'easy', prompt: 'What organ pumps blood through the body?', choices: ['Lungs', 'Liver', 'Heart', 'Kidney'], correctIndex: 2 },
  { category: 'Science', difficulty: 'easy', prompt: 'What force pulls objects toward Earth?', choices: ['Magnetism', 'Gravity', 'Friction', 'Tension'], correctIndex: 1 },
  { category: 'Science', difficulty: 'medium', prompt: 'What is the chemical symbol for gold?', choices: ['Ag', 'Au', 'Gd', 'Go'], correctIndex: 1 },
  { category: 'Science', difficulty: 'medium', prompt: 'How many bones are in the adult human body?', choices: ['186', '206', '226', '246'], correctIndex: 1 },
  { category: 'Science', difficulty: 'medium', prompt: 'What gas do plants primarily absorb from the atmosphere?', choices: ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Hydrogen'], correctIndex: 2 },
  { category: 'Science', difficulty: 'medium', prompt: 'What is the speed of light approximately?', choices: ['300,000 km/s', '150,000 km/s', '3,000 km/s', '30,000 km/s'], correctIndex: 0 },
  { category: 'Science', difficulty: 'medium', prompt: 'Which planet has the most moons?', choices: ['Jupiter', 'Saturn', 'Uranus', 'Neptune'], correctIndex: 1 },
  { category: 'Science', difficulty: 'medium', prompt: 'What is the hardest natural substance on Earth?', choices: ['Gold', 'Iron', 'Diamond', 'Quartz'], correctIndex: 2 },
  { category: 'Science', difficulty: 'hard', prompt: 'What is the powerhouse of the cell?', choices: ['Nucleus', 'Ribosome', 'Mitochondria', 'Golgi apparatus'], correctIndex: 2 },
  { category: 'Science', difficulty: 'hard', prompt: "What is the SI unit of electrical resistance?", choices: ['Volt', 'Ohm', 'Watt', 'Ampere'], correctIndex: 1 },
  { category: 'Science', difficulty: 'hard', prompt: 'Which element has the atomic number 1?', choices: ['Helium', 'Hydrogen', 'Lithium', 'Carbon'], correctIndex: 1 },
  { category: 'Science', difficulty: 'hard', prompt: 'What type of bond involves the sharing of electron pairs?', choices: ['Ionic', 'Covalent', 'Metallic', 'Hydrogen'], correctIndex: 1 },
  { category: 'Science', difficulty: 'hard', prompt: "What is the most abundant gas in Earth's atmosphere?", choices: ['Oxygen', 'Carbon Dioxide', 'Nitrogen', 'Argon'], correctIndex: 2 },
  { category: 'Science', difficulty: 'hard', prompt: 'Which scientist proposed the theory of general relativity?', choices: ['Newton', 'Bohr', 'Einstein', 'Curie'], correctIndex: 2 },

  // --- History ---
  { category: 'History', difficulty: 'easy', prompt: 'Who was the first man to walk on the moon?', choices: ['Buzz Aldrin', 'Neil Armstrong', 'Yuri Gagarin', 'John Glenn'], correctIndex: 1 },
  { category: 'History', difficulty: 'easy', prompt: 'In which century did the Titanic sink?', choices: ['19th', '20th', '21st', '18th'], correctIndex: 1 },
  { category: 'History', difficulty: 'easy', prompt: 'Which war involved the Allies fighting the Axis powers?', choices: ['World War I', 'World War II', 'Cold War', 'Vietnam War'], correctIndex: 1 },
  { category: 'History', difficulty: 'easy', prompt: 'Which ancient wonder was located in Egypt?', choices: ['Colossus of Rhodes', 'Great Pyramid of Giza', 'Hanging Gardens', 'Lighthouse of Alexandria'], correctIndex: 1 },
  { category: 'History', difficulty: 'easy', prompt: 'What year did World War I begin?', choices: ['1912', '1914', '1916', '1918'], correctIndex: 1 },
  { category: 'History', difficulty: 'easy', prompt: 'Which empire was ruled by Julius Caesar?', choices: ['Greek Empire', 'Roman Empire', 'Ottoman Empire', 'Persian Empire'], correctIndex: 1 },
  { category: 'History', difficulty: 'medium', prompt: 'Who wrote the plays Hamlet and Macbeth?', choices: ['Dickens', 'Shakespeare', 'Tolstoy', 'Homer'], correctIndex: 1 },
  { category: 'History', difficulty: 'medium', prompt: 'In which year did World War II end?', choices: ['1943', '1944', '1945', '1946'], correctIndex: 2 },
  { category: 'History', difficulty: 'medium', prompt: 'Which ancient civilization built the pyramids of Giza?', choices: ['Romans', 'Greeks', 'Egyptians', 'Persians'], correctIndex: 2 },
  { category: 'History', difficulty: 'medium', prompt: 'Who was the first President of the United States?', choices: ['Jefferson', 'Washington', 'Adams', 'Lincoln'], correctIndex: 1 },
  { category: 'History', difficulty: 'medium', prompt: 'The Great Wall was built primarily to defend which country?', choices: ['Japan', 'Mongolia', 'China', 'Korea'], correctIndex: 2 },
  { category: 'History', difficulty: 'medium', prompt: 'Which document did the American colonies sign in 1776?', choices: ['Bill of Rights', 'Declaration of Independence', 'Constitution', 'Magna Carta'], correctIndex: 1 },
  { category: 'History', difficulty: 'hard', prompt: 'In which year did the Berlin Wall fall?', choices: ['1987', '1989', '1991', '1993'], correctIndex: 1 },
  { category: 'History', difficulty: 'hard', prompt: 'Who was the last Pharaoh of Egypt?', choices: ['Nefertiti', 'Cleopatra VII', 'Hatshepsut', 'Tutankhamun'], correctIndex: 1 },
  { category: 'History', difficulty: 'hard', prompt: 'The Treaty of Versailles ended which conflict?', choices: ['World War I', 'World War II', 'Franco-Prussian War', 'Napoleonic Wars'], correctIndex: 0 },
  { category: 'History', difficulty: 'hard', prompt: 'Which explorer led the first expedition to circumnavigate the globe?', choices: ['Christopher Columbus', 'Vasco da Gama', 'Ferdinand Magellan', 'James Cook'], correctIndex: 2 },
  { category: 'History', difficulty: 'hard', prompt: 'What was the name of the ship that brought the Pilgrims to America in 1620?', choices: ['Mayflower', 'Santa Maria', 'Endeavour', 'Beagle'], correctIndex: 0 },
  { category: 'History', difficulty: 'hard', prompt: 'The Rosetta Stone helped decipher which ancient script?', choices: ['Cuneiform', 'Egyptian hieroglyphs', 'Linear B', 'Sanskrit'], correctIndex: 1 },

  // --- Movies ---
  { category: 'Movies', difficulty: 'easy', prompt: 'Which animated movie features a snowman named Olaf?', choices: ['Moana', 'Frozen', 'Tangled', 'Encanto'], correctIndex: 1 },
  { category: 'Movies', difficulty: 'easy', prompt: 'Who plays Iron Man in the Marvel movies?', choices: ['Chris Evans', 'Robert Downey Jr.', 'Chris Hemsworth', 'Mark Ruffalo'], correctIndex: 1 },
  { category: 'Movies', difficulty: 'easy', prompt: 'What is the name of the boy wizard in the Harry Potter films?', choices: ['Ron Weasley', 'Harry Potter', 'Neville Longbottom', 'Draco Malfoy'], correctIndex: 1 },
  { category: 'Movies', difficulty: 'easy', prompt: 'Which movie features a clownfish searching for his son?', choices: ['Finding Nemo', 'Shark Tale', 'Moana', 'The Little Mermaid'], correctIndex: 0 },
  { category: 'Movies', difficulty: 'easy', prompt: 'What kind of animal is Simba in The Lion King?', choices: ['Tiger', 'Lion', 'Leopard', 'Cheetah'], correctIndex: 1 },
  { category: 'Movies', difficulty: 'easy', prompt: 'In Toy Story, what type of toy is Woody?', choices: ['Astronaut', 'Cowboy', 'Robot', 'Dinosaur'], correctIndex: 1 },
  { category: 'Movies', difficulty: 'medium', prompt: 'Who directed the movie "Jaws"?', choices: ['George Lucas', 'Steven Spielberg', 'Martin Scorsese', 'James Cameron'], correctIndex: 1 },
  { category: 'Movies', difficulty: 'medium', prompt: 'Which movie features the song "Let It Go"?', choices: ['Moana', 'Tangled', 'Frozen', 'Encanto'], correctIndex: 2 },
  { category: 'Movies', difficulty: 'medium', prompt: 'What is the highest-grossing film of all time (unadjusted)?', choices: ['Titanic', 'Avatar', 'Avengers: Endgame', 'Star Wars'], correctIndex: 1 },
  { category: 'Movies', difficulty: 'medium', prompt: 'Which trilogy is set in Middle-earth?', choices: ['The Lord of the Rings', 'Star Wars', 'The Matrix', 'Chronicles of Narnia'], correctIndex: 0 },
  { category: 'Movies', difficulty: 'medium', prompt: 'Who directed "Inception" and "The Dark Knight"?', choices: ['Christopher Nolan', 'Quentin Tarantino', 'Ridley Scott', 'David Fincher'], correctIndex: 0 },
  { category: 'Movies', difficulty: 'medium', prompt: "Which studio produces the 'Toy Story' films?", choices: ['DreamWorks', 'Pixar', 'Illumination', 'Warner Bros.'], correctIndex: 1 },
  { category: 'Movies', difficulty: 'hard', prompt: 'Which film won the first-ever Academy Award for Best Picture?', choices: ['Wings', 'Metropolis', 'Sunrise', 'The Jazz Singer'], correctIndex: 0 },
  { category: 'Movies', difficulty: 'hard', prompt: "Who composed the iconic score for 'Star Wars'?", choices: ['Hans Zimmer', 'John Williams', 'Danny Elfman', 'James Horner'], correctIndex: 1 },
  { category: 'Movies', difficulty: 'hard', prompt: "In which year was 'Snow White and the Seven Dwarfs' released?", choices: ['1933', '1937', '1941', '1945'], correctIndex: 1 },
  { category: 'Movies', difficulty: 'hard', prompt: "Which film is famously known for the line 'I'll be back'?", choices: ['Predator', 'The Terminator', 'RoboCop', 'Total Recall'], correctIndex: 1 },
  { category: 'Movies', difficulty: 'hard', prompt: "Who directed the 1994 film 'Pulp Fiction'?", choices: ['Martin Scorsese', 'Quentin Tarantino', 'Oliver Stone', 'Spike Lee'], correctIndex: 1 },
  { category: 'Movies', difficulty: 'hard', prompt: 'Which 1975 film is considered the first summer blockbuster?', choices: ['Star Wars', 'Jaws', 'Rocky', 'Alien'], correctIndex: 1 },

  // --- Sports ---
  { category: 'Sports', difficulty: 'easy', prompt: 'How many players are on a basketball team on the court at once?', choices: ['4', '5', '6', '7'], correctIndex: 1 },
  { category: 'Sports', difficulty: 'easy', prompt: 'In which sport do you use a racket to hit a shuttlecock?', choices: ['Tennis', 'Badminton', 'Squash', 'Table Tennis'], correctIndex: 1 },
  { category: 'Sports', difficulty: 'easy', prompt: 'What shape is a soccer field?', choices: ['Circle', 'Rectangle', 'Square', 'Triangle'], correctIndex: 1 },
  { category: 'Sports', difficulty: 'easy', prompt: "Which sport is known as 'America's pastime'?", choices: ['Basketball', 'Baseball', 'Football', 'Hockey'], correctIndex: 1 },
  { category: 'Sports', difficulty: 'easy', prompt: 'In swimming, what stroke involves swimming on your back?', choices: ['Freestyle', 'Backstroke', 'Breaststroke', 'Butterfly'], correctIndex: 1 },
  { category: 'Sports', difficulty: 'easy', prompt: 'How many points is a touchdown worth in American football?', choices: ['3', '5', '6', '7'], correctIndex: 2 },
  { category: 'Sports', difficulty: 'medium', prompt: 'How many players are on a standard soccer team on the field?', choices: ['9', '10', '11', '12'], correctIndex: 2 },
  { category: 'Sports', difficulty: 'medium', prompt: 'In which sport would you perform a slam dunk?', choices: ['Volleyball', 'Basketball', 'Tennis', 'Badminton'], correctIndex: 1 },
  { category: 'Sports', difficulty: 'medium', prompt: 'How often are the Summer Olympic Games held?', choices: ['Every 2 years', 'Every 3 years', 'Every 4 years', 'Every 5 years'], correctIndex: 2 },
  { category: 'Sports', difficulty: 'medium', prompt: 'How many strings does a standard guitar have?', choices: ['4', '5', '6', '7'], correctIndex: 2 },
  { category: 'Sports', difficulty: 'medium', prompt: 'How many rings are on the Olympic flag?', choices: ['4', '5', '6', '7'], correctIndex: 1 },
  { category: 'Sports', difficulty: 'medium', prompt: 'In tennis, what is a score of zero called?', choices: ['Deuce', 'Love', 'Ace', 'Fault'], correctIndex: 1 },
  { category: 'Sports', difficulty: 'hard', prompt: 'Which country has won the most FIFA World Cup titles?', choices: ['Germany', 'Argentina', 'Brazil', 'Italy'], correctIndex: 2 },
  { category: 'Sports', difficulty: 'hard', prompt: 'How many Grand Slam tennis tournaments are there in a year?', choices: ['2', '3', '4', '5'], correctIndex: 2 },
  { category: 'Sports', difficulty: 'hard', prompt: 'In golf, what term describes one stroke under par?', choices: ['Bogey', 'Birdie', 'Eagle', 'Albatross'], correctIndex: 1 },
  { category: 'Sports', difficulty: 'hard', prompt: "Which boxer was known as 'The Greatest' and famously fought Joe Frazier?", choices: ['Mike Tyson', 'Muhammad Ali', 'George Foreman', 'Sugar Ray Robinson'], correctIndex: 1 },
  { category: 'Sports', difficulty: 'hard', prompt: 'How many players are on a cricket team?', choices: ['9', '10', '11', '12'], correctIndex: 2 },
  { category: 'Sports', difficulty: 'hard', prompt: 'In which year were the first modern Olympic Games held?', choices: ['1892', '1896', '1900', '1904'], correctIndex: 1 },

  // --- General Knowledge ---
  { category: 'General Knowledge', difficulty: 'easy', prompt: 'How many days are there in a leap year?', choices: ['364', '365', '366', '367'], correctIndex: 2 },
  { category: 'General Knowledge', difficulty: 'easy', prompt: 'What color do you get when you mix blue and yellow?', choices: ['Purple', 'Green', 'Orange', 'Brown'], correctIndex: 1 },
  { category: 'General Knowledge', difficulty: 'easy', prompt: 'How many sides does a hexagon have?', choices: ['5', '6', '7', '8'], correctIndex: 1 },
  { category: 'General Knowledge', difficulty: 'easy', prompt: "What is the opposite of 'hot'?", choices: ['Warm', 'Cold', 'Mild', 'Cool'], correctIndex: 1 },
  { category: 'General Knowledge', difficulty: 'easy', prompt: 'How many hours are in a day?', choices: ['12', '24', '36', '48'], correctIndex: 1 },
  { category: 'General Knowledge', difficulty: 'easy', prompt: 'What do you call a baby dog?', choices: ['Kitten', 'Puppy', 'Cub', 'Foal'], correctIndex: 1 },
  { category: 'General Knowledge', difficulty: 'medium', prompt: 'What is the largest organ in the human body?', choices: ['Liver', 'Heart', 'Skin', 'Lungs'], correctIndex: 2 },
  { category: 'General Knowledge', difficulty: 'medium', prompt: 'How many continents are there?', choices: ['5', '6', '7', '8'], correctIndex: 2 },
  { category: 'General Knowledge', difficulty: 'medium', prompt: 'What is the main language spoken in Brazil?', choices: ['Spanish', 'Portuguese', 'French', 'Italian'], correctIndex: 1 },
  { category: 'General Knowledge', difficulty: 'medium', prompt: 'Which fruit is known for keeping the doctor away?', choices: ['Banana', 'Apple', 'Orange', 'Grape'], correctIndex: 1 },
  { category: 'General Knowledge', difficulty: 'medium', prompt: 'What is the currency of Japan?', choices: ['Yuan', 'Won', 'Yen', 'Ringgit'], correctIndex: 2 },
  { category: 'General Knowledge', difficulty: 'medium', prompt: 'How many colors are in a rainbow?', choices: ['5', '6', '7', '8'], correctIndex: 2 },
  { category: 'General Knowledge', difficulty: 'hard', prompt: 'What is the only mammal capable of true flight?', choices: ['Flying squirrel', 'Bat', 'Colugo', 'Sugar glider'], correctIndex: 1 },
  { category: 'General Knowledge', difficulty: 'hard', prompt: "Which element has the chemical symbol 'Fe'?", choices: ['Fluorine', 'Iron', 'Lead', 'Tin'], correctIndex: 1 },
  { category: 'General Knowledge', difficulty: 'hard', prompt: 'What is the tallest mountain in the world measured from sea level?', choices: ['K2', 'Kangchenjunga', 'Mount Everest', 'Denali'], correctIndex: 2 },
  { category: 'General Knowledge', difficulty: 'hard', prompt: "What is the world's most spoken native language?", choices: ['English', 'Hindi', 'Mandarin Chinese', 'Spanish'], correctIndex: 2 },
  { category: 'General Knowledge', difficulty: 'hard', prompt: 'What is the study of earthquakes called?', choices: ['Seismology', 'Geology', 'Meteorology', 'Volcanology'], correctIndex: 0 },
  { category: 'General Knowledge', difficulty: 'hard', prompt: 'Which country gifted the Statue of Liberty to the United States?', choices: ['United Kingdom', 'France', 'Spain', 'Netherlands'], correctIndex: 1 },
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
  // without duplicating ones already seeded.
  const existingPrompts = new Set((await prisma.triviaQuestion.findMany({ select: { prompt: true } })).map((r) => r.prompt));
  const newQuestions = QUESTIONS.filter((q) => !existingPrompts.has(q.prompt));
  if (newQuestions.length > 0) {
    await prisma.triviaQuestion.createMany({ data: newQuestions });
    console.log(`Seeded ${newQuestions.length} new trivia questions (${QUESTIONS.length - newQuestions.length} already present).`);
  } else {
    console.log(`All ${QUESTIONS.length} trivia questions already present — skipping.`);
  }

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
