import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { createSuccessResponse, createErrorResponse, ensureArray } from '@/lib/api-response'

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic'

/**
 * Dashboard Summary API (Optimized for Projects, Tenders, and Tasks)
 * 
 * Returns aggregated statistics for the main dashboard:
 * - Active projects count and value
 * - Project value (YTD and MTD)
 * - Outstanding tasks (user-specific)
 * - Outstanding tenders
 * - Project deadlines (next 30 days)
 * - Recent activities (from audit logs)
 */

// Simple in-memory cache for dashboard data (per user, 60-second cache)
const userCache = new Map<string, { data: any; timestamp: number }>()
const CACHE_TTL = 60000 // 60 seconds

// Type for dashboard data
interface DashboardData {
  activeProjects: number
  totalActiveProjectValue: number
  activeProjectValue: number
  projectValueYTD: number
  totalProjectValueYTD: number
  projectValueMTD: number
  totalProjectValueMTD: number
  projectCountYTD: number
  projectCountMTD: number
  outstandingTasks: number
  myTasks: Array<{
    id: string
    title: string
    dueDate: string | null
    priority: string
    status: string
  }>
  outstandingTenders: number
  upcomingDeadlines: Array<{
    project: string
    dueDate: string
    status: string
    priority: string
    id: string
  }>
  recentActivities: Array<{
    action: string
    user: string
    entity: string
    timeAgo: string
    timestamp: string
  }>
  lastUpdated: string
  fromCache: boolean
}

// Safe empty dashboard data
function getEmptyDashboardData(): DashboardData {
  return {
    activeProjects: 0,
    totalActiveProjectValue: 0,
    activeProjectValue: 0,
    projectValueYTD: 0,
    totalProjectValueYTD: 0,
    projectValueMTD: 0,
    totalProjectValueMTD: 0,
    projectCountYTD: 0,
    projectCountMTD: 0,
    outstandingTasks: 0,
    myTasks: [],
    outstandingTenders: 0,
    upcomingDeadlines: [],
    recentActivities: [],
    lastUpdated: new Date().toISOString(),
    fromCache: false
  }
}

