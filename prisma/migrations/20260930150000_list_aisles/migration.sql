-- CreateEnum
CREATE TYPE "ShopAisle" AS ENUM ('PRODUCE', 'BAKERY', 'MEAT_FISH', 'DAIRY', 'DRY_GOODS', 'TINS_JARS', 'SPICES_SAUCES', 'SNACKS', 'DRINKS', 'FROZEN', 'HOUSEHOLD', 'BABY', 'OTHER');

-- AlterTable
ALTER TABLE "List" ADD COLUMN "groupByAisle" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "AisleChoice" (
    "homeId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "aisle" "ShopAisle" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AisleChoice_pkey" PRIMARY KEY ("homeId","key")
);

-- AddForeignKey
ALTER TABLE "AisleChoice" ADD CONSTRAINT "AisleChoice_homeId_fkey" FOREIGN KEY ("homeId") REFERENCES "Home"("id") ON DELETE CASCADE ON UPDATE CASCADE;
