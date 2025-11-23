
/**
 * Xero Invoice Pull Endpoint
 * Pulls invoices from Xero to local database
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { XeroSyncService } from '@/lib/xero-sync-service'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * POST /api/xero/sync/invoices/pull
 * Pull invoices from Xero to local database
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
      modifiedSince, 
      includeArchived = false, 
      forceRefresh = false,
      invoiceIds 
    } = body

    console.log('📥 Starting invoice pull from Xero...', {
      user: user.email,
      modifiedSince,
      includeArchived,
      forceRefresh,
      invoiceIds: invoiceIds?.length || 0
    })

    // Initialize sync service
    const syncService = new XeroSyncService(user.id)
    const initialized = await syncService.initialize()

    if (!initialized) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Not connected to Xero',
          message: 'Please connect to Xero first'
        },
        { status: 400 }
      )
    }

    // Perform pull operation
    const result = await syncService.pullInvoices({
      modifiedSince: modifiedSince ? new Date(modifiedSince) : undefined,
      includeArchived,
      forceRefresh,
      invoiceIds
    })

    return NextResponse.json(result)

  } catch (error: any) {
    console.error('❌ Invoice pull failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Invoice pull failed',
        message: error.message || 'An unexpected error occurred'
      },
      { status: 500 }
    )
  }
}
