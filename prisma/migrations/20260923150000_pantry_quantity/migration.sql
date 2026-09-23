/*
  A pantry entry now says how much of something a household has, not only whether it
  does. Quantity replaces `inStock`: zero is what `false` meant, any positive number is
  what `true` meant, so every existing row keeps the meaning it already had rather than
  being reset to "we have some" or "we've run out".
*/

-- CreateEnum
CREATE TYPE "PantryUnit" AS ENUM ('G', 'KG', 'DL', 'L', 'CAN', 'BAG', 'PACK', 'JAR', 'BUNCH');

-- AlterTable
ALTER TABLE "PantryItem" ADD COLUMN "quantity" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "PantryItem" ADD COLUMN "unit" "PantryUnit";

UPDATE "PantryItem" SET "quantity" = CASE WHEN "inStock" THEN 1 ELSE 0 END;

ALTER TABLE "PantryItem" DROP COLUMN "inStock";
