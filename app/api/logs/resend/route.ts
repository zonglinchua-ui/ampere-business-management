
/**
 * Resend Failed Logs API
 * 
 * Allows Super Admins to manually resend failed log notifications
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { notifySuperAdmins } from '@/lib/push-notifications'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only Super Admins can resend logs
    if (session.user.role !== 'SUPERADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Super Admin access required' },
        { status: 403 }
      )
    }

    // Get all unviewed critical/failed logs
    const failedLogs = await prisma.system_logs.findMany({
      where: {
        viewed: false,
        OR: [
          { status: 'CRITICAL' },
          { status: 'FAILED', type: 'ERROR' },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 50, // Limit to prevent spam
    })

    if (failedLogs.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No failed logs to resend',
        count: 0,
      })
    }

    // Group logs by module
    const logsByModule = failedLogs.reduce((acc: any, log: any) => {
      if (!acc[log.module]) {
        acc[log.module] = []
      }
      acc[log.module].push(log)
      return acc
    }, {} as Record<string, typeof failedLogs>)

    // Send grouped notifications
    let successCount = 0
    for (const [module, logs] of Object.entries(logsByModule)) {
      try {
        await notifySuperAdmins({
          title: `📨 ${logs.length} ${module} Error${logs.length > 1 ? 's' : ''} Resent`,
          message: `Recent errors:\n${logs.slice(0, 3).map((l) => `• ${l.action}: ${l.message.slice(0, 100)}`).join('\n')}`,
          link: '/settings/system-logs',
          severity: logs.some((l: any) => l.status === 'CRITICAL') ? 'critical' : 'error',
        })

        successCount += logs.length
      } catch (err) {
        console.error(`[Resend Logs] Failed to resend logs for ${module}:`, err)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully resent ${successCount} log notifications`,
      count: successCount,
      byModule: Object.entries(logsByModule).map(([module, logs]) => ({
        module,
        count: logs.length,
      })),
    })
  } catch (error: any) {
    console.error('[API] Failed to resend logs:', error)
    return NextResponse.json(
      { error: 'Failed to resend logs', details: error.message },
      { status: 500 }
    )
  }
}
