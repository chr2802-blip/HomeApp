-- A day can now be the leftovers of an earlier one. Nullable with no default and no
-- backfill: every row already in the table is a recipe being cooked or a night out, and
-- both of those are still exactly what they were — `leftoverOf` empty.
ALTER TABLE "MealPlan" ADD COLUMN "leftoverOf" TEXT;
