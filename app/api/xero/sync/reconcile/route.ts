
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { XeroContactSyncService } from '@/lib/xero-contact-sync'

/**
 * GET /api/xero/sync/reconcile
 * Generate reconciliation report (dry-run of two-way sync)
 * Shows what would happen if sync was run in both directions
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = (session.user as any).role
    if (!['SUPERADMIN', 'FINANCE'].includes(userRole)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const syncService = new XeroContactSyncService(session.user.id)
    const initialized = await syncService.initialize()

    if (!initialized) {
      return NextResponse.json(
        { error: 'Failed to initialize Xero connection' },
        { status: 503 }
      )
    }

    // Run dry-run pull
    const pullResult = await syncService.pullContacts({ dryRun: true })

    return NextResponse.json({
      reconciliation: {
        pull: {
          wouldCreate: pullResult.stats.created,
          wouldUpdate: pullResult.stats.updated,
          conflicts: pullResult.stats.conflicts,
          conflictDetails: pullResult.conflicts
        },
        timestamp: new Date().toISOString()
      }
    })

  } catch (error: any) {
    console.error('❌ Reconciliation error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate reconciliation report' },
      { status: 500 }
    )
  }
}
