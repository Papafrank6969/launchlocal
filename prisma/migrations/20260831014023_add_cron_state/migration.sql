-- CreateTable
CREATE TABLE "CronState" (
    "id" TEXT NOT NULL,
    "cursor" INTEGER NOT NULL DEFAULT 0,
    "lastRunAt" TIMESTAMP(3),
    "lastRunAdded" INTEGER,
    "lastRunNote" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CronState_pkey" PRIMARY KEY ("id")
);
