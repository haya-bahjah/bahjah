-- CreateTable
CREATE TABLE "GameHistoryEntry" (
    "id" TEXT NOT NULL,
    "roomCode" TEXT NOT NULL,
    "gameType" "GameType" NOT NULL,
    "hostId" TEXT NOT NULL,
    "playedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "results" JSONB NOT NULL,

    CONSTRAINT "GameHistoryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GameHistoryEntry_hostId_idx" ON "GameHistoryEntry"("hostId");

-- AddForeignKey
ALTER TABLE "GameHistoryEntry" ADD CONSTRAINT "GameHistoryEntry_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
