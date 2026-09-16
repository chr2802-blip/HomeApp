-- A person's own picture, chosen on their profile page.
--
-- It is an ordinary Photo, so it is filed under the home they were reading when they
-- picked it: that is the only home an upload can be filed under, and a person is not
-- home-scoped. The picture route makes up the difference by serving a member's picture
-- to anybody who shares a home with them, wherever it happens to be filed.
--
-- SetNull, like every other photoId: deleting a home takes its pictures, and the
-- people who were in it keep their accounts with no picture rather than going too.

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "photoId" TEXT;

-- CreateIndex
CREATE INDEX "User_photoId_idx" ON "User"("photoId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