export async function GET(request: NextRequest) {
  try {
    // Authentication check
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      console.error('[Dashboard Summary] Unauthorized access attempt')
      return NextResponse.json(
        createErrorResponse('Unauthorized', {
          message: 'Authentication required',
          code: 'UNAUTHORIZED'
        }),
        { status: 401 }
      )
    }

    const userId = session.user.id

    // Check cache for this user
    const now = Date.now()
    const cachedEntry = userCache.get(userId)
    if (cachedEntry && (now - cachedEntry.timestamp) < CACHE_TTL) {
      console.log(`[Dashboard Summary] Returning cached data for user ${userId}`)
      return NextResponse.json({
        ...cachedEntry.data,
        fromCache: true
      })
    }

    console.log(`[Dashboard Summary] Fetching fresh data from database for user ${userId}...`)

    // 1. Active Projects (status = PLANNING or IN_PROGRESS)
    let activeProjects = 0
    let activeProjectValue = 0
    try {
      const activeProjectData = await prisma.project.aggregate({
        where: {
          status: {
            in: ['PLANNING', 'IN_PROGRESS']
          },
          isActive: true
        },
        _count: true,
        _sum: {
          estimatedBudget: true
        }
      })
      activeProjects = activeProjectData._count || 0
      activeProjectValue = Number(activeProjectData._sum.estimatedBudget || 0)
      console.log(`[Dashboard Summary] Active projects: ${activeProjects}, Value: ${activeProjectValue}`)
    } catch (error) {
      console.error('[Dashboard Summary] Error fetching active projects:', error)
      activeProjects = 0
      activeProjectValue = 0
    }

    // 2. Project Value YTD (Year to Date)
    let projectValueYTD = 0
    let projectCountYTD = 0
    try {
      const yearStart = new Date(new Date().getFullYear(), 0, 1)
      const ytdData = await prisma.project.aggregate({
        where: {
          createdAt: {
            gte: yearStart
          },
          isActive: true
        },
        _count: true,
        _sum: {
          estimatedBudget: true
        }
      })
      projectValueYTD = Number(ytdData._sum?.estimatedBudget || 0)
      projectCountYTD = ytdData._count || 0
      console.log(`[Dashboard Summary] YTD Projects: ${projectCountYTD}, Value: ${projectValueYTD}`)
    } catch (error) {
      console.error('[Dashboard Summary] Error fetching YTD project value:', error)
      projectValueYTD = 0
      projectCountYTD = 0
    }

    // 3. Project Value MTD (Month to Date)
    let projectValueMTD = 0
    let projectCountMTD = 0
    try {
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      const mtdData = await prisma.project.aggregate({
        where: {
          createdAt: {
            gte: monthStart
          },
          isActive: true
        },
        _count: true,
        _sum: {
          estimatedBudget: true
        }
      })
      projectValueMTD = Number(mtdData._sum?.estimatedBudget || 0)
      projectCountMTD = mtdData._count || 0
      console.log(`[Dashboard Summary] MTD Projects: ${projectCountMTD}, Value: ${projectValueMTD}`)
    } catch (error) {
      console.error('[Dashboard Summary] Error fetching MTD project value:', error)
      projectValueMTD = 0
      projectCountMTD = 0
    }

    // 4. Outstanding Tasks (User-specific, not completed)
    let outstandingTasks = 0
    let myTasks: Array<{
      id: string
      title: string
      dueDate: string | null
      priority: string
      status: string
    }> = []
    try {
      const tasks = await prisma.task.findMany({
        where: {
          assigneeId: userId,
          status: {
            not: 'COMPLETED'
          },
          isArchived: false
        },
        take: 5,
        orderBy: {
          dueDate: 'asc'
        },
        select: {
          id: true,
          title: true,
          dueDate: true,
          priority: true,
          status: true
        }
      })
      outstandingTasks = await prisma.task.count({
        where: {
          assigneeId: userId,
          status: {
            not: 'COMPLETED'
          },
          isArchived: false
        }
      })
      myTasks = ensureArray(tasks).map((task: any) => ({
        id: task.id,
        title: task.title,
        dueDate: task.dueDate?.toISOString() || null,
        priority: task.priority,
        status: task.status
      }))
      console.log(`[Dashboard Summary] Outstanding tasks: ${outstandingTasks}`)
    } catch (error) {
      console.error('[Dashboard Summary] Error fetching outstanding tasks:', error)
      outstandingTasks = 0
      myTasks = []
    }

    // 5. Outstanding Tenders (OPEN or SUBMITTED only)
    let outstandingTenders = 0
    try {
      outstandingTenders = await prisma.tender.count({
        where: {
          status: {
            in: ['OPEN', 'SUBMITTED']
          },
          isActive: true
        }
      })
      console.log(`[Dashboard Summary] Outstanding tenders: ${outstandingTenders}`)
    } catch (error) {
      console.error('[Dashboard Summary] Error fetching outstanding tenders:', error)
      outstandingTenders = 0
    }

    // 6. Project Deadlines (next 30 days)
    let upcomingDeadlines: Array<{
      project: string
      dueDate: string
      status: string
      priority: string
      id: string
    }> = []
    try {
      const thirtyDaysFromNow = new Date()
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

      const projects = await prisma.project.findMany({
        where: {
          endDate: {
            gte: new Date(),
            lte: thirtyDaysFromNow
          },
          status: {
            in: ['IN_PROGRESS', 'PLANNING']
          },
          isActive: true
        },
        take: 5,
        orderBy: {
          endDate: 'asc'
        },
        select: {
          id: true,
          name: true,
          endDate: true,
          status: true,
          priority: true
        }
      })

      upcomingDeadlines = ensureArray(projects).map((project: any) => ({
        id: project.id,
        project: project.name,
        dueDate: project.endDate?.toISOString() || '',
        status: project.status,
        priority: project.priority || 'MEDIUM'
      }))

      console.log(`[Dashboard Summary] Fetched ${upcomingDeadlines.length} upcoming deadlines`)
    } catch (error) {
      console.error('[Dashboard Summary] Error fetching upcoming deadlines:', error)
      upcomingDeadlines = []
    }

    // 7. Recent Activities (Enhanced with entity names)
    let recentActivities: Array<{
      action: string
      user: string
      entity: string
      timeAgo: string
      timestamp: string
    }> = []

    try {
      const recentAuditLogs = await prisma.auditLog.findMany({
        take: 10,
        orderBy: {
          createdAt: 'desc'
        },
        include: {
          User: {
            select: {
              firstName: true,
              lastName: true,
              email: true
            }
          }
        }
      })

      recentActivities = ensureArray(recentAuditLogs).map((log: any) => {
        const userName = log.User 
          ? `${log.User.firstName || ''} ${log.User.lastName || ''}`.trim() || log.userEmail 
          : log.userEmail
        
        // Extract entity name from newValues if available
        let entityName = ''
        try {
          if (log.newValues && typeof log.newValues === 'object') {
            const values: any = log.newValues
            entityName = values._entityName || values.name || values.title || ''
          }
        } catch (e) {
          console.error('[Dashboard Summary] Error parsing newValues:', e)
        }
        
        return {
          action: formatActivityAction(log.action),
          user: userName,
          entity: formatEntityNameWithDetails(log.entityType, entityName, log.createdAt),
          timeAgo: formatTimeAgo(log.createdAt),
          timestamp: log.createdAt.toISOString()
        }
      })

      console.log(`[Dashboard Summary] Fetched ${recentActivities.length} recent activities`)
    } catch (error) {
      console.error('[Dashboard Summary] Error fetching audit logs:', error)
      recentActivities = []
    }

    // Prepare response data with consistent field names
    const responseData = {
      success: true,
      activeProjects,
      totalActiveProjectValue: activeProjectValue, // Alias for consistency
      activeProjectValue, // Keep for backward compatibility
      projectValueYTD,
      totalProjectValueYTD: projectValueYTD, // Alias for clarity
      projectValueMTD,
      totalProjectValueMTD: projectValueMTD, // Alias for clarity
      projectCountYTD,
      projectCountMTD,
      outstandingTasks,
      myTasks,
      outstandingTenders,
      upcomingDeadlines,
      recentActivities,
      lastUpdated: new Date().toISOString(),
      fromCache: false
    }

    // Update cache for this user
    userCache.set(userId, {
      data: responseData,
      timestamp: now
    })

    // Clean up old cache entries (older than 5 minutes)
    const fiveMinutesAgo = now - (5 * 60 * 1000)
    for (const [key, value] of userCache.entries()) {
      if (value.timestamp < fiveMinutesAgo) {
        userCache.delete(key)
      }
    }

    console.log('[Dashboard Summary] Successfully fetched and cached dashboard data')

    return NextResponse.json(responseData)
  } catch (error) {
    console.error('[Dashboard Summary] Fatal error:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    const errorStack = error instanceof Error ? error.stack : undefined
    
    console.error('[Dashboard Summary] Error details:', {
      message: errorMessage,
      stack: errorStack
    })

    // Return safe empty data with success=true to prevent .map() errors
    // The error is logged but we provide empty arrays for all fields
    const safeEmptyData = getEmptyDashboardData()
    
    return NextResponse.json({
      ...safeEmptyData,
      success: true, // Still true to prevent breaking frontend
      meta: {
        error: true,
        errorMessage: 'Failed to fetch dashboard data',
        errorCode: 'FETCH_ERROR'
      }
    })
  }
}

