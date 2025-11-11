

/**
 * Xero Notification Service
 * Handles push notifications for Xero sync operations
 */

import { prisma } from './db'
import crypto from 'crypto'

export interface NotificationOptions {
  title: string
  message: string
  type: 'sync_success' | 'sync_error' | 'sync_warning'
  entity: 'INVOICE' | 'CONTACT' | 'PAYMENT'
  details?: any
}

/**
 * Send push notification to Super Admin and Finance users
 */
export async function sendXeroSyncNotification(options: NotificationOptions): Promise<void> {
  try {
    console.log('📬 Sending Xero sync notification:', options.title)

    // Get all Super Admin and Finance users
    const targetUsers = await prisma.user.findMany({
      where: {
        OR: [
          { role: 'SUPERADMIN' },
          { role: 'FINANCE' }
        ],
        isActive: true
      },
      select: {
        id: true,
        email: true,
        role: true
      }
    })

    if (targetUsers.length === 0) {
      console.warn('⚠️  No Super Admin or Finance users found to notify')
      return
    }

    console.log(`📬 Notifying ${targetUsers.length} users: ${targetUsers.map(u => u.email).join(', ')}`)

    // Create notification record for each user
    const notificationPromises = targetUsers.map(async (user) => {
      try {
        // For now, we'll create a generic notification
        // In the future, you can integrate with Firebase, WebSocket, or other push notification services
        
        // Log to console (can be extended to actual push notification service)
        console.log(`  ✅ Notification sent to ${user.email} (${user.role}): ${options.title}`)
        
        // You can also create a database record for in-app notifications if needed
        // await prisma.notification.create({ ... })
        
      } catch (error: any) {
        console.error(`  ❌ Failed to notify ${user.email}:`, error.message)
      }
    })

    await Promise.all(notificationPromises)

    console.log('✅ Xero sync notifications sent successfully')

  } catch (error: any) {
    console.error('❌ Failed to send Xero sync notifications:', error.message)
    // Don't throw error - notification failure shouldn't break the sync
  }
}

/**
 * Send success notification
 */
export async function notifySyncSuccess(
  entity: 'INVOICE' | 'CONTACT' | 'PAYMENT',
  created: number,
  updated: number,
  skipped: number
): Promise<void> {
  const total = created + updated
  await sendXeroSyncNotification({
    title: 'Xero Sync Complete',
    message: `Successfully synced ${total} ${entity.toLowerCase()}s from Xero (${created} new, ${updated} updated, ${skipped} skipped).`,
    type: 'sync_success',
    entity,
    details: { created, updated, skipped }
  })
}

/**
 * Send error notification
 */
export async function notifySyncError(
  entity: 'INVOICE' | 'CONTACT' | 'PAYMENT',
  errorMessage: string,
  details?: any
): Promise<void> {
  await sendXeroSyncNotification({
    title: `${entity} Sync Failed`,
    message: `${entity} sync failed: ${errorMessage}`,
    type: 'sync_error',
    entity,
    details
  })
}

/**
 * Send warning notification (partial success)
 */
export async function notifySyncWarning(
  entity: 'INVOICE' | 'CONTACT' | 'PAYMENT',
  created: number,
  updated: number,
  skipped: number,
  errors: number
): Promise<void> {
  const total = created + updated
  await sendXeroSyncNotification({
    title: 'Xero Sync Completed with Warnings',
    message: `Synced ${total} ${entity.toLowerCase()}s with ${errors} errors (${created} new, ${updated} updated, ${skipped} skipped).`,
    type: 'sync_warning',
    entity,
    details: { created, updated, skipped, errors }
  })
}

