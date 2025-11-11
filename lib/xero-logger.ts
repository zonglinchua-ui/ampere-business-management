
import { prisma } from './db'
import { v4 as uuidv4 } from 'uuid'

export type XeroSyncDirection = 'PULL' | 'PUSH' | 'BOTH'
export type XeroSyncStatus = 'SUCCESS' | 'WARNING' | 'ERROR' | 'IN_PROGRESS'
export type XeroSyncEntity = 'CONTACTS' | 'INVOICES' | 'BILLS' | 'PAYMENTS' | 'ALL' | 'FULL_HISTORY'

export interface XeroLogEntry {
  id?: string
  timestamp: Date
  userId: string
  direction: XeroSyncDirection
  entity: XeroSyncEntity
  status: XeroSyncStatus
  recordsProcessed: number
  recordsSucceeded: number
  recordsFailed: number
  message: string
  details?: any
  errorMessage?: string
  errorStack?: string
  duration?: number
  createdAt?: Date
  updatedAt?: Date
}

export interface XeroErrorInfo {
  code: string
  message: string
  userFriendlyMessage: string
  isRetryable: boolean
  suggestedAction?: string
}

export class XeroLogger {
  private static readonly ERROR_CODES: Record<string, XeroErrorInfo> = {
    TOKEN_EXPIRED: {
      code: 'TOKEN_EXPIRED',
      message: 'Xero access token has expired',
      userFriendlyMessage: 'Your Xero connection has expired. Please reconnect your Xero account.',
      isRetryable: false,
      suggestedAction: 'Reconnect Xero account from Finance Settings'
    },
    TOKEN_INVALID: {
      code: 'TOKEN_INVALID',
      message: 'Xero access token is invalid',
      userFriendlyMessage: 'Your Xero connection is no longer valid. Please reconnect your account.',
      isRetryable: false,
      suggestedAction: 'Reconnect Xero account from Finance Settings'
    },
    RATE_LIMIT: {
      code: 'RATE_LIMIT',
      message: 'Xero API rate limit exceeded',
      userFriendlyMessage: 'Too many requests to Xero. Please wait a moment before trying again.',
      isRetryable: true,
      suggestedAction: 'Wait 60 seconds and try again'
    },
    NETWORK_ERROR: {
      code: 'NETWORK_ERROR',
      message: 'Network connection to Xero failed',
      userFriendlyMessage: 'Unable to connect to Xero. Please check your internet connection.',
      isRetryable: true,
      suggestedAction: 'Check internet connection and try again'
    },
    PERMISSION_DENIED: {
      code: 'PERMISSION_DENIED',
      message: 'Insufficient permissions for Xero operation',
      userFriendlyMessage: 'Your Xero account doesn\'t have the required permissions for this operation.',
      isRetryable: false,
      suggestedAction: 'Contact your Xero administrator to grant necessary permissions'
    },
    SYNC_CONFLICT: {
      code: 'SYNC_CONFLICT',
      message: 'Data conflict during sync',
      userFriendlyMessage: 'Some records have been updated in both systems and require manual review.',
      isRetryable: false,
      suggestedAction: 'Review conflicts in the Sync Log and resolve manually'
    },
    VALIDATION_ERROR: {
      code: 'VALIDATION_ERROR',
      message: 'Data validation failed',
      userFriendlyMessage: 'Some data doesn\'t meet Xero\'s requirements and couldn\'t be synced.',
      isRetryable: false,
      suggestedAction: 'Check data format and required fields'
    },
    UNKNOWN_ERROR: {
      code: 'UNKNOWN_ERROR',
      message: 'An unexpected error occurred',
      userFriendlyMessage: 'Something went wrong with the Xero sync. Please try again.',
      isRetryable: true,
      suggestedAction: 'Contact support if the problem persists'
    }
  }

