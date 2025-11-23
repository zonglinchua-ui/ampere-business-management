import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

const ALLOWED_ROLES = ['SUPERADMIN', 'FINANCE', 'PROJECT_MANAGER', 'ADMIN']

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userRole = (session.user as any).role
  if (userRole && !ALLOWED_ROLES.includes(userRole)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const body = await request.json()
  const { logId, conflictId, resolution = 'manual', notes } = body || {}

  if (!logId && !conflictId) {
    return NextResponse.json({ error: 'logId or conflictId is required' }, { status: 400 })
  }

  try {
    if (logId) {
      const log = await prisma.xero_logs.findUnique({ where: { id: logId } })
      if (!log) {
        return NextResponse.json({ error: 'Sync log not found' }, { status: 404 })
      }

      if (log.status !== 'ERROR' && log.status !== 'WARNING') {
        return NextResponse.json({ error: 'Only failed or warning logs can be retried' }, { status: 400 })
      }

      const updatedLog = await prisma.xero_logs.update({
        where: { id: logId },
        data: {
          status: log.status,
          message: `${log.message}\nManual retry requested by ${(session.user as any).email || 'system'}`.trim(),
          updatedAt: new Date()
        }
      })

      return NextResponse.json({
        success: true,
        type: 'sync-log',
        log: updatedLog
      })
    }

    if (conflictId) {
      const conflict = await prisma.xero_sync_conflicts.findUnique({ where: { id: conflictId } })
      if (!conflict) {
        return NextResponse.json({ error: 'Conflict not found' }, { status: 404 })
      }

      const resolvedConflict = await prisma.xero_sync_conflicts.update({
        where: { id: conflictId },
        data: {
          status: 'RESOLVED',
          resolution,
          notes,
          resolvedById: (session.user as any).id,
          resolvedAt: new Date()
        }
      })

      return NextResponse.json({
        success: true,
        type: 'conflict',
        conflict: resolvedConflict
      })
    }

    return NextResponse.json({ error: 'Unsupported operation' }, { status: 400 })
  } catch (error) {
    console.error('Retry endpoint failed', error)
    return NextResponse.json(
      {
        error: 'Failed to process retry request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
