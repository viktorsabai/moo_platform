-- Reusable menu option groups and dish assignments.
CREATE TABLE "MenuOptionGroup" (
  "id" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MenuOptionGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MenuOptionValue" (
  "id" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MenuOptionValue_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DishOptionValue" (
  "id" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "dishId" TEXT NOT NULL,
  "optionValueId" TEXT NOT NULL,
  "priceAdjust" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "order" INTEGER NOT NULL DEFAULT 0,
  "isAvailable" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DishOptionValue_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MenuOptionGroup_restaurantId_slug_key" ON "MenuOptionGroup"("restaurantId", "slug");
CREATE INDEX "MenuOptionGroup_restaurantId_isActive_order_idx" ON "MenuOptionGroup"("restaurantId", "isActive", "order");

CREATE UNIQUE INDEX "MenuOptionValue_groupId_slug_key" ON "MenuOptionValue"("groupId", "slug");
CREATE INDEX "MenuOptionValue_restaurantId_isActive_order_idx" ON "MenuOptionValue"("restaurantId", "isActive", "order");
CREATE INDEX "MenuOptionValue_groupId_idx" ON "MenuOptionValue"("groupId");

CREATE UNIQUE INDEX "DishOptionValue_dishId_optionValueId_key" ON "DishOptionValue"("dishId", "optionValueId");
CREATE INDEX "DishOptionValue_restaurantId_idx" ON "DishOptionValue"("restaurantId");
CREATE INDEX "DishOptionValue_dishId_idx" ON "DishOptionValue"("dishId");
CREATE INDEX "DishOptionValue_optionValueId_idx" ON "DishOptionValue"("optionValueId");

ALTER TABLE "MenuOptionGroup" ADD CONSTRAINT "MenuOptionGroup_restaurantId_fkey"
  FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MenuOptionValue" ADD CONSTRAINT "MenuOptionValue_restaurantId_fkey"
  FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MenuOptionValue" ADD CONSTRAINT "MenuOptionValue_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "MenuOptionGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DishOptionValue" ADD CONSTRAINT "DishOptionValue_restaurantId_fkey"
  FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DishOptionValue" ADD CONSTRAINT "DishOptionValue_dishId_fkey"
  FOREIGN KEY ("dishId") REFERENCES "Dish"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DishOptionValue" ADD CONSTRAINT "DishOptionValue_optionValueId_fkey"
  FOREIGN KEY ("optionValueId") REFERENCES "MenuOptionValue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
