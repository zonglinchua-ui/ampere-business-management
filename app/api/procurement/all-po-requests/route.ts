import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is superadmin
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Only superadmins can view all PO requests' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    // Build where clause
    const where: any = {};
    
    if (status) {
      where.status = status;
    }

    // Fetch all PO requests across all projects
    const poRequests = await prisma.procurementPORequest.findMany({
      where,
      include: {
        Quotation: {
          include: {
            Supplier: true,
            LineItems: {
              orderBy: { lineNumber: 'asc' },
            },
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
    console.error('Error fetching all PO requests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch PO requests' },
      { status: 500 }
    );
  }
}



