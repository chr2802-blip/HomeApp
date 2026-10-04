-- Postgres indexes a foreign key's target but never its source column, so every one of
-- these was a sequential scan whenever the row it points at went: a picture deleted or
-- replaced sets photoId null on every table that might hold it, removing an account
-- cascades through createdById, and the upload sweep asks each table whether anything
-- still points at a picture (`sweepUnclaimedPhotos`). Small tables today; free to fix.
-- Indexes only, on columns that already exist, so it applies the same to a full table as
-- to an empty one.

-- CreateIndex
CREATE INDEX "Home_photoId_idx" ON "Home"("photoId");

-- CreateIndex
CREATE INDEX "Invite_createdById_idx" ON "Invite"("createdById");

-- CreateIndex
CREATE INDEX "List_createdById_idx" ON "List"("createdById");

-- CreateIndex
CREATE INDEX "List_photoId_idx" ON "List"("photoId");

-- CreateIndex
CREATE INDEX "PantryItem_photoId_idx" ON "PantryItem"("photoId");

-- CreateIndex
CREATE INDEX "Recipe_createdById_idx" ON "Recipe"("createdById");

-- CreateIndex
CREATE INDEX "Recipe_photoId_idx" ON "Recipe"("photoId");

-- CreateIndex
CREATE INDEX "Task_createdById_idx" ON "Task"("createdById");

-- CreateIndex
CREATE INDEX "Task_assigneeId_idx" ON "Task"("assigneeId");

-- CreateIndex
CREATE INDEX "Task_photoId_idx" ON "Task"("photoId");

