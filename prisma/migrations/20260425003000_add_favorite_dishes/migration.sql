CREATE TABLE IF NOT EXISTS "FavoriteDish" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "restaurantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "dishId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FavoriteDish_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "FavoriteDish_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "FavoriteDish_dishId_fkey" FOREIGN KEY ("dishId") REFERENCES "Dish"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "FavoriteDish_restaurantId_userId_dishId_key"
  ON "FavoriteDish"("restaurantId", "userId", "dishId");

CREATE INDEX IF NOT EXISTS "FavoriteDish_restaurantId_userId_createdAt_idx"
  ON "FavoriteDish"("restaurantId", "userId", "createdAt");

CREATE INDEX IF NOT EXISTS "FavoriteDish_dishId_idx"
  ON "FavoriteDish"("dishId");
