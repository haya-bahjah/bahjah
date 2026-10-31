-- AlterTable
ALTER TABLE "GameHistoryEntry" ADD COLUMN "highlights" JSONB;

-- CreateIndex
CREATE INDEX "GameHistoryEntry_hostId_playedAt_idx" ON "GameHistoryEntry"("hostId", "playedAt");
