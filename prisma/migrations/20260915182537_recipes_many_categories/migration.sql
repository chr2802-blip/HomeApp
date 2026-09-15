-- A recipe is filed under as many headings as it belongs to, rather than one: the
-- single column becomes a table of pairings, and every existing recipe is carried over
-- into it before the column goes.

-- CreateTable
CREATE TABLE "RecipeCategoryLink" (
    "recipeId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "RecipeCategoryLink_pkey" PRIMARY KEY ("recipeId","categoryId")
);

-- CreateIndex
CREATE INDEX "RecipeCategoryLink_categoryId_idx" ON "RecipeCategoryLink"("categoryId");

-- Every recipe keeps the one category it had, which is now the first of however many
-- it ends up with. Copied while the column is still there: dropping it first would
-- lose every household's filing.
INSERT INTO "RecipeCategoryLink" ("recipeId", "categoryId")
SELECT "id", "categoryId" FROM "Recipe";

-- DropForeignKey
ALTER TABLE "Recipe" DROP CONSTRAINT "Recipe_categoryId_fkey";

-- DropIndex
DROP INDEX "Recipe_homeId_categoryId_idx";

-- AlterTable
ALTER TABLE "Recipe" DROP COLUMN "categoryId";

-- AddForeignKey
ALTER TABLE "RecipeCategoryLink" ADD CONSTRAINT "RecipeCategoryLink_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- NO ACTION rather than RESTRICT: deleting a home removes its recipes, its categories
-- and these rows in one statement, and RESTRICT would be checked in the middle of it.
-- Both refuse to delete a category that still holds recipes, which is the point.
ALTER TABLE "RecipeCategoryLink" ADD CONSTRAINT "RecipeCategoryLink_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "RecipeCategory"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