/**
 * Format activity action
 */
function formatActivityAction(action: string): string {
  const actionMap: Record<string, string> = {
    'CREATE': 'CREATED',
    'UPDATE': 'UPDATED',
    'DELETE': 'DELETED',
    'APPROVE': 'APPROVED',
    'REJECT': 'REJECTED',
    'SUBMIT': 'SUBMITTED',
    'COMPLETE': 'COMPLETED',
    'CANCEL': 'CANCELLED'
  }
  return actionMap[action.toUpperCase()] || action.toUpperCase()
}

/**
 * Format entity name for display (legacy)
 */
function formatEntityName(entityType: string, entityId: string): string {
  const typeMap: Record<string, string> = {
    'PROJECT': 'Project',
    'TASK': 'Task',
    'TENDER': 'Tender',
    'CUSTOMER': 'Customer',
    'SUPPLIER': 'Supplier',
    'INVOICE': 'Invoice',
    'QUOTATION': 'Quotation',
    'PURCHASE_ORDER': 'Purchase Order',
    'PAYMENT': 'Payment',
    'USER': 'User'
  }
  const entityName = typeMap[entityType.toUpperCase()] || entityType.replace(/_/g, ' ')
  return entityName
}

/**
 * Format entity name with details and date/time
 */
function formatEntityNameWithDetails(entityType: string, entityName: string, timestamp: Date): string {
  const typeMap: Record<string, string> = {
    'PROJECT': 'project',
    'TASK': 'task',
    'TENDER': 'tender',
    'CUSTOMER': 'customer',
    'SUPPLIER': 'supplier',
    'INVOICE': 'invoice',
    'QUOTATION': 'quotation',
    'PURCHASE_ORDER': 'purchase order',
    'PAYMENT': 'payment',
    'USER': 'user'
  }
  
  const entityTypeDisplay = typeMap[entityType.toUpperCase()] || entityType.toLowerCase().replace(/_/g, ' ')
  
  // Format: "project 'Project Name' on Oct 25 at 3:45 PM"
  if (entityName) {
    const dateStr = timestamp.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    })
    const timeStr = timestamp.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    })
    return `${entityTypeDisplay} "${entityName}" on ${dateStr} at ${timeStr}`
  }
  
  // Fallback if no entity name
  return entityTypeDisplay
}

/**
 * Format time ago (e.g., "2h ago", "3d ago")
 */
function formatTimeAgo(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}