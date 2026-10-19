-- Welcome to a Saudi Home: a fourth game type, played only from private event
-- links, and the per-player results its share pages and all-day leaderboard
-- read from.
ALTER TYPE "GameType" ADD VALUE 'saudi_home';

CREATE TABLE "SaudiHomeResult" (
    "id" TEXT NOT NULL,
    "shareToken" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "roomCode" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL,
    "playerCount" INTEGER NOT NULL,
    "correctCount" INTEGER NOT NULL,
    "questionCount" INTEGER NOT NULL,
    "correctTimeMs" INTEGER NOT NULL,
    "day" TEXT NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaudiHomeResult_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SaudiHomeResult_shareToken_key" ON "SaudiHomeResult"("shareToken");
CREATE INDEX "SaudiHomeResult_eventId_day_score_idx" ON "SaudiHomeResult"("eventId", "day", "score");
