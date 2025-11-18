# Procurement Document Management - Phase 3 Deployment Notes

## Overview
Phase 3 implements the PO generation workflow with approval system. Users can generate POs from approved quotations, and superadmins can review and approve/reject PO requests. Approved POs are automatically generated as PDF documents.

## Files Created/Modified

### API Endpoints
1. **`app/api/projects/[id]/procurement/generate-po/route.ts`** - NEW
   - POST: Create PO generation request from quotation
   - GET: List PO requests for a project with filters

2. **`app/api/projects/[id]/procurement/approve-po/route.ts`** - NEW
   - POST: Approve or reject PO request (superadmin only)
   - Generates PDF PO document on approval
   - Saves to project folder and central PO repository
   - Creates document record with line items

3. **`app/api/procurement/all-po-requests/route.ts`** - NEW
   - GET: Fetch all PO requests across all projects (superadmin only)

### Components
4. **`components/projects/procurement/po-generation-form.tsx`** - NEW
   - Form to configure PO details from quotation
   - Editable: PO number, dates, amounts, payment terms, T&Cs
   - Auto-generates PO number
   - Validation and submission

5. **`components/projects/procurement/po-approval-dashboard.tsx`** - NEW
   - Superadmin dashboard for PO approvals
   - List pending/approved/rejected requests
   - Review modal with full PO details
   - Approve/reject actions with comments
   - Generates PDF on approval

6. **`components/projects/procurement/document-list-with-po.tsx`** - NEW
   - Enhanced document list with "Generate PO" button for quotations
   - Opens PO generation modal
   - Shows PO status and links

### Pages
7. **`app/(dashboard)/procurement/approvals/page.tsx`** - NEW
   - Superadmin-only page for PO approvals
   - Shows all pending PO requests across projects

### Updates
8. **`components/projects/procurement/procurement-management.tsx`** - MODIFIED
   - Updated to use `DocumentListWithPO` component

## Dependencies to Install

**On Production Server:**
```bash
cd C:\ampere\ampere_business_management
pnpm add pdfkit @types/pdfkit
pnpm add react-dropzone
```

## Environment Variables

**No new environment variables required.** Existing variables are sufficient:
- `NAS_BASE_PATH` - Already configured
- `OLLAMA_BASE_URL` - Already configured

## PO PDF Generation

The system automatically generates professional PDF PO documents with:
- Header with PO number, date, project info
- Supplier details
- Delivery information
- Line items table with descriptions, quantities, prices
- Subtotal, tax, and total amounts
- Payment terms
- Terms & conditions

**PDF Storage:**
1. **Project Folder:** `[NAS_PATH]/PROJECT/[ProjectNo]-[ProjectName]/POs to suppliers/`
2. **Central Repository:** `[NAS_PATH]/POs/` (for cross-project search)

**Filename Format:** `PO [PO_NUMBER] - [SUPPLIER_NAME] - [PROJECT_NAME].pdf`

## Workflow

### PO Generation Flow
1. User uploads supplier quotation → AI extracts data
2. User clicks "Generate PO" button on quotation
3. Form pre-fills with quotation data (editable)
4. User submits PO request
5. Request status: PENDING
6. Quotation status: PENDING_APPROVAL

### Approval Flow (Superadmin)
1. Superadmin navigates to `/procurement/approvals`
2. Reviews pending PO requests
3. Clicks "Review" to see full details
4. Options:
   - **Approve**: Generates PDF PO, saves to NAS, creates document record
   - **Reject**: Adds rejection reason, updates statuses

### Post-Approval
- PO Request status: APPROVED
- Quotation status: APPROVED
- PO Document created with:
  - Type: SUPPLIER_PO
  - Status: APPROVED
  - Linked to quotation
  - PDF file in NAS
  - Line items copied from quotation

## Database Schema

**No new migrations required.** Phase 1 migration already includes:
- `ProcurementPORequest` table
- `ProcurementApprovalHistory` table
- All necessary relations

## Testing Checklist

### 1. PO Generation Request
- [ ] Upload a supplier quotation
- [ ] Verify AI extraction works
- [ ] Click "Generate PO" button
- [ ] Verify form pre-fills with quotation data
- [ ] Edit PO details (number, dates, amounts, terms)
- [ ] Submit PO request
- [ ] Verify request appears in pending list
- [ ] Verify quotation status changes to PENDING_APPROVAL

### 2. Superadmin Approval
- [ ] Login as superadmin
- [ ] Navigate to `/procurement/approvals`
- [ ] Verify pending requests appear
- [ ] Click "Review" on a request
- [ ] Verify all details display correctly
- [ ] Verify line items table shows correctly
- [ ] Test rejection:
  - [ ] Add rejection reason
  - [ ] Click "Reject"
  - [ ] Verify status updates
- [ ] Test approval:
  - [ ] Add approval comments (optional)
  - [ ] Click "Approve & Generate PO"
  - [ ] Verify PDF generated in NAS
  - [ ] Verify PDF in central PO folder
  - [ ] Verify PO document record created
  - [ ] Verify line items copied

### 3. PDF Generation
- [ ] Open generated PDF
- [ ] Verify header (PO number, date, project)
- [ ] Verify supplier details
- [ ] Verify delivery information
- [ ] Verify line items table
- [ ] Verify amounts (subtotal, tax, total)
- [ ] Verify payment terms
- [ ] Verify terms & conditions

### 4. Document Linking
- [ ] Verify generated PO links to quotation
- [ ] Verify quotation shows linked PO
- [ ] Verify document list shows link icon

### 5. Permissions
- [ ] Verify non-admin users cannot access `/procurement/approvals`
- [ ] Verify non-admin users can create PO requests
- [ ] Verify only superadmins can approve/reject

## Known Limitations

1. **PDF Generation**: Requires `pdfkit` package. Basic formatting only.
2. **PO Numbering**: Auto-generated timestamp-based. Can be customized.
3. **Single Approval**: No multi-level approval workflow yet.
4. **Email Notifications**: Not implemented. Can be added in future.

## Next Steps (Phase 4)

After successful Phase 3 deployment:
1. Invoice-to-PO matching (3-way matching)
2. VO handling with revised PO generation
3. Payment approval gates
4. Email notifications for approvals

## Rollback Plan

If issues occur:

1. **Code**: Revert new files:
   ```bash
   git checkout components/projects/procurement/procurement-management.tsx
   git clean -fd app/api/projects/[id]/procurement/generate-po/
   git clean -fd app/api/projects/[id]/procurement/approve-po/
   git clean -fd app/api/procurement/all-po-requests/
   git clean -fd components/projects/procurement/po-generation-form.tsx
   git clean -fd components/projects/procurement/po-approval-dashboard.tsx
   git clean -fd components/projects/procurement/document-list-with-po.tsx
   git clean -fd app/(dashboard)/procurement/approvals/
   ```

2. **Dependencies**:
   ```bash
   pnpm remove pdfkit @types/pdfkit
   ```

3. **Database**: No rollback needed (no new migrations)

## Support

For issues:
- Check PM2 logs for API errors
- Check browser console for frontend errors
- Verify NAS permissions and paths
- Check PDF generation errors in logs
- Verify user roles and permissions
