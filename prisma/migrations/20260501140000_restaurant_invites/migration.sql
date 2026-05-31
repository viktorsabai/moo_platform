-- CreateEnum
CREATE TYPE "RestaurantInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

-- CreateTable
CREATE TABLE "RestaurantInvite" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "invitedTelegramId" TEXT NOT NULL,
    "role" "RestaurantRole" NOT NULL DEFAULT 'STAFF',
    "status" "RestaurantInviteStatus" NOT NULL DEFAULT 'PENDING',
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "RestaurantInvite_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "RestaurantInvite" ADD CONSTRAINT "RestaurantInvite_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RestaurantInvite" ADD CONSTRAINT "RestaurantInvite_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "RestaurantInvite_restaurantId_status_idx" ON "RestaurantInvite"("restaurantId", "status");

CREATE INDEX "RestaurantInvite_invitedTelegramId_status_idx" ON "RestaurantInvite"("invitedTelegramId", "status");
