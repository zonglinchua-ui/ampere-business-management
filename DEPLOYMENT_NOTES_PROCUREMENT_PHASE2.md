# Procurement Document Management - Phase 2 Deployment Notes

## Overview
Phase 2 implements the unified document upload interface with AI-powered extraction for procurement documents (quotations, POs, invoices, VOs).

## Files Created/Modified

### API Endpoints
1. **`app/api/projects/[id]/procurement/upload/route.ts`** - NEW
   - Document upload with AI extraction using Ollama
   - Auto-creates suppliers/customers from extracted data
   - Saves files to NAS with proper folder structure
   - Extracts line items, amounts, payment terms

2. **`app/api/projects/[id]/procurement/documents/route.ts`** - NEW
   - GET: List documents with filters (type, status)
   - DELETE: Remove documents

### Components
3. **`components/projects/procurement/document-upload.tsx`** - NEW
   - Drag-and-drop file upload interface
   - Document type selection (6 types)
   - Notes field
   - Upload status with AI confidence display

4. **`components/projects/procurement/document-list.tsx`** - NEW
   - Document list with filters
   - Document detail modal
   - Line items display
   - Delete functionality

5. **`components/projects/procurement/procurement-management.tsx`** - NEW
   - Main procurement page with tabs (List/Upload)
   - Quick stats cards
   - Workflow info panel

### Pages
6. **`app/(dashboard)/projects/[id]/procurement/page.tsx`** - NEW
   - Procurement page route
   - Authentication check
   - Breadcrumb navigation

### Updates
7. **`components/projects/finance/simplified-finance-dashboard.tsx`** - MODIFIED
   - Added "Procurement Documents" card with link
   - Positioned after Progress Claims, before Supplier Invoices

## Database Migration

**Already Created:** `prisma/migrations/add_procurement_document_management.sql`

**To Apply on Production Server:**
```bash
cd C:\ampere\ampere_business_management
$env:PGPASSWORD='Ampere2024!'
psql -h localhost -p 5433 -U ampere_user -d ampere_db -f prisma\migrations\add_procurement_document_management.sql
```

## Dependencies to Install

**On Production Server:**
```bash
cd C:\ampere\ampere_business_management
pnpm add react-dropzone
```

## Environment Variables

**Already configured in `.env`:**
- `OLLAMA_BASE_URL=http://localhost:11434`
- `OLLAMA_MODEL=llama3.1:8b`
- `NAS_BASE_PATH=C:/ampere/nas` (or actual NAS path)

**Verify Ollama is running:**
```bash
curl http://localhost:11434/api/tags
```

## NAS Folder Structure

The system will auto-create folders following the existing structure:
```
[NAS_PATH]/PROJECT/[ProjectNo]-[ProjectName]/
├── POs from customer/          (CUSTOMER_PO)
├── invoices & quotations from suppliers/  (SUPPLIER_QUOTATION, SUPPLIER_INVOICE)
├── POs to suppliers/           (SUPPLIER_PO)
├── VOs/                        (VARIATION_ORDER)
└── documents/                  (fallback)
```

## Testing Checklist

### 1. Database Migration
- [ ] Apply migration SQL successfully
- [ ] Verify tables created: `ProcurementDocument`, `ProcurementDocumentLineItem`, `ProcurementPORequest`, `ProcurementApprovalHistory`
- [ ] Verify enums created: `ProcurementDocumentType`, `ProcurementDocumentStatus`, `ProcurementPaymentTerms`

### 2. Document Upload
- [ ] Navigate to `/projects/[id]/procurement`
- [ ] Test drag-and-drop file upload
- [ ] Test file selection via click
- [ ] Upload a supplier quotation PDF
- [ ] Verify AI extraction works (check confidence %)
- [ ] Verify file saved to NAS in correct folder
- [ ] Verify supplier auto-created if new

### 3. Document List
- [ ] View uploaded documents
- [ ] Test filters (document type, status)
- [ ] Click document to view details
- [ ] Verify line items display correctly
- [ ] Test delete functionality

### 4. Finance Dashboard Integration
- [ ] Navigate to Finance tab
- [ ] Verify "Procurement Documents" card appears
- [ ] Click "Manage Documents" button
- [ ] Verify redirects to procurement page

### 5. AI Extraction Quality
- [ ] Upload various document formats (PDF, images, Word)
- [ ] Verify extraction accuracy for:
  - Document number
  - Date
  - Supplier/customer name
  - Total amount
  - Tax amount
  - Line items
  - Payment terms

## Known Limitations

1. **AI Extraction Accuracy**: Depends on document quality and format. May require manual review.
2. **Ollama Dependency**: Requires Ollama service running locally. Falls back gracefully if unavailable.
3. **File Size**: Large files may take longer to process.
4. **Supported Formats**: PDF, images (PNG, JPG), Word documents (DOC, DOCX).

## Next Steps (Phase 3)

After successful Phase 2 deployment:
1. Implement PO generation from quotations
2. Add superadmin approval workflow
3. Build invoice-to-PO matching
4. Implement VO handling with revised PO generation

## Rollback Plan

If issues occur:
1. **Database**: Run rollback SQL:
   ```sql
   DROP TABLE IF EXISTS "ProcurementApprovalHistory";
   DROP TABLE IF EXISTS "ProcurementPORequest";
   DROP TABLE IF EXISTS "ProcurementDocumentLineItem";
   DROP TABLE IF EXISTS "ProcurementDocument";
   DROP TYPE IF EXISTS "ProcurementPaymentTerms";
   DROP TYPE IF EXISTS "ProcurementDocumentStatus";
   DROP TYPE IF EXISTS "ProcurementDocumentType";
   ```

2. **Code**: Revert changes:
   ```bash
   git checkout components/projects/finance/simplified-finance-dashboard.tsx
   git clean -fd app/api/projects/[id]/procurement/
   git clean -fd components/projects/procurement/
   git clean -fd app/(dashboard)/projects/[id]/procurement/
   ```

3. **Dependencies**:
   ```bash
   pnpm remove react-dropzone
   ```

## Support

For issues or questions:
- Check Ollama logs: `ollama logs`
- Check Next.js logs: PM2 logs
- Database queries: Use pgAdmin or psql
- File upload issues: Check NAS permissions and paths
