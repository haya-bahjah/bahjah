import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const QUESTIONS: Array<{ category: string; prompt: string; choices: string[]; correctIndex: number }> = [
  { category: 'Geography', prompt: 'Which planet is known as the Red Planet?', choices: ['Venus', 'Mars', 'Jupiter', 'Saturn'], correctIndex: 1 },
  { category: 'Geography', prompt: 'What is the largest ocean on Earth?', choices: ['Atlantic', 'Indian', 'Arctic', 'Pacific'], correctIndex: 3 },
  { category: 'Geography', prompt: 'Which country has the most natural lakes?', choices: ['Canada', 'Russia', 'Finland', 'USA'], correctIndex: 0 },
  { category: 'Geography', prompt: 'What is the capital of Australia?', choices: ['Sydney', 'Melbourne', 'Canberra', 'Perth'], correctIndex: 2 },
  { category: 'Geography', prompt: 'Which desert is the largest in the world?', choices: ['Sahara', 'Gobi', 'Antarctic', 'Arabian'], correctIndex: 2 },
  { category: 'Geography', prompt: 'The Nile river flows through which country?', choices: ['Kenya', 'Egypt', 'Morocco', 'Nigeria'], correctIndex: 1 },
  { category: 'Science', prompt: 'What is the chemical symbol for gold?', choices: ['Ag', 'Au', 'Gd', 'Go'], correctIndex: 1 },
  { category: 'Science', prompt: 'How many bones are in the adult human body?', choices: ['186', '206', '226', '246'], correctIndex: 1 },
  { category: 'Science', prompt: 'What gas do plants primarily absorb from the atmosphere?', choices: ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Hydrogen'], correctIndex: 2 },
  { category: 'Science', prompt: 'What is the speed of light approximately?', choices: ['300,000 km/s', '150,000 km/s', '3,000 km/s', '30,000 km/s'], correctIndex: 0 },
  { category: 'Science', prompt: 'Which planet has the most moons?', choices: ['Jupiter', 'Saturn', 'Uranus', 'Neptune'], correctIndex: 1 },
  { category: 'Science', prompt: 'What is the hardest natural substance on Earth?', choices: ['Gold', 'Iron', 'Diamond', 'Quartz'], correctIndex: 2 },
  { category: 'History', prompt: 'Who wrote the plays Hamlet and Macbeth?', choices: ['Dickens', 'Shakespeare', 'Tolstoy', 'Homer'], correctIndex: 1 },
  { category: 'History', prompt: 'In which year did World War II end?', choices: ['1943', '1944', '1945', '1946'], correctIndex: 2 },
  { category: 'History', prompt: 'Which ancient civilization built the pyramids of Giza?', choices: ['Romans', 'Greeks', 'Egyptians', 'Persians'], correctIndex: 2 },
  { category: 'History', prompt: 'Who was the first President of the United States?', choices: ['Jefferson', 'Washington', 'Adams', 'Lincoln'], correctIndex: 1 },
  { category: 'History', prompt: 'The Great Wall was built primarily to defend which country?', choices: ['Japan', 'Mongolia', 'China', 'Korea'], correctIndex: 2 },
  { category: 'Movies', prompt: 'Who directed the movie "Jaws"?', choices: ['George Lucas', 'Steven Spielberg', 'Martin Scorsese', 'James Cameron'], correctIndex: 1 },
  { category: 'Movies', prompt: 'Which movie features the song "Let It Go"?', choices: ['Moana', 'Tangled', 'Frozen', 'Encanto'], correctIndex: 2 },
  { category: 'Movies', prompt: 'What is the highest-grossing film of all time (unadjusted)?', choices: ['Titanic', 'Avatar', 'Avengers: Endgame', 'Star Wars'], correctIndex: 1 },
  { category: 'Sports', prompt: 'How many players are on a standard soccer team on the field?', choices: ['9', '10', '11', '12'], correctIndex: 2 },
  { category: 'Sports', prompt: 'In which sport would you perform a slam dunk?', choices: ['Volleyball', 'Basketball', 'Tennis', 'Badminton'], correctIndex: 1 },
  { category: 'Sports', prompt: 'How often are the Summer Olympic Games held?', choices: ['Every 2 years', 'Every 3 years', 'Every 4 years', 'Every 5 years'], correctIndex: 2 },
  { category: 'Sports', prompt: 'How many strings does a standard guitar have?', choices: ['4', '5', '6', '7'], correctIndex: 2 },
  { category: 'General Knowledge', prompt: 'What is the largest organ in the human body?', choices: ['Liver', 'Heart', 'Skin', 'Lungs'], correctIndex: 2 },
  { category: 'General Knowledge', prompt: 'How many continents are there?', choices: ['5', '6', '7', '8'], correctIndex: 2 },
  { category: 'General Knowledge', prompt: 'What is the main language spoken in Brazil?', choices: ['Spanish', 'Portuguese', 'French', 'Italian'], correctIndex: 1 },
  { category: 'General Knowledge', prompt: 'Which fruit is known for keeping the doctor away?', choices: ['Banana', 'Apple', 'Orange', 'Grape'], correctIndex: 1 },
  { category: 'General Knowledge', prompt: 'What is the currency of Japan?', choices: ['Yuan', 'Won', 'Yen', 'Ringgit'], correctIndex: 2 },
  { category: 'General Knowledge', prompt: 'How many colors are in a rainbow?', choices: ['5', '6', '7', '8'], correctIndex: 2 },
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
  const existingQuestions = await prisma.triviaQuestion.count();
  if (existingQuestions > 0) {
    console.log(`TriviaQuestion already has ${existingQuestions} rows — skipping seed.`);
  } else {
    await prisma.triviaQuestion.createMany({ data: QUESTIONS });
    console.log(`Seeded ${QUESTIONS.length} trivia questions.`);
  }

  const existingPrompts = await prisma.knowsYouBestPrompt.count();
  if (existingPrompts > 0) {
    console.log(`KnowsYouBestPrompt already has ${existingPrompts} rows — skipping seed.`);
  } else {
    await prisma.knowsYouBestPrompt.createMany({ data: KYB_PROMPTS });
    console.log(`Seeded ${KYB_PROMPTS.length} knows-you-best prompts.`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
