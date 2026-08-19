-- Repair columns used by checkout and the owner Operations queue.
-- The project has historically been deployed against databases with partial schema state,
-- so every addition is intentionally idempotent.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "itemsCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paymentOptionSlug" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "fulfillmentMethod" TEXT NOT NULL DEFAULT 'DELIVERY';
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paymentAmountRub" DECIMAL(12, 2);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "fxRubPerThb" DECIMAL(12, 6);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "receiptUrl" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "receiptUploadedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Order_restaurantId_status_idx" ON "Order"("restaurantId", "status");
