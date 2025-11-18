# Procurement Document Management System - Testing Guide

## Overview

This guide provides comprehensive testing procedures for the procurement document management system. Follow these steps in order to ensure all features work correctly before production deployment.

## Prerequisites

Before starting tests, ensure the following are ready:

- **Database**: Migration applied successfully, all tables created
- **Dependencies**: `pdfkit`, `@types/pdfkit`, `react-dropzone` installed
- **Ollama**: Running and accessible at `http://localhost:11434`
- **NAS**: Accessible at configured path, proper permissions set
- **Test Data**: Sample documents ready (quotations, invoices, VOs in PDF format)
- **User Accounts**: Test accounts for regular user and superadmin roles

## Test Environment Setup

### 1. Verify Database Schema

Connect to the database and verify all tables exist:

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'Procurement%';

-- Expected tables:
-- ProcurementDocument
-- ProcurementDocumentLineItem
-- ProcurementPORequest
-- ProcurementApprovalHistory
```

### 2. Verify Ollama Service

```bash
curl http://localhost:11434/api/tags
# Should return list of available models including llama3.1:8b
```

### 3. Verify NAS Access

Check that the NAS path is accessible and writable:

```bash
# Windows
Test-Path "C:\ampere\nas"

# Create test folder
New-Item -Path "C:\ampere\nas\TEST" -ItemType Directory
Remove-Item -Path "C:\ampere\nas\TEST"
```

## Testing Scenarios

### Scenario 1: Complete Quotation-to-PO Workflow

**Objective**: Test the full workflow from quotation upload to PO generation and approval.

**Steps**:

1. **Upload Supplier Quotation**
   - Navigate to project → Procurement tab
   - Click "Upload Document"
   - Select document type: "Supplier Quotation"
   - Upload a sample quotation PDF
   - Add notes: "Test quotation for Scenario 1"
   - Click "Upload & Extract"

2. **Verify AI Extraction**
   - Wait for upload to complete
   - Check extraction status message
   - Verify confidence score displayed (should be > 70%)
   - Navigate to "Document List" tab
   - Find uploaded quotation
   - Click "View Details" (eye icon)
   - Verify extracted data:
     - Document number
     - Supplier name (auto-created if new)
     - Total amount
     - Line items with descriptions and amounts
     - Payment terms

3. **Generate PO from Quotation**
   - In document list, find the quotation
   - Click "Generate PO" button (blue icon)
   - Verify form pre-fills with quotation data
   - Review and edit if needed:
     - PO number (auto-generated)
     - PO date (defaults to today)
     - Delivery date (optional)
     - Delivery address (optional)
     - Financial details (subtotal, tax, total)
     - Payment terms (select from dropdown)
     - Terms & conditions (pre-filled, editable)
   - Click "Submit for Approval"
   - Verify success message
   - Verify quotation status changes to "Pending Approval"

4. **Approve PO (Superadmin)**
   - Logout and login as superadmin
   - Navigate to `/procurement/approvals`
   - Verify pending PO request appears
   - Click "Review" button
   - Review all details:
     - PO information
     - Supplier and project details
     - Financial breakdown
     - Line items table
     - Terms & conditions
   - Add approval comments (optional)
   - Click "Approve & Generate PO"
   - Wait for PDF generation
   - Verify success message

5. **Verify Generated PO**
   - Check NAS folders:
     - Project folder: `[NAS]/PROJECT/[ProjectNo]-[Name]/POs to suppliers/`
     - Central folder: `[NAS]/POs/`
   - Open generated PDF
   - Verify PDF contents:
     - Header with PO number and date
     - Project information
     - Supplier details
     - Line items table
     - Financial totals
     - Payment terms
     - Terms & conditions
   - Return to document list
   - Verify new PO document appears
   - Verify quotation shows linked PO
   - Verify quotation status is "Approved"

**Expected Results**:
- ✅ Quotation uploaded successfully
- ✅ AI extraction completed with good confidence
- ✅ Supplier auto-created (if new)
- ✅ PO request created
- ✅ Approval workflow completed
- ✅ PDF generated in both locations
- ✅ Document records created and linked
- ✅ Statuses updated correctly

---

### Scenario 2: Invoice-to-PO Matching with Exact Match

**Objective**: Test invoice linking to PO when amounts match within 5% threshold.

**Steps**:

1. **Prerequisites**
   - Complete Scenario 1 first (need an approved PO)
   - Have a supplier invoice PDF that matches the PO amount

2. **Upload Supplier Invoice**
   - Navigate to project → Procurement → Upload Document
   - Select document type: "Supplier Invoice"
   - Upload invoice PDF
   - Add notes: "Test invoice for Scenario 2"
   - Click "Upload & Extract"

3. **Verify Extraction**
   - Check extraction results
   - Verify invoice details extracted:
     - Invoice number
     - Supplier name (should match existing supplier)
     - Invoice date
     - Total amount
     - Line items

4. **Link Invoice to PO**
   - Navigate to Document List
   - Find uploaded invoice
   - Verify "⚠️ Needs PO Linking" badge appears
   - Click "Link to PO" button (yellow icon)
   - In modal, verify:
     - Available POs shown for correct supplier
     - PO dropdown populated
   - Select the PO from Scenario 1
   - Review variance calculation:
     - PO Amount: [amount]
     - Invoice Amount: [amount]
     - Variance: [amount] ([percentage]%)
   - Verify variance is < 5% (green indicator)
   - Click "Link Invoice to PO"
   - Verify success message

5. **Verify Linked Status**
   - Check invoice status changed to "LINKED"
   - Verify "⚠️ Needs PO Linking" badge removed
   - Click "View Details" on invoice
   - Verify linked PO information displayed
   - Verify invoice shows linked PO number

**Expected Results**:
- ✅ Invoice uploaded and extracted
- ✅ Supplier matched correctly
- ✅ Available POs filtered by supplier
- ✅ Variance calculated correctly
- ✅ Linking succeeded (variance < 5%)
- ✅ Status updated to LINKED
- ✅ Invoice ready for payment processing

---

### Scenario 3: Invoice-to-PO Matching with Variance

**Objective**: Test invoice linking when amount variance exceeds 5% threshold.

**Steps**:

1. **Upload Invoice with Different Amount**
   - Upload supplier invoice with amount differing > 5% from PO
   - Complete extraction

2. **Attempt Linking**
   - Click "Link to PO" button
   - Select matching PO
   - Observe variance calculation:
     - Variance percentage > 5%
     - Red indicator shown
     - Warning message displayed

3. **Complete Linking**
   - Click "Link Invoice to PO" despite warning
   - Verify linking succeeds but with approval flag

4. **Verify Approval Required**
   - Check invoice status: "PENDING_APPROVAL"
   - Verify requiresApproval flag set
   - Verify warning message about approval needed
   - Verify payment processing blocked until approval

**Expected Results**:
- ✅ Variance detected correctly (> 5%)
- ✅ Warning displayed to user
- ✅ Linking allowed but flagged
- ✅ Status set to PENDING_APPROVAL
- ✅ Payment blocked until superadmin approval

---

### Scenario 4: Variation Order Processing

**Objective**: Test VO upload and revised PO generation.

**Steps**:

1. **Prerequisites**
   - Have an approved PO from Scenario 1
   - Have a VO PDF document

2. **Upload Variation Order**
   - Navigate to Procurement → Upload Document
   - Select document type: "Variation Order"
   - Upload VO PDF
   - Add notes: "Test VO for Scenario 4"
   - Complete upload and extraction

3. **Verify VO Status**
   - Navigate to Document List
   - Find uploaded VO
   - Verify "⚠️ Needs Revised PO" badge appears
   - Click "View Details"
   - Verify VO details extracted

4. **Process VO**
   - Click "Handle VO" button (red icon)
   - In modal:
     - Select original PO from dropdown
     - Verify revised total calculation:
       - Original PO Amount: [amount]
       - VO Amount: [amount]
       - Revised Total: [sum]
   - Click "Generate Revised PO"

5. **Configure Revised PO**
   - Verify form pre-fills with:
     - Revised total amount
     - Documentation in T&Cs showing:
       - Original PO number
       - VO number
       - Amount breakdown
     - Combined line items
   - Edit PO number if needed (add "-R01" suffix)
   - Review all details
   - Click "Submit for Approval"

6. **Approve Revised PO (Superadmin)**
   - Login as superadmin
   - Navigate to `/procurement/approvals`
   - Find revised PO request
   - Review details showing VO information
   - Approve request
   - Verify revised PO PDF generated

7. **Verify VO Linked**
   - Return to document list
   - Verify VO status changed to "LINKED"
   - Verify "⚠️ Needs Revised PO" badge removed
   - Verify VO shows linked to revised PO
   - Open revised PO PDF
   - Verify it includes VO documentation

**Expected Results**:
- ✅ VO uploaded and extracted
- ✅ VO flagged for processing
- ✅ Original PO selection works
- ✅ Revised total calculated correctly
- ✅ Revised PO request created
- ✅ Approval workflow completed
- ✅ Revised PO PDF generated with VO details
- ✅ VO linked to revised PO
- ✅ Payment can proceed against revised PO

---

### Scenario 5: Multiple Document Types

**Objective**: Test uploading and managing all document types.

**Steps**:

1. **Upload Customer PO**
   - Select type: "Customer PO"
   - Upload document
   - Verify extraction
   - Verify customer auto-created

2. **Upload Client Invoice**
   - Select type: "Client Invoice"
   - Upload document
   - Verify extraction
   - Verify customer linked

3. **Review Document List**
   - Apply filters:
     - Filter by document type
     - Filter by status
   - Verify filtering works correctly
   - Verify all document types display with correct badges

4. **Test Document Actions**
   - View details for each document type
   - Verify line items display correctly
   - Test delete functionality
   - Verify deletion requires confirmation

**Expected Results**:
- ✅ All 6 document types supported
- ✅ Extraction works for all types
- ✅ Customers and suppliers auto-created
- ✅ Filtering works correctly
- ✅ Document actions work for all types

---

### Scenario 6: Error Handling

**Objective**: Test system behavior with invalid inputs and error conditions.

**Steps**:

1. **Invalid File Upload**
   - Try uploading non-PDF file (e.g., .txt)
   - Verify appropriate error message
   - Try uploading very large file (> 50MB)
   - Verify size limit error

2. **AI Extraction Failure**
   - Upload corrupted or unreadable PDF
   - Verify graceful handling
   - Verify document still saved with manual entry option

3. **Duplicate PO Request**
   - Try generating PO from same quotation twice
   - Verify error: "PO request already exists"

4. **Invalid Linking**
   - Try linking invoice to PO from different supplier
   - Verify error message

5. **Permission Errors**
   - Login as non-admin user
   - Try accessing `/procurement/approvals`
   - Verify redirect or access denied

6. **Missing Data**
   - Try submitting PO form with missing required fields
   - Verify validation errors display

**Expected Results**:
- ✅ All errors handled gracefully
- ✅ Clear error messages displayed
- ✅ No system crashes
- ✅ Data integrity maintained

---

## Performance Testing

### Load Testing

1. **Multiple Document Uploads**
   - Upload 10 documents simultaneously
   - Verify all complete successfully
   - Check for memory leaks or slowdowns

2. **Large Document Processing**
   - Upload 20+ page PDF
   - Verify AI extraction completes
   - Check processing time (should be < 30 seconds)

3. **Large Line Item Lists**
   - Upload document with 50+ line items
   - Verify all extracted correctly
   - Check UI rendering performance

### Database Performance

1. **Query Performance**
   - Create 100+ documents
   - Test document list loading time
   - Test filtering performance
   - Verify pagination if implemented

---

## Integration Testing

### NAS Integration

1. **File Storage**
   - Verify files saved to correct folders
   - Check file naming conventions
   - Verify file permissions

2. **File Retrieval**
   - Test opening files from NAS
   - Verify file download functionality

### Ollama Integration

1. **AI Extraction**
   - Test with various document formats
   - Verify extraction quality
   - Test fallback when Ollama unavailable

### Database Integration

1. **Transactions**
   - Verify atomic operations
   - Test rollback on errors
   - Check foreign key constraints

---

## Security Testing

### Authentication

1. **Access Control**
   - Verify unauthenticated users redirected
   - Test session expiration
   - Verify role-based access

### Authorization

1. **Role Permissions**
   - Regular users can upload and create PO requests
   - Only superadmins can approve POs
   - Only superadmins can access approval dashboard

### Data Security

1. **SQL Injection**
   - Test input fields with SQL injection attempts
   - Verify all queries parameterized

2. **File Upload Security**
   - Test malicious file uploads
   - Verify file type validation
   - Check file size limits

---

## Regression Testing

After any code changes, re-run:

1. Scenario 1 (Complete workflow)
2. Scenario 2 (Invoice matching)
3. Scenario 4 (VO processing)

This ensures core functionality remains intact.

---

## Test Data Preparation

### Sample Documents Needed

1. **Supplier Quotation**: PDF with clear amounts and line items
2. **Supplier Invoice**: PDF matching quotation amounts
3. **Supplier Invoice (Variance)**: PDF with 10% different amount
4. **Variation Order**: PDF with additional scope/costs
5. **Customer PO**: PDF from customer
6. **Client Invoice**: PDF invoice to customer

### Test Accounts

1. **Regular User**
   - Email: `test.user@ampere.com`
   - Role: `PROJECT_MANAGER`
   - Can: Upload, create PO requests

2. **Superadmin**
   - Email: `admin@ampere.com`
   - Role: `ADMIN`
   - Can: Everything + approve POs

---

## Bug Reporting Template

When issues are found, report using this format:

```
**Bug ID**: [Unique identifier]
**Severity**: [Critical/High/Medium/Low]
**Module**: [e.g., Invoice Matching]
**Description**: [Clear description of the issue]
**Steps to Reproduce**:
1. [Step 1]
2. [Step 2]
3. [Step 3]
**Expected Result**: [What should happen]
**Actual Result**: [What actually happened]
**Screenshots**: [Attach if applicable]
**Environment**: [Browser, OS, etc.]
**Workaround**: [If any]
```

---

## Test Sign-Off

After completing all tests, document results:

| Scenario | Status | Tester | Date | Notes |
|----------|--------|--------|------|-------|
| Scenario 1: Quotation-to-PO | ☐ Pass ☐ Fail | | | |
| Scenario 2: Invoice Match | ☐ Pass ☐ Fail | | | |
| Scenario 3: Invoice Variance | ☐ Pass ☐ Fail | | | |
| Scenario 4: VO Processing | ☐ Pass ☐ Fail | | | |
| Scenario 5: Multiple Types | ☐ Pass ☐ Fail | | | |
| Scenario 6: Error Handling | ☐ Pass ☐ Fail | | | |
| Performance Tests | ☐ Pass ☐ Fail | | | |
| Integration Tests | ☐ Pass ☐ Fail | | | |
| Security Tests | ☐ Pass ☐ Fail | | | |

**Overall System Status**: ☐ Ready for Production ☐ Needs Fixes

**Sign-off**:
- Tester: _________________ Date: _________
- Developer: _________________ Date: _________
- Project Manager: _________________ Date: _________
