-- CreateTable
CREATE TABLE "ListFavorite" (
    "userId" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListFavorite_pkey" PRIMARY KEY ("userId","listId")
);

-- CreateIndex
CREATE INDEX "ListFavorite_listId_idx" ON "ListFavorite"("listId");

-- AddForeignKey
ALTER TABLE "ListFavorite" ADD CONSTRAINT "ListFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListFavorite" ADD CONSTRAINT "ListFavorite_listId_fkey" FOREIGN KEY ("listId") REFERENCES "List"("id") ON DELETE CASCADE ON UPDATE CASCADE;
