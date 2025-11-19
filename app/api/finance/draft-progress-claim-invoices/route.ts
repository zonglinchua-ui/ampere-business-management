
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// GET /api/finance/draft-progress-claim-invoices
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only SUPERADMIN, FINANCE, and PROJECT_MANAGER can access
    const allowedRoles = ['SUPERADMIN', 'FINANCE', 'PROJECT_MANAGER']
    if (!allowedRoles.includes(session.user?.role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Fetch all draft invoices created from progress claims that haven't been synced to Xero
    const invoices = await prisma.customerInvoice.findMany({
      where: {
        isProgressClaimInvoice: true,
        status: 'DRAFT',
        isXeroSynced: false,
      },
      include: {
        Customer: {
          select: {
            id: true,
            name: true,
            email: true,
            customerNumber: true,
          },
        },
        Project: {
          select: {
            id: true,
            name: true,
            projectNumber: true,
          },
        },
        CustomerInvoiceItem: {
          orderBy: {
            order: 'asc'
          }
        },
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Calculate totals
    const totalAmount = invoices.reduce((sum: any, inv: any) => sum + parseFloat(inv.totalAmount.toString()), 0)
    const totalInvoices = invoices.length

    return NextResponse.json({
      success: true,
      invoices: invoices.map((inv: any) => ({
        ...inv,
        items: inv.CustomerInvoiceItem || []
      })),
      summary: {
        totalInvoices,
        totalAmount,
        currency: 'SGD'
      }
    })
  } catch (error: any) {
    console.error('GET /api/finance/draft-progress-claim-invoices error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'
