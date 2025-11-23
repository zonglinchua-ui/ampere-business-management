
/**
 * Xero Full Historical Sync Endpoint
 * Syncs ALL data from Xero since inception
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { XeroFullHistorySyncService } from '@/lib/xero-full-history-sync'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes for large syncs

/**
 * POST /api/xero/sync/full-history
 * Trigger full historical sync from Xero
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
      syncContacts = true, 
      syncInvoices = true, 
      syncPayments = true,
      forceRefresh = false
    } = body

    console.log('🚀 Starting full historical sync from Xero...', {
      user: user.email,
      syncContacts,
      syncInvoices,
      syncPayments,
      forceRefresh
    })

    // Initialize sync service
    const syncService = new XeroFullHistorySyncService(user.id)

    // Perform full historical sync
    const result = await syncService.syncFullHistory({
      syncContacts,
      syncInvoices,
      syncPayments,
      forceRefresh
    })

    return NextResponse.json(result)

  } catch (error: any) {
    console.error('❌ Full historical sync failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Full historical sync failed',
        message: error.message || 'An unexpected error occurred'
      },
      { status: 500 }
    )
  }
}
