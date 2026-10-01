-- Seasonal touches in the header, off until a household turns them on.
ALTER TABLE "Home" ADD COLUMN "seasonal" BOOLEAN NOT NULL DEFAULT false;
