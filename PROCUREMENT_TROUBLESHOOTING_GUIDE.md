# Procurement Document Management System - Troubleshooting Guide

## Common Issues and Solutions

### Document Upload Issues

#### Issue: Upload Fails with "File Too Large" Error

**Symptoms**: Error message appears when trying to upload a document stating the file size exceeds the limit.

**Causes**: The uploaded file exceeds the configured maximum file size limit (typically 50MB). The file may be unnecessarily large due to high-resolution scans or embedded images.

**Solutions**:
1. Compress the PDF using a PDF compression tool
2. Reduce the scan resolution if creating PDFs from paper documents (300 DPI is usually sufficient)
3. Remove unnecessary pages or embedded images
4. If the file legitimately needs to be larger, contact your system administrator to increase the upload limit

**Prevention**: Scan documents at appropriate resolution (300 DPI for text documents). Use PDF compression tools before uploading.

---

#### Issue: Upload Succeeds but AI Extraction Fails

**Symptoms**: Document uploads successfully but extraction status shows "Failed" or confidence score is 0%.

**Causes**: The document may be a scanned image without OCR text layer. The document format may be corrupted or unsupported. Ollama service may be unavailable or overloaded. The document may contain only images or handwritten text.

**Solutions**:
1. Check if the document is a scanned image - if so, run OCR on it first
2. Try converting the document to a different PDF format
3. Verify Ollama service is running: `curl http://localhost:11434/api/tags`
4. Check server logs for specific error messages
5. If extraction consistently fails, manually enter the document data

**Prevention**: Ensure documents are text-based PDFs rather than image scans. Use OCR tools on scanned documents before uploading. Keep Ollama service running and monitored.

---

#### Issue: Extraction Confidence is Very Low (< 50%)

**Symptoms**: AI extraction completes but confidence score is below 50%, indicating uncertain results.

**Causes**: Poor document quality (blurry, low resolution, or skewed). Complex or non-standard document layout. Multiple languages or mixed content. Handwritten notes or signatures interfering with text extraction.

**Solutions**:
1. Review extracted data carefully and correct any errors
2. If possible, obtain a better quality version of the document
3. For consistently problematic suppliers, create extraction templates (future feature)
4. Manually verify and correct all extracted fields before proceeding

**Prevention**: Request digital documents from suppliers rather than scanned copies. Establish document quality standards with suppliers. Use standard document templates when possible.

---

### PO Generation Issues

#### Issue: "Generate PO" Button Not Visible

**Symptoms**: The Generate PO button does not appear next to a quotation in the document list.

**Causes**: The quotation status is not "EXTRACTED" (may still be uploading or already approved). A PO has already been generated from this quotation. The quotation is missing required data (supplier, amount). User lacks necessary permissions.

**Solutions**:
1. Check the quotation status - it must be "EXTRACTED"
2. Verify no PO is already linked to this quotation
3. Review quotation details to ensure supplier and amount are present
4. Confirm you have PROJECT_MANAGER or ADMIN role
5. Refresh the page to ensure UI is up to date

**Prevention**: Wait for extraction to complete before attempting PO generation. Verify all required data is present in the quotation.

---

#### Issue: PO Request Submission Fails

**Symptoms**: Error message appears when submitting PO generation request, or form validation prevents submission.

**Causes**: Required fields are missing or invalid. PO number conflicts with existing PO. Database connection issue. Invalid date formats. Amount fields contain non-numeric values.

**Solutions**:
1. Review all required fields marked with asterisks
2. Ensure PO number is unique (auto-generated numbers should be unique by default)
3. Check date fields are in correct format (YYYY-MM-DD)
4. Verify amount fields contain only numbers and decimals
5. Check browser console for specific validation errors
6. Try refreshing the page and submitting again

**Prevention**: Use auto-generated PO numbers to avoid conflicts. Fill all required fields before submitting. Validate data before clicking submit.

---

#### Issue: PO Request Not Appearing in Approval Dashboard

**Symptoms**: After submitting a PO request, it does not appear in the superadmin approval dashboard.

**Causes**: Request submission actually failed (check for error messages). User is not logged in as superadmin. Browser cache is showing old data. Database query filtering out the request. Request was created for a different project.

