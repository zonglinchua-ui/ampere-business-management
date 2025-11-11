
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { XeroLogger, XeroSyncDirection, XeroSyncStatus, XeroSyncEntity } from '@/lib/xero-logger'
import { v4 as uuidv4 } from 'uuid'

// In-memory cache for dashboard summary data
interface CachedDashboardData {
  data: any
  timestamp: number
  expires: number
  cacheKey: string
}

let dashboardCache: Map<string, CachedDashboardData> = new Map()
const SUMMARY_CACHE_TTL = 60 * 1000 // 1 minute cache for summary
const DETAILS_CACHE_TTL = 30 * 1000 // 30 seconds cache for details

// Clean up old cache entries periodically
setInterval(() => {
  const now = Date.now()
  for (const [key, value] of dashboardCache.entries()) {
    if (now > value.expires) {
      dashboardCache.delete(key)
    }
  }
}, 2 * 60 * 1000) // Clean every 2 minutes

/**
 * GET /api/xero/sync-dashboard
 * Unified endpoint for Xero sync dashboard combining logs, conflicts, and summary stats
 * Now with intelligent caching and optimized queries
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission
    const userRole = (session.user as any).role
    const hasPermission = ['SUPERADMIN', 'FINANCE', 'PROJECT_MANAGER'].includes(userRole)

    if (!hasPermission) {
      return NextResponse.json({ 
        error: 'Insufficient permissions',
        message: `You need Super Admin, Finance, or Project Manager role to view sync dashboard. Your current role: ${userRole}` 
      }, { status: 403 })
    }

    const url = new URL(request.url)
    
    // Query params for filtering
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '50')
    const status = url.searchParams.get('status') as XeroSyncStatus | undefined
    const entity = url.searchParams.get('entity') as XeroSyncEntity | undefined
    const direction = url.searchParams.get('direction') as XeroSyncDirection | undefined
    const dateFrom = url.searchParams.get('dateFrom')
    const dateTo = url.searchParams.get('dateTo')
    const searchQuery = url.searchParams.get('search')
    const viewMode = url.searchParams.get('view') || 'all' // all, conflicts, errors
    const summaryOnly = url.searchParams.get('summaryOnly') === 'true' // New param for lazy loading

    // Create cache key based on filters
    const cacheKey = `${viewMode}-${status}-${entity}-${direction}-${dateFrom}-${dateTo}-${searchQuery}-${page}-${summaryOnly}`
    
    // Check cache first (only for non-filtered summary requests)
    const now = Date.now()
    const cached = dashboardCache.get(cacheKey)
    if (cached && now < cached.expires) {
      const duration = now - startTime
      console.log(`[Sync Dashboard] Cache HIT (${duration}ms) - age: ${now - cached.timestamp}ms`)
      
      const headers = new Headers()
      headers.set('X-Cache', 'HIT')
      headers.set('X-Cache-Age', String(now - cached.timestamp))
      headers.set('X-Response-Time', `${duration}ms`)
      
      return NextResponse.json(cached.data, { headers })
    }

    // Build where clause for XeroLog
    const whereClause: any = {}
    
    if (status) whereClause.status = status
    if (entity) whereClause.entity = entity
    if (direction) whereClause.direction = direction
    if (dateFrom || dateTo) {
      whereClause.timestamp = {}
      if (dateFrom) whereClause.timestamp.gte = new Date(dateFrom)
      if (dateTo) whereClause.timestamp.lte = new Date(dateTo)
    }
    
    // Filter by view mode
    if (viewMode === 'conflicts') {
      whereClause.status = 'ERROR'
      whereClause.xero_sync_conflicts = { some: {} }
    } else if (viewMode === 'errors') {
      whereClause.status = 'ERROR'
    }

    // OPTIMIZATION: Get summary statistics with optimized queries
    const [
      totalLogs,
      statusCounts,
      pendingConflictsCount,
      lastSync
    ] = await Promise.all([
      prisma.xero_logs.count({ where: whereClause }),
      // Single groupBy query instead of 4 separate count queries
      prisma.xero_logs.groupBy({
        by: ['status'],
        where: whereClause,
        _count: { id: true }
      }),
      prisma.xero_sync_conflicts.count({ where: { status: 'PENDING' } }),
      prisma.xero_logs.findFirst({
        where: whereClause,
        orderBy: { timestamp: 'desc' },
        select: { timestamp: true, status: true }
      })
    ])

    // Extract counts from grouped results
    const successCount = statusCounts.find(s => s.status === 'SUCCESS')?._count.id || 0
    const errorCount = statusCounts.find(s => s.status === 'ERROR')?._count.id || 0
    const warningCount = statusCounts.find(s => s.status === 'WARNING')?._count.id || 0
    const inProgressCount = statusCounts.find(s => s.status === 'IN_PROGRESS')?._count.id || 0

    // Calculate summary statistics
    const summary = {
      total: totalLogs,
      success: successCount,
      error: errorCount,
      warning: warningCount,
      inProgress: inProgressCount,
      pendingConflicts: pendingConflictsCount,
      skipped: 0,
      lastSync: lastSync ? {
        timestamp: lastSync.timestamp,
        status: lastSync.status
      } : null,
      successRate: totalLogs > 0 ? ((successCount / totalLogs) * 100).toFixed(1) : '0'
    }

    // Get statistics by entity type (lightweight query)
    const entityStats = await prisma.xero_logs.groupBy({
      by: ['entity', 'status'],
      where: whereClause,
      _count: { id: true }
    })

    const entityBreakdown = entityStats.reduce((acc: any, stat) => {
      if (!acc[stat.entity]) {
        acc[stat.entity] = { success: 0, error: 0, warning: 0, total: 0 }
      }
      const statusKey = stat.status.toLowerCase()
      acc[stat.entity][statusKey] = stat._count.id
      acc[stat.entity].total += stat._count.id
      return acc
    }, {})

    // If summaryOnly requested, return just the summary (for initial page load)
    if (summaryOnly) {
      const responseData = {
        summary,
        entityBreakdown,
        logs: [],
        conflicts: [],
        pagination: {
          page: 1,
          limit: 0,
          total: totalLogs,
          totalPages: 0
        },
        summaryOnly: true
      }

      // Cache summary data
      dashboardCache.set(cacheKey, {
        data: responseData,
        timestamp: now,
        expires: now + SUMMARY_CACHE_TTL,
        cacheKey
      })

      const duration = Date.now() - startTime
      console.log(`[Sync Dashboard] Summary loaded in ${duration}ms`)

      const headers = new Headers()
      headers.set('X-Cache', 'MISS')
      headers.set('X-Response-Time', `${duration}ms`)

      return NextResponse.json(responseData, { headers })
    }

    // OPTIMIZATION: Get paginated logs with minimal joins
    const skip = (page - 1) * limit
    const logs = await prisma.xero_logs.findMany({
      where: whereClause,
      select: {
        id: true,
        timestamp: true,
        userId: true,
        direction: true,
        entity: true,
        status: true,
        recordsProcessed: true,
        recordsSucceeded: true,
        recordsFailed: true,
        message: true,
        details: true,
        errorMessage: true,
        duration: true,
        User: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        xero_sync_conflicts: searchQuery ? {
          where: {
            OR: [
              { entityName: { contains: searchQuery, mode: 'insensitive' } },
              { entity: { contains: searchQuery, mode: 'insensitive' } }
            ]
          },
          orderBy: { createdAt: 'desc' }
        } : {
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { timestamp: 'desc' },
      skip,
      take: limit
    })

    // Get standalone conflicts only if needed (for conflicts view)
    const conflicts = viewMode === 'conflicts' ? await prisma.xero_sync_conflicts.findMany({
      where: {
        status: 'PENDING',
        ...(searchQuery && {
          OR: [
            { entityName: { contains: searchQuery, mode: 'insensitive' } },
            { entity: { contains: searchQuery, mode: 'insensitive' } }
          ]
        })
      },
      include: {
        xero_logs: {
          select: {
            id: true,
            timestamp: true,
            entity: true,
            status: true,
            User: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    }) : []

    const responseData = {
      summary,
      entityBreakdown,
      logs,
      conflicts,
      pagination: {
        page,
        limit,
        total: totalLogs,
        totalPages: Math.ceil(totalLogs / limit)
      }
    }

    // Cache the response (shorter TTL for detailed data)
    dashboardCache.set(cacheKey, {
      data: responseData,
      timestamp: now,
      expires: now + DETAILS_CACHE_TTL,
      cacheKey
    })

    const duration = Date.now() - startTime
    console.log(`[Sync Dashboard] Full data loaded in ${duration}ms`)

    const headers = new Headers()
    headers.set('X-Cache', 'MISS')
    headers.set('X-Response-Time', `${duration}ms`)

    return NextResponse.json(responseData, { headers })

  } catch (error: any) {
    const duration = Date.now() - startTime
    console.error('❌ Error fetching sync dashboard data:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch sync dashboard data', details: error.stack },
      { status: 500 }
    )
  }
}

/**
 * POST /api/xero/sync-dashboard
 * Trigger manual sync for specific entities
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = (session.user as any).role
    if (!['SUPERADMIN', 'FINANCE'].includes(userRole)) {
      return NextResponse.json(
        { error: 'Insufficient permissions - only Super Admin and Finance can trigger manual sync' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { action, entity, direction, entityIds } = body

    if (action === 'manual-sync') {
      // Create a log entry for the manual sync initiation
      const logEntry = await prisma.xero_logs.create({
        data: {
          id: uuidv4(),
          timestamp: new Date(),
          userId: session.user.id,
          direction: direction || 'BOTH',
          entity: entity || 'ALL',
          status: 'IN_PROGRESS',
          recordsProcessed: 0,
          recordsSucceeded: 0,
          recordsFailed: 0,
          message: `Manual sync initiated by ${session.user.name || session.user.email}`,
          details: JSON.stringify({ entityIds }),
          updatedAt: new Date()
        }
      })

      return NextResponse.json({
        success: true,
        message: 'Manual sync initiated',
        logId: logEntry.id
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  } catch (error: any) {
    console.error('❌ Error in sync dashboard action:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to perform action' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/xero/sync-dashboard
 * Clear old sync logs (Super Admin only)
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = (session.user as any).role
    if (userRole !== 'SUPERADMIN') {
      return NextResponse.json(
        { error: 'Only Super Admin can clear old logs' },
        { status: 403 }
      )
    }

    const url = new URL(request.url)
    const daysToKeep = parseInt(url.searchParams.get('days') || '90')
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

    // Delete old logs
    const result = await prisma.xero_logs.deleteMany({
      where: {
        timestamp: { lt: cutoffDate },
        status: { not: 'ERROR' } // Keep error logs
      }
    })

    return NextResponse.json({
      success: true,
      message: `Deleted ${result.count} log entries older than ${daysToKeep} days`,
      deletedCount: result.count
    })

  } catch (error: any) {
    console.error('❌ Error clearing old logs:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to clear old logs' },
      { status: 500 }
    )
  }
}
