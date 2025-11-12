import { prisma } from '@/lib/db'
import { XeroSyncEntityType } from '@prisma/client'

export interface SyncErrorLog {
  syncType: XeroSyncEntityType
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED' | 'PARTIAL'
  entityId?: string
  entityName?: string
  xeroId?: string
  errorMessage?: string
  errorDetails?: any
  attemptCount?: number
}

/**
 * Log a Xero sync error to the database
 */
export async function logSyncError(log: SyncErrorLog) {
  try {
    await prisma.xeroSyncLog.create({
      data: {
        id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        syncType: log.syncType,
        status: log.status,
        entityId: log.entityId,
        entityName: log.entityName,
        xeroId: log.xeroId,
        errorMessage: log.errorMessage,
        errorDetails: log.errorDetails ? JSON.parse(JSON.stringify(log.errorDetails)) : null,
        attemptCount: log.attemptCount || 1,
        lastAttemptAt: new Date(),
      },
    })
    console.log(`[Xero Sync Logger] Logged ${log.status} for ${log.syncType}: ${log.entityName || log.entityId}`)
  } catch (error) {
    console.error('[Xero Sync Logger] Failed to log sync error:', error)
    // Don't throw - logging errors shouldn't break the sync process
  }
}

/**
 * Log a successful sync
 */
export async function logSyncSuccess(
  syncType: XeroSyncEntityType,
  entityId?: string,
  entityName?: string,
  xeroId?: string
) {
  await logSyncError({
    syncType,
    status: 'SUCCESS',
    entityId,
    entityName,
    xeroId,
  })
}

/**
 * Log a failed sync
 */
export async function logSyncFailure(
  syncType: XeroSyncEntityType,
  error: Error | string,
  entityId?: string,
  entityName?: string,
  xeroId?: string,
  errorDetails?: any
) {
  await logSyncError({
    syncType,
    status: 'FAILED',
    entityId,
    entityName,
    xeroId,
    errorMessage: typeof error === 'string' ? error : error.message,
    errorDetails: errorDetails || (typeof error === 'object' ? error : undefined),
  })
}

/**
 * Log a skipped sync
 */
export async function logSyncSkipped(
  syncType: XeroSyncEntityType,
  reason: string,
  entityId?: string,
  entityName?: string,
  xeroId?: string
) {
  await logSyncError({
    syncType,
    status: 'SKIPPED',
    entityId,
    entityName,
    xeroId,
    errorMessage: reason,
  })
}

/**
 * Mark a sync error as resolved
 */
export async function resolveSyncError(logId: string, resolvedBy: string, notes?: string) {
  try {
    await prisma.xeroSyncLog.update({
      where: { id: logId },
      data: {
        resolvedAt: new Date(),
        resolvedBy,
        notes,
      },
    })
    console.log(`[Xero Sync Logger] Marked log ${logId} as resolved by ${resolvedBy}`)
  } catch (error) {
    console.error('[Xero Sync Logger] Failed to resolve sync error:', error)
    throw error
  }
}

/**
 * Get recent sync errors
 */
export async function getRecentSyncErrors(limit: number = 100) {
  return await prisma.xeroSyncLog.findMany({
    where: {
      status: {
        in: ['FAILED', 'SKIPPED'],
      },
      resolvedAt: null,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: limit,
  })
}

/**
 * Get sync error statistics
 */
export async function getSyncErrorStats() {
  const [totalErrors, unresolvedErrors, errorsByType, recentErrors] = await Promise.all([
    // Total errors
    prisma.xeroSyncLog.count({
      where: {
        status: {
          in: ['FAILED', 'SKIPPED'],
        },
      },
    }),
    
    // Unresolved errors
    prisma.xeroSyncLog.count({
      where: {
        status: {
          in: ['FAILED', 'SKIPPED'],
        },
        resolvedAt: null,
      },
    }),
    
    // Errors by type
    prisma.xeroSyncLog.groupBy({
      by: ['syncType', 'status'],
      where: {
        status: {
          in: ['FAILED', 'SKIPPED'],
        },
        resolvedAt: null,
      },
      _count: true,
    }),
    
    // Recent errors (last 24 hours)
    prisma.xeroSyncLog.count({
      where: {
        status: {
          in: ['FAILED', 'SKIPPED'],
        },
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    }),
  ])

  return {
    totalErrors,
    unresolvedErrors,
    errorsByType,
    recentErrors,
  }
}

