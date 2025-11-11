
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
    const { paymentId } = body

    if (!paymentId) {
      return NextResponse.json({ error: 'paymentId required' }, { status: 400 })
    }

    // Get stored Xero tokens
    const tokens = await ImprovedXeroService.getStoredTokens()
    if (!tokens) {
      return NextResponse.json({ 
        error: 'Xero connection not found. Please connect to Xero first.' 
      }, { status: 400 })
    }

    // Note: Individual payment sync is not yet implemented in ImprovedXeroService
    // Use the bulk sync endpoint (/api/xero/enhanced-sync) instead
    return NextResponse.json({ 
      success: false,
      error: 'Individual payment sync not yet implemented. Please use the bulk sync feature in the Xero Integration tab.',
      suggestion: 'Go to Finance → Xero Integration → Sync Manager to sync all payments'
    }, { status: 501 })
  } catch (error: any) {
    console.error('Payment sync error:', error)
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
    const paymentId = searchParams.get('paymentId')

    if (!paymentId) {
      return NextResponse.json({ error: 'paymentId required' }, { status: 400 })
    }

    const { prisma } = await import('@/lib/db')
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      select: {
        id: true,
        paymentNumber: true,
        xeroPaymentId: true,
        isXeroSynced: true,
        lastXeroSync: true,
      }
    })

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    return NextResponse.json({
      paymentId: payment.id,
      paymentNumber: payment.paymentNumber,
      isSynced: !!payment.xeroPaymentId,
      xeroPaymentId: payment.xeroPaymentId,
      lastSyncDate: payment.lastXeroSync,
      syncStatus: payment.isXeroSynced ? 'synced' : 'not_synced'
    })
  } catch (error: any) {
    console.error('Payment sync status error:', error)
    return NextResponse.json({ 
      error: error?.message || 'Internal server error' 
    }, { status: 500 })
  }
}
