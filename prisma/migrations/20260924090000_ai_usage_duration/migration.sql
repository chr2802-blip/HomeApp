/*
  How long each AI call took, so "make it faster" is argued from numbers. Nullable
  because every row already stored predates the measurement; adding a nullable column
  with no default is a metadata-only change on a populated table.
*/

-- AlterTable
ALTER TABLE "AiUsage" ADD COLUMN "durationMs" INTEGER;
