-- AlterTable
ALTER TABLE "TriviaQuestion" ADD COLUMN     "choicesAr" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "promptAr" TEXT;
