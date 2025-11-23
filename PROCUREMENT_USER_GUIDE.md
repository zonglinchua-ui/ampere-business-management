# Procurement Document Management System - User Guide

## Introduction

The Procurement Document Management System streamlines the handling of supplier quotations, purchase orders, invoices, and variation orders. This guide explains how to use each feature of the system effectively.

## Getting Started

### Accessing the Procurement System

The procurement system is integrated into each project within the Ampere Business Management application. To access procurement features for a specific project, navigate to the project details page and select the **Procurement** tab from the navigation menu.

### User Roles and Permissions

The system supports two primary user roles with different capabilities. **Regular users** (Project Managers and team members) can upload documents, view all procurement documents, create purchase order requests from quotations, link invoices to purchase orders, and process variation orders. **Superadmins** have all regular user permissions plus the ability to approve or reject PO generation requests and access the centralized approval dashboard across all projects.

## Core Features

### Document Upload

The document upload feature provides a unified interface for managing all procurement-related documents. The system supports six document types: Customer PO (purchase orders received from clients), Supplier Quotation (quotes received from suppliers), Supplier Invoice (invoices received from suppliers), Supplier PO (purchase orders issued to suppliers), Client Invoice (invoices issued to clients), and Variation Order (scope change documents).

**To upload a document**, navigate to the Procurement tab and click the **Upload Document** button. Select the appropriate document type from the available options. Click the upload area or drag and drop your PDF file. Optionally add notes to provide context about the document. Click **Upload & Extract** to begin processing.

The system uses AI-powered extraction to automatically read and extract key information from uploaded documents. This includes document numbers, dates, supplier or customer names, total amounts, tax amounts, line items with descriptions and quantities, payment terms, and terms and conditions. The extraction process typically completes within 10-30 seconds depending on document complexity.

After extraction completes, you will see a confidence score indicating the AI's certainty about the extracted data. Scores above 80% generally indicate high accuracy. You can review the extracted information by clicking **View Details** on the document in the list. If any information is incorrect, you can manually edit it by clicking the edit button in the document details view.

### Generating Purchase Orders from Quotations

When you receive a quotation from a supplier and wish to convert it into a purchase order, the system streamlines this process. First, upload the supplier quotation using the document upload feature. Once the AI extraction completes, navigate to the Document List tab and locate your uploaded quotation. Click the **Generate PO** button (blue icon with a checkmark) next to the quotation.

The PO generation form will open with all quotation data pre-filled. You can review and edit any fields as needed. The PO number is auto-generated but can be changed if your organization uses a specific numbering scheme. Set the PO date, which defaults to today's date. Optionally specify a delivery date and delivery address. Review the financial details including subtotal, tax amount, and total amount. Select payment terms from the dropdown menu (Net 7, 15, 30, 45, 60, or 90 days, Immediate, or Custom). If you select Custom, enter your specific payment terms. Review and edit the terms and conditions as needed.

Once you have reviewed all information, click **Submit for Approval**. The quotation status will change to "Pending Approval" and a notification will be sent to superadmins for review. You can track the approval status in the Document List. Once approved by a superadmin, a professional PDF purchase order will be automatically generated and saved to both the project folder and the central PO repository.

### Approving Purchase Orders (Superadmin Only)

Superadmins can review and approve PO generation requests through a centralized dashboard. Navigate to **Procurement → Approvals** from the main menu. This dashboard shows all pending PO requests across all projects. You can filter by status (Pending, Approved, Rejected) to focus on specific requests.

To review a request, click the **Review** button next to any pending PO. The review modal displays complete information including PO details (number, date, amounts, payment terms), supplier and project information, a complete line items table showing all items from the quotation, and terms and conditions. You can add comments about your decision, which will be recorded in the approval history.

To approve the request, review all details carefully, optionally add approval comments, and click **Approve & Generate PO**. The system will automatically generate a PDF purchase order document, save it to the project folder and central repository, create a PO document record in the database, update the quotation status to "Approved", and link the PO to the original quotation.

To reject the request, enter a rejection reason in the comments field (required for rejections), and click **Reject**. The quotation status will revert to allow corrections, and the requester will be notified of the rejection with your comments.

### Linking Invoices to Purchase Orders

All supplier invoices must be linked to approved purchase orders before payment can be processed. This ensures proper authorization and enables three-way matching. When you upload a supplier invoice, the system will display a warning badge "⚠️ Needs PO Linking" to indicate action is required.

To link an invoice, locate the invoice in the Document List and click the **Link to PO** button (yellow icon). The linking interface will display all approved POs for the invoice's supplier. Select the appropriate PO from the dropdown menu. The system will automatically calculate the variance between the invoice amount and the PO amount, showing both the absolute difference and the percentage variance.

If the variance is within 5%, the linking will succeed and the invoice status will change to "LINKED", making it ready for payment processing. If the variance exceeds 5%, the system will display a warning but still allow the linking. However, the invoice will be flagged as "PENDING_APPROVAL" and will require superadmin review before payment can proceed. This safeguard prevents unauthorized payments while maintaining flexibility for legitimate variances.

Once linked, the invoice will display the linked PO information in its details view. If you need to unlink an invoice (for example, if you linked it to the wrong PO), click the unlink button in the invoice details and confirm the action.

### Processing Variation Orders

Variation orders represent changes to the original project scope and require special handling to ensure proper authorization. When you upload a variation order, the system displays a warning badge "⚠️ Needs Revised PO" indicating that a revised purchase order must be generated before payment can proceed.

To process a variation order, locate the VO in the Document List and click the **Handle VO** button (red icon). In the VO processing interface, select the original purchase order that this variation relates to from the dropdown menu. The system will display a calculation showing the original PO amount, the VO amount (typically an addition), and the revised total (original plus VO).

