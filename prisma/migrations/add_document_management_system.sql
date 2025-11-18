-- ============================================================================
-- Document Management System Schema
-- Comprehensive document tracking with approval workflows
-- ============================================================================

-- Document Types Enum
CREATE TYPE "DocumentType" AS ENUM (
  'CUSTOMER_PO',           -- PO from customer
  'SUPPLIER_QUOTATION',    -- Quotation from supplier
  'SUPPLIER_INVOICE',      -- Invoice from supplier
  'SUPPLIER_PO',           -- PO to supplier (generated)
  'CLIENT_INVOICE',        -- Invoice to client
  'VARIATION_ORDER'        -- Variation Order from supplier
);

-- Document Status Enum
CREATE TYPE "DocumentStatus" AS ENUM (
  'UPLOADED',              -- Just uploaded, pending extraction
  'EXTRACTED',             -- Data extracted, pending review
  'PENDING_APPROVAL',      -- Awaiting superadmin approval
  'APPROVED',              -- Approved by superadmin
  'REJECTED',              -- Rejected by superadmin
  'LINKED',                -- Linked to PO/Invoice
  'PAID',                  -- Invoice paid
  'CANCELLED'              -- Cancelled/voided
);

-- Approval Status Enum
CREATE TYPE "ApprovalStatus" AS ENUM (
  'PENDING',
  'APPROVED',
  'REJECTED'
);

-- Payment Terms Enum
CREATE TYPE "PaymentTerms" AS ENUM (
  'NET_7',
  'NET_15',
  'NET_30',
  'NET_45',
  'NET_60',
  'NET_90',
  'IMMEDIATE',
  'CUSTOM'
);

-- ============================================================================
-- Main Documents Table
-- ============================================================================
CREATE TABLE "ProjectDocument" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "documentType" "DocumentType" NOT NULL,
  "documentNumber" TEXT,                    -- PO-001, QT-001, INV-001, VO-001
  "documentDate" TIMESTAMP(3),
  "status" "DocumentStatus" NOT NULL DEFAULT 'UPLOADED',
  
  -- File Information
  "fileName" TEXT NOT NULL,
  "originalFileName" TEXT NOT NULL,
  "filePath" TEXT NOT NULL,                 -- Path in project folder
  "centralFilePath" TEXT,                   -- Path in central POs folder (for POs only)
  "fileSize" INTEGER NOT NULL,
  "mimeType" TEXT NOT NULL,
  
  -- Related Entities
  "supplierId" TEXT,                        -- For supplier documents
  "customerId" TEXT,                        -- For customer documents
  
  -- Extracted Data (from AI)
  "extractedData" JSONB,                    -- Flexible JSON for extracted fields
  "extractionConfidence" DOUBLE PRECISION,  -- 0-1 confidence score
  
  -- Financial Data
  "totalAmount" DECIMAL(15,2),
  "currency" TEXT DEFAULT 'SGD',
  "taxAmount" DECIMAL(15,2),
  "subtotalAmount" DECIMAL(15,2),
  
  -- Payment Terms
  "paymentTerms" "PaymentTerms",
  "customPaymentTerms" TEXT,                -- If CUSTOM selected
  "dueDate" TIMESTAMP(3),
  
  -- Terms & Conditions
  "termsAndConditions" TEXT,
  
  -- Linking
  "linkedQuotationId" TEXT,                 -- PO links to quotation
  "linkedPOId" TEXT,                        -- Invoice links to PO
  "linkedVOId" TEXT,                        -- Revised PO links to VO
  "parentDocumentId" TEXT,                  -- For revisions/amendments
  
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
  
  CONSTRAINT "ProjectDocument_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- Document Line Items Table
-- ============================================================================
CREATE TABLE "DocumentLineItem" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "lineNumber" INTEGER NOT NULL,
  
  -- Item Details
  "description" TEXT NOT NULL,
  "quantity" DECIMAL(10,2),
  "unitPrice" DECIMAL(15,2),
  "unit" TEXT,                              -- e.g., "pcs", "m2", "lot"
  "amount" DECIMAL(15,2) NOT NULL,
  
  -- Additional Info
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  
  CONSTRAINT "DocumentLineItem_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- PO Generation Requests Table
