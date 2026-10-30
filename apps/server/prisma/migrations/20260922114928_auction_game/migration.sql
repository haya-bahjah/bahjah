-- AlterEnum
ALTER TYPE "GameType" ADD VALUE 'auction';

-- CreateTable
CREATE TABLE "AuctionCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "minAnswers" INTEGER NOT NULL DEFAULT 50,
    "maxAnswers" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuctionCategory_pkey" PRIMARY KEY ("id")
);
