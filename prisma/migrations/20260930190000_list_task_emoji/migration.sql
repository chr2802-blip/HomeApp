-- A face for a list or a task, chosen by the household; null means "guess from the title".
ALTER TABLE "List" ADD COLUMN "emoji" TEXT;
ALTER TABLE "Task" ADD COLUMN "emoji" TEXT;
