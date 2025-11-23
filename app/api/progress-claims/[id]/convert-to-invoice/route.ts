
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import { generateInvoiceNumber } from '@/lib/number-generation';
import { createAuditLog } from '@/lib/api-audit-context';

// POST /api/progress-claims/[id]/convert-to-invoice - Convert approved claim to invoice
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { issueDate, dueDate, terms, notes } = body;

    const claim = await prisma.progressClaim.findUnique({
      where: { id: params.id },
      include: {
        Project: {
          include: {
            Customer: true,
          },
        },
        items: true,
      },
    });

    if (!claim) {
      return NextResponse.json(
        { error: 'Progress claim not found' },
        { status: 404 }
      );
    }

    if (claim.status !== 'APPROVED') {
      return NextResponse.json(
        { error: 'Can only convert approved claims to invoices' },
        { status: 400 }
      );
    }

    if (claim.invoiceId) {
      return NextResponse.json(
        { error: 'Claim has already been converted to invoice' },
        { status: 400 }
      );
    }

    // Generate invoice number
    const invoiceNumber = await generateInvoiceNumber('CUSTOMER');

    // Create invoice items from claim items
    const invoiceItems = claim.items.map((item: any, index: any) => ({
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
      notes: item.notes || `Progress Claim: ${claim.claimNumber}`,
      order: index,
      accountCode: '200',
      taxType: 'OUTPUT2',
    }));

    const subtotal = parseFloat(claim.netClaimAmount.toString());
    const taxAmount = 0; // Can be calculated based on tax rate
    const totalAmount = subtotal + taxAmount;

    // Create the customer invoice
    const invoice = await prisma.customerInvoice.create({
      data: {
        id: `ci_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        invoiceNumber,
        projectId: claim.projectId,
        quotationId: claim.quotationId || null,
        customerId: claim.Project.customerId,
        subtotal,
        taxAmount,
        discountAmount: parseFloat(claim.retentionAmount?.toString() || '0'),
        totalAmount,
        amountDue: totalAmount,
        amountPaid: 0,
        currency: 'SGD',
        status: 'DRAFT',
        issueDate: issueDate ? new Date(issueDate) : new Date(),
        dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        description: `Progress Claim ${claim.claimNumber}: ${claim.claimTitle}`,
        terms: terms || null,
        notes: notes || `Converted from Progress Claim ${claim.claimNumber}`,
        createdById: session.user.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      include: {
        Project: true,
        Customer: true,
      },
    });

    // Update progress claim with invoice reference
    await prisma.progressClaim.update({
      where: { id: params.id },
      data: {
        status: 'INVOICED',
        invoiceId: invoice.id,
        invoicedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Create audit log
    await createAuditLog({
      userId: session.user.id,
      userEmail: session.user.email || '',
      action: 'COMPLETE',
      entityType: 'PROGRESS_CLAIM',
      entityId: claim.id,
      entityName: `${claim.claimNumber} - ${claim.claimTitle}`,
      oldValues: { status: claim.status },
      newValues: {
        status: 'INVOICED',
        invoiceNumber,
        totalAmount,
        projectName: claim.Project.name,
        customerName: claim.Project.Customer.name,
      },
    });

    return NextResponse.json(invoice, { status: 201 });
  } catch (error) {
    console.error('Error converting progress claim to invoice:', error);
    return NextResponse.json(
      { error: 'Failed to convert progress claim to invoice' },
      { status: 500 }
    );
  }
}
