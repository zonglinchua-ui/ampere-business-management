
/**
 * Xero Full Historical Sync Service
 * Ensures ALL data from Xero since inception is synced to the web app
 * Includes robust error handling, pagination, and progress tracking
 */

import { XeroSyncService } from './xero-sync-service'
import { XeroLogger } from './xero-logger'
import { prisma } from './db'
import { v4 as uuidv4 } from 'uuid'

export interface FullSyncOptions {
  syncContacts?: boolean
  syncInvoices?: boolean
  syncPayments?: boolean
  forceRefresh?: boolean
}

export interface FullSyncProgress {
  stage: 'contacts' | 'invoices' | 'payments' | 'complete'
  current: number
  total: number
  percentage: number
  message: string
}

export interface FullSyncResult {
  success: boolean
  message: string
  contacts: {
    synced: number
    errors: number
  }
  invoices: {
    synced: number
    errors: number
  }
  payments: {
    synced: number
    errors: number
  }
  duration: number
  errors: string[]
}

/**
 * Full Historical Sync Service
 * Syncs ALL data from Xero since inception
 */
export class XeroFullHistorySyncService {
  private userId: string
  private syncService: XeroSyncService
  private progressCallback?: (progress: FullSyncProgress) => void

  constructor(userId: string) {
    this.userId = userId
    this.syncService = new XeroSyncService(userId)
  }

  /**
   * Set progress callback for real-time updates
   */
  setProgressCallback(callback: (progress: FullSyncProgress) => void) {
    this.progressCallback = callback
  }

  /**
   * Report progress
   */
  private reportProgress(progress: FullSyncProgress) {
    console.log(`📊 [${progress.stage.toUpperCase()}] ${progress.message} (${progress.percentage}%)`)
    if (this.progressCallback) {
      this.progressCallback(progress)
    }
  }

