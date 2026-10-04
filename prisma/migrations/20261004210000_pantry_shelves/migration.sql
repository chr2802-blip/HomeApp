/*
  Shelves a household makes for itself, beside the built-in ones. An entry is filed on
  one or the other (shelfId or category, never both); every stored entry has no shelfId
  and so stays exactly where it was.
*/

-- AlterTable
ALTER TABLE "PantryItem" ADD COLUMN     "shelfId" TEXT;

-- CreateTable
CREATE TABLE "PantryShelf" (
    "id" TEXT NOT NULL,
    "homeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PantryShelf_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PantryShelf_homeId_name_key" ON "PantryShelf"("homeId", "name");

-- CreateIndex
CREATE INDEX "PantryItem_shelfId_idx" ON "PantryItem"("shelfId");

-- AddForeignKey
ALTER TABLE "PantryItem" ADD CONSTRAINT "PantryItem_shelfId_fkey" FOREIGN KEY ("shelfId") REFERENCES "PantryShelf"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PantryShelf" ADD CONSTRAINT "PantryShelf_homeId_fkey" FOREIGN KEY ("homeId") REFERENCES "Home"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Closed to Supabase's Data API like every other table (see close_supabase_data_api).

ALTER TABLE "PantryShelf" ENABLE ROW LEVEL SECURITY;
