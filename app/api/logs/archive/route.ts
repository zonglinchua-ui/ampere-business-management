
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { archiveOldLogs, deleteArchivedLogs, getArchiveStats } from '@/lib/archive-service'
import { createSystemLog, getIpAddress } from '@/lib/logger'

/**
 * GET /api/logs/archive
 * Get archive statistics
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only Super Admins can view archive stats
    if (session.user.role !== 'SUPERADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Super Admin access required' },
        { status: 403 }
      )
    }

    const stats = await getArchiveStats()

    return NextResponse.json(stats)
  } catch (error: any) {
    console.error('[API] Failed to fetch archive stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch archive stats', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/logs/archive
 * Archive old logs or run cron job
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only Super Admins can archive logs
    if (session.user.role !== 'SUPERADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Super Admin access required' },
        { status: 403 }
      )
    }

    const { daysOld = 90, dryRun = false } = await req.json()

    // Archive logs
    const result = await archiveOldLogs({
      daysOld,
      dryRun,
    })

    // Log this action (only if not dry run)
    if (!dryRun) {
      await createSystemLog({
        type: 'ACTIVITY',
        status: 'SUCCESS',
        userId: session.user.id,
        username: session.user.name || session.user.email || 'Unknown',
        role: session.user.role,
        action: 'ARCHIVE_LOGS',
        message: `Archived ${result.archived} log entries older than ${daysOld} days`,
        module: 'System Logs',
        ipAddress: getIpAddress(req) || undefined,
      })
    }

    return NextResponse.json({
      message: dryRun 
        ? `Would archive ${result.archived} log entries`
        : `Successfully archived ${result.archived} log entries`,
      ...result,
    })
  } catch (error: any) {
    console.error('[API] Failed to archive logs:', error)
    return NextResponse.json(
      { error: 'Failed to archive logs', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/logs/archive
 * Permanently delete archived logs
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only Super Admins can delete archived logs
    if (session.user.role !== 'SUPERADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Super Admin access required' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(req.url)
    const daysOld = parseInt(searchParams.get('daysOld') || '180')

    // Delete archived logs
    const count = await deleteArchivedLogs(daysOld)

    // Log this action
    await createSystemLog({
      type: 'ACTIVITY',
      status: 'SUCCESS',
      userId: session.user.id,
      username: session.user.name || session.user.email || 'Unknown',
      role: session.user.role,
      action: 'DELETE_ARCHIVED_LOGS',
      message: `Permanently deleted ${count} archived log entries older than ${daysOld} days`,
      module: 'System Logs',
      ipAddress: getIpAddress(req) || undefined,
    })

    return NextResponse.json({
      message: `Successfully deleted ${count} archived log entries`,
      count,
    })
  } catch (error: any) {
    console.error('[API] Failed to delete archived logs:', error)
    return NextResponse.json(
      { error: 'Failed to delete archived logs', details: error.message },
      { status: 500 }
    )
  }
}
