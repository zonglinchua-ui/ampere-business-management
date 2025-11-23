
import { NextRequest, NextResponse } from 'next/server'
import { archiveOldLogs } from '@/lib/archive-service'
import { createSystemLog } from '@/lib/logger'

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/archive
 * Cron job to automatically archive old logs
 * 
 * This should be called daily by a cron service
 */
export async function GET(req: NextRequest) {
  try {
    // Verify cron secret (optional security measure)
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()

    // Archive logs older than 90 days (excluding critical errors)
    const result = await archiveOldLogs({
      daysOld: 90,
      excludeStatuses: ['CRITICAL'],
      dryRun: false,
    })

    // Log this automated action
    await createSystemLog({
      type: 'ACTIVITY',
      status: 'SUCCESS',
      action: 'AUTO_ARCHIVE_LOGS',
      message: `Automated archive: ${result.archived} log entries archived`,
      module: 'System Logs',
    })

    console.log(`[Cron] Archived ${result.archived} logs`)

    return NextResponse.json({
      message: 'Archive cron job completed',
      timestamp: now.toISOString(),
      archived: result.archived,
    })
  } catch (error: any) {
    console.error('[Cron] Archive job failed:', error)

    // Log the failure
    await createSystemLog({
      type: 'ERROR',
      status: 'FAILED',
      action: 'AUTO_ARCHIVE_LOGS',
      message: `Automated archive failed: ${error.message}`,
      module: 'System Logs',
      errorCode: 'ARCHIVE_CRON_ERROR',
    })

    return NextResponse.json(
      { error: 'Archive cron job failed', details: error.message },
      { status: 500 }
    )
  }
}
