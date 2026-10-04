/*
  A shelf for what the bathroom runs on. Added before OTHER so the enum reads in the
  same order as the schema and the page; no stored entry changes.
*/

-- AlterEnum
ALTER TYPE "PantryCategory" ADD VALUE 'BATHROOM' BEFORE 'OTHER';
