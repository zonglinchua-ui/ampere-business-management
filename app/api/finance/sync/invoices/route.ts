
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ImprovedXeroService } from '@/lib/xero-service-improved'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check user role - only Finance and SuperAdmin can sync
    const userRole = session.user.role
    if (!['SUPERADMIN', 'FINANCE', 'PROJECT_MANAGER'].includes(userRole)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const { invoiceId, bulkSync, type } = body // type: 'client' | 'vendor'

    // Get stored Xero tokens
    const tokens = await ImprovedXeroService.getStoredTokens()
    if (!tokens) {
      return NextResponse.json({ 
        error: 'Xero connection not found. Please connect to Xero first.' 
      }, { status: 400 })
    }

    const xeroService = new ImprovedXeroService(tokens, session.user.id)

    // Note: Individual invoice sync is not yet implemented in ImprovedXeroService
    // Use the bulk sync endpoint (/api/xero/enhanced-sync) instead
    return NextResponse.json({ 
      success: false,
      error: 'Individual invoice sync not yet implemented. Please use the bulk sync feature in the Xero Integration tab.',
      suggestion: 'Go to Finance → Xero Integration → Sync Manager to sync all invoices'
    }, { status: 501 })
  } catch (error: any) {
    console.error('Invoice sync error:', error)
    return NextResponse.json({ 
      error: error?.message || 'Internal server error' 
    }, { status: 500 })
  }
}

// GET endpoint to check sync status
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = session.user.role
    if (!['SUPERADMIN', 'FINANCE', 'PROJECT_MANAGER'].includes(userRole)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const invoiceId = searchParams.get('invoiceId')
    const type = searchParams.get('type') // 'client' | 'vendor'

    if (!invoiceId || !type) {
      return NextResponse.json({ error: 'invoiceId and type required' }, { status: 400 })
    }

    const { prisma } = await import('@/lib/db')

    let invoice: any
    if (type === 'client') {
      invoice = await prisma.customerInvoice.findUnique({
        where: { id: invoiceId },
        select: {
          id: true,
          invoiceNumber: true,
          xeroInvoiceId: true,
          isXeroSynced: true,
          lastXeroSync: true,
        }
      })
    } else if (type === 'vendor') {
      invoice = await prisma.supplierInvoice.findUnique({
        where: { id: invoiceId },
        select: {
          id: true,
          invoiceNumber: true,
          xeroInvoiceId: true,
          isXeroSynced: true,
          lastXeroSync: true,
        }
      })
    } else {
      return NextResponse.json({ error: 'Invalid invoice type' }, { status: 400 })
    }

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    return NextResponse.json({
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      isSynced: !!invoice.xeroInvoiceId,
      xeroInvoiceId: invoice.xeroInvoiceId,
      lastSyncDate: invoice.lastXeroSync,
      syncStatus: invoice.isXeroSynced ? 'synced' : 'not_synced',
      type
    })
  } catch (error: any) {
    console.error('Invoice sync status error:', error)
    return NextResponse.json({ 
      error: error?.message || 'Internal server error' 
    }, { status: 500 })
  }
}
