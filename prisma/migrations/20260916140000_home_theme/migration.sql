/*
  A home is dressed in a colour of its own.

  Now that somebody can be in several homes, the header has to say which one is on
  screen without being read. Every home that already exists keeps the look the app has
  always had, which is what SLATE is.
*/

-- CreateEnum
CREATE TYPE "HomeTheme" AS ENUM ('SLATE', 'OCEAN', 'INDIGO', 'VIOLET', 'PLUM', 'SAND');

-- AlterTable
ALTER TABLE "Home" ADD COLUMN "theme" "HomeTheme" NOT NULL DEFAULT 'SLATE';
