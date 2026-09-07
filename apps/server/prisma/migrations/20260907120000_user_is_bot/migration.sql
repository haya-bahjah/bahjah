-- Practice bots: filler players a host can add to their own lobby to reach
-- the game's player minimum. Bots are ordinary users and ordinary room
-- members; this flag is only how the bot driver knows whose turns to play.
ALTER TABLE "User" ADD COLUMN "isBot" BOOLEAN NOT NULL DEFAULT false;
