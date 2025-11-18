-- Migration: Add Supplier Budget Tables
-- Description: Add tables for supplier-based budget tracking with quotation upload and PO integration

-- Create SupplierBudgetStatus enum
CREATE TYPE "SupplierBudgetStatus" AS ENUM (
  'QUOTED',
  'PENDING_APPROVAL',
  'APPROVED',
  'PO_ISSUED',
  'IN_PROGRESS',
  'COMPLETED',
  'INVOICED',
  'PAID',
  'CANCELLED'
);

-- Create BudgetAlertType enum
CREATE TYPE "BudgetAlertType" AS ENUM (
  'BUDGET_EXCEEDED',
  'BUDGET_WARNING',
  'COST_EXCEEDED',
  'COST_WARNING',
  'PROFIT_LOSS',
  'PROFIT_WARNING',
  'SUPPLIER_OVER_BUDGET',
  'MISSING_QUOTATION'
);

-- Create AlertSeverity enum
CREATE TYPE "AlertSeverity" AS ENUM (
  'INFO',
  'WARNING',
  'CRITICAL'
);

-- Create SupplierBudgetItem table
CREATE TABLE "SupplierBudgetItem" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "supplierName" TEXT NOT NULL,
  "tradeType" TEXT NOT NULL,
  "description" TEXT,
  "quotedAmount" DECIMAL(15,2) NOT NULL,
  "quotedAmountBeforeTax" DECIMAL(15,2),
  "quotedTaxAmount" DECIMAL(15,2),
  "actualCost" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "actualCostBeforeTax" DECIMAL(15,2),
  "actualTaxAmount" DECIMAL(15,2),
  "variance" DECIMAL(15,2),
  "variancePercentage" DECIMAL(5,2),
  "quotationReference" TEXT,
  "quotationDate" TIMESTAMP(3),
  "quotationFilePath" TEXT,
  "quotationFileName" TEXT,
  "extractedByAI" BOOLEAN NOT NULL DEFAULT false,
  "aiConfidence" DECIMAL(3,2),
  "aiExtractedData" JSONB,
  "needsReview" BOOLEAN NOT NULL DEFAULT false,
  "purchaseOrderId" TEXT,
  "poIssued" BOOLEAN NOT NULL DEFAULT false,
  "poIssuedDate" TIMESTAMP(3),
  "status" "SupplierBudgetStatus" NOT NULL DEFAULT 'QUOTED',
  "isApproved" BOOLEAN NOT NULL DEFAULT false,
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "notes" TEXT,
  "internalNotes" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SupplierBudgetItem_pkey" PRIMARY KEY ("id")
);

-- Create ProjectBudgetSummary table
CREATE TABLE "ProjectBudgetSummary" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "contractValue" DECIMAL(15,2) NOT NULL,
  "contractValueBeforeTax" DECIMAL(15,2),
  "contractTaxAmount" DECIMAL(15,2),
  "totalBudget" DECIMAL(15,2) NOT NULL,
  "totalBudgetBeforeTax" DECIMAL(15,2),
  "totalBudgetTaxAmount" DECIMAL(15,2),
  "totalActualCost" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "totalActualCostBeforeTax" DECIMAL(15,2),
  "totalActualTaxAmount" DECIMAL(15,2),
  "estimatedProfit" DECIMAL(15,2) NOT NULL,
  "estimatedProfitMargin" DECIMAL(5,2) NOT NULL,
  "actualProfit" DECIMAL(15,2),
  "actualProfitMargin" DECIMAL(5,2),
  "budgetUtilization" DECIMAL(5,2) NOT NULL,
  "costUtilization" DECIMAL(5,2),
  "totalSuppliers" INTEGER NOT NULL DEFAULT 0,
  "suppliersWithPO" INTEGER NOT NULL DEFAULT 0,
  "suppliersWithQuotation" INTEGER NOT NULL DEFAULT 0,
  "hasWarnings" BOOLEAN NOT NULL DEFAULT false,
  "warningCount" INTEGER NOT NULL DEFAULT 0,
  "criticalWarningCount" INTEGER NOT NULL DEFAULT 0,
  "lastCalculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastCalculatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProjectBudgetSummary_pkey" PRIMARY KEY ("id")
);

-- Create BudgetAlert table
CREATE TABLE "BudgetAlert" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "alertType" "BudgetAlertType" NOT NULL,
  "severity" "AlertSeverity" NOT NULL DEFAULT 'WARNING',
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "supplierBudgetItemId" TEXT,
  "supplierName" TEXT,
  "threshold" DECIMAL(5,2),
  "currentValue" DECIMAL(15,2),
  "limitValue" DECIMAL(15,2),
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "isDismissed" BOOLEAN NOT NULL DEFAULT false,
  "isResolved" BOOLEAN NOT NULL DEFAULT false,
  "readAt" TIMESTAMP(3),
  "dismissedAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "notifiedUsers" JSONB,
  "notifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BudgetAlert_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX "SupplierBudgetItem_projectId_idx" ON "SupplierBudgetItem"("projectId");
CREATE INDEX "SupplierBudgetItem_supplierId_idx" ON "SupplierBudgetItem"("supplierId");
CREATE INDEX "SupplierBudgetItem_status_idx" ON "SupplierBudgetItem"("status");
CREATE INDEX "SupplierBudgetItem_poIssued_idx" ON "SupplierBudgetItem"("poIssued");

CREATE UNIQUE INDEX "ProjectBudgetSummary_projectId_key" ON "ProjectBudgetSummary"("projectId");
CREATE INDEX "ProjectBudgetSummary_projectId_idx" ON "ProjectBudgetSummary"("projectId");

CREATE INDEX "BudgetAlert_projectId_idx" ON "BudgetAlert"("projectId");
CREATE INDEX "BudgetAlert_isRead_idx" ON "BudgetAlert"("isRead");
CREATE INDEX "BudgetAlert_severity_idx" ON "BudgetAlert"("severity");
CREATE INDEX "BudgetAlert_isResolved_idx" ON "BudgetAlert"("isResolved");

-- Add foreign key constraints
ALTER TABLE "SupplierBudgetItem" ADD CONSTRAINT "SupplierBudgetItem_projectId_fkey" 
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupplierBudgetItem" ADD CONSTRAINT "SupplierBudgetItem_supplierId_fkey" 
  FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SupplierBudgetItem" ADD CONSTRAINT "SupplierBudgetItem_purchaseOrderId_fkey" 
  FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SupplierBudgetItem" ADD CONSTRAINT "SupplierBudgetItem_createdById_fkey" 
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SupplierBudgetItem" ADD CONSTRAINT "SupplierBudgetItem_approvedById_fkey" 
  FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProjectBudgetSummary" ADD CONSTRAINT "ProjectBudgetSummary_projectId_fkey" 
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectBudgetSummary" ADD CONSTRAINT "ProjectBudgetSummary_lastCalculatedById_fkey" 
  FOREIGN KEY ("lastCalculatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BudgetAlert" ADD CONSTRAINT "BudgetAlert_projectId_fkey" 
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BudgetAlert" ADD CONSTRAINT "BudgetAlert_supplierBudgetItemId_fkey" 
  FOREIGN KEY ("supplierBudgetItemId") REFERENCES "SupplierBudgetItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
