
/**
 * Log Archive Service
 * 
 * Provides functionality to automatically archive old system logs
 */

import { prisma } from './db'
import { subDays } from 'date-fns'

export interface ArchiveOptions {
  daysOld?: number
  excludeTypes?: string[]
  excludeStatuses?: string[]
  dryRun?: boolean
}

/**
 * Archive logs older than specified days
 */
export async function archiveOldLogs(options: ArchiveOptions = {}): Promise<{
  archived: number
  affected: any[]
}> {
  const {
    daysOld = 90,
    excludeTypes = [],
    excludeStatuses = ['CRITICAL'], // Don't auto-archive critical errors by default
    dryRun = false,
  } = options

  const cutoffDate = subDays(new Date(), daysOld)

  // Build where clause
  const where: any = {
    createdAt: {
      lt: cutoffDate,
    },
    archived: false,
  }

  if (excludeTypes.length > 0) {
    where.type = {
      notIn: excludeTypes,
    }
  }

  if (excludeStatuses.length > 0) {
    where.status = {
      notIn: excludeStatuses,
    }
  }

  if (dryRun) {
    // Just count what would be archived
    const count = await prisma.system_logs.count({ where })
    const samples = await prisma.system_logs.findMany({
      where,
      take: 10,
      orderBy: { createdAt: 'asc' },
    })
    return {
      archived: count,
      affected: samples,
    }
  }

  // Get logs that will be archived
  const logsToArchive = await prisma.system_logs.findMany({
    where,
    select: {
      id: true,
      type: true,
      module: true,
      createdAt: true,
    },
  })

  // Archive them
  const result = await prisma.system_logs.updateMany({
    where,
    data: {
      archived: true,
      archivedAt: new Date(),
    },
  })

  return {
    archived: result.count,
    affected: logsToArchive,
  }
}

/**
 * Permanently delete archived logs older than specified days
 */
export async function deleteArchivedLogs(daysOld: number = 180): Promise<number> {
  const cutoffDate = subDays(new Date(), daysOld)

  const result = await prisma.system_logs.deleteMany({
    where: {
      archived: true,
      archivedAt: {
        lt: cutoffDate,
      },
    },
  })

  return result.count
}

/**
 * Get archive statistics
 */
export async function getArchiveStats(): Promise<{
  totalLogs: number
  activeLogs: number
  archivedLogs: number
  oldestLog: Date | null
  oldestArchivedLog: Date | null
  archiveSizeEstimate: string
}> {
  const [totalLogs, activeLogs, archivedLogs, oldestLog, oldestArchivedLog] = await Promise.all([
    prisma.system_logs.count(),
    prisma.system_logs.count({ where: { archived: false } }),
    prisma.system_logs.count({ where: { archived: true } }),
    prisma.system_logs.findFirst({
      where: { archived: false },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    }),
    prisma.system_logs.findFirst({
      where: { archived: true },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    }),
  ])

  // Rough estimate: 1KB per log entry
  const archiveSizeEstimate = `${(archivedLogs / 1024).toFixed(2)} MB`

  return {
    totalLogs,
    activeLogs,
    archivedLogs,
    oldestLog: oldestLog?.createdAt || null,
    oldestArchivedLog: oldestArchivedLog?.createdAt || null,
    archiveSizeEstimate,
  }
}
