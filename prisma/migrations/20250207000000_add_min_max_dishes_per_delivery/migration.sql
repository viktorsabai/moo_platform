-- AlterTable: add minDishesPerDelivery and maxDishesPerDelivery to SubscriptionPlanTemplate.
-- Safe to run on DB that already has these (e.g. after db push): uses IF NOT EXISTS where supported.
ALTER TABLE "SubscriptionPlanTemplate" ADD COLUMN IF NOT EXISTS "minDishesPerDelivery" INTEGER;
ALTER TABLE "SubscriptionPlanTemplate" ADD COLUMN IF NOT EXISTS "maxDishesPerDelivery" INTEGER;
