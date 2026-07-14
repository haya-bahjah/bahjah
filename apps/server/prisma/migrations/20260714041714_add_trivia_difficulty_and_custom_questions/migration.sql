-- CreateEnum
CREATE TYPE "TriviaDifficulty" AS ENUM ('easy', 'medium', 'hard');

-- AlterTable
ALTER TABLE "TriviaQuestion" ADD COLUMN     "difficulty" "TriviaDifficulty" NOT NULL DEFAULT 'medium';

-- CreateTable
CREATE TABLE "TriviaCustomQuestion" (
    "id" TEXT NOT NULL,
    "roomCode" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "choices" TEXT[],
    "correctIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TriviaCustomQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TriviaCustomQuestion_roomCode_idx" ON "TriviaCustomQuestion"("roomCode");