  // Log a sync operation
  static async logSyncOperation(entry: Omit<XeroLogEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const logEntry = await prisma.xero_logs.create({
        data: {
          id: uuidv4(),
          timestamp: entry.timestamp,
          userId: entry.userId,
          direction: entry.direction,
          entity: entry.entity,
          status: entry.status,
          recordsProcessed: entry.recordsProcessed,
          recordsSucceeded: entry.recordsSucceeded,
          recordsFailed: entry.recordsFailed,
          message: entry.message,
          details: entry.details ? JSON.stringify(entry.details) : null,
          errorMessage: entry.errorMessage,
          errorStack: entry.errorStack,
          duration: entry.duration,
          updatedAt: new Date()
        }
      })
      return logEntry.id
    } catch (error) {
      console.error('Failed to log Xero operation:', error)
      // Don't throw here - logging failure shouldn't break the main operation
      return 'failed-to-log'
    }
  }

  // Update an existing log entry (for in-progress operations)
  static async updateLogEntry(id: string, updates: Partial<XeroLogEntry>): Promise<void> {
    try {
      await prisma.xero_logs.update({
        where: { id },
        data: {
          ...(updates.status && { status: updates.status }),
          ...(updates.recordsProcessed !== undefined && { recordsProcessed: updates.recordsProcessed }),
          ...(updates.recordsSucceeded !== undefined && { recordsSucceeded: updates.recordsSucceeded }),
          ...(updates.recordsFailed !== undefined && { recordsFailed: updates.recordsFailed }),
          ...(updates.message && { message: updates.message }),
          ...(updates.details && { details: JSON.stringify(updates.details) }),
          ...(updates.errorMessage && { errorMessage: updates.errorMessage }),
          ...(updates.errorStack && { errorStack: updates.errorStack }),
          ...(updates.duration !== undefined && { duration: updates.duration })
        }
      })
    } catch (error) {
      console.error('Failed to update Xero log entry:', error)
    }
  }

  // Get user-friendly error information
  static getErrorInfo(error: any): XeroErrorInfo {
    // Check for specific Xero error patterns
    const errorMessage = error?.message?.toLowerCase() || error?.toString()?.toLowerCase() || ''
    const errorCode = error?.code || error?.response?.status

    // Token expiration
    if (errorMessage.includes('token') && (errorMessage.includes('expired') || errorMessage.includes('invalid'))) {
      return this.ERROR_CODES.TOKEN_EXPIRED
    }

    // Rate limiting
    if (errorCode === 429 || errorMessage.includes('rate limit') || errorMessage.includes('too many requests')) {
      return this.ERROR_CODES.RATE_LIMIT
    }

    // Network errors
    if (errorMessage.includes('network') || errorMessage.includes('connection') || errorMessage.includes('timeout')) {
      return this.ERROR_CODES.NETWORK_ERROR
    }

    // Permission errors
    if (errorCode === 403 || errorMessage.includes('permission') || errorMessage.includes('unauthorized')) {
      return this.ERROR_CODES.PERMISSION_DENIED
    }

    // Validation errors
    if (errorCode === 400 || errorMessage.includes('validation') || errorMessage.includes('invalid')) {
      return this.ERROR_CODES.VALIDATION_ERROR
    }

    // Default to unknown error
    return this.ERROR_CODES.UNKNOWN_ERROR
  }

  // Get sync logs with pagination
  static async getSyncLogs(userId: string, options: {
    page?: number
    limit?: number
    status?: XeroSyncStatus
    entity?: XeroSyncEntity
    direction?: XeroSyncDirection
    dateFrom?: Date
    dateTo?: Date
  } = {}): Promise<{ logs: any[], total: number, page: number, limit: number }> {
    const { page = 1, limit = 50, status, entity, direction, dateFrom, dateTo } = options

    const where: any = { userId }

    if (status) where.status = status
    if (entity) where.entity = entity
    if (direction) where.direction = direction
    if (dateFrom || dateTo) {
      where.timestamp = {}
      if (dateFrom) where.timestamp.gte = dateFrom
      if (dateTo) where.timestamp.lte = dateTo
    }

    const [logs, total] = await Promise.all([
      prisma.xero_logs.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.xero_logs.count({ where })
    ])

    // Parse details JSON for each log
    const logsWithParsedDetails = logs.map(log => ({
      ...log,
      details: log.details ? JSON.parse(log.details) : null
    }))

    return {
      logs: logsWithParsedDetails,
      total,
      page,
      limit
    }
  }

  // Get sync statistics
  static async getSyncStats(userId: string, days: number = 30): Promise<{
    totalSyncs: number
    successfulSyncs: number
    failedSyncs: number
    averageDuration: number
    lastSync: Date | null
    entityStats: Record<XeroSyncEntity, number>
  }> {
    const dateFrom = new Date()
    dateFrom.setDate(dateFrom.getDate() - days)

    const logs = await prisma.xero_logs.findMany({
      where: {
        userId,
        timestamp: { gte: dateFrom }
      }
    })

    const totalSyncs = logs.length
    const successfulSyncs = logs.filter(log => log.status === 'SUCCESS').length
    const failedSyncs = logs.filter(log => log.status === 'ERROR').length
    const averageDuration = logs.reduce((sum, log) => sum + (log.duration || 0), 0) / totalSyncs || 0
    const lastSync = logs.length > 0 ? logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0].timestamp : null

    const entityStats: Record<XeroSyncEntity, number> = {
      CONTACTS: 0,
      INVOICES: 0,
      BILLS: 0,
      PAYMENTS: 0,
      ALL: 0,
      FULL_HISTORY: 0
    }

    logs.forEach(log => {
      if (entityStats[log.entity as XeroSyncEntity] !== undefined) {
        entityStats[log.entity as XeroSyncEntity]++
      }
    })

    return {
      totalSyncs,
      successfulSyncs,
      failedSyncs,
      averageDuration: Math.round(averageDuration / 1000), // Convert to seconds
      lastSync,
      entityStats
    }
  }

  // Clean old logs (keep last 90 days)
  static async cleanOldLogs(days: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - days)

      const result = await prisma.xero_logs.deleteMany({
        where: {
          timestamp: { lt: cutoffDate }
        }
      })

      console.log(`Cleaned ${result.count} old Xero log entries`)
      return result.count
    } catch (error) {
      console.error('Failed to clean old Xero logs:', error)
      return 0
    }
  }
}

