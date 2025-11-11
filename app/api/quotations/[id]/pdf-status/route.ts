
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasActivePDF, getQuotationPDF } from '@/lib/quotation-pdf-utils'


export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if quotation exists
    const quotation = await prisma.quotation.findUnique({
      where: { id: params.id },
      select: { 
        id: true,
        quotationNumber: true,
        version: true,
        updatedAt: true
      }
    })

    if (!quotation) {
      return NextResponse.json({ error: 'Quotation not found' }, { status: 404 })
    }

    // Check PDF status
    const hasPDF = await hasActivePDF(params.id)
    const pdfInfo = hasPDF ? await getQuotationPDF(params.id) : null

    return NextResponse.json({
      quotationId: quotation.id,
      quotationNumber: quotation.quotationNumber,
      version: quotation.version,
      hasPDF: hasPDF,
      pdfInfo: pdfInfo ? {
        filename: pdfInfo.filename,
        generatedAt: pdfInfo.createdAt.toISOString()
      } : null,
      quotationUpdatedAt: quotation.updatedAt.toISOString()
    })

  } catch (error) {
    console.error('Error checking PDF status:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
