
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { XeroContactSyncService } from '@/lib/xero-contact-sync'
import { prisma } from '@/lib/db'

/**
 * POST /api/xero/sync/conflicts/[id]/resolve
 * Resolve a sync conflict
 * Body: { resolution: 'use_local' | 'use_remote' | 'manual', manualData?: any }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const body = await request.json()
    const { resolution, manualData } = body

    if (!['use_local', 'use_remote', 'manual'].includes(resolution)) {
      return NextResponse.json(
        { error: 'Invalid resolution type' },
        { status: 400 }
      )
    }

    // Find the conflict
    const conflict = await prisma.xero_sync_state.findUnique({
      where: { id: params.id }
    })

    if (!conflict) {
      return NextResponse.json(
        { error: 'Conflict not found' },
        { status: 404 }
      )
    }

    if (conflict.status !== 'CONFLICT') {
      return NextResponse.json(
        { error: 'This entity is not in conflict state' },
        { status: 400 }
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

    await syncService.resolveConflict(
      conflict.entityType,
      conflict.entityId,
      resolution,
      manualData
    )

    return NextResponse.json({
      success: true,
      message: `Conflict resolved using ${resolution} strategy`
    })

  } catch (error: any) {
    console.error('❌ Error resolving conflict:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to resolve conflict' },
      { status: 500 }
    )
  }
}
