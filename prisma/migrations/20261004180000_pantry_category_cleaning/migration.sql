/*
  A shelf for what the home is cleaned with. Added before OTHER so the enum reads in the
  same order as the schema and the page; no stored entry changes.
*/

-- AlterEnum
ALTER TYPE "PantryCategory" ADD VALUE 'CLEANING' BEFORE 'OTHER';
