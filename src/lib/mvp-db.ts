import { prisma } from '@/lib/prisma'

let initialized = false

export async function ensureMvpTables() {
  if (initialized) return
  const ddlStatements = [
    `CREATE TABLE IF NOT EXISTS "SubscriptionRequestLead" (
      "id" TEXT PRIMARY KEY,
      "restaurantId" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "telegramId" TEXT,
      "note" TEXT,
      "status" TEXT NOT NULL DEFAULT 'NEW',
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS "idx_SubscriptionRequestLead_restaurant_created"
      ON "SubscriptionRequestLead" ("restaurantId", "createdAt" DESC)`,
    `CREATE TABLE IF NOT EXISTS "DeliveryZone" (
      "id" TEXT PRIMARY KEY,
      "restaurantId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "polygonJson" TEXT,
      "keywords" TEXT[] NOT NULL DEFAULT '{}',
      "zipCodes" TEXT[] NOT NULL DEFAULT '{}',
      "deliveryFee" INTEGER NOT NULL DEFAULT 0,
      "minOrderAmount" INTEGER NOT NULL DEFAULT 0,
      "deliveryWindowMin" INTEGER NOT NULL DEFAULT 60,
      "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS "idx_DeliveryZone_restaurant_active_order"
      ON "DeliveryZone" ("restaurantId", "isActive", "sortOrder")`,
    `CREATE TABLE IF NOT EXISTS "OrderStatusLog" (
      "id" TEXT PRIMARY KEY,
      "orderId" TEXT NOT NULL,
      "restaurantId" TEXT NOT NULL,
      "fromStatus" TEXT,
      "toStatus" TEXT NOT NULL,
      "changedByUserId" TEXT,
      "source" TEXT NOT NULL DEFAULT 'ADMIN',
      "comment" TEXT,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS "idx_OrderStatusLog_order_created"
      ON "OrderStatusLog" ("orderId", "createdAt" DESC)`,
    `CREATE INDEX IF NOT EXISTS "idx_OrderStatusLog_restaurant_created"
      ON "OrderStatusLog" ("restaurantId", "createdAt" DESC)`,
  ]
  for (const stmt of ddlStatements) {
    await prisma.$executeRawUnsafe(stmt)
  }
  initialized = true
}

export function newId(prefix: string) {
  const rnd = Math.random().toString(36).slice(2, 10)
  return `${prefix}_${Date.now().toString(36)}_${rnd}`
}