  /**
   * Perform full historical sync from Xero
   * Syncs ALL data from inception with no date filters
   */
  async syncFullHistory(options: FullSyncOptions = {}): Promise<FullSyncResult> {
    const startTime = Date.now()
    let logId: string | undefined

    const result: FullSyncResult = {
      success: false,
      message: '',
      contacts: { synced: 0, errors: 0 },
      invoices: { synced: 0, errors: 0 },
      payments: { synced: 0, errors: 0 },
      duration: 0,
      errors: []
    }

    try {
      // Initialize sync service
      const initialized = await this.syncService.initialize()
      if (!initialized) {
        throw new Error('Failed to initialize Xero sync service. Please reconnect to Xero.')
      }

      // Start logging
      logId = await XeroLogger.logSyncOperation({
        timestamp: new Date(),
        userId: this.userId,
        direction: 'PULL',
        entity: 'FULL_HISTORY',
        status: 'IN_PROGRESS',
        recordsProcessed: 0,
        recordsSucceeded: 0,
        recordsFailed: 0,
        message: 'Starting full historical sync from Xero',
        duration: 0
      })

      console.log('\n🚀 ==========================================')
      console.log('🚀 STARTING FULL HISTORICAL SYNC FROM XERO')
      console.log('🚀 This will sync ALL data since inception')
      console.log('🚀 ==========================================\n')

      const {
        syncContacts = true,
        syncInvoices = true,
        syncPayments = true,
        forceRefresh = false
      } = options

      // ==================== STAGE 1: CONTACTS ====================
      if (syncContacts) {
        console.log('\n📇 STAGE 1/3: Syncing Contacts (Customers & Suppliers)')
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

        this.reportProgress({
          stage: 'contacts',
          current: 0,
          total: 100,
          percentage: 0,
          message: 'Starting contact sync...'
        })

        try {
          const contactResult = await this.syncService.pullContacts({
            includeArchived: true, // Include ALL contacts including archived
            forceRefresh // Only force refresh if explicitly requested
          })

          result.contacts.synced = contactResult.created + contactResult.updated
          result.contacts.errors = contactResult.errors

          this.reportProgress({
            stage: 'contacts',
            current: 100,
            total: 100,
            percentage: 100,
            message: `✅ Contacts synced: ${result.contacts.synced} (${contactResult.created} new, ${contactResult.updated} updated)`
          })

          console.log(`✅ Contacts sync complete: ${result.contacts.synced} synced, ${result.contacts.errors} errors\n`)

          if (contactResult.errors > 0) {
            result.errors.push(`Contacts sync had ${contactResult.errors} errors`)
          }
        } catch (error: any) {
          console.error('❌ Contacts sync failed:', error.message)
          result.errors.push(`Contacts sync failed: ${error.message}`)
          result.contacts.errors++
        }
      }

      // ==================== STAGE 2: INVOICES ====================
      if (syncInvoices) {
        console.log('\n📄 STAGE 2/3: Syncing Invoices (ALL historical data)')
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

        this.reportProgress({
          stage: 'invoices',
          current: 0,
          total: 100,
          percentage: 0,
          message: 'Starting invoice sync...'
        })

        try {
          // Pull ALL invoices from Xero (no modifiedSince filter)
          const invoiceResult = await this.syncService.pullInvoices({
            modifiedSince: undefined, // NO DATE FILTER - get all historical data
            includeArchived: true,
            forceRefresh
          })

          result.invoices.synced = invoiceResult.created + invoiceResult.updated
          result.invoices.errors = invoiceResult.errors

          this.reportProgress({
            stage: 'invoices',
            current: 100,
            total: 100,
            percentage: 100,
            message: `✅ Invoices synced: ${result.invoices.synced} (${invoiceResult.created} new, ${invoiceResult.updated} updated)`
          })

          console.log(`✅ Invoices sync complete: ${result.invoices.synced} synced, ${result.invoices.errors} errors\n`)

          if (invoiceResult.errors > 0) {
            result.errors.push(`Invoices sync had ${invoiceResult.errors} errors`)
          }
        } catch (error: any) {
          console.error('❌ Invoices sync failed:', error.message)
          result.errors.push(`Invoices sync failed: ${error.message}`)
          result.invoices.errors++
        }
      }

      // ==================== STAGE 3: PAYMENTS ====================
      if (syncPayments) {
        console.log('\n💳 STAGE 3/3: Syncing Payments (ALL historical data)')
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

        this.reportProgress({
          stage: 'payments',
          current: 0,
          total: 100,
          percentage: 0,
          message: 'Starting payment sync...'
        })

        try {
          // Pull ALL payments from Xero (no modifiedSince filter)
          const paymentResult = await this.syncService.pullPayments({
            modifiedSince: undefined, // NO DATE FILTER - get all historical data
            includeArchived: true,
            forceRefresh
          })

          result.payments.synced = paymentResult.created + paymentResult.updated
          result.payments.errors = paymentResult.errors

          this.reportProgress({
            stage: 'payments',
            current: 100,
            total: 100,
            percentage: 100,
            message: `✅ Payments synced: ${result.payments.synced} (${paymentResult.created} new, ${paymentResult.updated} updated)`
          })

          console.log(`✅ Payments sync complete: ${result.payments.synced} synced, ${result.payments.errors} errors\n`)

          if (paymentResult.errors > 0) {
            result.errors.push(`Payments sync had ${paymentResult.errors} errors`)
          }
        } catch (error: any) {
          console.error('❌ Payments sync failed:', error.message)
          result.errors.push(`Payments sync failed: ${error.message}`)
          result.payments.errors++
        }
      }

      // ==================== COMPLETE ====================
      const duration = Date.now() - startTime
      result.duration = duration

      const totalSynced = result.contacts.synced + result.invoices.synced + result.payments.synced
      const totalErrors = result.contacts.errors + result.invoices.errors + result.payments.errors

      result.success = totalErrors === 0
      result.message = result.success
        ? `✅ Full historical sync complete! Synced ${totalSynced} records in ${Math.round(duration / 1000)}s`
        : `⚠️  Full historical sync completed with ${totalErrors} errors. Synced ${totalSynced} records in ${Math.round(duration / 1000)}s`

      this.reportProgress({
        stage: 'complete',
        current: 100,
        total: 100,
        percentage: 100,
        message: result.message
      })

      console.log('\n✅ ==========================================')
      console.log('✅ FULL HISTORICAL SYNC COMPLETE')
      console.log('✅ ==========================================')
      console.log(`📊 Total synced: ${totalSynced} records`)
      console.log(`   • Contacts: ${result.contacts.synced}`)
      console.log(`   • Invoices: ${result.invoices.synced}`)
      console.log(`   • Payments: ${result.payments.synced}`)
      console.log(`⏱️  Duration: ${Math.round(duration / 1000)}s`)
      if (totalErrors > 0) {
        console.log(`❌ Errors: ${totalErrors}`)
        result.errors.forEach(err => console.log(`   • ${err}`))
      }
      console.log('✅ ==========================================\n')

      // Update log
      if (logId) {
        await XeroLogger.updateLogEntry(logId, {
          status: result.success ? 'SUCCESS' : 'WARNING',
          message: result.message,
          recordsProcessed: totalSynced + totalErrors,
          recordsSucceeded: totalSynced,
          recordsFailed: totalErrors,
          duration,
          details: {
            contacts: result.contacts,
            invoices: result.invoices,
            payments: result.payments,
            errors: result.errors
          }
        })
      }

      // Update XeroIntegration lastSyncAt
      await prisma.xeroIntegration.updateMany({
        where: { isActive: true },
        data: { lastSyncAt: new Date() }
      })

      return result

    } catch (error: any) {
      const duration = Date.now() - startTime
      const errorMessage = error.message || 'Unknown error'

      console.error('\n❌ ==========================================')
      console.error('❌ FULL HISTORICAL SYNC FAILED')
      console.error('❌ ==========================================')
      console.error(`❌ Error: ${errorMessage}`)
      console.error('❌ ==========================================\n')

      result.success = false
      result.message = `❌ Full historical sync failed: ${errorMessage}`
      result.duration = duration
      result.errors.push(errorMessage)

      // Update log
      if (logId) {
        await XeroLogger.updateLogEntry(logId, {
          status: 'ERROR',
          message: result.message,
          recordsProcessed: 0,
          recordsSucceeded: 0,
          recordsFailed: 1,
          duration,
          details: {
            error: errorMessage,
            stack: error.stack
          }
        })
      }

      return result
    }
  }
}

/**
 * Helper function to trigger full historical sync
 */
export async function triggerFullHistoricalSync(
  userId: string,
  options?: FullSyncOptions
): Promise<FullSyncResult> {
  const syncService = new XeroFullHistorySyncService(userId)
  return await syncService.syncFullHistory(options)
}
