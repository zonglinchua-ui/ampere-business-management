
-- Add XeroLog table for comprehensive logging
-- This should be added to your Prisma schema

-- XeroLog model
-- @@map("xero_logs")
CREATE TABLE IF NOT EXISTS "xero_logs" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "timestamp" TIMESTAMP(3) NOT NULL,
  "userId" TEXT NOT NULL,
  "direction" TEXT NOT NULL, -- PULL, PUSH, BOTH
  "entity" TEXT NOT NULL,    -- CONTACTS, INVOICES, BILLS, PAYMENTS, ALL
  "status" TEXT NOT NULL,    -- SUCCESS, WARNING, ERROR, IN_PROGRESS
  "recordsProcessed" INTEGER NOT NULL DEFAULT 0,
  "recordsSucceeded" INTEGER NOT NULL DEFAULT 0,
  "recordsFailed" INTEGER NOT NULL DEFAULT 0,
  "message" TEXT NOT NULL,
  "details" TEXT,            -- JSON string for additional data
  "errorMessage" TEXT,
  "errorStack" TEXT,
  "duration" INTEGER,        -- Duration in milliseconds
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "xero_logs_userId_idx" ON "xero_logs"("userId");
CREATE INDEX IF NOT EXISTS "xero_logs_timestamp_idx" ON "xero_logs"("timestamp");
CREATE INDEX IF NOT EXISTS "xero_logs_status_idx" ON "xero_logs"("status");
CREATE INDEX IF NOT EXISTS "xero_logs_entity_idx" ON "xero_logs"("entity");
