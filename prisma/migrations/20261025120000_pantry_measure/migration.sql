/*
  A pantry entry is counted in uses ("stk") or simply had or not ("uendelig"), never in
  grams or litres: keeping weights current was more work than the household would do.

  Every entry that was counted in a unit of measure becomes ENDLESS — had if it had any,
  run out if it was at zero — because "500 g" says nothing about how many times it can be
  cooked with. A plain count stays PIECES, rounded up to a whole number. The household
  turns a measured entry into stk by hand, the one time, where it wants it counted down.
*/

-- CreateEnum
CREATE TYPE "PantryMeasure" AS ENUM ('PIECES', 'ENDLESS');

-- AlterTable
ALTER TABLE "PantryItem" ADD COLUMN "measure" "PantryMeasure" NOT NULL DEFAULT 'PIECES';

UPDATE "PantryItem" SET "measure" = 'ENDLESS', "quantity" = CASE WHEN "quantity" > 0 THEN 1 ELSE 0 END
  WHERE "unit" IS NOT NULL;

ALTER TABLE "PantryItem" ALTER COLUMN "quantity" SET DATA TYPE INTEGER USING CEIL("quantity")::INTEGER;
ALTER TABLE "PantryItem" DROP COLUMN "unit";

-- DropEnum
DROP TYPE "PantryUnit";

-- AlterTable
ALTER TABLE "MealPlan" ADD COLUMN "times" DOUBLE PRECISION NOT NULL DEFAULT 1;
