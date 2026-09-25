/*
  Which shelf a pantry entry sits on. Nullable with no default, because null is its own
  answer ("not sorted yet") and every entry already stored is exactly that: a
  metadata-only change on a populated table.
*/

-- CreateEnum
CREATE TYPE "PantryCategory" AS ENUM ('SPICES', 'OIL_VINEGAR', 'SAUCES', 'BAKING', 'DRY_GOODS', 'TINS_JARS', 'FRIDGE', 'FREEZER', 'DRINKS', 'OTHER');

-- AlterTable
ALTER TABLE "PantryItem" ADD COLUMN "category" "PantryCategory";
