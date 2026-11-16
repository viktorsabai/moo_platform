ALTER TABLE "SubscriptionDelivery" ADD COLUMN IF NOT EXISTS "kitchenError" TEXT;
ALTER TABLE "SubscriptionDelivery" ADD COLUMN IF NOT EXISTS "kitchenErrorAt" TIMESTAMP(3);
