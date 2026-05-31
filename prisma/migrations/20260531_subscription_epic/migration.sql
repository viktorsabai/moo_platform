-- Subscription epic: config, option eligibility, personCount/periodDays

ALTER TABLE "AppSettings" ADD COLUMN IF NOT EXISTS "subscriptionConfigJson" JSONB;

ALTER TABLE "DishOptionValue" ADD COLUMN IF NOT EXISTS "costPrice" DECIMAL(10,2);
ALTER TABLE "DishOptionValue" ADD COLUMN IF NOT EXISTS "subscriptionEligible" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "DishModifier" ADD COLUMN IF NOT EXISTS "costPrice" DECIMAL(10,2);
ALTER TABLE "DishModifier" ADD COLUMN IF NOT EXISTS "subscriptionEligible" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "personCount" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "periodDays" INTEGER NOT NULL DEFAULT 28;
