
/**
 * FIXED: Scalable Xero Sync Service with proper Payment sync implementation
 * 
 * This file replaces the placeholder payment sync in scalable-sync-service.ts
 */

import { Payment as XeroPayment } from 'xero-node'
import { XeroPaymentPullService } from './payment-sync-pull'

/**
 * Fixed syncSinglePayment implementation
 * 
 * This method properly processes payments from Xero and stores them locally
 */
export async function syncSinglePaymentFixed(
  xeroPayment: XeroPayment,
  userId: string
): Promise<void> {
  const pullService = new XeroPaymentPullService(userId)
  
  const result = await pullService.processSinglePayment(xeroPayment)
  
  if (!result.success) {
    throw new Error(result.error || 'Failed to sync payment')
  }
}

/**
 * Fixed batch payment processing
 */
export async function syncPaymentBatchFixed(
  xeroPayments: XeroPayment[],
  userId: string
): Promise<{
  processed: number
  succeeded: number
  failed: number
  errors: Array<{ record: string; error: string }>
}> {
  const pullService = new XeroPaymentPullService(userId)
  
  const result = await pullService.processBatch(xeroPayments)
  
  return {
    processed: result.processed,
    succeeded: result.succeeded + result.skipped, // Count skipped as succeeded
    failed: result.failed,
    errors: result.errors.map(e => ({
      record: e.paymentId,
      error: e.error
    }))
  }
}
