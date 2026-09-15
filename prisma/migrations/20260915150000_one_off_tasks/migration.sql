-- One table now holds both kinds of task, so it is named for what it holds rather than
-- for the only kind it used to. A rename keeps every row: nothing is copied or dropped.
ALTER TABLE "RecurringTask" RENAME TO "Task";

-- Postgres carries constraints and indexes through a table rename under their old
-- names. They are renamed too, so the database matches what Prisma would generate for
-- this schema from scratch and no later migration is diffed against stale names.
ALTER TABLE "Task" RENAME CONSTRAINT "RecurringTask_pkey" TO "Task_pkey";
ALTER TABLE "Task" RENAME CONSTRAINT "RecurringTask_homeId_fkey" TO "Task_homeId_fkey";
ALTER TABLE "Task" RENAME CONSTRAINT "RecurringTask_createdById_fkey" TO "Task_createdById_fkey";
ALTER TABLE "Task" RENAME CONSTRAINT "RecurringTask_assigneeId_fkey" TO "Task_assigneeId_fkey";
ALTER TABLE "Task" RENAME CONSTRAINT "RecurringTask_photoId_fkey" TO "Task_photoId_fkey";

ALTER INDEX "RecurringTask_homeId_idx" RENAME TO "Task_homeId_idx";
ALTER INDEX "RecurringTask_nextDueAt_idx" RENAME TO "Task_nextDueAt_idx";
ALTER INDEX "RecurringTask_homeId_nextDueAt_idx" RENAME TO "Task_homeId_nextDueAt_idx";

-- A one-off task has no interval; that missing number is what makes it one. Every
-- existing row keeps the interval it already had, so every task stays recurring.
ALTER TABLE "Task" ALTER COLUMN "intervalDays" DROP NOT NULL;
