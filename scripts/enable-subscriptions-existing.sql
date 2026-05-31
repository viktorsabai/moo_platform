-- Включить подписки для всех существующих заведений (один раз после деплоя)
-- Запуск: psql $DATABASE_URL -f scripts/enable-subscriptions-existing.sql
UPDATE "AppSettings" SET "subscriptionEnabled" = true WHERE "subscriptionEnabled" = false;