**Solutions**:
1. Verify the PO request was created successfully (check for confirmation message)
2. Confirm you are logged in with ADMIN role
3. Hard refresh the approval dashboard (Ctrl+F5)
4. Check the status filter - ensure "PENDING" is selected
5. Search for the request in the project's procurement document list
6. Check database directly: `SELECT * FROM "ProcurementPORequest" WHERE status = 'PENDING';`

**Prevention**: Always wait for confirmation message after submitting requests. Bookmark the approval dashboard for quick access.

---

### PO Approval Issues

#### Issue: PDF Generation Fails After Approval

**Symptoms**: PO is approved but PDF is not generated, or error message appears during approval.

**Causes**: NAS path is not accessible or lacks write permissions. pdfkit library is not installed or configured correctly. File path contains invalid characters. Disk space is full. Folder structure does not exist.

**Solutions**:
1. Verify NAS path exists and is accessible: `Test-Path "C:\ampere\nas"`
2. Check folder permissions: `icacls "C:\ampere\nas"`
3. Ensure pdfkit is installed: `pnpm list pdfkit`
4. Check disk space: `Get-PSDrive C`
5. Manually create required folders if missing
6. Check server logs for specific error messages
7. Try approving again after resolving issues

**Prevention**: Monitor disk space regularly. Ensure NAS is always accessible. Verify folder structure exists before deployment. Test PDF generation in development environment.

---

#### Issue: Generated PDF is Blank or Corrupted

**Symptoms**: PDF file is created but appears blank when opened, or PDF reader shows corruption errors.

**Causes**: pdfkit library version incompatibility. Font files missing or inaccessible. Data contains special characters that break PDF generation. Incomplete write operation (file system issue).

**Solutions**:
1. Update pdfkit to latest version: `pnpm update pdfkit`
2. Check if fonts are accessible on the server
3. Review the PO data for special characters or unusual formatting
4. Delete the corrupted PDF and regenerate
5. Check server logs during PDF generation
6. Try generating a simple test PDF to isolate the issue

**Prevention**: Test PDF generation with various data inputs during development. Keep pdfkit library updated. Sanitize user input to remove problematic characters.

---

### Invoice Linking Issues

#### Issue: No POs Available for Linking

**Symptoms**: When trying to link an invoice, the PO dropdown is empty or shows "No approved POs found".

**Causes**: No POs exist for the invoice's supplier. All POs for this supplier are not yet approved. Supplier name mismatch between invoice and POs. POs were created for a different project.

**Solutions**:
1. Verify the supplier name on the invoice is correct
2. Check if any POs exist for this supplier in the project
3. Ensure POs are in "APPROVED" status
4. If supplier name is slightly different, manually correct it in the invoice details
5. Generate a PO from a quotation if none exists yet

**Prevention**: Ensure quotations and invoices use consistent supplier names. Generate POs before receiving invoices. Maintain a supplier master list with standardized names.

---

#### Issue: Variance Exceeds 5% Threshold

**Symptoms**: When linking invoice to PO, system shows variance warning and requires approval.

**Causes**: Invoice amount differs from PO amount by more than 5%. This may be legitimate (partial shipment, price adjustments) or an error. Currency mismatch between invoice and PO. Tax calculations differ.

**Solutions**:
1. Verify the variance is legitimate and expected
2. Check if this is a partial invoice for a larger PO
3. Confirm currency is consistent between invoice and PO
4. Review tax calculations on both documents
5. If variance is legitimate, proceed with linking - it will require superadmin approval
6. If variance is an error, correct the invoice amount or contact the supplier

**Prevention**: Communicate with suppliers about partial shipments. Verify amounts before uploading invoices. Ensure currency consistency. Review PO terms regarding partial invoicing.

---

#### Issue: Invoice Already Linked Error

**Symptoms**: Error message "Invoice is already linked to a PO" when attempting to link.

**Causes**: The invoice has already been linked to a PO (possibly by another user). The invoice was linked, then the page was not refreshed. Database state is inconsistent.

**Solutions**:
1. Refresh the page to see current invoice status
2. Check invoice details to see which PO it is linked to
3. If linked to wrong PO, unlink it first, then link to correct PO
4. If this appears to be a database error, check the database: `SELECT * FROM "ProcurementDocument" WHERE id = '[invoice-id]';`

**Prevention**: Refresh document list after linking operations. Coordinate with team members to avoid simultaneous operations on same document.

---

### Variation Order Issues

#### Issue: Cannot Select Original PO for VO

**Symptoms**: VO processing interface shows no POs available in the dropdown.

