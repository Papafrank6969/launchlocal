-- CreateTable
CREATE TABLE "EmailContact" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT NOT NULL DEFAULT '',
    "company" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailSend" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "step" INTEGER NOT NULL,
    "subject" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailSend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailSuppression" (
    "email" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailSuppression_pkey" PRIMARY KEY ("email")
);

-- CreateTable
CREATE TABLE "EmailInbound" (
    "messageId" TEXT NOT NULL,
    "contactId" TEXT,
    "kind" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailInbound_pkey" PRIMARY KEY ("messageId")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailContact_email_key" ON "EmailContact"("email");

-- CreateIndex
CREATE INDEX "EmailContact_status_idx" ON "EmailContact"("status");

-- CreateIndex
CREATE INDEX "EmailSend_sentAt_idx" ON "EmailSend"("sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailSend_contactId_step_key" ON "EmailSend"("contactId", "step");

-- AddForeignKey
ALTER TABLE "EmailSend" ADD CONSTRAINT "EmailSend_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "EmailContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

