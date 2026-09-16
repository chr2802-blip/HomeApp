/*
  Somebody can now be part of several homes.

  What was one column on User — the home they are in, and whether they run it — becomes
  a row per home they belong to. User keeps only a pointer at whichever of those homes
  they are looking at, which is why the column is renamed rather than dropped: it no
  longer answers "which home are you in", only "which one are you reading".
*/

-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('SUPER_ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('ADMIN', 'USER');

-- CreateTable
CREATE TABLE "HomeMember" (
    "userId" TEXT NOT NULL,
    "homeId" TEXT NOT NULL,
    "role" "MemberRole" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HomeMember_pkey" PRIMARY KEY ("userId","homeId")
);

-- CreateIndex
CREATE INDEX "HomeMember_homeId_idx" ON "HomeMember"("homeId");

-- AddForeignKey
ALTER TABLE "HomeMember" ADD CONSTRAINT "HomeMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeMember" ADD CONSTRAINT "HomeMember_homeId_fkey" FOREIGN KEY ("homeId") REFERENCES "Home"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Everybody already in a home becomes a member of it, keeping the role they had there.
-- A super admin who had switched into a home was administering it, so they arrive as
-- its admin; every other home stays reachable to them without a membership, as before.
INSERT INTO "HomeMember" ("userId", "homeId", "role", "createdAt")
SELECT "id",
       "homeId",
       CASE WHEN "role" = 'USER' THEN 'USER' ELSE 'ADMIN' END::"MemberRole",
       "createdAt"
FROM "User"
WHERE "homeId" IS NOT NULL;

-- An invite names a role inside one home, which is now its own type.
ALTER TABLE "Invite" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "Invite" ALTER COLUMN "role" TYPE "MemberRole"
  USING CASE WHEN "role" = 'ADMIN' THEN 'ADMIN' ELSE 'USER' END::"MemberRole";
ALTER TABLE "Invite" ALTER COLUMN "role" SET DEFAULT 'USER';

-- User.role now answers only whether somebody looks after the whole installation.
-- Anyone who was an admin of their home has just been given that on the membership.
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "PlatformRole"
  USING CASE WHEN "role" = 'SUPER_ADMIN' THEN 'SUPER_ADMIN' ELSE 'USER' END::"PlatformRole";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'USER';

-- DropEnum
DROP TYPE "Role";

-- The home somebody was in becomes the home they are looking at. SetNull rather than
-- Cascade: deleting a home used to delete its people with it, which is no longer what
-- being in a home means — they belong to the others they are members of.
ALTER TABLE "User" DROP CONSTRAINT "User_homeId_fkey";

-- DropIndex
DROP INDEX "User_homeId_idx";

-- AlterTable
ALTER TABLE "User" RENAME COLUMN "homeId" TO "activeHomeId";

-- CreateIndex
CREATE INDEX "User_activeHomeId_idx" ON "User"("activeHomeId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_activeHomeId_fkey" FOREIGN KEY ("activeHomeId") REFERENCES "Home"("id") ON DELETE SET NULL ON UPDATE CASCADE;
