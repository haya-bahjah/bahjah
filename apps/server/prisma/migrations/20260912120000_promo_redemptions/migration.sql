-- Promo code redemptions. The unique index on (code, "userId") is what
-- enforces "once per account, ever" -- see the model comment in schema.prisma.
CREATE TABLE "PromoRedemption" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "code" TEXT NOT NULL,
    "grantedHours" INTEGER NOT NULL,
    "grantedUntil" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromoRedemption_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PromoRedemption_code_idx" ON "PromoRedemption"("code");

CREATE UNIQUE INDEX "PromoRedemption_code_userId_key" ON "PromoRedemption"("code", "userId");

ALTER TABLE "PromoRedemption" ADD CONSTRAINT "PromoRedemption_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
