-- AlterEnum
ALTER TYPE "GameType" ADD VALUE 'majlisak';

-- CreateTable
CREATE TABLE "MajlisakGame" (
    "id" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "occasion" TEXT NOT NULL,
    "honoree" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "language" TEXT NOT NULL DEFAULT 'ar',
    "themeId" TEXT NOT NULL DEFAULT 'graduation',
    "themeImageId" TEXT,
    "questions" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "albumToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MajlisakGame_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MajlisakImage" (
    "id" TEXT NOT NULL,
    "gameId" TEXT,
    "ownerId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "roomCode" TEXT,
    "questionId" TEXT,
    "authorName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MajlisakImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MajlisakNote" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "roomCode" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MajlisakNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MajlisakGame_albumToken_key" ON "MajlisakGame"("albumToken");

-- CreateIndex
CREATE INDEX "MajlisakGame_hostId_idx" ON "MajlisakGame"("hostId");

-- CreateIndex
CREATE INDEX "MajlisakImage_gameId_idx" ON "MajlisakImage"("gameId");

-- CreateIndex
CREATE INDEX "MajlisakNote_gameId_idx" ON "MajlisakNote"("gameId");

