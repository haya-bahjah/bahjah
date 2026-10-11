-- Rooms opened from a private event link remember which event they belong to.
-- Nullable, so every existing room is an ordinary room.
ALTER TABLE "Room" ADD COLUMN "eventId" TEXT;
