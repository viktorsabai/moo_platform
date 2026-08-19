-- CreateTable
CREATE TABLE "SubscriptionMealPlanDraft" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "planTemplateId" TEXT,
    "name" TEXT NOT NULL DEFAULT 'Новый рацион',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "periodDays" INTEGER NOT NULL DEFAULT 7,
    "personCount" INTEGER NOT NULL DEFAULT 1,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastOpenedAt" TIMESTAMP(3),

    CONSTRAINT "SubscriptionMealPlanDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SubscriptionMealPlanDraft_restaurantId_status_updatedAt_idx" ON "SubscriptionMealPlanDraft"("restaurantId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "SubscriptionMealPlanDraft_restaurantId_createdByUserId_updatedAt_idx" ON "SubscriptionMealPlanDraft"("restaurantId", "createdByUserId", "updatedAt");

-- CreateIndex
CREATE INDEX "SubscriptionMealPlanDraft_planTemplateId_idx" ON "SubscriptionMealPlanDraft"("planTemplateId");

-- AddForeignKey
ALTER TABLE "SubscriptionMealPlanDraft" ADD CONSTRAINT "SubscriptionMealPlanDraft_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionMealPlanDraft" ADD CONSTRAINT "SubscriptionMealPlanDraft_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionMealPlanDraft" ADD CONSTRAINT "SubscriptionMealPlanDraft_planTemplateId_fkey" FOREIGN KEY ("planTemplateId") REFERENCES "SubscriptionPlanTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
