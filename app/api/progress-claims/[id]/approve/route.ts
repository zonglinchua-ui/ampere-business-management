
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import { createAuditLog } from '@/lib/api-audit-context';
import { uploadFile } from '@/lib/s3';
import { Decimal } from '@prisma/client/runtime/library';
import { generateInvoiceNumber } from '@/lib/number-generation';
import { XeroInvoiceSyncEnhanced } from '@/lib/xero-invoice-sync-enhanced';
import { calculateProjectProgressFromItems } from '@/lib/project-progress-calculator';

// POST /api/progress-claims/[id]/approve - Approve claim
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const contentType = request.headers.get('content-type') || '';
    let approvalNotes = '';
    let customerApprovedAmount: number | null = null;
    let documentUrl: string | null = null;
    let documentName: string | null = null;

    // Handle FormData (with file upload)
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      approvalNotes = (formData.get('approvalNotes') as string) || '';
      const approvedAmountStr = formData.get('customerApprovedAmount') as string;
      if (approvedAmountStr) {
        customerApprovedAmount = parseFloat(approvedAmountStr);
      }

      const file = formData.get('approvedDocument') as File;
      if (file && file.size > 0) {
        const buffer = Buffer.from(await file.arrayBuffer());
        const timestamp = Date.now();
        const fileExtension = file.name.split('.').pop();
        const fileName = `progress-claims/${params.id}/approved-document-${timestamp}.${fileExtension}`;
        
        documentUrl = await uploadFile(buffer, fileName);
        documentName = file.name;
      }
    } else {
      // Handle JSON (backwards compatibility)
      const body = await request.json();
      approvalNotes = body.approvalNotes || '';
      if (body.customerApprovedAmount) {
        customerApprovedAmount = parseFloat(body.customerApprovedAmount);
      }
    }

    const claim = await prisma.progressClaim.findUnique({
      where: { id: params.id },
      include: {
        Project: {
          include: {
            Customer: true,
          },
        },
      },
    });

    if (!claim) {
      return NextResponse.json(
        { error: 'Progress claim not found' },
        { status: 404 }
      );
    }

    if (claim.status !== 'SUBMITTED') {
      return NextResponse.json(
        { error: 'Can only approve submitted claims' },
        { status: 400 }
      );
    }

    // Use customerApprovedAmount if provided, otherwise use currentClaimAmount
    const finalApprovedAmount = customerApprovedAmount !== null 
      ? new Decimal(customerApprovedAmount)
      : claim.currentClaimAmount;

    const updatedClaim = await prisma.progressClaim.update({
      where: { id: params.id },
      data: {
        status: 'APPROVED',
        approvedByClientAt: new Date(),
        approvedByClientUserId: session.user.id,
        approvalNotes: approvalNotes || null,
        customerApprovedAmount: finalApprovedAmount,
        customerApprovedDocumentUrl: documentUrl,
        customerApprovedDocumentName: documentName,
        updatedAt: new Date(),
      },
      include: {
        Project: {
          include: {
            Customer: true,
          },
        },
        items: true,
      },
    });

    // Automatically create draft invoice and sync to Xero
    let invoice = null;
    try {
      // Generate invoice number
      const invoiceNumber = await generateInvoiceNumber('CUSTOMER');

      // Create invoice items from claim items
      const invoiceItems = updatedClaim.items.map((item: any, index: any) => ({
        id: `ci_item_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`,
        description: `${item.description} (${item.currentClaimPct.toFixed(2)}% claimed)`,
        category: 'SERVICES' as const,
        quantity: item.currentClaimQty,
        unitPrice: item.unitRate,
        discount: 0,
        taxRate: 0,
        subtotal: item.currentClaimAmount,
        discountAmount: 0,
        taxAmount: 0,
        totalPrice: item.currentClaimAmount,
        unit: item.unit,
        notes: item.notes || `Progress Claim: ${updatedClaim.claimNumber}`,
        order: index,
        accountCode: '200',
        taxType: 'OUTPUT2',
      }));

      const subtotal = parseFloat(updatedClaim.netClaimAmount.toString());
      const retentionAmount = parseFloat(updatedClaim.retentionAmount?.toString() || '0');
      const taxAmount = 0; // Can be calculated based on tax rate
      const totalAmount = parseFloat(finalApprovedAmount.toString());

      // Create the customer invoice as DRAFT (not synced to Xero until manually approved)
      invoice = await prisma.customerInvoice.create({
        data: {
          id: `ci_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          invoiceNumber,
          projectId: updatedClaim.projectId,
          quotationId: updatedClaim.quotationId || null,
          customerId: updatedClaim.Project.customerId,
          subtotal,
          taxAmount,
          discountAmount: retentionAmount,
          totalAmount,
          amountDue: totalAmount,
          amountPaid: 0,
          currency: 'SGD',
          status: 'DRAFT',
          issueDate: new Date(),
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
          description: `Progress Claim ${updatedClaim.claimNumber}: ${updatedClaim.claimTitle}`,
          terms: null,
          notes: approvalNotes || `Converted from Progress Claim ${updatedClaim.claimNumber}`,
          isProgressClaimInvoice: true, // Flag this as a progress claim invoice
          createdById: session.user.id,
          createdAt: new Date(),
          updatedAt: new Date(),
          CustomerInvoiceItem: {
            create: invoiceItems,
          },
        },
        include: {
          Project: true,
          Customer: true,
          CustomerInvoiceItem: true,
        },
      });

      // Update progress claim with invoice reference
      await prisma.progressClaim.update({
        where: { id: params.id },
        data: {
          invoiceId: invoice.id,
          status: 'INVOICED',
          invoicedAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // NOTE: Progress claim invoices are NOT automatically synced to Xero
      // They must be manually reviewed and batch-synced by a superadmin from the Finance module
      // This allows for quality control before sending to Xero
      console.log(`✅ Created draft invoice ${invoiceNumber} for progress claim ${updatedClaim.claimNumber}`);
    } catch (invoiceError: any) {
      console.error('⚠️ Failed to create invoice:', invoiceError);
      // Don't fail the approval if invoice creation fails
      // User can manually convert to invoice later
    }

    // Automatically update project progress and status based on approved claims
    try {
      const progressUpdate = await calculateProjectProgressFromItems(updatedClaim.projectId);
      console.log(`✅ Project progress auto-updated: ${progressUpdate.progress}% (Status: ${progressUpdate.status})`);
    } catch (progressError) {
      console.error('⚠️ Failed to update project progress:', progressError);
      // Don't fail the approval if progress calculation fails
    }

    // Create audit log
    await createAuditLog({
      userId: session.user.id,
      userEmail: session.user.email || '',
      action: 'APPROVE',
      entityType: 'PROGRESS_CLAIM',
      entityId: updatedClaim.id,
      entityName: `${updatedClaim.claimNumber} - ${updatedClaim.claimTitle}`,
      oldValues: { status: claim.status },
      newValues: {
        status: 'INVOICED',
        approvalNotes,
        customerApprovedAmount: finalApprovedAmount.toString(),
        hasApprovedDocument: !!documentUrl,
        projectName: claim.Project.name,
        customerName: claim.Project.Customer.name,
        invoiceNumber: invoice?.invoiceNumber || 'N/A',
        invoiceCreated: !!invoice,
      },
    });

    return NextResponse.json({
      claim: updatedClaim,
      invoice: invoice,
      message: invoice 
        ? `Progress claim approved and draft invoice ${invoice.invoiceNumber} created successfully. Invoice is staged for review and will be synced to Xero by superadmin.`
        : 'Progress claim approved successfully.'
    });
  } catch (error) {
    console.error('Error approving progress claim:', error);
    return NextResponse.json(
      { error: 'Failed to approve progress claim' },
      { status: 500 }
    );
  }
}
