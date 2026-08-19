-- Persist delivery vs pickup as an explicit order business field.
ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "fulfillmentMethod" TEXT NOT NULL DEFAULT 'DELIVERY';

CREATE INDEX IF NOT EXISTS "Order_restaurantId_fulfillmentMethod_idx"
  ON "Order" ("restaurantId", "fulfillmentMethod");
