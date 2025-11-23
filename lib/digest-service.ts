
/**
 * Log Digest Service
 * 
 * Generates and sends daily/weekly/monthly digests of system logs to Super Admins
 */

import { prisma } from './db'
import { format, subDays, subWeeks, subMonths, startOfDay, endOfDay } from 'date-fns'

export interface DigestData {
  period: {
    start: Date
    end: Date
    description: string
  }
  summary: {
    totalLogs: number
    criticalErrors: number
    failedOperations: number
    warnings: number
    successfulOperations: number
  }
  criticalErrors: any[]
  topErrors: Array<{ message: string; count: number }>
  topModules: Array<{ module: string; errorCount: number }>
  userActivity: Array<{ username: string; actionCount: number }>
}

/**
 * Calculate date range based on digest frequency
 */
export function getDigestDateRange(frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY'): { start: Date; end: Date; description: string } {
  const now = new Date()
  const end = endOfDay(now)
  let start: Date
  let description: string

  switch (frequency) {
    case 'DAILY':
      start = startOfDay(subDays(now, 1))
      description = format(start, 'MMMM d, yyyy')
      break
    case 'WEEKLY':
      start = startOfDay(subWeeks(now, 1))
      description = `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`
      break
    case 'MONTHLY':
      start = startOfDay(subMonths(now, 1))
      description = format(start, 'MMMM yyyy')
      break
  }

  return { start, end, description }
}

/**
 * Generate digest data
 */
export async function generateDigestData(frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY'): Promise<DigestData> {
  const { start, end, description } = getDigestDateRange(frequency)

  // Get all logs in period (excluding archived)
  const logs = await prisma.system_logs.findMany({
    where: {
      createdAt: {
        gte: start,
        lte: end,
      },
      archived: false,
    },
    orderBy: { createdAt: 'desc' },
  })

  // Calculate summary stats
  const summary = {
    totalLogs: logs.length,
    criticalErrors: logs.filter((l: any) => l.status === 'CRITICAL').length,
    failedOperations: logs.filter((l: any) => l.status === 'FAILED' && l.type === 'ERROR').length,
    warnings: logs.filter((l: any) => l.status === 'WARNING').length,
    successfulOperations: logs.filter((l: any) => l.status === 'SUCCESS').length,
  }

  // Get critical errors
  const criticalErrors = logs
    .filter((l: any) => l.status === 'CRITICAL')
    .slice(0, 10)

  // Get top error messages
  const errorMessages = logs
    .filter((l: any) => l.type === 'ERROR')
    .reduce((acc: Record<string, number>, log: any) => {
      const key = log.message.substring(0, 100) // First 100 chars as key
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {} as Record<string, number>)

  const topErrors = Object.entries(errorMessages)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, 5)
    .map(([message, count]) => ({ message, count: count as number }))

  // Get top modules with errors
  const moduleErrors = logs
    .filter((l: any) => l.type === 'ERROR')
    .reduce((acc: Record<string, number>, log: any) => {
      acc[log.module] = (acc[log.module] || 0) + 1
      return acc
    }, {} as Record<string, number>)

  const topModules = Object.entries(moduleErrors)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, 5)
    .map(([module, errorCount]) => ({ module, errorCount: errorCount as number }))

  // Get user activity
  const userActions = logs
    .filter((l: any) => l.username)
    .reduce((acc: Record<string, number>, log: any) => {
      const username = log.username!
      acc[username] = (acc[username] || 0) + 1
      return acc
    }, {} as Record<string, number>)

  const userActivity = Object.entries(userActions)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, 10)
    .map(([username, actionCount]) => ({ username, actionCount: actionCount as number }))

  return {
    period: {
      start,
      end,
      description,
    },
    summary,
    criticalErrors,
    topErrors,
    topModules,
    userActivity,
  }
}

/**
 * Format digest as HTML email
 */
