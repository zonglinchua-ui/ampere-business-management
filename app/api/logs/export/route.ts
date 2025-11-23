
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic'

import {
  exportLogsAsCSV,
  exportLogsAsJSON,
  filterCriticalErrors,
  generateExportFilename,
} from '@/lib/export-service'
import { createSystemLog, getIpAddress } from '@/lib/logger'

/**
 * GET /api/logs/export
 * Export system logs (Super Admin only)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only Super Admins can export logs
    if (session.user.role !== 'SUPERADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Super Admin access required' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(req.url)
    
    // Parse export options
    const format = (searchParams.get('format') || 'csv') as 'csv' | 'json'
    const criticalOnly = searchParams.get('criticalOnly') === 'true'
    const includeArchived = searchParams.get('includeArchived') === 'true'
    
    // Parse filters (same as main logs endpoint)
    const type = searchParams.get('type') as 'ERROR' | 'ACTIVITY' | 'NOTIFICATION' | null
    const status = searchParams.get('status') as 'SUCCESS' | 'FAILED' | 'WARNING' | 'CRITICAL' | null
    const module = searchParams.get('module')
    const userId = searchParams.get('userId')
    const keyword = searchParams.get('keyword')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // Build where clause
    const where: any = {}

    if (!includeArchived) {
      where.archived = false
    }

    if (type) where.type = type
    if (status) where.status = status
    if (module) where.module = module
    if (userId) where.userId = userId

    if (keyword) {
      where.OR = [
        { message: { contains: keyword, mode: 'insensitive' } },
        { action: { contains: keyword, mode: 'insensitive' } },
        { errorCode: { contains: keyword, mode: 'insensitive' } },
        { username: { contains: keyword, mode: 'insensitive' } },
      ]
    }

    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) where.createdAt.gte = new Date(startDate)
      if (endDate) where.createdAt.lte = new Date(endDate)
    }

    // Fetch logs (no pagination for export)
    const logs = await prisma.system_logs.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    // Filter critical errors if requested
    const filteredLogs = criticalOnly ? filterCriticalErrors(logs as any) : (logs as any)

    // Export in requested format
    let content: string
    let contentType: string

    if (format === 'csv') {
      content = exportLogsAsCSV(filteredLogs)
      contentType = 'text/csv'
    } else {
      content = exportLogsAsJSON(filteredLogs)
      contentType = 'application/json'
    }

    // Generate filename
    const filename = generateExportFilename(format, type || undefined, criticalOnly)

    // Log this export action
    await createSystemLog({
      type: 'ACTIVITY',
      status: 'SUCCESS',
      userId: session.user.id,
      username: session.user.name || session.user.email || 'Unknown',
      role: session.user.role,
      action: 'EXPORT_LOGS',
      message: `Exported ${filteredLogs.length} log entries as ${format.toUpperCase()}${criticalOnly ? ' (critical only)' : ''}`,
      module: 'System Logs',
      ipAddress: getIpAddress(req) || undefined,
    })

    // Return file
    return new NextResponse(content, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error: any) {
    console.error('[API] Failed to export logs:', error)
    return NextResponse.json(
      { error: 'Failed to export logs', details: error.message },
      { status: 500 }
    )
  }
}
