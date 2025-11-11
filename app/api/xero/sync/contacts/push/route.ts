

/**
 * Xero Contacts Push API Route
 * Push contacts from App to Xero (Phase D implementation)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { XeroSyncService } from '@/lib/xero-sync-service'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * POST /api/xero/sync/contacts/push
 * Pushes local clients and suppliers to Xero
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
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    // Parse request body
    const body = await request.json().catch(() => ({}))
    const options = {
      customerIds: body.customerIds || undefined,
      supplierIds: body.supplierIds || undefined,
      pushAll: body.pushAll === true,
      onlyUnsynced: body.onlyUnsynced !== false // Default to true
    }

    console.log('📤 Starting contacts push to Xero...', options)

    // Initialize and run sync
    const syncService = new XeroSyncService(user.id)
    const initialized = await syncService.initialize()

    if (!initialized) {
      return NextResponse.json(
        { success: false, error: 'Failed to initialize Xero connection' },
        { status: 500 }
      )
    }

    const result = await syncService.pushContacts(options)

    return NextResponse.json(result, { status: result.success ? 200 : 207 })

  } catch (error: any) {
    console.error('❌ Contacts push error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to push contacts',
        message: 'An unexpected error occurred during contact push'
      },
      { status: 500 }
    )
  }
}

