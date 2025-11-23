import type { PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/db'
import { checkXeroConnectionHealth } from '@/lib/xero-token-refresh-service'

export type HealthLevel = 'healthy' | 'warning' | 'critical'

export interface HealthCheckResult {
  status: HealthLevel
  lastChecked: string
  details?: string
  metrics?: Record<string, number>
}

export interface SyncFailureSummary {
  id: string
  entity: string
  status: string
  message: string
  timestamp: string
  recordsFailed: number
}

export interface ConflictSummary {
  id: string
  entity: string
  entityName: string
  conflictType: string
  status: string
  createdAt: string
}

export interface IntegrationHealthSnapshot {
  overallStatus: HealthLevel
  generatedAt: string
  checks: {
    database: HealthCheckResult
    xeroConnection: HealthCheckResult & {
      expiresInMinutes?: number
      tenantName?: string
    }
    syncActivity: HealthCheckResult & {
      lastSync?: string
      pendingConflicts: number
      failedSyncs: number
    }
  }
  recentFailures: SyncFailureSummary[]
  pendingConflicts: ConflictSummary[]
}

async function getDatabaseHealth(client: PrismaClient): Promise<HealthCheckResult> {
  try {
    await client.$queryRaw`SELECT 1` // Simple connectivity check

    const [invoiceCount, xeroSyncedInvoices, customerCount, xeroSyncedCustomers] = await Promise.all([
      client.customerInvoice.count(),
      client.customerInvoice.count({ where: { isXeroSynced: true } }),
      client.customer.count(),
      client.customer.count({ where: { isXeroSynced: true } })
    ])

    return {
      status: 'healthy',
      lastChecked: new Date().toISOString(),
      details: 'Database connection and sync markers are healthy',
      metrics: {
        invoiceCount,
        xeroSyncedInvoices,
        customerCount,
        xeroSyncedCustomers
      }
    }
  } catch (error) {
    return {
      status: 'critical',
      lastChecked: new Date().toISOString(),
      details: error instanceof Error ? error.message : 'Database health check failed'
    }
  }
}

async function getXeroHealth(
  client: PrismaClient,
  xeroHealthChecker: typeof checkXeroConnectionHealth
): Promise<HealthCheckResult & { expiresInMinutes?: number; tenantName?: string }> {
  try {
    const [integration, tokenHealth] = await Promise.all([
      client.xeroIntegration.findFirst({
        where: { isActive: true },
        orderBy: { connectedAt: 'desc' }
      }),
      xeroHealthChecker()
    ])

    if (!integration) {
      return {
        status: 'warning',
        lastChecked: new Date().toISOString(),
        details: 'No active Xero integration found'
      }
    }

    return {
      status: tokenHealth.isConnected ? 'healthy' : 'warning',
      lastChecked: new Date().toISOString(),
      details: tokenHealth.isConnected
        ? 'Xero connection is active'
        : tokenHealth.needsReconnect
          ? 'Xero connection needs to be re-authorized'
          : 'Xero connection requires attention',
      expiresInMinutes: tokenHealth.tokenExpiresIn,
      tenantName: integration.tenantName || integration.tenantId || undefined
    }
  } catch (error) {
    return {
      status: 'critical',
      lastChecked: new Date().toISOString(),
      details: error instanceof Error ? error.message : 'Failed to check Xero connection'
    }
  }
}

async function getSyncHealth(client: PrismaClient): Promise<HealthCheckResult & { lastSync?: string; pendingConflicts: number; failedSyncs: number }> {
  try {
    const [lastSync, failedCount, pendingConflicts] = await Promise.all([
      client.xero_logs.findFirst({
        orderBy: { timestamp: 'desc' },
        select: { timestamp: true, status: true }
      }),
      client.xero_logs.count({ where: { status: 'ERROR' } }),
      client.xero_sync_conflicts.count({ where: { status: 'PENDING' } })
    ])

    let status: HealthLevel = 'healthy'
    if (failedCount > 0 || pendingConflicts > 0) {
      status = failedCount > 5 ? 'critical' : 'warning'
    }
    if (lastSync?.status === 'ERROR') {
      status = 'critical'
    }

    return {
      status,
      lastChecked: new Date().toISOString(),
      details: failedCount > 0
        ? `${failedCount} failed sync events detected`
        : 'Sync pipeline is healthy',
      lastSync: lastSync?.timestamp?.toISOString(),
      pendingConflicts,
      failedSyncs: failedCount
    }
  } catch (error) {
    return {
      status: 'critical',
      lastChecked: new Date().toISOString(),
      details: error instanceof Error ? error.message : 'Failed to check sync health',
      pendingConflicts: 0,
      failedSyncs: 0
    }
  }
}

async function getRecentFailures(client: PrismaClient): Promise<SyncFailureSummary[]> {
  const failures = await client.xero_logs.findMany({
    where: { status: 'ERROR' },
    orderBy: { timestamp: 'desc' },
    take: 5,
    select: {
      id: true,
      entity: true,
      status: true,
      message: true,
      timestamp: true,
      recordsFailed: true
    }
  })

  return failures.map((failure) => ({
    ...failure,
    timestamp: failure.timestamp.toISOString()
  }))
}

async function getPendingConflicts(client: PrismaClient): Promise<ConflictSummary[]> {
  const conflicts = await client.xero_sync_conflicts.findMany({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: {
      id: true,
      entity: true,
      entityName: true,
      conflictType: true,
      status: true,
      createdAt: true
    }
  })

  return conflicts.map((conflict) => ({
    ...conflict,
    createdAt: conflict.createdAt.toISOString()
  }))
}

export async function getIntegrationHealthSnapshot(
  client: PrismaClient = prisma,
  xeroHealthChecker: typeof checkXeroConnectionHealth = checkXeroConnectionHealth
): Promise<IntegrationHealthSnapshot> {
  const [database, xeroConnection, syncActivity, recentFailures, pendingConflicts] = await Promise.all([
    getDatabaseHealth(client),
    getXeroHealth(client, xeroHealthChecker),
    getSyncHealth(client),
    getRecentFailures(client),
    getPendingConflicts(client)
  ])

  let overallStatus: HealthLevel = 'healthy'
  const statuses = [database.status, xeroConnection.status, syncActivity.status]
  if (statuses.includes('critical')) {
    overallStatus = 'critical'
  } else if (statuses.includes('warning')) {
    overallStatus = 'warning'
  }

  return {
    overallStatus,
    generatedAt: new Date().toISOString(),
    checks: {
      database,
      xeroConnection,
      syncActivity
    },
    recentFailures,
    pendingConflicts
  }
}