**Causes**: No approved POs exist for the VO's supplier. Supplier name on VO does not match any PO suppliers. VO was uploaded without supplier information.

**Solutions**:
1. Verify the supplier name on the VO
2. Check if approved POs exist for this supplier
3. If supplier name is missing, manually add it in VO details
4. If supplier name differs slightly, correct it to match existing POs
5. Ensure the original PO has been approved before processing VO

**Prevention**: Ensure VOs clearly identify the supplier. Verify original PO exists and is approved before uploading VO. Use consistent supplier naming.

---

#### Issue: Revised PO Calculation Incorrect

**Symptoms**: The revised total shown when processing VO does not match expectations.

**Causes**: Original PO amount is incorrect in the database. VO amount was extracted incorrectly. Currency mismatch between original PO and VO. Tax calculations are inconsistent.

**Solutions**:
1. Verify the original PO amount in the database
2. Check the VO amount in document details
3. Manually correct any incorrect amounts
4. Ensure both documents use the same currency
5. Recalculate manually: Revised Total = Original PO + VO Amount

**Prevention**: Verify all amounts before processing VOs. Ensure currency consistency. Double-check AI-extracted amounts.

---

### Performance Issues

#### Issue: Document Upload is Very Slow

**Symptoms**: File upload takes several minutes or times out.

**Causes**: Large file size. Slow network connection. Server under heavy load. Ollama service is processing multiple requests. Database performance issues.

**Solutions**:
1. Compress the PDF before uploading
2. Check network speed and stability
3. Monitor server resource usage (CPU, memory, disk I/O)
4. Check Ollama service status and queue
5. Try uploading during off-peak hours
6. If persistent, contact system administrator

**Prevention**: Compress documents before uploading. Schedule large uploads during off-peak hours. Monitor server resources and scale if needed.

---

#### Issue: Document List Loads Slowly

**Symptoms**: Document list takes a long time to load or times out.

**Causes**: Large number of documents in the project. Complex database queries. Missing database indexes. Network latency. Browser rendering performance.

**Solutions**:
1. Use filters to reduce the number of documents displayed
2. Check database query performance
3. Verify database indexes are present
4. Clear browser cache
5. Try a different browser
6. Contact administrator to optimize database queries

**Prevention**: Implement pagination for large document sets. Regularly optimize database indexes. Archive old documents to separate tables.

---

### Permission and Access Issues

#### Issue: Cannot Access Approval Dashboard

**Symptoms**: Error message or redirect when trying to access `/procurement/approvals`.

**Causes**: User is not logged in as superadmin (ADMIN role). Session has expired. Insufficient permissions. URL is incorrect.

**Solutions**:
1. Verify you are logged in with ADMIN role
2. Log out and log back in to refresh session
3. Check user role in database: `SELECT role FROM "User" WHERE email = '[your-email]';`
4. Verify the URL is correct: `/procurement/approvals`
5. Contact administrator to grant ADMIN role if needed

**Prevention**: Ensure superadmin accounts are properly configured. Keep session active while working. Bookmark the correct URL.

---

#### Issue: Cannot Upload Documents

**Symptoms**: Upload button is disabled or error appears when attempting to upload.

**Causes**: User lacks necessary permissions. Project is archived or locked. Browser restrictions. File type is not allowed.

**Solutions**:
1. Verify you have PROJECT_MANAGER or ADMIN role
2. Check project status (ensure it is not archived)
3. Try a different browser
4. Ensure file is PDF format
5. Check browser console for specific errors

**Prevention**: Ensure users have appropriate roles assigned. Keep projects active while work is ongoing. Use supported file formats.

---

### Data Integrity Issues

#### Issue: Document Shows Incorrect Linked Status

**Symptoms**: Document appears linked but linked document does not exist, or vice versa.

**Causes**: Database inconsistency. Linked document was deleted. Foreign key relationship broken. Cache issue.

**Solutions**:
1. Refresh the page to clear cache
2. Check database for orphaned records:
   ```sql
   SELECT * FROM "ProcurementDocument" 
   WHERE linkedPOId IS NOT NULL 
   AND linkedPOId NOT IN (SELECT id FROM "ProcurementDocument");
   ```
3. Manually correct the linkedPOId field if needed
4. If linked document was deleted, unlink the document
5. Contact administrator for database repair

**Prevention**: Use proper foreign key constraints. Implement soft delete instead of hard delete. Regularly check database integrity.

