-- AlterEnum
ALTER TYPE "GameType" ADD VALUE 'fabrication';

-- CreateTable
CREATE TABLE "FabricationQuestion" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "difficulty" "TriviaDifficulty" NOT NULL DEFAULT 'medium',
    "prompt" TEXT NOT NULL,
    "promptAr" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "answerAr" TEXT NOT NULL,
    "acceptedVariants" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "acceptedVariantsAr" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FabricationQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FabricationQuestion_category_idx" ON "FabricationQuestion"("category");
