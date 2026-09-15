-- Pictures. A home can have one of its own, and so can each list, recurring task and
-- recipe. Every column arrives nullable: nothing has a picture yet, and "no picture"
-- stays a perfectly ordinary state afterwards, so there is nothing to backfill.
--
-- The bytes live here rather than in object storage: a household's collection is
-- measured in megabytes, and keeping it in the database means no second service to
-- hold credentials for and nothing to keep in step when a row is deleted. Two sizes
-- are stored, because a recipe page wants the whole picture and a page of twenty cards
-- wants twenty postage stamps.

-- CreateTable
CREATE TABLE "Photo" (
    "id" TEXT NOT NULL,
    "homeId" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "bytes" BYTEA NOT NULL,
    "thumbWidth" INTEGER NOT NULL,
    "thumbHeight" INTEGER NOT NULL,
    "thumbBytes" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Photo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Photo_homeId_idx" ON "Photo"("homeId");

-- CreateIndex
CREATE INDEX "Photo_homeId_createdAt_idx" ON "Photo"("homeId", "createdAt");

-- AlterTable
ALTER TABLE "Home" ADD COLUMN     "photoId" TEXT;

-- AlterTable
ALTER TABLE "List" ADD COLUMN     "photoId" TEXT;

-- AlterTable
ALTER TABLE "RecurringTask" ADD COLUMN     "photoId" TEXT;

-- AlterTable
ALTER TABLE "Recipe" ADD COLUMN     "photoId" TEXT;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_homeId_fkey" FOREIGN KEY ("homeId") REFERENCES "Home"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
-- SET NULL on every side that points at a picture, never RESTRICT. Deleting a home
-- removes its pictures and the lists, tasks and recipes holding them in one statement,
-- in no fixed order; Postgres checks RESTRICT the instant the referenced row goes,
-- which that ordering can trip over. SET NULL has no such moment to get wrong, and the
-- app deletes a picture explicitly when the thing holding it is deleted or replaced.
ALTER TABLE "Home" ADD CONSTRAINT "Home_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "List" ADD CONSTRAINT "List_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringTask" ADD CONSTRAINT "RecurringTask_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
