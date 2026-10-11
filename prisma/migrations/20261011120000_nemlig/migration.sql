/*
  "Send to Nemlig": a household's nemlig.com login (its password sealed with
  NEMLIG_SECRET_KEY, never stored as typed), and the product it chose for each line of
  shopping, so the next basket starts from the same choice.
*/

-- CreateTable
CREATE TABLE "NemligAccount" (
    "homeId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NemligAccount_pkey" PRIMARY KEY ("homeId")
);

-- CreateTable
CREATE TABLE "NemligChoice" (
    "homeId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NemligChoice_pkey" PRIMARY KEY ("homeId","key")
);

-- AddForeignKey
ALTER TABLE "NemligAccount" ADD CONSTRAINT "NemligAccount_homeId_fkey" FOREIGN KEY ("homeId") REFERENCES "Home"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NemligChoice" ADD CONSTRAINT "NemligChoice_homeId_fkey" FOREIGN KEY ("homeId") REFERENCES "Home"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Closed to Supabase's Data API like every other table (see close_supabase_data_api).
-- The account table above all: it holds a sealed password.

ALTER TABLE "NemligAccount" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NemligChoice" ENABLE ROW LEVEL SECURITY;
