/*
  Invitations are links rather than an email and a code: an admin makes one, posts it
  where the household talks, and whoever opens it joins as a member. Codes still open
  are dropped with the table — whoever was waiting on one is sent a link instead.
*/

-- DropTable
DROP TABLE "Invite";

-- CreateTable
CREATE TABLE "InviteLink" (
    "id" TEXT NOT NULL,
    "homeId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "maxUses" INTEGER NOT NULL,
    "uses" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InviteLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InviteLink_tokenHash_key" ON "InviteLink"("tokenHash");
CREATE INDEX "InviteLink_homeId_idx" ON "InviteLink"("homeId");
CREATE INDEX "InviteLink_createdById_idx" ON "InviteLink"("createdById");

-- AddForeignKey
ALTER TABLE "InviteLink" ADD CONSTRAINT "InviteLink_homeId_fkey" FOREIGN KEY ("homeId") REFERENCES "Home"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InviteLink" ADD CONSTRAINT "InviteLink_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InviteLink" ENABLE ROW LEVEL SECURITY;
