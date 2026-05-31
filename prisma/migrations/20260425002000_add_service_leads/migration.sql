CREATE TABLE IF NOT EXISTS "ServiceLead" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "restaurantId" TEXT NOT NULL,
  "userId" TEXT,
  "telegramId" TEXT,
  "name" TEXT,
  "phone" TEXT,
  "type" TEXT NOT NULL DEFAULT 'custom',
  "title" TEXT,
  "guestCount" INTEGER,
  "eventDate" TIMESTAMP(3),
  "note" TEXT,
  "source" TEXT NOT NULL DEFAULT 'home',
  "status" TEXT NOT NULL DEFAULT 'NEW',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ServiceLead_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ServiceLead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ServiceLead_restaurantId_status_createdAt_idx"
  ON "ServiceLead"("restaurantId", "status", "createdAt");

CREATE INDEX IF NOT EXISTS "ServiceLead_restaurantId_type_createdAt_idx"
  ON "ServiceLead"("restaurantId", "type", "createdAt");

CREATE INDEX IF NOT EXISTS "ServiceLead_userId_idx"
  ON "ServiceLead"("userId");
