/*
  A pantry quantity can carry one decimal ("1,5 kg"). Every stored whole number casts to
  the same value as a double, so no entry changes what it says. The one-decimal limit is
  `clampPantryQuantity`'s to keep, not a check constraint, for the same reason
  `MealPlan`'s columns are the action's.
*/

-- AlterTable
ALTER TABLE "PantryItem" ALTER COLUMN "quantity" SET DATA TYPE DOUBLE PRECISION;
