-- Optional image for subscription UI only (not shown on guest menu).
ALTER TABLE "DishModifier" ADD COLUMN IF NOT EXISTS "subscriptionImageUrl" TEXT;
ALTER TABLE "MenuOptionValue" ADD COLUMN IF NOT EXISTS "subscriptionImageUrl" TEXT;
