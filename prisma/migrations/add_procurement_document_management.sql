-- Migration: Add Procurement Document Management System
-- Created: 2025-01-XX
-- Description: Adds comprehensive document management for procurement workflow including
--              customer POs, supplier quotations, supplier invoices, PO generation, and VOs

-- Create Enums
CREATE TYPE "ProcurementDocumentType" AS ENUM (
  'CUSTOMER_PO',
  'SUPPLIER_QUOTATION',
  'SUPPLIER_INVOICE',
  'SUPPLIER_PO',
  'CLIENT_INVOICE',
  'VARIATION_ORDER'
);

CREATE TYPE "ProcurementDocumentStatus" AS ENUM (
  'UPLOADED',
  'EXTRACTED',
  'PENDING_APPROVAL',
  'APPROVED',
  'REJECTED',
  'LINKED',
  'PAID',
  'CANCELLED'
);

CREATE TYPE "ProcurementPaymentTerms" AS ENUM (
  'NET_7',
  'NET_15',
  'NET_30',
  'NET_45',
  'NET_60',
  'NET_90',
  'IMMEDIATE',
  'CUSTOM'
);

-- Create ProcurementDocument table
CREATE TABLE "ProcurementDocument" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "documentType" "ProcurementDocumentType" NOT NULL,
  "documentNumber" TEXT,
  "documentDate" TIMESTAMP(3),
  "status" "ProcurementDocumentStatus" NOT NULL DEFAULT 'UPLOADED',
  
  -- File Information
  "fileName" TEXT NOT NULL,
  "originalFileName" TEXT NOT NULL,
  "filePath" TEXT NOT NULL,
  "centralFilePath" TEXT,
  "fileSize" INTEGER NOT NULL,
  "mimeType" TEXT NOT NULL,
  
  -- Related Entities
  "supplierId" TEXT,
  "customerId" TEXT,
  
  -- Extracted Data
  "extractedData" JSONB,
  "extractionConfidence" DOUBLE PRECISION,
  
  -- Financial Data
  "totalAmount" DECIMAL(15,2),
  "currency" TEXT DEFAULT 'SGD',
  "taxAmount" DECIMAL(15,2),
  "subtotalAmount" DECIMAL(15,2),
  
  -- Payment Terms
  "paymentTerms" "ProcurementPaymentTerms",
  "customPaymentTerms" TEXT,
  "dueDate" TIMESTAMP(3),
  
  -- Terms & Conditions
  "termsAndConditions" TEXT,
  
  -- Linking
  "linkedQuotationId" TEXT,
  "linkedPOId" TEXT,
  "linkedVOId" TEXT,
  "parentDocumentId" TEXT,
  
  -- Approval Workflow
  "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
  "approvalStatus" "ApprovalStatus",
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  
  -- Metadata
  "notes" TEXT,
  "uploadedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProcurementDocument_pkey" PRIMARY KEY ("id")
);

-- Create ProcurementDocumentLineItem table
CREATE TABLE "ProcurementDocumentLineItem" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "lineNumber" INTEGER NOT NULL,
  
  -- Item Details
  "description" TEXT NOT NULL,
  "quantity" DECIMAL(10,2),
  "unitPrice" DECIMAL(15,2),
  "unit" TEXT,
  "amount" DECIMAL(15,2) NOT NULL,
  
  -- Additional Info
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProcurementDocumentLineItem_pkey" PRIMARY KEY ("id")
);

