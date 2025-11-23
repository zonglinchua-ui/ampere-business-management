
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { XeroSyncService } from '@/lib/xero-sync-service'

/**
 * GET /api/xero/sync/contacts
 * Pull contacts from Xero with optional filters
 * Query params:
 *  - forceRefresh: boolean (default: false)
 *  - modifiedSince: ISO date string
 *  - includeArchived: boolean (default: false)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check role
    const userRole = (session.user as any).role
    if (!['SUPERADMIN', 'FINANCE'].includes(userRole)) {
      return NextResponse.json(
        { error: 'Insufficient permissions. Only SUPERADMIN and FINANCE can sync with Xero.' },
        { status: 403 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const forceRefresh = searchParams.get('forceRefresh') === 'true'
    const modifiedSinceStr = searchParams.get('modifiedSince')
    const includeArchived = searchParams.get('includeArchived') === 'true'

    const options: any = {
      forceRefresh,
      includeArchived
    }

    if (modifiedSinceStr) {
      options.modifiedSince = new Date(modifiedSinceStr)
    }

    const syncService = new XeroSyncService(session.user.id)
    const initialized = await syncService.initialize()

    if (!initialized) {
      return NextResponse.json(
        { error: 'Failed to initialize Xero connection. Please reconnect to Xero.' },
        { status: 503 }
      )
    }

    const result = await syncService.pullContacts(options)

    return NextResponse.json(result)

  } catch (error: any) {
    console.error('❌ Xero contact sync error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to sync contacts from Xero' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/xero/sync/contacts
 * Push local contacts to Xero
 * Body: { 
 *   customerIds?: string[], 
 *   supplierIds?: string[],
 *   pushAll?: boolean,
 *   onlyUnsynced?: boolean
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check role
    const userRole = (session.user as any).role
    if (!['SUPERADMIN', 'FINANCE'].includes(userRole)) {
      return NextResponse.json(
        { error: 'Insufficient permissions. Only SUPERADMIN and FINANCE can sync with Xero.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { customerIds, supplierIds, pushAll = false, onlyUnsynced = false } = body

    const syncService = new XeroSyncService(session.user.id)
    const initialized = await syncService.initialize()

    if (!initialized) {
      return NextResponse.json(
        { error: 'Failed to initialize Xero connection. Please reconnect to Xero.' },
        { status: 503 }
      )
    }

    const result = await syncService.pushContacts({
      customerIds,
      supplierIds,
      pushAll,
      onlyUnsynced
    })

    return NextResponse.json(result)

  } catch (error: any) {
    console.error('❌ Xero contact push error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to push contacts to Xero' },
      { status: 500 }
    )
  }
}
