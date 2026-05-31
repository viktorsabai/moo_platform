CREATE TABLE IF NOT EXISTS "UserActivityEvent" (
  "id" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "userId" TEXT,
  "telegramId" TEXT,
  "type" TEXT NOT NULL,
  "path" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserActivityEvent_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'UserActivityEvent_restaurantId_fkey'
  ) THEN
    ALTER TABLE "UserActivityEvent"
      ADD CONSTRAINT "UserActivityEvent_restaurantId_fkey"
      FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'UserActivityEvent_userId_fkey'
  ) THEN
    ALTER TABLE "UserActivityEvent"
      ADD CONSTRAINT "UserActivityEvent_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "UserActivityEvent_restaurantId_type_createdAt_idx"
  ON "UserActivityEvent"("restaurantId", "type", "createdAt");

CREATE INDEX IF NOT EXISTS "UserActivityEvent_restaurantId_userId_createdAt_idx"
  ON "UserActivityEvent"("restaurantId", "userId", "createdAt");

CREATE INDEX IF NOT EXISTS "UserActivityEvent_restaurantId_telegramId_createdAt_idx"
  ON "UserActivityEvent"("restaurantId", "telegramId", "createdAt");
