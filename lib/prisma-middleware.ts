
/**
 * Prisma Middleware for Automatic Error Notifications
 * 
 * Intercepts Prisma operations and sends notifications for failures
 * 
 * Note: Automatic audit logging is handled manually in API routes using
 * the createAuditLog() helper function from @/lib/api-audit-context
 */

import { Prisma } from '@prisma/client'
import { notifySuperAdmins } from './push-notifications'

/**
 * Initialize Prisma middleware for error notifications
 */
export function initializePrismaMiddleware(prisma: any): void {
  prisma.$use(async (params: Prisma.MiddlewareParams, next: any) => {
    try {
      const result = await next(params)

      // Check if a SystemLog was created with critical status
      if (params.model === 'system_logs' && params.action === 'create') {
        const log = result as any

        if (['FAILED', 'CRITICAL'].includes(log.status)) {
          // Send push notification to Super Admins
          await notifySuperAdmins({
            title: log.status === 'CRITICAL' ? `🚨 Critical Error` : `⚠️ Error Detected`,
            message: `${log.module} - ${log.action}: ${log.message}`,
            link: '/settings/system-logs',
            severity: log.status === 'CRITICAL' ? 'critical' : 'error',
          }).catch((err) => {
            console.error('[Prisma Middleware] Failed to send notification:', err)
          })
        }
      }

      return result
    } catch (error: any) {
      // Log Prisma errors
      console.error('[Prisma Middleware] Operation failed:', {
        model: params.model,
        action: params.action,
        error: error.message,
      })

      throw error
    }
  })
}
