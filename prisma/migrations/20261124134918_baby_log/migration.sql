-- CreateEnum
CREATE TYPE "BabyEventKind" AS ENUM ('SLEEP', 'FEED', 'DIAPER');

-- CreateTable
CREATE TABLE "Baby" (
    "id" TEXT NOT NULL,
    "homeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trackSleep" BOOLEAN NOT NULL DEFAULT true,
    "trackBreast" BOOLEAN NOT NULL DEFAULT true,
    "trackBottle" BOOLEAN NOT NULL DEFAULT true,
    "trackSolid" BOOLEAN NOT NULL DEFAULT true,
    "trackDiaper" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Baby_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BabyEvent" (
    "id" TEXT NOT NULL,
    "homeId" TEXT NOT NULL,
    "babyId" TEXT NOT NULL,
    "kind" "BabyEventKind" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "details" JSONB NOT NULL DEFAULT '{}',
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BabyEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Baby_homeId_idx" ON "Baby"("homeId");

-- CreateIndex
CREATE INDEX "BabyEvent_babyId_startedAt_idx" ON "BabyEvent"("babyId", "startedAt");

-- CreateIndex
CREATE INDEX "BabyEvent_homeId_idx" ON "BabyEvent"("homeId");

-- CreateIndex
CREATE INDEX "BabyEvent_createdById_idx" ON "BabyEvent"("createdById");

-- AddForeignKey
ALTER TABLE "Baby" ADD CONSTRAINT "Baby_homeId_fkey" FOREIGN KEY ("homeId") REFERENCES "Home"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BabyEvent" ADD CONSTRAINT "BabyEvent_homeId_fkey" FOREIGN KEY ("homeId") REFERENCES "Home"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BabyEvent" ADD CONSTRAINT "BabyEvent_babyId_fkey" FOREIGN KEY ("babyId") REFERENCES "Baby"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BabyEvent" ADD CONSTRAINT "BabyEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Closed to Supabase's Data API, like every other table (see tests/integration/rls.test.ts).
ALTER TABLE "Baby" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BabyEvent" ENABLE ROW LEVEL SECURITY;