-- ============================================================================
CREATE TABLE "POGenerationRequest" (
  "id" TEXT NOT NULL,
  "quotationId" TEXT NOT NULL,              -- Source quotation document
  "projectId" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  
  -- PO Details (editable before generation)
  "poNumber" TEXT NOT NULL,
  "poDate" TIMESTAMP(3) NOT NULL,
  "deliveryDate" TIMESTAMP(3),
  "deliveryAddress" TEXT,
  
  -- Financial
  "totalAmount" DECIMAL(15,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'SGD',
  "taxAmount" DECIMAL(15,2),
  
  -- Terms (editable)
  "paymentTerms" "PaymentTerms" NOT NULL,
  "customPaymentTerms" TEXT,
  "termsAndConditions" TEXT,
  
  -- Approval
  "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  
  -- Generated PO
  "generatedPOId" TEXT,                     -- Links to ProjectDocument when approved
  
  -- Metadata
  "requestedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  
  CONSTRAINT "POGenerationRequest_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- Document Approval History Table
-- ============================================================================
CREATE TABLE "DocumentApprovalHistory" (
  "id" TEXT NOT NULL,
  "documentId" TEXT,
  "poRequestId" TEXT,
  
  -- Approval Details
  "action" "ApprovalStatus" NOT NULL,
  "comments" TEXT,
  "approvedById" TEXT NOT NULL,
  "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT "DocumentApprovalHistory_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================
CREATE INDEX "ProjectDocument_projectId_idx" ON "ProjectDocument"("projectId");
CREATE INDEX "ProjectDocument_documentType_idx" ON "ProjectDocument"("documentType");
CREATE INDEX "ProjectDocument_status_idx" ON "ProjectDocument"("status");
CREATE INDEX "ProjectDocument_supplierId_idx" ON "ProjectDocument"("supplierId");
CREATE INDEX "ProjectDocument_customerId_idx" ON "ProjectDocument"("customerId");
CREATE INDEX "ProjectDocument_documentNumber_idx" ON "ProjectDocument"("documentNumber");
CREATE INDEX "ProjectDocument_linkedQuotationId_idx" ON "ProjectDocument"("linkedQuotationId");
CREATE INDEX "ProjectDocument_linkedPOId_idx" ON "ProjectDocument"("linkedPOId");
CREATE INDEX "ProjectDocument_linkedVOId_idx" ON "ProjectDocument"("linkedVOId");
CREATE INDEX "ProjectDocument_approvalStatus_idx" ON "ProjectDocument"("approvalStatus");
CREATE INDEX "ProjectDocument_createdAt_idx" ON "ProjectDocument"("createdAt");

CREATE INDEX "DocumentLineItem_documentId_idx" ON "DocumentLineItem"("documentId");

CREATE INDEX "POGenerationRequest_quotationId_idx" ON "POGenerationRequest"("quotationId");
CREATE INDEX "POGenerationRequest_projectId_idx" ON "POGenerationRequest"("projectId");
CREATE INDEX "POGenerationRequest_supplierId_idx" ON "POGenerationRequest"("supplierId");
CREATE INDEX "POGenerationRequest_status_idx" ON "POGenerationRequest"("status");
CREATE INDEX "POGenerationRequest_generatedPOId_idx" ON "POGenerationRequest"("generatedPOId");

CREATE INDEX "DocumentApprovalHistory_documentId_idx" ON "DocumentApprovalHistory"("documentId");
CREATE INDEX "DocumentApprovalHistory_poRequestId_idx" ON "DocumentApprovalHistory"("poRequestId");

-- ============================================================================
-- Foreign Key Constraints
-- ============================================================================
ALTER TABLE "ProjectDocument" ADD CONSTRAINT "ProjectDocument_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectDocument" ADD CONSTRAINT "ProjectDocument_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectDocument" ADD CONSTRAINT "ProjectDocument_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectDocument" ADD CONSTRAINT "ProjectDocument_linkedQuotationId_fkey" FOREIGN KEY ("linkedQuotationId") REFERENCES "ProjectDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectDocument" ADD CONSTRAINT "ProjectDocument_linkedPOId_fkey" FOREIGN KEY ("linkedPOId") REFERENCES "ProjectDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectDocument" ADD CONSTRAINT "ProjectDocument_linkedVOId_fkey" FOREIGN KEY ("linkedVOId") REFERENCES "ProjectDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectDocument" ADD CONSTRAINT "ProjectDocument_parentDocumentId_fkey" FOREIGN KEY ("parentDocumentId") REFERENCES "ProjectDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectDocument" ADD CONSTRAINT "ProjectDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProjectDocument" ADD CONSTRAINT "ProjectDocument_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DocumentLineItem" ADD CONSTRAINT "DocumentLineItem_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "ProjectDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "POGenerationRequest" ADD CONSTRAINT "POGenerationRequest_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "ProjectDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "POGenerationRequest" ADD CONSTRAINT "POGenerationRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "POGenerationRequest" ADD CONSTRAINT "POGenerationRequest_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "POGenerationRequest" ADD CONSTRAINT "POGenerationRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "POGenerationRequest" ADD CONSTRAINT "POGenerationRequest_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "POGenerationRequest" ADD CONSTRAINT "POGenerationRequest_generatedPOId_fkey" FOREIGN KEY ("generatedPOId") REFERENCES "ProjectDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DocumentApprovalHistory" ADD CONSTRAINT "DocumentApprovalHistory_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "ProjectDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentApprovalHistory" ADD CONSTRAINT "DocumentApprovalHistory_poRequestId_fkey" FOREIGN KEY ("poRequestId") REFERENCES "POGenerationRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentApprovalHistory" ADD CONSTRAINT "DocumentApprovalHistory_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