Click **Generate Revised PO** to create a new purchase order incorporating both amounts. The revised PO form will pre-fill with the combined information, including documentation in the terms and conditions section showing the original PO number, VO number, and amount breakdown. The line items will include both the original PO items and the VO items for complete transparency.

Review all details and make any necessary adjustments. The revised PO number should clearly indicate it is a revision (for example, by adding "-R01" suffix to the original PO number). Submit the revised PO for approval following the same process as standard POs. Once approved by a superadmin, the revised PO will be generated and the VO status will change to "LINKED". Payment can then proceed against the revised PO amount.

### Viewing Document Details

You can view comprehensive details for any document by clicking the **View Details** button (eye icon) in the Document List. The details view displays all extracted information including document number, date, supplier or customer name, total amount and currency, payment terms, status, and extraction confidence score.

For documents with line items, a formatted table shows the description, quantity, unit price, and amount for each item. If the document is linked to other documents (such as a PO linked to a quotation), the linking information is displayed with clickable links to view the related documents. The upload history shows who uploaded the document and when, along with any notes they added.

## Document Status Workflow

Understanding document statuses helps you track where each document is in the procurement workflow. The **UPLOADED** status indicates the document has been uploaded but AI extraction has not yet completed. **EXTRACTED** means AI extraction completed successfully and data is available for review. **PENDING_APPROVAL** indicates the document requires superadmin approval before proceeding (usually due to amount variances or as part of the PO generation workflow).

The **APPROVED** status shows the document has been approved by a superadmin and is ready for the next step. **LINKED** means the document is linked to another document (such as an invoice linked to a PO). **REJECTED** indicates a superadmin has rejected the document with a reason provided. **PAID** shows the invoice has been paid (managed through the finance module). **CANCELLED** means the document has been cancelled and is no longer active.

## Best Practices

### Document Naming

When uploading documents, use clear and consistent naming conventions. Include the supplier or customer name, document type, and date in the filename. For example: "ABC Suppliers - Quotation - 2024-01-15.pdf". This makes documents easier to find and manage.

### Document Quality

For best AI extraction results, ensure uploaded documents are clear and readable. Avoid scanned documents with poor image quality. Use PDF format when possible rather than images. Ensure text is not rotated or skewed. Check that all pages are included and in the correct order.

### Verification

Always verify AI-extracted data before proceeding with PO generation or linking. Check that amounts match your expectations, supplier names are correct, line items are complete and accurate, and payment terms are as agreed. While the AI is highly accurate, manual verification ensures complete accuracy.

### Approval Timeliness

Superadmins should review and process PO approval requests promptly to avoid delays in the procurement workflow. Set up notifications or check the approval dashboard daily. Provide clear rejection reasons to help requesters make necessary corrections.

### Documentation

Use the notes field when uploading documents to provide context. This helps other team members understand the purpose and background of each document. For example: "Quotation for Phase 2 electrical work" or "Revised quote after scope discussion on 2024-01-10".

## Troubleshooting

### AI Extraction Failed or Inaccurate

If AI extraction fails or produces inaccurate results, check the document quality and ensure it is a clear, readable PDF. Try re-uploading the document if the first attempt failed. Manually edit extracted data if it is partially correct. Contact support if extraction consistently fails for a particular document type.

### Cannot Generate PO from Quotation

If the Generate PO button is not available, verify the quotation status is "EXTRACTED" (not pending approval or already approved). Check that the quotation has not already been converted to a PO. Ensure the quotation has a supplier assigned. Refresh the page and try again.

### Invoice Linking Not Working

If you cannot link an invoice to a PO, ensure the invoice and PO have the same supplier. Verify the PO status is "APPROVED" (only approved POs can be linked). Check that the invoice is not already linked to another PO. Confirm you have the necessary permissions.

### PO Approval Request Not Appearing

If a PO request is not showing in the approval dashboard, verify you are logged in as a superadmin. Check that the request was successfully submitted (look for confirmation message). Refresh the approval dashboard page. Check the request status in the project's procurement document list.

### PDF Not Generated After Approval

If a PDF is not generated after PO approval, check the server logs for errors. Verify the NAS path is accessible and has write permissions. Ensure the pdfkit library is properly installed. Contact your system administrator if the issue persists.

## Getting Help

If you encounter issues not covered in this guide, contact your system administrator or the support team. When reporting issues, provide the document ID or name, a description of what you were trying to do, any error messages you received, and screenshots if applicable.

For questions about procurement policies or approval criteria, contact your project manager or finance team. For technical issues with the system, contact the IT support team.

## Appendix: Keyboard Shortcuts

The system supports several keyboard shortcuts to improve efficiency:

- **Ctrl + U**: Open upload dialog (when on procurement page)
- **Esc**: Close modal dialogs
- **Enter**: Submit forms (when focus is in a text field)
- **Tab**: Navigate between form fields

## Appendix: Document Type Reference

**Customer PO**: Purchase orders you receive from your clients authorizing work. These represent revenue and should be linked to client invoices.

**Supplier Quotation**: Price quotes you receive from suppliers. These can be converted into supplier POs once approved.

**Supplier Invoice**: Invoices you receive from suppliers requesting payment. Must be linked to supplier POs before payment.

**Supplier PO**: Purchase orders you issue to suppliers authorizing them to proceed with work. Generated from approved quotations.

**Client Invoice**: Invoices you issue to clients requesting payment. Should reference customer POs.

**Variation Order**: Documents authorizing changes to the original project scope. Require revised POs to be generated before payment.
