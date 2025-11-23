
/**
 * Log Export Service
 * 
 * Provides functionality to export system logs in various formats
 */

import { format } from 'date-fns'
import { LogType, LogStatus } from '@prisma/client'

export interface ExportLog {
  id: string
  type: LogType
  status: LogStatus
  module: string
  action: string
  message: string
  username?: string | null
  role?: string | null
  endpoint?: string | null
  errorCode?: string | null
  ipAddress?: string | null
  userId?: string | null
  viewed: boolean
  archived: boolean
  archivedAt?: Date | null
  createdAt: Date
}

/**
 * Export logs as CSV
 */
export function exportLogsAsCSV(logs: ExportLog[]): string {
  const headers = [
    'ID',
    'Type',
    'Status',
    'Module',
    'Action',
    'Message',
    'Username',
    'Role',
    'Endpoint',
    'Error Code',
    'IP Address',
    'Viewed',
    'Archived',
    'Created At',
  ]

  const rows = logs.map(log => [
    log.id,
    log.type,
    log.status,
    log.module,
    log.action,
    `"${log.message.replace(/"/g, '""')}"`, // Escape quotes
    log.username || '',
    log.role || '',
    log.endpoint || '',
    log.errorCode || '',
    log.ipAddress || '',
    log.viewed ? 'Yes' : 'No',
    log.archived ? 'Yes' : 'No',
    format(new Date(log.createdAt), 'yyyy-MM-dd HH:mm:ss'),
  ])

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(',')),
  ].join('\n')

  return csvContent
}

/**
 * Export logs as JSON
 */
export function exportLogsAsJSON(logs: ExportLog[]): string {
  return JSON.stringify(logs, null, 2)
}

/**
 * Export critical errors only
 */
export function filterCriticalErrors(logs: ExportLog[]): ExportLog[] {
  return logs.filter(log => 
    log.status === 'CRITICAL' || 
    (log.status === 'FAILED' && log.type === 'ERROR')
  )
}

/**
 * Generate filename for export
 */
export function generateExportFilename(
  exportFormat: 'csv' | 'json',
  filterType?: string,
  criticalOnly: boolean = false
): string {
  const timestamp = format(new Date(), 'yyyy-MM-dd_HHmmss')
  const prefix = criticalOnly ? 'critical_errors' : 'system_logs'
  const filterSuffix = filterType ? `_${filterType}` : ''
  
  return `${prefix}${filterSuffix}_${timestamp}.${exportFormat}`
}
