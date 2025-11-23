-- Migration: Add polymorphic comments with mentions

-- Create CommentEntityType enum
CREATE TYPE "CommentEntityType" AS ENUM (
  'INVOICE',
  'PURCHASE_ORDER',
  'PROJECT_BUDGET'
);

-- Create Comment table
CREATE TABLE "Comment" (
  "id" TEXT NOT NULL,
  "entityType" "CommentEntityType" NOT NULL,
  "invoiceId" TEXT,
  "purchaseOrderId" TEXT,
  "projectId" TEXT,
  "content" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- Create CommentMention table
CREATE TABLE "CommentMention" (
  "id" TEXT NOT NULL,
  "commentId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommentMention_pkey" PRIMARY KEY ("id")
);

-- Relationships
ALTER TABLE "Comment"
  ADD CONSTRAINT "Comment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "Comment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "CustomerInvoice"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "Comment_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "Comment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE;

ALTER TABLE "CommentMention"
  ADD CONSTRAINT "CommentMention_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "CommentMention_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;

-- Indexes
CREATE INDEX "Comment_entityType_invoiceId_idx" ON "Comment"("entityType", "invoiceId");
CREATE INDEX "Comment_entityType_purchaseOrderId_idx" ON "Comment"("entityType", "purchaseOrderId");
CREATE INDEX "Comment_entityType_projectId_idx" ON "Comment"("entityType", "projectId");
CREATE UNIQUE INDEX "CommentMention_commentId_userId_key" ON "CommentMention"("commentId", "userId");
