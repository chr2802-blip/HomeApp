-- AlterTable
ALTER TABLE "ListItem" ADD COLUMN     "completedById" TEXT;

-- CreateTable
CREATE TABLE "ClearedWeek" (
    "homeId" TEXT NOT NULL,
    "week" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "lastAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClearedWeek_pkey" PRIMARY KEY ("homeId","week")
);

-- CreateIndex
CREATE INDEX "ListItem_completedById_idx" ON "ListItem"("completedById");

-- AddForeignKey
ALTER TABLE "ListItem" ADD CONSTRAINT "ListItem_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClearedWeek" ADD CONSTRAINT "ClearedWeek_homeId_fkey" FOREIGN KEY ("homeId") REFERENCES "Home"("id") ON DELETE CASCADE ON UPDATE CASCADE;