---

#### Issue: Duplicate Documents Appearing

**Symptoms**: Same document appears multiple times in the list with different IDs.

**Causes**: User uploaded the same file multiple times. Network issue caused duplicate submission. Database transaction issue.

**Solutions**:
1. Check if documents are truly duplicates (same file name, size, date)
2. Delete duplicate entries (keep the most recent or most complete)
3. Check upload logs to understand how duplicates were created
4. If caused by network issues, implement idempotency checks

**Prevention**: Implement duplicate detection based on file hash. Add UI feedback to prevent multiple submissions. Use transaction locks during upload.

---

## System-Level Troubleshooting

### Checking Service Status

**Ollama Service**:
```bash
curl http://localhost:11434/api/tags
# Should return JSON with available models
```

**Database Connection**:
```bash
$env:PGPASSWORD='Ampere2024!'
psql -h localhost -p 5433 -U ampere_user -d ampere_db -c "SELECT 1;"
# Should return: 1
```

**Application Status**:
```bash
pm2 status ampere-app
# Should show: status: online
```

### Viewing Logs

**Application Logs**:
```bash
pm2 logs ampere-app --lines 100
```

**Database Logs**:
```bash
# Check PostgreSQL log file location
# Typically: C:\Program Files\PostgreSQL\15\data\log\
```

**Ollama Logs**:
```bash
ollama logs
```

### Database Queries for Debugging

**Check Document Status**:
```sql
SELECT 
  id, 
  documentType, 
  documentNumber, 
  status, 
  linkedPOId,
  createdAt
FROM "ProcurementDocument"
WHERE projectId = '[project-id]'
ORDER BY createdAt DESC;
```

**Check PO Requests**:
```sql
SELECT 
  id,
  poNumber,
  status,
  totalAmount,
  createdAt,
  approvedAt
FROM "ProcurementPORequest"
WHERE projectId = '[project-id]'
ORDER BY createdAt DESC;
```

**Check Approval History**:
```sql
SELECT 
  pr.poNumber,
  ah.action,
  ah.comments,
  ah.approvedAt,
  u.name as approver
FROM "ProcurementApprovalHistory" ah
JOIN "ProcurementPORequest" pr ON ah.poRequestId = pr.id
JOIN "User" u ON ah.approvedById = u.id
ORDER BY ah.approvedAt DESC;
```

### Clearing Cache

**Browser Cache**:
- Chrome/Edge: Ctrl+Shift+Delete → Clear browsing data
- Firefox: Ctrl+Shift+Delete → Clear recent history

**Server Cache** (if implemented):
```bash
pm2 restart ampere-app
```

### Restarting Services

**Application**:
```bash
pm2 restart ampere-app
```

**Ollama**:
```bash
# Stop
taskkill /F /IM ollama.exe

# Start
ollama serve
```

**Database** (use with caution):
```bash
# Stop
pg_ctl -D "C:\Program Files\PostgreSQL\15\data" stop

# Start
pg_ctl -D "C:\Program Files\PostgreSQL\15\data" start
```

## Getting Additional Help

If issues persist after trying these solutions:

1. **Check Documentation**: Review the user guide and deployment notes
2. **Search Logs**: Look for specific error messages in application and system logs
3. **Contact Support**: Provide detailed information including:
   - What you were trying to do
   - Exact error messages
   - Steps to reproduce
   - Screenshots
   - User role and permissions
   - Browser and version
4. **Emergency Contact**: For critical production issues, contact the on-call administrator

## Preventive Maintenance

To avoid common issues:

- **Daily**: Check application logs for errors, verify Ollama service is running, monitor disk space
- **Weekly**: Review pending approvals, check for orphaned documents, verify NAS accessibility
- **Monthly**: Database performance tuning, archive old documents, review user permissions, update dependencies
- **Quarterly**: Full system backup, disaster recovery test, security audit, performance optimization

## Known Limitations

Current known limitations of the system:

1. **Single PO per Invoice**: Each invoice can only link to one PO (partial invoicing not fully supported)
2. **5% Variance Threshold**: Fixed at 5%, not configurable per project or supplier
3. **PDF Format Only**: AI extraction works best with PDF documents
4. **English Language**: AI extraction optimized for English documents
5. **No Batch Operations**: Documents must be uploaded and processed individually
6. **No Email Notifications**: Manual checking required for approvals and status changes

These limitations are documented for future enhancement.
