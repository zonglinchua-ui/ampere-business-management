
/**
 * Xero Payment Debug Endpoint
 * Tests a single payment sync and returns detailed error information
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { XeroPaymentSyncEnhanced } from '@/lib/xero-payment-sync-enhanced'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * POST handler to debug a single payment
 */
export async function POST(request: NextRequest) {
  // Disable in production for security
  if (process.env.NODE_ENV === 'production' || process.env.DEPLOYMENT_MODE === 'production') {
    return NextResponse.json(
      { error: 'Debug endpoints disabled in production' },
      { status: 403 }
    )
  }

  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const user = session.user as any
    const userRole = user?.role || 'UNKNOWN'
    const allowedRoles = ['SUPERADMIN', 'FINANCE', 'PROJECT_MANAGER']
    
    if (!allowedRoles.includes(userRole)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Insufficient permissions',
          message: `You need Super Admin, Finance, or Project Manager role. Your current role: ${userRole}`
        },
        { status: 403 }
      )
    }

    // Parse request body
    const body = await request.json().catch(() => ({}))
    const { paymentId } = body

    if (!paymentId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Payment ID required',
          message: 'Please provide a paymentId to debug'
        },
        { status: 400 }
      )
    }

    console.log('🔍 Debugging single payment:', { 
      paymentId,
      userEmail: user.email 
    })

    // Initialize sync service
    const syncService = new XeroPaymentSyncEnhanced(user.id)
    const initialized = await syncService.initialize()

    if (!initialized) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to initialize Xero connection',
          message: 'Unable to connect to Xero. Please check your integration settings.'
        },
        { status: 500 }
      )
    }

    // Debug single payment
    const result = await syncService.syncSinglePayment(paymentId)

    console.log('✅ Payment debug complete:', result)

    return NextResponse.json(result)

  } catch (error: any) {
    console.error('❌ Payment debug error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Payment debug failed',
        message: error.message || 'An unexpected error occurred while debugging payment',
        errorDetails: [error.message]
      },
      { status: 500 }
    )
  }
}
