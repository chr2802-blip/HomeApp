-- Recipes are filed under a category from now on, and every recipe must have one.
-- Recipes already saved have nothing to file them under, so the column arrives
-- nullable, each home that has recipes gets an "Uncategorised" heading to hold them,
-- and only then does the column become required. Doing it the other way round would
-- fail the moment the first home had a single recipe in it.

-- CreateTable
CREATE TABLE "RecipeCategory" (
    "id" TEXT NOT NULL,
    "homeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecipeCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecipeCategory_homeId_idx" ON "RecipeCategory"("homeId");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeCategory_homeId_name_key" ON "RecipeCategory"("homeId", "name");

-- AddForeignKey
ALTER TABLE "RecipeCategory" ADD CONSTRAINT "RecipeCategory_homeId_fkey" FOREIGN KEY ("homeId") REFERENCES "Home"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Recipe" ADD COLUMN "categoryId" TEXT;

-- One "Uncategorised" heading per home that has recipes to put in it. The id is
-- generated here rather than by the app: md5 is available on every Postgres this has
-- ever run on, and the shape only has to be a unique string.
INSERT INTO "RecipeCategory" ("id", "homeId", "name")
SELECT 'c' || substr(md5(random()::text || clock_timestamp()::text || "homeId"), 1, 24),
       "homeId",
       'Uncategorised'
FROM (SELECT DISTINCT "homeId" FROM "Recipe") AS homes_with_recipes;

UPDATE "Recipe"
SET "categoryId" = "RecipeCategory"."id"
FROM "RecipeCategory"
WHERE "RecipeCategory"."homeId" = "Recipe"."homeId"
  AND "RecipeCategory"."name" = 'Uncategorised';

-- AlterTable
ALTER TABLE "Recipe" ALTER COLUMN "categoryId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Recipe_homeId_categoryId_idx" ON "Recipe"("homeId", "categoryId");

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "RecipeCategory"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
