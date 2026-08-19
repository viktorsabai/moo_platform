-- Per-user, per-restaurant notification subscriptions.
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'INSTANT',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NotificationPreference_restaurantId_userId_eventId_key"
  ON "NotificationPreference"("restaurantId", "userId", "eventId");
CREATE INDEX "NotificationPreference_restaurantId_userId_idx"
  ON "NotificationPreference"("restaurantId", "userId");
CREATE INDEX "NotificationPreference_restaurantId_eventId_idx"
  ON "NotificationPreference"("restaurantId", "eventId");

ALTER TABLE "NotificationPreference"
  ADD CONSTRAINT "NotificationPreference_restaurantId_fkey"
  FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationPreference"
  ADD CONSTRAINT "NotificationPreference_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
