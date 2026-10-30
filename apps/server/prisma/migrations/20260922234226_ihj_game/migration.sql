-- AlterEnum
ALTER TYPE "GameType" ADD VALUE 'insan_hayawan_jamad';

-- CreateTable
CREATE TABLE "IhjLetter" (
    "id" TEXT NOT NULL,
    "letter" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 2,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IhjLetter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IhjCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IhjCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IhjLetter_letter_key" ON "IhjLetter"("letter");

-- CreateIndex
CREATE UNIQUE INDEX "IhjCategory_name_key" ON "IhjCategory"("name");
