/*
  An optional expiry date on a pantry entry, as the day in the home's zone
  ("yyyy-MM-dd"). Nullable with no default: a metadata-only change on a populated table.
*/

-- AlterTable
ALTER TABLE "PantryItem" ADD COLUMN "expiresOn" TEXT;
