-- CreateTable
CREATE TABLE "PinnedGame" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameType" "GameType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PinnedGame_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionPack" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameType" "GameType" NOT NULL,
    "name" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionPack_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PinnedGame_userId_gameType_key" ON "PinnedGame"("userId", "gameType");

-- CreateIndex
CREATE INDEX "QuestionPack_userId_idx" ON "QuestionPack"("userId");

-- AddForeignKey
ALTER TABLE "PinnedGame" ADD CONSTRAINT "PinnedGame_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionPack" ADD CONSTRAINT "QuestionPack_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
