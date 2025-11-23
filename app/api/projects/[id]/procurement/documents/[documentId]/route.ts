import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; documentId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { documentId } = params;
    
    // Fetch document with related data
    const document = await prisma.procurementDocument.findUnique({
      where: { id: documentId },
      include: {
        Supplier: {
          select: { id: true, name: true }
        },
        Customer: {
          select: { id: true, name: true }
        },
        UploadedBy: {
          select: { id: true, name: true, email: true }
        },
        LineItems: {
          select: {
            id: true,
            description: true,
            quantity: true,
            unitPrice: true,
            amount: true,
          }
        },
        LinkedQuotation: {
          select: { id: true, documentNumber: true }
        },
        LinkedPO: {
          select: { id: true, documentNumber: true }
        },
        LinkedVO: {
          select: { id: true, documentNumber: true }
        }
      }
    });
    
    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }
    
    return NextResponse.json({
      success: true,
      document: document
    });
    
  } catch (error) {
    console.error('Error fetching document:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch document', 
        details: (error as Error).message 
      },
      { status: 500 }
    );
  }
}
