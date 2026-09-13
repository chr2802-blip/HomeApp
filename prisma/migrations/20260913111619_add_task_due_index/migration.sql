-- CreateIndex
CREATE INDEX "RecurringTask_homeId_nextDueAt_idx" ON "RecurringTask"("homeId", "nextDueAt");
