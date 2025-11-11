
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { v4 as uuidv4 } from 'uuid'
import { generateQuotationHTML } from '@/lib/document-templates'


export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch quotation with all related data
    const quotation = await prisma.quotation.findUnique({
      where: { id: params.id },
      include: {
        Customer: true,
        Tender: true,
        User_Quotation_salespersonIdToUser: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        },
        QuotationItem: {
          orderBy: {
            order: 'asc'
          }
        }
      }
    })

    if (!quotation) {
      return NextResponse.json({ error: 'Quotation not found' }, { status: 404 })
    }

    // Log export activity
    await prisma.quotationActivity.create({
      data: {
        id: uuidv4(),
        quotationId: params.id,
        action: 'EXPORTED',
        description: `Quotation exported to PDF by ${session.user?.firstName} ${session.user?.lastName}`,
        userId: session.user?.id || '',
        userEmail: session.user?.email || ''
      }
    })

    // Generate professional HTML document with letterhead
    // This can be converted to PDF using browser print or headless browser tools
    const htmlContent = generateQuotationHTML(quotation)
    
    return new NextResponse(htmlContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/html',
        'Content-Disposition': `inline; filename="${quotation.quotationNumber}.html"`,
      },
    })

  } catch (error) {
    console.error('Error exporting quotation:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
