-- AlterTable
ALTER TABLE "Event" ADD COLUMN "path" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Site" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "tagline" TEXT,
    "about" TEXT,
    "services" TEXT,
    "hours" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "instagramHandle" TEXT,
    "photoUrl" TEXT,
    "template" TEXT NOT NULL DEFAULT 'classic',
    "primaryColor" TEXT NOT NULL DEFAULT '#2563eb',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "utmTrackingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "leadId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Site_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Site" ("about", "address", "businessName", "createdAt", "email", "hours", "id", "instagramHandle", "leadId", "phone", "photoUrl", "primaryColor", "services", "slug", "status", "tagline", "template", "updatedAt") SELECT "about", "address", "businessName", "createdAt", "email", "hours", "id", "instagramHandle", "leadId", "phone", "photoUrl", "primaryColor", "services", "slug", "status", "tagline", "template", "updatedAt" FROM "Site";
DROP TABLE "Site";
ALTER TABLE "new_Site" RENAME TO "Site";
CREATE UNIQUE INDEX "Site_slug_key" ON "Site"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
