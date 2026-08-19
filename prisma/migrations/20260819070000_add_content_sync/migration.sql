CREATE TABLE "RestaurantContentSyncState" (
  "id" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "menuVersion" INTEGER NOT NULL DEFAULT 0,
  "subscriptionVersion" INTEGER NOT NULL DEFAULT 0,
  "lastEventId" TEXT,
  "lastPublishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RestaurantContentSyncState_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RestaurantContentSyncEvent" (
  "id" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "entityType" TEXT,
  "entityId" TEXT,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RestaurantContentSyncEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RestaurantContentSyncState_restaurantId_key"
  ON "RestaurantContentSyncState"("restaurantId");

CREATE INDEX "RestaurantContentSyncEvent_restaurantId_createdAt_idx"
  ON "RestaurantContentSyncEvent"("restaurantId", "createdAt");

CREATE INDEX "RestaurantContentSyncEvent_restaurantId_domain_version_idx"
  ON "RestaurantContentSyncEvent"("restaurantId", "domain", "version");

ALTER TABLE "RestaurantContentSyncState"
  ADD CONSTRAINT "RestaurantContentSyncState_restaurantId_fkey"
  FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RestaurantContentSyncEvent"
  ADD CONSTRAINT "RestaurantContentSyncEvent_restaurantId_fkey"
  FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
