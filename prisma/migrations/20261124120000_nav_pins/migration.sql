-- AlterTable
ALTER TABLE "User" ADD COLUMN     "navPins" TEXT[] DEFAULT ARRAY[]::TEXT[];
