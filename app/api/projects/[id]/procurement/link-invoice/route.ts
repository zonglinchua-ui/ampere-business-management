import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectId = params.id;
    const body = await request.json();
    
    const { invoiceId, poId } = body;

    if (!invoiceId || !poId) {
      return NextResponse.json(
        { error: 'Invoice ID and PO ID are required' },
        { status: 400 }
      );
    }

    // Verify invoice exists and belongs to project
    const invoice = await prisma.procurementDocument.findFirst({
      where: {
        id: invoiceId,
        projectId,
        documentType: 'SUPPLIER_INVOICE',
      },
      include: {
        Supplier: true,
        LineItems: {
          orderBy: { lineNumber: 'asc' },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json(
        { error: 'Invoice not found or invalid' },
        { status: 404 }
      );
    }

    // Verify PO exists and belongs to same project and supplier
    const po = await prisma.procurementDocument.findFirst({
      where: {
        id: poId,
        projectId,
        documentType: 'SUPPLIER_PO',
        supplierId: invoice.supplierId,
      },
      include: {
        Supplier: true,
        LineItems: {
          orderBy: { lineNumber: 'asc' },
        },
      },
    });

    if (!po) {
      return NextResponse.json(
        { error: 'PO not found or does not match invoice supplier' },
        { status: 404 }
      );
    }

    // Check if invoice is already linked to a PO
    if (invoice.linkedPOId) {
      return NextResponse.json(
        { error: 'Invoice is already linked to a PO' },
        { status: 400 }
      );
    }

    // Perform 3-way matching validation
    const matchingResult = {
      amountMatch: false,
      amountVariance: 0,
      amountVariancePercentage: 0,
      supplierMatch: false,
      warnings: [] as string[],
    };

    // Check supplier match
    matchingResult.supplierMatch = invoice.supplierId === po.supplierId;
    if (!matchingResult.supplierMatch) {
      matchingResult.warnings.push('Supplier mismatch between invoice and PO');
    }

    // Check amount match (allow 5% variance)
    const invoiceAmount = invoice.totalAmount || 0;
    const poAmount = po.totalAmount || 0;
    matchingResult.amountVariance = Math.abs(invoiceAmount - poAmount);
    matchingResult.amountVariancePercentage = poAmount > 0 
      ? (matchingResult.amountVariance / poAmount) * 100 
      : 0;
    matchingResult.amountMatch = matchingResult.amountVariancePercentage <= 5;

    if (!matchingResult.amountMatch) {
      matchingResult.warnings.push(
        `Amount variance of ${matchingResult.amountVariancePercentage.toFixed(2)}% exceeds 5% threshold`
      );
    }

    // Link invoice to PO
    const updatedInvoice = await prisma.procurementDocument.update({
      where: { id: invoiceId },
      data: {
        linkedPOId: poId,
        status: matchingResult.warnings.length > 0 ? 'PENDING_APPROVAL' : 'LINKED',
        requiresApproval: matchingResult.warnings.length > 0,
      },
      include: {
        Supplier: true,
        LinkedPO: {
          select: {
            id: true,
            documentNumber: true,
            totalAmount: true,
            currency: true,
          },
        },
        LineItems: {
          orderBy: { lineNumber: 'asc' },
        },
      },
    });

    return NextResponse.json({
      success: true,
      invoice: updatedInvoice,
      matchingResult,
      message: matchingResult.warnings.length > 0
        ? 'Invoice linked to PO but requires approval due to matching issues'
        : 'Invoice successfully linked to PO',
    });
  } catch (error) {
    console.error('Error linking invoice to PO:', error);
    return NextResponse.json(
      { error: 'Failed to link invoice', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectId = params.id;
    const { searchParams } = new URL(request.url);
    const supplierId = searchParams.get('supplierId');

    // Fetch available POs for linking
    const where: any = {
      projectId,
      documentType: 'SUPPLIER_PO',
      status: 'APPROVED',
    };

    if (supplierId) {
      where.supplierId = supplierId;
    }

    const availablePOs = await prisma.procurementDocument.findMany({
      where,
      include: {
        Supplier: {
          select: {
            id: true,
            name: true,
            supplierNumber: true,
          },
        },
        LinkedInvoices: {
          select: {
            id: true,
            documentNumber: true,
            totalAmount: true,
          },
        },
      },
      orderBy: {
        documentDate: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      availablePOs,
    });
  } catch (error) {
    console.error('Error fetching available POs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch available POs' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const invoiceId = searchParams.get('invoiceId');

    if (!invoiceId) {
      return NextResponse.json({ error: 'Invoice ID is required' }, { status: 400 });
    }

    // Unlink invoice from PO
    await prisma.procurementDocument.update({
      where: { id: invoiceId },
      data: {
        linkedPOId: null,
        status: 'EXTRACTED',
        requiresApproval: false,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Invoice unlinked from PO',
    });
  } catch (error) {
    console.error('Error unlinking invoice:', error);
    return NextResponse.json(
      { error: 'Failed to unlink invoice' },
      { status: 500 }
    );
  }
}
