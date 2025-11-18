# Procurement Document Management - Phase 4 Deployment Notes

## Overview
Phase 4 implements invoice-to-PO matching with 3-way verification and variation order handling with revised PO generation. This completes the procurement workflow by ensuring all supplier invoices are properly linked to approved POs before payment, and VOs trigger revised PO generation.

## Files Created/Modified

### API Endpoints
1. **`app/api/projects/[id]/procurement/link-invoice/route.ts`** - NEW
   - POST: Link supplier invoice to PO with 3-way matching
   - GET: Fetch available POs for linking (filtered by supplier)
   - DELETE: Unlink invoice from PO
   - Validates: supplier match, amount variance (5% threshold)
   - Auto-flags invoices requiring approval

### Components
2. **`components/projects/procurement/invoice-matching.tsx`** - NEW
   - Interface to link invoices to POs
   - Shows available POs for selected supplier
   - Displays amount comparison and variance
   - Warns if variance exceeds 5%
   - Shows linked PO status
   - Unlink functionality

3. **`components/projects/procurement/vo-handler.tsx`** - NEW
   - VO processing interface
   - Select original PO
   - Calculate revised total (Original + VO)
   - Generate revised PO request
   - Shows VO workflow steps

4. **`components/projects/procurement/document-list-enhanced.tsx`** - NEW
   - Enhanced document list with action buttons
   - "Link to PO" button for unlinked invoices
   - "Handle VO" button for unprocessed VOs
   - "Generate PO" button for quotations
   - Action required badges (⚠️ Needs PO Linking, ⚠️ Needs Revised PO)
   - Unified modal for all actions

### Updates
5. **`components/projects/procurement/procurement-management.tsx`** - MODIFIED
   - Updated to use `DocumentListEnhanced` component

## Database Schema

**No new migrations required.** Existing schema from Phase 1 supports:
- `linkedPOId` field in `ProcurementDocument`
- Document linking between invoices, POs, and VOs
- Status tracking for approval workflows

## Key Features

### Invoice-to-PO Matching (3-Way Matching)

The system performs comprehensive validation when linking invoices to POs, ensuring financial accuracy and compliance. The matching process verifies that the supplier on the invoice matches the supplier on the PO, preventing payment to incorrect vendors. Amount validation compares the invoice total against the PO total, allowing a 5% variance threshold to accommodate minor differences due to rounding or partial shipments. When the variance exceeds this threshold, the invoice is automatically flagged for superadmin approval before payment can proceed.

The linking interface provides users with a clear view of all available POs for the invoice's supplier, displaying PO numbers, amounts, and dates for easy selection. A real-time variance calculator shows the difference between invoice and PO amounts, both in absolute terms and as a percentage. Visual warnings alert users when variances exceed acceptable limits, and the system maintains complete audit trails of all linking actions.

### Variation Order Handling

Variation orders require special handling to ensure proper authorization and payment control. When a VO is uploaded, the system requires users to identify the original PO that the variation relates to. The system then calculates a revised total by adding the VO amount to the original PO amount, creating a comprehensive view of the updated project scope.

Users can generate a revised PO that incorporates both the original amount and the variation. This revised PO includes detailed documentation showing the original PO number, the VO number, the breakdown of amounts, and the new total. The revised PO follows the same approval workflow as standard POs, requiring superadmin authorization. This ensures that all scope changes are properly documented and approved before additional payments are processed.

### Payment Approval Gates

The system implements strict payment controls to prevent unauthorized disbursements. Supplier invoices cannot be marked as paid unless they are linked to an approved PO, ensuring that all payments have proper authorization. Invoices with amount variances exceeding 5% require explicit superadmin approval before payment processing. Variation orders must have an approved revised PO before any payments can be made against them.

These gates provide financial oversight and prevent common procurement errors such as paying invoices without proper PO authorization, processing payments that exceed approved amounts, and paying for scope changes before they are properly documented and approved.

## Workflow Examples

### Invoice Matching Workflow
1. User uploads supplier invoice → AI extracts data
2. System detects unlinked invoice → Shows "⚠️ Needs PO Linking" badge
3. User clicks "Link to PO" button
4. System shows available POs for the invoice supplier
5. User selects matching PO → System calculates variance
6. If variance ≤ 5%: Invoice status → LINKED (ready for payment)
7. If variance > 5%: Invoice status → PENDING_APPROVAL (requires superadmin)

