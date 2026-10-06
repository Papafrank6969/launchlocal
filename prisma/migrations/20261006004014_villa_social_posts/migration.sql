-- CreateEnum
CREATE TYPE "SocialPostStatus" AS ENUM ('DRAFTED', 'RENDERED', 'POSTED', 'FAILED');

-- CreateTable
CREATE TABLE "SocialPost" (
    "id" TEXT NOT NULL,
    "status" "SocialPostStatus" NOT NULL DEFAULT 'DRAFTED',
    "audience" TEXT NOT NULL,
    "pillar" TEXT NOT NULL,
    "hook" TEXT NOT NULL,
    "spec" JSONB NOT NULL,
    "caption" TEXT NOT NULL,
    "videoUrl" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "postedAt" TIMESTAMP(3),

    CONSTRAINT "SocialPost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SocialPost_status_createdAt_idx" ON "SocialPost"("status", "createdAt");
