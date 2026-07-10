-- CreateTable
CREATE TABLE "KnowsYouBestPrompt" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowsYouBestPrompt_pkey" PRIMARY KEY ("id")
);
