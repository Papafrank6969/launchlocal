-- AlterTable
ALTER TABLE "Site" ADD COLUMN "customDomain" TEXT;
ALTER TABLE "Site" ADD COLUMN "deliveredAt" DATETIME;

-- CreateTable
CREATE TABLE "HandoffTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "siteId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "doneAt" DATETIME,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "HandoffTask_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "HandoffTask_siteId_key_key" ON "HandoffTask"("siteId", "key");
