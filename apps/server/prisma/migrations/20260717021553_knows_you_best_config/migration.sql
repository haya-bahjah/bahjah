-- AlterTable
ALTER TABLE "KnowsYouBestPrompt" ADD COLUMN     "textAr" TEXT;

-- CreateTable
CREATE TABLE "KnowsYouBestCustomPrompt" (
    "id" TEXT NOT NULL,
    "roomCode" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "textAr" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowsYouBestCustomPrompt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KnowsYouBestCustomPrompt_roomCode_idx" ON "KnowsYouBestCustomPrompt"("roomCode");
