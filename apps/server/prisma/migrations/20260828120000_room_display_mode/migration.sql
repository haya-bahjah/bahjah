-- Whether a room's creator is a player on their own phone, or a passive
-- second screen. Existing rooms behaved like the latter, so that is the
-- default and no backfill is needed.
CREATE TYPE "RoomDisplayMode" AS ENUM ('phone', 'tv');

ALTER TABLE "Room"
  ADD COLUMN "displayMode" "RoomDisplayMode" NOT NULL DEFAULT 'tv';