// Error handling wrapper for Xero operations
export async function withXeroErrorHandling<T>(
  operation: () => Promise<T>,
  context: {
    userId: string
    entity: XeroSyncEntity
    direction: XeroSyncDirection
    operationName: string
  }
): Promise<{ success: boolean; data?: T; error?: XeroErrorInfo; logId?: string }> {
  const startTime = Date.now()
  let logId: string | undefined

  try {
    // Start logging
    logId = await XeroLogger.logSyncOperation({
      timestamp: new Date(),
      userId: context.userId,
      direction: context.direction,
      entity: context.entity,
      status: 'IN_PROGRESS',
      recordsProcessed: 0,
      recordsSucceeded: 0,
      recordsFailed: 0,
      message: `Starting ${context.operationName}`,
      duration: 0
    })

    // Execute operation
    const result = await operation()
    const duration = Date.now() - startTime

    // Update log with success
    if (logId) {
      await XeroLogger.updateLogEntry(logId, {
        status: 'SUCCESS',
        message: `${context.operationName} completed successfully`,
        duration
      })
    }

    return { success: true, data: result, logId }

  } catch (error: any) {
    const duration = Date.now() - startTime
    const errorInfo = XeroLogger.getErrorInfo(error)

    console.error(`Xero ${context.operationName} error:`, error)

    // Update log with error
    if (logId) {
      await XeroLogger.updateLogEntry(logId, {
        status: 'ERROR',
        message: `${context.operationName} failed: ${errorInfo.userFriendlyMessage}`,
        errorMessage: errorInfo.message,
        errorStack: error.stack,
        recordsFailed: 1,
        duration
      })
    }

    return { success: false, error: errorInfo, logId }
  }
}
