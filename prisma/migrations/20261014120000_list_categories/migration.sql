-- How a list is drawn, one column instead of a flag per way.
CREATE TYPE "ListGrouping" AS ENUM ('NONE', 'AISLE', 'OWN');

ALTER TABLE "List" ADD COLUMN "grouping" "ListGrouping" NOT NULL DEFAULT 'NONE';
UPDATE "List" SET "grouping" = 'AISLE' WHERE "groupByAisle";
ALTER TABLE "List" DROP COLUMN "groupByAisle";

-- A list's own headings.
CREATE TABLE "ListCategory" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListCategory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ListCategory_listId_idx" ON "ListCategory"("listId");

ALTER TABLE "ListCategory" ADD CONSTRAINT "ListCategory_listId_fkey" FOREIGN KEY ("listId") REFERENCES "List"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ListItem" ADD COLUMN "categoryId" TEXT;

CREATE INDEX "ListItem_categoryId_idx" ON "ListItem"("categoryId");

ALTER TABLE "ListItem" ADD CONSTRAINT "ListItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ListCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ListCategory" ENABLE ROW LEVEL SECURITY;
