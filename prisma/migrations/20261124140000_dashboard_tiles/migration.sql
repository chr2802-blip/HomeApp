-- AlterTable
ALTER TABLE "User" ADD COLUMN     "dashboardTiles" TEXT[] DEFAULT ARRAY[]::TEXT[];
