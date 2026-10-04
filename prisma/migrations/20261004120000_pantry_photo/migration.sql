-- A pantry entry can carry a picture, shown only in its edit sheet.
-- SetNull, like every other photoId: deleting a home takes its pictures and its pantry
-- in one statement, and SetNull has no ordering to get wrong.
ALTER TABLE "PantryItem" ADD COLUMN "photoId" TEXT;
ALTER TABLE "PantryItem" ADD CONSTRAINT "PantryItem_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
