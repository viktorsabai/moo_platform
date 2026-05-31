-- Добавить колонки minDishesPerDelivery и maxDishesPerDelivery в продовую БД.
-- Выполнить один раз в проде (Vercel Postgres / Supabase / любой SQL-консоль).
-- Безопасно повторять: IF NOT EXISTS не создаст колонку второй раз.
ALTER TABLE "SubscriptionPlanTemplate" ADD COLUMN IF NOT EXISTS "minDishesPerDelivery" INTEGER;
ALTER TABLE "SubscriptionPlanTemplate" ADD COLUMN IF NOT EXISTS "maxDishesPerDelivery" INTEGER;
