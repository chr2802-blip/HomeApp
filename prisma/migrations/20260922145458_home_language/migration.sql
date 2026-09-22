/*
  A home also has a language.

  It decides the words the app speaks, the way dates are written, and the language a
  recipe is read into on import. Every home that already exists keeps the voice the app
  has always had, which is what EN is.
*/

-- CreateEnum
CREATE TYPE "HomeLanguage" AS ENUM ('EN', 'DA');

-- AlterTable
ALTER TABLE "Home" ADD COLUMN "language" "HomeLanguage" NOT NULL DEFAULT 'EN';
