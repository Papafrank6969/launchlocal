-- CreateTable
CREATE TABLE "BetPick" (
    "id" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "prob" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "gameAt" TIMESTAMP(3) NOT NULL,
    "result" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gradedAt" TIMESTAMP(3),

    CONSTRAINT "BetPick_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BetPick_result_gameAt_idx" ON "BetPick"("result", "gameAt");
