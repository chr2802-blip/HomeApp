-- Every existing category defaults to false, i.e. still eligible for the daily dinner
-- suggestion — a heading nobody has thought about here is one a home wants suggested,
-- same as before this column existed.

-- AlterTable
ALTER TABLE "RecipeCategory" ADD COLUMN     "excludeFromSuggestion" BOOLEAN NOT NULL DEFAULT false;

-- One row per home, replaced rather than added to on "Find new": the primary key is
-- the home itself. recipeId is unique for the same reason a recipe can carry at most
-- one back-reference to it — a recipe belongs to exactly one home, which has at most
-- one row here.

-- CreateTable
CREATE TABLE "RecipeSuggestion" (
    "homeId" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecipeSuggestion_pkey" PRIMARY KEY ("homeId")
);

-- CreateIndex
CREATE UNIQUE INDEX "RecipeSuggestion_recipeId_key" ON "RecipeSuggestion"("recipeId");

-- AddForeignKey
ALTER TABLE "RecipeSuggestion" ADD CONSTRAINT "RecipeSuggestion_homeId_fkey" FOREIGN KEY ("homeId") REFERENCES "Home"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeSuggestion" ADD CONSTRAINT "RecipeSuggestion_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
