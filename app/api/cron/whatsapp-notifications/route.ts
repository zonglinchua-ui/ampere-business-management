/**
 * WhatsApp Notifications Cron Job
 * 
 * This endpoint should be called periodically (e.g., every hour or twice daily)
 * to check for upcoming deadlines and send WhatsApp notifications.
 * 
 * Can be triggered by:
 * - External cron service (e.g., cron-job.org)
 * - Internal scheduler
 * - Manual trigger
 */

import { NextRequest, NextResponse } from 'next/server'
import { runAllNotificationChecks } from '@/lib/notification-checker-service'
import { checkWhatsAppStatus } from '@/lib/whatsapp-service'
import { createSystemLog } from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    console.log('\n🔔 [Cron] WhatsApp notifications check triggered')
    
    // Verify cron secret (optional security measure)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.warn('[Cron] Unauthorized access attempt')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    // Check if WhatsApp service is available
    const status = await checkWhatsAppStatus()
    if (!status.available) {
      console.log(`[Cron] WhatsApp service not available: ${status.error}`)
      
      await createSystemLog({
        type: 'ERROR',
        action: 'WHATSAPP_NOTIFICATION_CHECK',
        message: `WhatsApp service not available: ${status.error}`,
        module: 'NOTIFICATION_SERVICE',
        status: 'FAILED'
      })
      
      return NextResponse.json({
        success: false,
        message: 'WhatsApp service not available',
        error: status.error
      })
    }
    
    // Run all notification checks
    const results = await runAllNotificationChecks()
    
    // Log the results
    await createSystemLog({
      type: 'ACTIVITY',
      action: 'WHATSAPP_NOTIFICATION_CHECK',
      message: `WhatsApp notifications sent: ${results.totalNotified} notifications, ${results.totalErrors} errors`,
      module: 'NOTIFICATION_SERVICE',
      status: results.totalErrors === 0 ? 'SUCCESS' : 'WARNING'
    })
    
    console.log('✅ [Cron] WhatsApp notifications check completed')
    
    return NextResponse.json({
      success: true,
      results: {
        tenders: {
          checked: results.tenders.checked,
          notified: results.tenders.notified,
          errors: results.tenders.errors.length
        },
        tasks: {
          checked: results.tasks.checked,
          notified: results.tasks.notified,
          errors: results.tasks.errors.length
        },
        invoices: {
          checked: results.invoices.checked,
          notified: results.invoices.notified,
          errors: results.invoices.errors.length
        },
        progressClaims: {
          checked: results.progressClaims.checked,
          notified: results.progressClaims.notified,
          errors: results.progressClaims.errors.length
        },
        totalNotified: results.totalNotified,
        totalErrors: results.totalErrors
      }
    })
    
  } catch (error: any) {
    console.error('❌ [Cron] WhatsApp notifications check failed:', error)
    
    await createSystemLog({
      type: 'ERROR',
      action: 'WHATSAPP_NOTIFICATION_CHECK',
      message: `WhatsApp notifications check failed: ${error.message}`,
      module: 'NOTIFICATION_SERVICE',
      status: 'FAILED'
    })
    
    return NextResponse.json(
      {
        success: false,
        error: error.message
      },
      { status: 500 }
    )
  }
}

// Allow POST as well for manual triggers
export async function POST(request: NextRequest) {
  return GET(request)
}
