-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Lead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "existingUrl" TEXT,
    "instagramHandle" TEXT,
    "rating" REAL,
    "reviewCount" INTEGER,
    "city" TEXT NOT NULL,
    "websiteStatus" TEXT NOT NULL DEFAULT 'NONE',
    "source" TEXT NOT NULL DEFAULT 'MOCK',
    "placeId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "outreachStatus" TEXT NOT NULL DEFAULT 'NEW',
    "lastContactedAt" DATETIME,
    "followUpAt" DATETIME,
    "outreachNotes" TEXT,
    "followUpCount" INTEGER NOT NULL DEFAULT 0
);
INSERT INTO "new_Lead" ("address", "category", "city", "createdAt", "email", "existingUrl", "followUpAt", "id", "instagramHandle", "lastContactedAt", "name", "outreachNotes", "outreachStatus", "phone", "placeId", "rating", "reviewCount", "source", "websiteStatus") SELECT "address", "category", "city", "createdAt", "email", "existingUrl", "followUpAt", "id", "instagramHandle", "lastContactedAt", "name", "outreachNotes", "outreachStatus", "phone", "placeId", "rating", "reviewCount", "source", "websiteStatus" FROM "Lead";
DROP TABLE "Lead";
ALTER TABLE "new_Lead" RENAME TO "Lead";
CREATE UNIQUE INDEX "Lead_placeId_key" ON "Lead"("placeId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
