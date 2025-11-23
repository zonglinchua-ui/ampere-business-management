import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

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
    
    const {
      quotationId,
      supplierId,
      poNumber,
      poDate,
      deliveryDate,
      deliveryAddress,
      totalAmount,
      taxAmount,
      paymentTerms,
      customPaymentTerms,
      termsAndConditions,
    } = body;

    // Validate required fields
    if (!quotationId || !supplierId || !poNumber || !poDate || !totalAmount || !paymentTerms) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Verify quotation exists and belongs to project
    const quotation = await prisma.procurementDocument.findFirst({
      where: {
        id: quotationId,
        projectId,
        documentType: 'SUPPLIER_QUOTATION',
      },
      include: {
        Supplier: true,
        LineItems: true,
      },
    });

    if (!quotation) {
      return NextResponse.json(
        { error: 'Quotation not found or invalid' },
        { status: 404 }
      );
    }

    // Check if PO request already exists for this quotation
    const existingRequest = await prisma.procurementPORequest.findFirst({
      where: {
        quotationId,
        status: {
          in: ['PENDING', 'APPROVED'],
        },
      },
    });

    if (existingRequest) {
      return NextResponse.json(
        { error: 'A PO request already exists for this quotation' },
        { status: 400 }
      );
    }

    // Create PO generation request
    const poRequest = await prisma.procurementPORequest.create({
      data: {
        quotationId,
        projectId,
        supplierId,
        poNumber,
        poDate: new Date(poDate),
        deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
        deliveryAddress,
        totalAmount,
        taxAmount: taxAmount || null,
        currency: quotation.currency || 'SGD',
        paymentTerms: paymentTerms as any,
        customPaymentTerms: paymentTerms === 'CUSTOM' ? customPaymentTerms : null,
        termsAndConditions,
        status: 'PENDING',
        requestedById: session.user.id,
      },
      include: {
        Quotation: {
          include: {
            Supplier: true,
            LineItems: true,
          },
        },
        Project: {
          select: {
            id: true,
            name: true,
            projectNumber: true,
          },
        },
        Supplier: {
          select: {
            id: true,
            name: true,
            supplierNumber: true,
          },
        },
        RequestedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Create approval history entry
    await prisma.procurementApprovalHistory.create({
      data: {
        poRequestId: poRequest.id,
        action: 'PENDING',
        comments: 'PO generation requested',
        approvedById: session.user.id,
      },
    });

    // Update quotation status to pending approval
    await prisma.procurementDocument.update({
      where: { id: quotationId },
      data: {
        status: 'PENDING_APPROVAL',
        requiresApproval: true,
      },
    });

    return NextResponse.json({
      success: true,
      poRequest,
      message: 'PO generation request created successfully. Awaiting superadmin approval.',
    });
  } catch (error) {
    console.error('Error creating PO request:', error);
    return NextResponse.json(
      { error: 'Failed to create PO request', details: error instanceof Error ? error.message : 'Unknown error' },
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
    const status = searchParams.get('status');

    // Build where clause
    const where: any = { projectId };
    
    if (status) {
      where.status = status;
    }

    // Fetch PO requests
    const poRequests = await prisma.procurementPORequest.findMany({
      where,
      include: {
        Quotation: {
          include: {
            Supplier: true,
            LineItems: true,
          },
        },
        Project: {
          select: {
            id: true,
            name: true,
            projectNumber: true,
          },
        },
        Supplier: {
          select: {
            id: true,
            name: true,
            supplierNumber: true,
          },
        },
        RequestedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        ApprovedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        GeneratedPO: {
          select: {
            id: true,
            documentNumber: true,
            fileName: true,
            status: true,
          },
        },
        ApprovalHistory: {
          orderBy: {
            approvedAt: 'desc',
          },
          include: {
            ApprovedBy: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      poRequests,
    });
  } catch (error) {
    console.error('Error fetching PO requests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch PO requests' },
      { status: 500 }
    );
  }
}
