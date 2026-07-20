-- CreateEnum
CREATE TYPE "BillingPlan" AS ENUM ('none', 'day_pass', 'monthly');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('none', 'active', 'past_due', 'canceled');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "cardBrand" TEXT,
ADD COLUMN     "cardLast4" TEXT,
ADD COLUMN     "cardToken" TEXT,
ADD COLUMN     "nextBillingAt" TIMESTAMP(3),
ADD COLUMN     "paidUntil" TIMESTAMP(3),
ADD COLUMN     "plan" "BillingPlan" NOT NULL DEFAULT 'none',
ADD COLUMN     "renewalAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'none';

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "moyasarId" TEXT NOT NULL,
    "plan" "BillingPlan" NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "status" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Payment_moyasarId_key" ON "Payment"("moyasarId");

-- CreateIndex
CREATE INDEX "Payment_userId_idx" ON "Payment"("userId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
