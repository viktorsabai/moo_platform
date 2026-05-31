-- Идемпотентно: безопасно после ручного `prisma db execute` и для повторного `migrate deploy`.

-- Enums
DO $$ BEGIN CREATE TYPE "CampaignKind" AS ENUM ('PROMOCODE', 'AUTO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'EXPIRED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "CampaignVisibility" AS ENUM ('PUBLIC', 'HIDDEN', 'ASSIGNED_ONLY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "CampaignTargetType" AS ENUM ('ORDER_TOTAL', 'DELIVERY_FEE', 'CATEGORY', 'ITEM');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "CampaignRewardType" AS ENUM ('FIXED', 'PERCENT', 'GIFT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "CampaignRedemptionStatus" AS ENUM ('APPLIED', 'REVERSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Order: columns for applied campaigns
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "campaignId" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "campaignCode" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "discountAmount" DECIMAL(10, 2);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "discountDetailsJson" JSONB;

CREATE TABLE IF NOT EXISTS "Campaign" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "kind" "CampaignKind" NOT NULL DEFAULT 'PROMOCODE',
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "visibility" "CampaignVisibility" NOT NULL DEFAULT 'PUBLIC',
    "targetType" "CampaignTargetType" NOT NULL DEFAULT 'ORDER_TOTAL',
    "rewardType" "CampaignRewardType" NOT NULL DEFAULT 'FIXED',
    "rewardValue" DECIMAL(10, 2) NOT NULL,
    "rewardCap" DECIMAL(10, 2),
    "giftTitle" TEXT,
    "giftPayloadJson" JSONB,
    "minSubtotal" DECIMAL(10, 2),
    "firstOrderOnly" BOOLEAN NOT NULL DEFAULT false,
    "usageLimitTotal" INTEGER,
    "usageLimitPerUser" INTEGER DEFAULT 1,
    "assignedUserId" TEXT,
    "assignedTelegramId" TEXT,
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "metadataJson" JSONB,
    "notifyOnPublish" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CampaignRedemption" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "codeSnapshot" TEXT,
    "discountAmount" DECIMAL(10, 2) NOT NULL,
    "status" "CampaignRedemptionStatus" NOT NULL DEFAULT 'APPLIED',
    "detailsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CampaignRedemption_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_restaurantId_fkey"
  FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_assignedUserId_fkey"
  FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CampaignRedemption" ADD CONSTRAINT "CampaignRedemption_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CampaignRedemption" ADD CONSTRAINT "CampaignRedemption_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CampaignRedemption" ADD CONSTRAINT "CampaignRedemption_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CampaignRedemption" ADD CONSTRAINT "CampaignRedemption_restaurantId_fkey"
  FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Order" ADD CONSTRAINT "Order_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "Campaign_restaurantId_code_key" ON "Campaign"("restaurantId", "code");

CREATE INDEX IF NOT EXISTS "Campaign_restaurantId_status_validFrom_validTo_idx" ON "Campaign"("restaurantId", "status", "validFrom", "validTo");
CREATE INDEX IF NOT EXISTS "Campaign_assignedUserId_idx" ON "Campaign"("assignedUserId");
CREATE INDEX IF NOT EXISTS "Campaign_assignedTelegramId_idx" ON "Campaign"("assignedTelegramId");

CREATE UNIQUE INDEX IF NOT EXISTS "CampaignRedemption_campaignId_orderId_key" ON "CampaignRedemption"("campaignId", "orderId");
CREATE INDEX IF NOT EXISTS "CampaignRedemption_userId_campaignId_idx" ON "CampaignRedemption"("userId", "campaignId");
CREATE INDEX IF NOT EXISTS "CampaignRedemption_restaurantId_createdAt_idx" ON "CampaignRedemption"("restaurantId", "createdAt");

CREATE INDEX IF NOT EXISTS "Order_campaignId_idx" ON "Order"("campaignId");
