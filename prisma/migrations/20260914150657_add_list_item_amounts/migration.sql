-- AlterTable
ALTER TABLE "List" ADD COLUMN     "trackAmounts" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ListItem" ADD COLUMN     "amount" INTEGER NOT NULL DEFAULT 1;
