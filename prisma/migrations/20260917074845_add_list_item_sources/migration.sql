-- Where a list item came from, when a recipe put it there.
--
-- Nothing to backfill: every item on every list until now was typed into the add box,
-- and an item with no row here is exactly what "added by hand" means. New table only,
-- so this is safe against a full database as well as an empty one.

-- CreateTable
CREATE TABLE "ListItemSource" (
    "itemId" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListItemSource_pkey" PRIMARY KEY ("itemId","recipeId")
);

-- CreateIndex
CREATE INDEX "ListItemSource_recipeId_idx" ON "ListItemSource"("recipeId");

-- AddForeignKey
ALTER TABLE "ListItemSource" ADD CONSTRAINT "ListItemSource_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ListItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListItemSource" ADD CONSTRAINT "ListItemSource_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
