-- Which ingredient lines each step uses, and how long it takes: what action mode needs
-- and the two text blocks cannot say. Null on every existing row, which reads as "never
-- prepared" — action mode shows those recipes' steps plainly until one is written.
ALTER TABLE "Recipe" ADD COLUMN "cookSteps" JSONB;
