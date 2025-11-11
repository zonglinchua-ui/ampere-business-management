
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic'

/**
 * GET /api/logs/stats
 * Get statistics about system logs (Super Admin only)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only Super Admins can view log stats
    if (session.user.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Forbidden: Super Admin access required' }, { status: 403 })
    }

    const now = new Date()
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    // Get counts by type and status
    const [
      totalLogs,
      errorLogs,
      activityLogs,
      criticalLogs,
      unviewedLogs,
      last24hLogs,
      last7dLogs,
      logsByModule,
      logsByStatus,
    ] = await Promise.all([
      prisma.system_logs.count(),
      prisma.system_logs.count({ where: { type: 'ERROR' } }),
      prisma.system_logs.count({ where: { type: 'ACTIVITY' } }),
      prisma.system_logs.count({ where: { status: 'CRITICAL' } }),
      prisma.system_logs.count({ where: { viewed: false } }),
      prisma.system_logs.count({ where: { createdAt: { gte: last24h } } }),
      prisma.system_logs.count({ where: { createdAt: { gte: last7d } } }),
      prisma.system_logs.groupBy({
        by: ['module'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
      prisma.system_logs.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
    ])

    return NextResponse.json({
      overview: {
        total: totalLogs,
        errors: errorLogs,
        activities: activityLogs,
        critical: criticalLogs,
        unviewed: unviewedLogs,
        last24h: last24hLogs,
        last7d: last7dLogs,
      },
      byModule: logsByModule.map(item => ({
        module: item.module,
        count: item._count.id,
      })),
      byStatus: logsByStatus.map(item => ({
        status: item.status,
        count: item._count.id,
      })),
    })
  } catch (error: any) {
    console.error('[API] Failed to fetch log stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch log stats', details: error.message },
      { status: 500 }
    )
  }
}

