/*
  A shelf for what a household buys for a baby. Added before OTHER so the enum reads in
  the same order as the schema and the page; no stored entry changes.
*/

-- AlterEnum
ALTER TYPE "PantryCategory" ADD VALUE 'BABY' BEFORE 'OTHER';
