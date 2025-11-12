-- CreateEnum for sync status
CREATE TYPE "XeroSyncStatus" AS ENUM ('SUCCESS', 'FAILED', 'SKIPPED', 'PARTIAL');

-- CreateEnum for sync entity type
CREATE TYPE "XeroSyncEntityType" AS ENUM ('CONTACT', 'INVOICE', 'BILL', 'PAYMENT', 'ITEM', 'ACCOUNT', 'OTHER');

-- CreateTable
CREATE TABLE "XeroSyncLog" (
    "id" TEXT NOT NULL,
    "syncType" "XeroSyncEntityType" NOT NULL,
    "status" "XeroSyncStatus" NOT NULL,
    "entityId" TEXT,
    "entityName" TEXT,
    "xeroId" TEXT,
    "errorMessage" TEXT,
    "errorDetails" JSONB,
    "attemptCount" INTEGER NOT NULL DEFAULT 1,
    "lastAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "XeroSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "XeroSyncLog_syncType_idx" ON "XeroSyncLog"("syncType");
CREATE INDEX "XeroSyncLog_status_idx" ON "XeroSyncLog"("status");
CREATE INDEX "XeroSyncLog_createdAt_idx" ON "XeroSyncLog"("createdAt");
CREATE INDEX "XeroSyncLog_entityId_idx" ON "XeroSyncLog"("entityId");
CREATE INDEX "XeroSyncLog_xeroId_idx" ON "XeroSyncLog"("xeroId");

