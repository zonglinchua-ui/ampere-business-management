import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

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
    const documentType = searchParams.get('documentType');
    const status = searchParams.get('status');

    // Build where clause
    const where: any = { projectId };
    
    if (documentType) {
      where.documentType = documentType;
    }
    
    if (status) {
      where.status = status;
    }

    // Fetch documents
    const documents = await prisma.procurementDocument.findMany({
      where,
      include: {
        Supplier: {
          select: {
            id: true,
            name: true,
            supplierNumber: true,
          },
        },
        Customer: {
          select: {
            id: true,
            name: true,
            customerNumber: true,
          },
        },
        UploadedBy: {
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
        LineItems: {
          orderBy: { lineNumber: 'asc' },
        },
        LinkedQuotation: {
          select: {
            id: true,
            documentNumber: true,
            documentType: true,
          },
        },
        LinkedPO: {
          select: {
            id: true,
            documentNumber: true,
            documentType: true,
          },
        },
        LinkedVO: {
          select: {
            id: true,
            documentNumber: true,
            documentType: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      documents,
    });
  } catch (error) {
    console.error('Error fetching procurement documents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
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
    const documentId = searchParams.get('documentId');

    if (!documentId) {
      return NextResponse.json({ error: 'Document ID is required' }, { status: 400 });
    }

    // Delete document (cascade will handle line items and approval history)
    await prisma.procurementDocument.delete({
      where: { id: documentId },
    });

    return NextResponse.json({
      success: true,
      message: 'Document deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting procurement document:', error);
    return NextResponse.json(
      { error: 'Failed to delete document' },
      { status: 500 }
    );
  }
}
