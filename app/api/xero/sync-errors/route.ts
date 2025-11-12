import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getRecentSyncErrors, getSyncErrorStats, resolveSyncError } from '@/lib/xero-sync-error-logger'

// GET /api/xero/sync-errors - Get sync errors with optional filters
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '100')
    const status = searchParams.get('status') // 'FAILED', 'SKIPPED', or null for all
    const syncType = searchParams.get('syncType') // 'CONTACT', 'INVOICE', etc.
    const resolved = searchParams.get('resolved') === 'true'

    const where: any = {}

    if (status) {
      where.status = status
    } else {
      where.status = { in: ['FAILED', 'SKIPPED'] }
    }

    if (syncType) {
      where.syncType = syncType
    }

    if (resolved) {
      where.resolvedAt = { not: null }
    } else {
      where.resolvedAt = null
    }

    const [errors, stats] = await Promise.all([
      prisma.xeroSyncLog.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
      }),
      getSyncErrorStats(),
    ])

    return NextResponse.json({
      errors,
      stats,
      total: errors.length,
    })
  } catch (error) {
    console.error('[Xero Sync Errors API] Error fetching sync errors:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sync errors' },
      { status: 500 }
    )
  }
}

// POST /api/xero/sync-errors - Resolve a sync error
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { logId, notes } = body

    if (!logId) {
      return NextResponse.json(
        { error: 'logId is required' },
        { status: 400 }
      )
    }

    await resolveSyncError(logId, session.user.email || session.user.id, notes)

    return NextResponse.json({
      success: true,
      message: 'Sync error marked as resolved',
    })
  } catch (error) {
    console.error('[Xero Sync Errors API] Error resolving sync error:', error)
    return NextResponse.json(
      { error: 'Failed to resolve sync error' },
      { status: 500 }
    )
  }
}

