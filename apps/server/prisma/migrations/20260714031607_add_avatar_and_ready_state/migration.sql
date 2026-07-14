-- AlterTable
ALTER TABLE "RoomMember" ADD COLUMN     "isReady" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatar" TEXT;
