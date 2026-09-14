-- A recurring task can name one member of the home. Nullable, and every existing task
-- arrives null: that already means "the whole household", which is how tasks behaved
-- before this column existed, so nothing needs backfilling.

-- AlterTable
ALTER TABLE "RecurringTask" ADD COLUMN     "assigneeId" TEXT;

-- AddForeignKey
-- SET NULL, not CASCADE: removing a member hands their tasks back to the household
-- rather than deleting them.
ALTER TABLE "RecurringTask" ADD CONSTRAINT "RecurringTask_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