-- Create ProcurementPORequest table
CREATE TABLE "ProcurementPORequest" (
  "id" TEXT NOT NULL,
  "quotationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  
  -- PO Details
  "poNumber" TEXT NOT NULL,
  "poDate" TIMESTAMP(3) NOT NULL,
  "deliveryDate" TIMESTAMP(3),
  "deliveryAddress" TEXT,
  
  -- Financial
  "totalAmount" DECIMAL(15,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'SGD',
  "taxAmount" DECIMAL(15,2),
  
  -- Terms
  "paymentTerms" "ProcurementPaymentTerms" NOT NULL,
  "customPaymentTerms" TEXT,
  "termsAndConditions" TEXT,
  
  -- Approval
  "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  
  -- Generated PO
  "generatedPOId" TEXT,
  
  -- Metadata
  "requestedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProcurementPORequest_pkey" PRIMARY KEY ("id")
);

-- Create ProcurementApprovalHistory table
CREATE TABLE "ProcurementApprovalHistory" (
  "id" TEXT NOT NULL,
  "documentId" TEXT,
  "poRequestId" TEXT,
  
  -- Approval Details
  "action" "ApprovalStatus" NOT NULL,
  "comments" TEXT,
  "approvedById" TEXT NOT NULL,
  "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProcurementApprovalHistory_pkey" PRIMARY KEY ("id")
);

-- Add Foreign Key Constraints for ProcurementDocument
ALTER TABLE "ProcurementDocument" ADD CONSTRAINT "ProcurementDocument_projectId_fkey" 
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProcurementDocument" ADD CONSTRAINT "ProcurementDocument_supplierId_fkey" 
  FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProcurementDocument" ADD CONSTRAINT "ProcurementDocument_customerId_fkey" 
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProcurementDocument" ADD CONSTRAINT "ProcurementDocument_uploadedById_fkey" 
  FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProcurementDocument" ADD CONSTRAINT "ProcurementDocument_approvedById_fkey" 
  FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProcurementDocument" ADD CONSTRAINT "ProcurementDocument_linkedQuotationId_fkey" 
  FOREIGN KEY ("linkedQuotationId") REFERENCES "ProcurementDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProcurementDocument" ADD CONSTRAINT "ProcurementDocument_linkedPOId_fkey" 
  FOREIGN KEY ("linkedPOId") REFERENCES "ProcurementDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProcurementDocument" ADD CONSTRAINT "ProcurementDocument_linkedVOId_fkey" 
  FOREIGN KEY ("linkedVOId") REFERENCES "ProcurementDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProcurementDocument" ADD CONSTRAINT "ProcurementDocument_parentDocumentId_fkey" 
  FOREIGN KEY ("parentDocumentId") REFERENCES "ProcurementDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add Foreign Key Constraints for ProcurementDocumentLineItem
ALTER TABLE "ProcurementDocumentLineItem" ADD CONSTRAINT "ProcurementDocumentLineItem_documentId_fkey" 
  FOREIGN KEY ("documentId") REFERENCES "ProcurementDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add Foreign Key Constraints for ProcurementPORequest
ALTER TABLE "ProcurementPORequest" ADD CONSTRAINT "ProcurementPORequest_quotationId_fkey" 
  FOREIGN KEY ("quotationId") REFERENCES "ProcurementDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProcurementPORequest" ADD CONSTRAINT "ProcurementPORequest_projectId_fkey" 
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProcurementPORequest" ADD CONSTRAINT "ProcurementPORequest_supplierId_fkey" 
  FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProcurementPORequest" ADD CONSTRAINT "ProcurementPORequest_requestedById_fkey" 
  FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProcurementPORequest" ADD CONSTRAINT "ProcurementPORequest_approvedById_fkey" 
  FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProcurementPORequest" ADD CONSTRAINT "ProcurementPORequest_generatedPOId_fkey" 
  FOREIGN KEY ("generatedPOId") REFERENCES "ProcurementDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add Foreign Key Constraints for ProcurementApprovalHistory
ALTER TABLE "ProcurementApprovalHistory" ADD CONSTRAINT "ProcurementApprovalHistory_documentId_fkey" 
  FOREIGN KEY ("documentId") REFERENCES "ProcurementDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProcurementApprovalHistory" ADD CONSTRAINT "ProcurementApprovalHistory_poRequestId_fkey" 
  FOREIGN KEY ("poRequestId") REFERENCES "ProcurementPORequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProcurementApprovalHistory" ADD CONSTRAINT "ProcurementApprovalHistory_approvedById_fkey" 
  FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Create Indexes for ProcurementDocument
CREATE INDEX "ProcurementDocument_projectId_idx" ON "ProcurementDocument"("projectId");
CREATE INDEX "ProcurementDocument_documentType_idx" ON "ProcurementDocument"("documentType");
CREATE INDEX "ProcurementDocument_status_idx" ON "ProcurementDocument"("status");
CREATE INDEX "ProcurementDocument_supplierId_idx" ON "ProcurementDocument"("supplierId");
CREATE INDEX "ProcurementDocument_customerId_idx" ON "ProcurementDocument"("customerId");
CREATE INDEX "ProcurementDocument_documentNumber_idx" ON "ProcurementDocument"("documentNumber");
CREATE INDEX "ProcurementDocument_linkedQuotationId_idx" ON "ProcurementDocument"("linkedQuotationId");
CREATE INDEX "ProcurementDocument_linkedPOId_idx" ON "ProcurementDocument"("linkedPOId");
CREATE INDEX "ProcurementDocument_linkedVOId_idx" ON "ProcurementDocument"("linkedVOId");
CREATE INDEX "ProcurementDocument_approvalStatus_idx" ON "ProcurementDocument"("approvalStatus");
CREATE INDEX "ProcurementDocument_createdAt_idx" ON "ProcurementDocument"("createdAt");

-- Create Indexes for ProcurementDocumentLineItem
CREATE INDEX "ProcurementDocumentLineItem_documentId_idx" ON "ProcurementDocumentLineItem"("documentId");

-- Create Indexes for ProcurementPORequest
CREATE INDEX "ProcurementPORequest_quotationId_idx" ON "ProcurementPORequest"("quotationId");
CREATE INDEX "ProcurementPORequest_projectId_idx" ON "ProcurementPORequest"("projectId");
CREATE INDEX "ProcurementPORequest_supplierId_idx" ON "ProcurementPORequest"("supplierId");
CREATE INDEX "ProcurementPORequest_status_idx" ON "ProcurementPORequest"("status");
CREATE INDEX "ProcurementPORequest_generatedPOId_idx" ON "ProcurementPORequest"("generatedPOId");

-- Create Indexes for ProcurementApprovalHistory
CREATE INDEX "ProcurementApprovalHistory_documentId_idx" ON "ProcurementApprovalHistory"("documentId");
CREATE INDEX "ProcurementApprovalHistory_poRequestId_idx" ON "ProcurementApprovalHistory"("poRequestId");
