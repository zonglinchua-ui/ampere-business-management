
/**
 * Xero Payment Push Endpoint
 * Pushes local payments to Xero with enhanced error logging
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { XeroPaymentSyncEnhanced } from '@/lib/xero-payment-sync-enhanced'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * POST handler to push payments to Xero
 */
export async function POST(request: NextRequest) {
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
    const { 
      dryRun = false, 
      paymentIds = [],
      debugMode = false,
      singlePaymentId
    } = body

    console.log('📤 Pushing payments to Xero...', { 
      dryRun,
      debugMode,
      singlePaymentId,
      paymentCount: paymentIds.length,
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

    // Push payments to Xero
    const result = await syncService.pushPayments({
      dryRun,
      debugMode,
      paymentIds: paymentIds.length > 0 ? paymentIds : undefined,
      singlePaymentId
    })

    console.log('✅ Payment push complete:', result)

    return NextResponse.json(result)

  } catch (error: any) {
    console.error('❌ Payment push error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Payment push failed',
        message: error.message || 'An unexpected error occurred while pushing payments',
        errorDetails: [error.message]
      },
      { status: 500 }
    )
  }
}
