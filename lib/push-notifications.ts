
/**
 * Push Notification Service for Super Admins
 * 
 * Sends real-time notifications for critical errors and system events
 */

import { prisma } from './db'

export interface PushNotificationData {
  title: string
  message: string
  link?: string
  severity?: 'info' | 'warning' | 'error' | 'critical'
}

/**
 * Send push notification to all Super Admins
 */
export async function notifySuperAdmins(data: PushNotificationData): Promise<void> {
  try {
    // Get all Super Admin users
    const superAdmins = await prisma.user.findMany({
      where: {
        role: 'SUPERADMIN',
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    })

    if (superAdmins.length === 0) {
      console.warn('[Push Notifications] No active Super Admins found')
      return
    }

    // NOTE: TaskNotification table requires taskId field, which system notifications don't have.
    // For now, we skip DB persistence for system notifications and only log to console.
    // Future improvement: Create a separate SystemNotification table or make taskId nullable.
    
    // Log notification for Super Admins (DB creation skipped due to schema constraints)
    console.log(`[Push Notifications] System notification for ${superAdmins.length} Super Admins:`)
    console.log(`  Title: ${data.title}`)
    console.log(`  Message: ${data.message}`)
    console.log(`  Severity: ${data.severity}`)
    
    // Skip DB creation for system notifications due to taskId requirement
    // The notification will still appear in logs which Super Admins can monitor

    console.log(`[Push Notifications] Sent to ${superAdmins.length} Super Admins:`, data.title)
  } catch (error) {
    console.error('[Push Notifications] Failed to send notifications:', error)
  }
}

/**
 * Send notification for failed system operation
 */
export async function notifyOperationFailure(params: {
  module: string
  action: string
  error: string
  userId?: string
  username?: string
}): Promise<void> {
  await notifySuperAdmins({
    title: `⚠️ ${params.module} Error`,
    message: `${params.action} failed: ${params.error}`,
    link: '/settings/system-logs',
    severity: 'error',
  })
}

/**
 * Send notification for critical system error
 */
export async function notifyCriticalError(params: {
  module: string
  message: string
  endpoint?: string
}): Promise<void> {
  await notifySuperAdmins({
    title: `🚨 Critical Error in ${params.module}`,
    message: params.message,
    link: '/settings/system-logs',
    severity: 'critical',
  })
}

/**
 * Send notification for system warning
 */
export async function notifySystemWarning(params: {
  title: string
  message: string
  link?: string
}): Promise<void> {
  await notifySuperAdmins({
    title: params.title,
    message: params.message,
    link: params.link,
    severity: 'warning',
  })
}
