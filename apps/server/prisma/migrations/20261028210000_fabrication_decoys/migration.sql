-- فبركة: the game's own believable wrong answers for each question, used to
-- top up a voting board that has fewer lies than players.
ALTER TABLE "FabricationQuestion" ADD COLUMN "decoys" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "FabricationQuestion" ADD COLUMN "decoysAr" TEXT[] DEFAULT ARRAY[]::TEXT[];
