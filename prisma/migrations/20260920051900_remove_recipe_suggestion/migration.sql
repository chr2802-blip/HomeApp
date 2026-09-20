/*
  Warnings:

  - You are about to drop the `RecipeSuggestion` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "RecipeSuggestion" DROP CONSTRAINT "RecipeSuggestion_homeId_fkey";

-- DropForeignKey
ALTER TABLE "RecipeSuggestion" DROP CONSTRAINT "RecipeSuggestion_recipeId_fkey";

-- DropTable
DROP TABLE "RecipeSuggestion";
