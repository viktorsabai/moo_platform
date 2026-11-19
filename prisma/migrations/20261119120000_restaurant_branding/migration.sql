-- AlterTable: обложка и логотип заведения для главной гостя
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "coverImage" TEXT;
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "logoImage" TEXT;