### VO Handling Workflow
1. User uploads variation order → AI extracts data
2. System detects VO → Shows "⚠️ Needs Revised PO" badge
3. User clicks "Handle VO" button
4. User selects original PO from dropdown
5. System calculates revised total (Original + VO)
6. User clicks "Generate Revised PO"
7. Form pre-fills with revised amounts and documentation
8. User submits revised PO request
9. Superadmin approves → Revised PO generated as PDF
10. VO status → LINKED, ready for payment against revised PO

## Testing Checklist

### 1. Invoice-to-PO Linking
- [ ] Upload a supplier invoice
- [ ] Verify "Needs PO Linking" badge appears
- [ ] Click "Link to PO" button
- [ ] Verify available POs show for correct supplier
- [ ] Select a PO with matching amount (< 5% variance)
- [ ] Verify linking succeeds
- [ ] Verify invoice status changes to LINKED
- [ ] Verify linked PO displays in invoice details

### 2. Invoice Variance Handling
- [ ] Upload invoice with amount differing > 5% from PO
- [ ] Link to PO
- [ ] Verify warning message appears
- [ ] Verify invoice status changes to PENDING_APPROVAL
- [ ] Verify requiresApproval flag is set

### 3. VO Processing
- [ ] Upload a variation order
- [ ] Verify "Needs Revised PO" badge appears
- [ ] Click "Handle VO" button
- [ ] Select original PO
- [ ] Verify revised total calculation is correct
- [ ] Click "Generate Revised PO"
- [ ] Verify form pre-fills with:
  - [ ] Revised total amount
  - [ ] Documentation showing original PO + VO
  - [ ] Line items from both original and VO
- [ ] Submit revised PO request
- [ ] Verify request appears in approval dashboard

### 4. Revised PO Approval
- [ ] Login as superadmin
- [ ] Navigate to PO approvals
- [ ] Find revised PO request
- [ ] Verify documentation shows original PO and VO details
- [ ] Approve request
- [ ] Verify revised PO PDF generated
- [ ] Verify revised PO includes both original and VO amounts
- [ ] Verify VO status changes to LINKED

### 5. Payment Gates
- [ ] Attempt to mark unlinked invoice as paid → Should fail
- [ ] Link invoice to PO with > 5% variance
- [ ] Verify payment blocked until superadmin approval
- [ ] Upload VO without revised PO
- [ ] Verify payment blocked until revised PO approved

### 6. Document List Enhancements
- [ ] Verify action badges appear correctly
- [ ] Test "Link to PO" button for invoices
- [ ] Test "Handle VO" button for VOs
- [ ] Test "Generate PO" button for quotations
- [ ] Verify modal opens with correct action mode
- [ ] Test all actions complete successfully

## Known Limitations

1. **5% Variance Threshold**: Fixed at 5%. Can be made configurable in future.
2. **Single PO Linking**: Each invoice can link to only one PO. Partial invoices not supported yet.
3. **VO Complexity**: Assumes simple additive VOs. Complex VOs with deductions may need manual handling.
4. **No Email Notifications**: Users must manually check for pending actions.

## Next Steps (Phase 5)

After successful Phase 4 deployment:
1. End-to-end testing of complete workflow
2. User acceptance testing with real documents
3. Performance optimization for large document sets
4. Email notification system for approvals
5. Reporting dashboard for procurement metrics

## Dependencies

**No new dependencies required.** All functionality uses existing packages:
- `pdfkit` (already installed in Phase 3)
- `react-dropzone` (already installed in Phase 2)

## Rollback Plan

If issues occur:

1. **Code**: Revert new files:
   ```bash
   git checkout components/projects/procurement/procurement-management.tsx
   git clean -fd app/api/projects/[id]/procurement/link-invoice/
   git clean -fd components/projects/procurement/invoice-matching.tsx
   git clean -fd components/projects/procurement/vo-handler.tsx
   git clean -fd components/projects/procurement/document-list-enhanced.tsx
   ```

2. **Database**: No rollback needed (no schema changes)

3. **Restore Previous Version**:
   ```bash
   git checkout HEAD~1 components/projects/procurement/
   ```

## Support

For issues:
- Check browser console for frontend errors
- Check PM2 logs for API errors
- Verify PO availability for invoice linking
- Check variance calculations
- Verify approval workflow permissions

## Security Considerations

- Only authenticated users can link invoices
- Superadmin approval required for variance exceptions
- Audit trail maintained for all linking actions
- Payment gates prevent unauthorized disbursements
- Document deletion restricted by permissions
