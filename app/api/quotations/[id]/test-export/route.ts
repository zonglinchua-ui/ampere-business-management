
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'


export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Disable in production for security
  if (process.env.NODE_ENV === 'production' || process.env.DEPLOYMENT_MODE === 'production') {
    return NextResponse.json(
      { error: 'Test endpoints disabled in production' },
      { status: 403 }
    )
  }

  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission (only SUPERADMIN, ADMIN, PROJECT_MANAGER)
    const userRole = session.user?.role
    if (!["SUPERADMIN", "ADMIN", "PROJECT_MANAGER"].includes(userRole || "")) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Test if quotation exists
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

    // Return quotation data for testing
    const result = {
      success: true,
      message: 'PDF export test endpoint working',
      quotation: {
        id: quotation.id,
        quotationNumber: quotation.quotationNumber,
        title: quotation.title,
        clientName: quotation.Customer?.name,
        projectName: quotation.Tender?.title,
        status: quotation.status,
        itemsCount: quotation.QuotationItem.length,
        totalAmount: quotation.totalAmount
      },
      exportUrl: `/api/quotations/${params.id}/download-pdf`,
      timestamp: new Date().toISOString()
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('Error in test export endpoint:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
