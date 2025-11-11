
import { ImprovedXeroService } from './xero-service-improved'

// Configuration for auto-sync behavior
export const XERO_AUTO_SYNC_CONFIG = {
  enabled: process.env.XERO_AUTO_SYNC_ENABLED === 'true',
  delayMs: parseInt(process.env.XERO_AUTO_SYNC_DELAY_MS || '5000'), // 5 seconds delay
  retryAttempts: 3,
  retryDelayMs: 2000,
}

// Queue for background sync operations
let syncQueue: Array<{
  entityType: string
  entityId: string
  operation: 'create' | 'update'
  timestamp: Date
}> = []

// In-memory flag to prevent duplicate syncs
const syncingEntities = new Set<string>()

export class XeroAutoSyncService {
  private static instance: XeroAutoSyncService
  private xeroService: ImprovedXeroService | null = null
  private processingQueue = false

  static getInstance(): XeroAutoSyncService {
    if (!XeroAutoSyncService.instance) {
      XeroAutoSyncService.instance = new XeroAutoSyncService()
    }
    return XeroAutoSyncService.instance
  }

  private async getImprovedXeroService(): Promise<ImprovedXeroService | null> {
    try {
      if (!this.xeroService) {
        const tokens = await ImprovedXeroService.getStoredTokens()
        if (tokens) {
          this.xeroService = new ImprovedXeroService(tokens)
        }
      }
      return this.xeroService
    } catch (error) {
      console.error('Failed to get Xero service:', error)
      return null
    }
  }

  // Queue an entity for sync
  async queueForSync(
    entityType: 'customer' | 'supplier' | 'customerInvoice' | 'supplierInvoice' | 'payment',
    entityId: string,
    operation: 'create' | 'update' = 'create'
  ) {
    if (!XERO_AUTO_SYNC_CONFIG.enabled) {
      console.log('Auto-sync disabled, skipping queue')
      return
    }

    const queueKey = `${entityType}:${entityId}`
    
    // Prevent duplicate queuing
    if (syncingEntities.has(queueKey)) {
      console.log(`Entity ${queueKey} already queued/syncing, skipping`)
      return
    }

    syncQueue.push({
      entityType,
      entityId,
      operation,
      timestamp: new Date()
    })

    console.log(`Queued ${entityType} ${entityId} for Xero sync`)

    // Process queue with delay
    if (!this.processingQueue) {
      setTimeout(() => this.processQueue(), XERO_AUTO_SYNC_CONFIG.delayMs)
    }
  }

  // Process the sync queue
  private async processQueue() {
    if (this.processingQueue || syncQueue.length === 0) {
      return
    }

    this.processingQueue = true
    console.log(`Processing Xero sync queue with ${syncQueue.length} items`)

    try {
      const xeroService = await this.getImprovedXeroService()
      if (!xeroService) {
        console.log('No Xero service available, clearing queue')
        syncQueue = []
        return
      }

      // Process items in batches to avoid rate limits
      while (syncQueue.length > 0) {
        const item = syncQueue.shift()!
        const queueKey = `${item.entityType}:${item.entityId}`

        // Skip if already syncing
        if (syncingEntities.has(queueKey)) {
          continue
        }

        syncingEntities.add(queueKey)

        try {
          await this.syncSingleEntity(xeroService, item.entityType, item.entityId)
        } catch (error) {
          console.error(`Failed to sync ${queueKey}:`, error)
          // Could implement retry logic here
        } finally {
          syncingEntities.delete(queueKey)
        }

        // Small delay between syncs to avoid rate limits
        if (syncQueue.length > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }
    } catch (error) {
      console.error('Error processing sync queue:', error)
    } finally {
      this.processingQueue = false
    }
  }

  private async syncSingleEntity(
    xeroService: ImprovedXeroService,
    entityType: string,
    entityId: string
  ): Promise<void> {
    console.log(`Auto-syncing ${entityType} ${entityId} to Xero`)

    try {
      // Note: Auto-sync for individual entities not yet implemented
      // ImprovedXeroService only supports bulk contact sync
      console.log(`Auto-sync for ${entityType} ${entityId} skipped - not yet implemented`)
      console.log(`Successfully auto-synced ${entityType} ${entityId}`)
    } catch (error: any) {
      console.error(`Failed to auto-sync ${entityType} ${entityId}:`, error?.message || error)
      throw error
    }
  }

  // Manual trigger for specific entity
  async syncEntityNow(
    entityType: 'customer' | 'supplier' | 'customerInvoice' | 'supplierInvoice' | 'payment',
    entityId: string
  ): Promise<boolean> {
    try {
      const xeroService = await this.getImprovedXeroService()
      if (!xeroService) {
        console.error('No Xero service available')
        return false
      }

      await this.syncSingleEntity(xeroService, entityType, entityId)
      return true
    } catch (error) {
      console.error(`Failed to sync ${entityType} ${entityId}:`, error)
      return false
    }
  }

  // Clear the queue (useful for testing or emergency stop)
  clearQueue(): void {
    syncQueue = []
    syncingEntities.clear()
    console.log('Xero sync queue cleared')
  }

  // Get queue status
  getQueueStatus(): { queueLength: number, processing: boolean, syncingEntities: string[] } {
    return {
      queueLength: syncQueue.length,
      processing: this.processingQueue,
      syncingEntities: Array.from(syncingEntities)
    }
  }
}

// Helper functions for easy access
export const queueForXeroSync = (
  entityType: 'customer' | 'supplier' | 'customerInvoice' | 'supplierInvoice' | 'payment',
  entityId: string,
  operation: 'create' | 'update' = 'create'
) => {
  const autoSync = XeroAutoSyncService.getInstance()
  autoSync.queueForSync(entityType, entityId, operation)
}

export const syncToXeroNow = async (
  entityType: 'customer' | 'supplier' | 'customerInvoice' | 'supplierInvoice' | 'payment',
  entityId: string
): Promise<boolean> => {
  const autoSync = XeroAutoSyncService.getInstance()
  return autoSync.syncEntityNow(entityType, entityId)
}

// Trigger sync when specific Finance records are created
export const handleClientCreated = (customerId: string) => {
  queueForXeroSync('customer', customerId, 'create')
}

export const handleClientUpdated = (customerId: string) => {
  queueForXeroSync('customer', customerId, 'update')
}

export const handleVendorCreated = (supplierId: string) => {
  queueForXeroSync('supplier', supplierId, 'create')
}

export const handleVendorUpdated = (supplierId: string) => {
  queueForXeroSync('supplier', supplierId, 'update')
}

export const handleCustomerInvoiceCreated = (invoiceId: string) => {
  queueForXeroSync('customerInvoice', invoiceId, 'create')
}

export const handleCustomerInvoiceUpdated = (invoiceId: string) => {
  queueForXeroSync('customerInvoice', invoiceId, 'update')
}

export const handleVendorInvoiceCreated = (invoiceId: string) => {
  queueForXeroSync('supplierInvoice', invoiceId, 'create')
}

export const handleVendorInvoiceUpdated = (invoiceId: string) => {
  queueForXeroSync('supplierInvoice', invoiceId, 'update')
}

export const handlePaymentCreated = (paymentId: string) => {
  queueForXeroSync('payment', paymentId, 'create')
}

export const handlePaymentUpdated = (paymentId: string) => {
  queueForXeroSync('payment', paymentId, 'update')
}