export function formatDigestHTML(data: DigestData): string {
  const { period, summary, criticalErrors, topErrors, topModules, userActivity } = data

  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { color: #2563eb; border-bottom: 3px solid #2563eb; padding-bottom: 10px; }
    h2 { color: #475569; margin-top: 30px; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin: 20px 0; }
    .stat-card { background: #f8fafc; border-left: 4px solid #2563eb; padding: 15px; border-radius: 4px; }
    .stat-card.critical { border-left-color: #dc2626; }
    .stat-card.warning { border-left-color: #f59e0b; }
    .stat-card.success { border-left-color: #10b981; }
    .stat-label { font-size: 12px; color: #64748b; text-transform: uppercase; }
    .stat-value { font-size: 28px; font-weight: bold; margin-top: 5px; }
    .log-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    .log-table th { background: #f1f5f9; padding: 10px; text-align: left; font-weight: 600; }
    .log-table td { padding: 10px; border-bottom: 1px solid #e2e8f0; }
    .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; }
    .badge.critical { background: #fee2e2; color: #991b1b; }
    .badge.error { background: #fef2f2; color: #991b1b; }
    .badge.warning { background: #fef3c7; color: #92400e; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>System Log Digest - ${period.description}</h1>
    
    <div class="summary">
      <div class="stat-card">
        <div class="stat-label">Total Logs</div>
        <div class="stat-value">${summary.totalLogs}</div>
      </div>
      <div class="stat-card critical">
        <div class="stat-label">Critical Errors</div>
        <div class="stat-value">${summary.criticalErrors}</div>
      </div>
      <div class="stat-card critical">
        <div class="stat-label">Failed Operations</div>
        <div class="stat-value">${summary.failedOperations}</div>
      </div>
      <div class="stat-card warning">
        <div class="stat-label">Warnings</div>
        <div class="stat-value">${summary.warnings}</div>
      </div>
      <div class="stat-card success">
        <div class="stat-label">Successful</div>
        <div class="stat-value">${summary.successfulOperations}</div>
      </div>
    </div>

    ${criticalErrors.length > 0 ? `
      <h2>🚨 Critical Errors</h2>
      <table class="log-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Module</th>
            <th>Action</th>
            <th>Message</th>
          </tr>
        </thead>
        <tbody>
          ${criticalErrors.map(log => `
            <tr>
              <td>${format(new Date(log.createdAt), 'MMM d, HH:mm')}</td>
              <td>${log.module}</td>
              <td>${log.action}</td>
              <td>${log.message}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : '<p>No critical errors in this period. 🎉</p>'}

    ${topErrors.length > 0 ? `
      <h2>Most Common Errors</h2>
      <table class="log-table">
        <thead>
          <tr>
            <th>Error Message</th>
            <th>Count</th>
          </tr>
        </thead>
        <tbody>
          ${topErrors.map(err => `
            <tr>
              <td>${err.message}</td>
              <td><span class="badge error">${err.count}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : ''}

    ${topModules.length > 0 ? `
      <h2>Modules with Most Errors</h2>
      <table class="log-table">
        <thead>
          <tr>
            <th>Module</th>
            <th>Error Count</th>
          </tr>
        </thead>
        <tbody>
          ${topModules.map(mod => `
            <tr>
              <td>${mod.module}</td>
              <td><span class="badge error">${mod.errorCount}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : ''}

    ${userActivity.length > 0 ? `
      <h2>User Activity</h2>
      <table class="log-table">
        <thead>
          <tr>
            <th>User</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${userActivity.map(user => `
            <tr>
              <td>${user.username}</td>
              <td>${user.actionCount}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : ''}

    <div class="footer">
      <p>This is an automated system log digest. To change your digest preferences, visit Settings → System Logs in your dashboard.</p>
    </div>
  </div>
</body>
</html>
  `.trim()
}

/**
 * Format digest as plain text
 */
export function formatDigestText(data: DigestData): string {
  const { period, summary, criticalErrors, topErrors, topModules, userActivity } = data

  let text = `SYSTEM LOG DIGEST - ${period.description}\n`
  text += `${'='.repeat(60)}\n\n`

  text += `SUMMARY\n`
  text += `-------\n`
  text += `Total Logs: ${summary.totalLogs}\n`
  text += `Critical Errors: ${summary.criticalErrors}\n`
  text += `Failed Operations: ${summary.failedOperations}\n`
  text += `Warnings: ${summary.warnings}\n`
  text += `Successful Operations: ${summary.successfulOperations}\n\n`

  if (criticalErrors.length > 0) {
    text += `CRITICAL ERRORS\n`
    text += `---------------\n`
    criticalErrors.forEach(log => {
      text += `[${format(new Date(log.createdAt), 'MMM d, HH:mm')}] ${log.module} - ${log.action}\n`
      text += `  ${log.message}\n\n`
    })
  } else {
    text += `No critical errors in this period. 🎉\n\n`
  }

  if (topErrors.length > 0) {
    text += `MOST COMMON ERRORS\n`
    text += `------------------\n`
    topErrors.forEach(err => {
      text += `(${err.count}x) ${err.message}\n`
    })
    text += `\n`
  }

  if (topModules.length > 0) {
    text += `MODULES WITH MOST ERRORS\n`
    text += `------------------------\n`
    topModules.forEach(mod => {
      text += `${mod.module}: ${mod.errorCount} errors\n`
    })
    text += `\n`
  }

  if (userActivity.length > 0) {
    text += `USER ACTIVITY\n`
    text += `-------------\n`
    userActivity.forEach(user => {
      text += `${user.username}: ${user.actionCount} actions\n`
    })
    text += `\n`
  }

  text += `\n${'='.repeat(60)}\n`
  text += `This is an automated system log digest.\n`
  text += `To change your digest preferences, visit Settings → System Logs.\n`

  return text
}

/**
 * Check if digest should be sent based on user preferences
 */
export function shouldSendDigest(
  preference: { digestFrequency: string; digestTime: string; digestDays: string[]; lastDigestSent: Date | null },
  now: Date = new Date()
): boolean {
  const { digestFrequency, digestTime, digestDays, lastDigestSent } = preference
  
  const [hours, minutes] = digestTime.split(':').map(Number)
  const targetTime = new Date(now)
  targetTime.setHours(hours, minutes, 0, 0)

  // Check if we're within 1 hour of target time
  const timeDiff = Math.abs(now.getTime() - targetTime.getTime())
  const withinTimeWindow = timeDiff < 60 * 60 * 1000 // 1 hour

  if (!withinTimeWindow) {
    return false
  }

  // If never sent before, send it
  if (!lastDigestSent) {
    return true
  }

  const daysSinceLastSent = Math.floor((now.getTime() - lastDigestSent.getTime()) / (1000 * 60 * 60 * 24))

  switch (digestFrequency) {
    case 'DAILY':
      return daysSinceLastSent >= 1
    case 'WEEKLY':
      const dayOfWeek = format(now, 'EEEE')
      return daysSinceLastSent >= 7 && digestDays.includes(dayOfWeek)
    case 'MONTHLY':
      return daysSinceLastSent >= 30
    default:
      return false
  }
}
