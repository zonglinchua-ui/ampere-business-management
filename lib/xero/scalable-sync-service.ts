
/**
 * Scalable Xero Sync Service
 * 
 * Features:
 * - Pagination for large datasets
 * - Batch processing to prevent memory issues
 * - Resumable sync with checkpoints
 * - Detailed progress logging
 * - Error recovery
 */

import { getXeroClient } from '../xero-config'
import { prisma } from '../db'
import { Contact, Invoice, Payment } from 'xero-node'

export interface SyncProgress {
  syncId: string
  entity: string
  direction: string
  currentPage: number
  totalPages: number
  recordsProcessed: number
  recordsSucceeded: number
  recordsFailed: number
  status: 'IN_PROGRESS' | 'SUCCESS' | 'ERROR' | 'PAUSED'
  startedAt: Date
  lastCheckpoint: Date
  errors: Array<{ record: string; error: string }>
}

export interface SyncConfig {
  pageSize?: number          // Records per page (default: 100)
  batchSize?: number         // Records to process before checkpoint (default: 50)
  maxRetries?: number        // Max retries per record (default: 3)
  continueOnError?: boolean  // Continue if individual records fail (default: true)
}

export interface SyncCheckpoint {
  syncId: string
  entity: string
  lastPage: number
  lastProcessedId?: string
  timestamp: Date
}

export class ScalableXeroSyncService {
  private xeroClient = getXeroClient()
  private systemUserId: string | null = null
  
  constructor(
    private tokens: {
      accessToken: string
      refreshToken: string
      expiresAt: Date
      tenantId: string
    },
    private userId: string,
    private config: SyncConfig = {}
  ) {
    this.setTokens(tokens)
    this.config = {
      pageSize: config.pageSize || 100,
      batchSize: config.batchSize || 50,
      maxRetries: config.maxRetries || 3,
      continueOnError: config.continueOnError !== false
    }
  }

  private setTokens(tokens: any) {
    this.xeroClient.setTokenSet({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expires_at: tokens.expiresAt.getTime(),
    })
  }

  private async getSystemUserId(): Promise<string> {
    if (this.systemUserId) return this.systemUserId

    try {
      let systemUser = await prisma.user.findFirst({
        where: { 
          OR: [
            { email: 'system@ampere.com' },
            { role: 'SUPERADMIN' }
          ]
        }
      })

      if (!systemUser) {
        systemUser = await prisma.user.create({
          data: {
            id: `system-xero-${Date.now()}`,
            email: 'xero-system@ampere.com',
            name: 'Xero System Integration',
            password: 'disabled',
            role: 'PROJECT_MANAGER',
            isActive: false,
            emailVerified: new Date(),
            updatedAt: new Date(),
          }
        })
      }

      this.systemUserId = systemUser.id
      return systemUser.id
    } catch (error) {
      console.error('Failed to get system user:', error)
      return this.userId || 'fallback-system'
    }
  }

  /**
   * Create or retrieve sync checkpoint
   */
  private async getCheckpoint(syncId: string, entity: string): Promise<SyncCheckpoint | null> {
    try {
      const checkpoint = await prisma.$queryRaw<any[]>`
        SELECT details FROM "XeroLog" 
        WHERE id = ${syncId} 
        AND entity = ${entity}
        AND status = 'IN_PROGRESS'
        LIMIT 1
      `
      
      if (checkpoint && checkpoint[0]?.details) {
        const details = JSON.parse(checkpoint[0].details)
        return {
          syncId,
          entity,
          lastPage: details.lastPage || 0,
          lastProcessedId: details.lastProcessedId,
          timestamp: new Date(details.timestamp)
        }
      }
      
      return null
    } catch (error) {
      console.error('Failed to get checkpoint:', error)
      return null
    }
  }

  /**
   * Save sync checkpoint for resumability
   */
  private async saveCheckpoint(
    syncId: string,
    entity: string,
    page: number,
    lastProcessedId?: string
  ): Promise<void> {
    try {
      const details = JSON.stringify({
        lastPage: page,
        lastProcessedId,
        timestamp: new Date().toISOString()
      })
      
      await prisma.xero_logs.update({
        where: { id: syncId },
        data: {
          details,
          updatedAt: new Date()
        }
      })
    } catch (error) {
      console.error('Failed to save checkpoint:', error)
    }
  }

  /**
   * Initialize sync log entry
   */
  private async initializeSyncLog(entity: string, direction: string): Promise<string> {
    const log = await prisma.xero_logs.create({
      data: {
        id: `sync-${entity.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        timestamp: new Date(),
        userId: this.userId,
        direction,
        entity: entity.toUpperCase(),
        status: 'IN_PROGRESS',
        message: `Starting ${direction} sync for ${entity}`,
        recordsProcessed: 0,
        recordsSucceeded: 0,
        recordsFailed: 0,
        details: JSON.stringify({ startTime: new Date().toISOString() }),
        updatedAt: new Date()
      }
    })
    
    return log.id
  }

  /**
   * Update sync log with progress
   */
  private async updateSyncLog(
    syncId: string,
    progress: Partial<SyncProgress>,
    additionalDetails?: any
  ): Promise<void> {
    try {
      const existingLog = await prisma.xero_logs.findUnique({
        where: { id: syncId }
      })
      
      const currentDetails = existingLog?.details 
        ? JSON.parse(existingLog.details) 
        : {}
      
      const updatedDetails = JSON.stringify({
        ...currentDetails,
        ...additionalDetails,
        lastUpdate: new Date().toISOString()
      })
      
      await prisma.xero_logs.update({
        where: { id: syncId },
        data: {
          status: progress.status || 'IN_PROGRESS',
          message: progress.status === 'SUCCESS' 
            ? `Sync completed successfully` 
            : progress.status === 'ERROR'
            ? `Sync failed`
            : `Processing... (${progress.recordsProcessed || 0} records)`,
          recordsProcessed: progress.recordsProcessed,
          recordsSucceeded: progress.recordsSucceeded,
          recordsFailed: progress.recordsFailed,
          details: updatedDetails,
          updatedAt: new Date()
        }
      })
    } catch (error) {
      console.error('Failed to update sync log:', error)
    }
  }

  /**
   * Finalize sync log
   */
  private async finalizeSyncLog(
    syncId: string,
    progress: SyncProgress,
    duration: number
  ): Promise<void> {
    try {
      const details = JSON.stringify({
        startTime: progress.startedAt.toISOString(),
        endTime: new Date().toISOString(),
        duration,
        totalPages: progress.totalPages,
        errors: progress.errors,
        config: this.config
      })
      
      await prisma.xero_logs.update({
        where: { id: syncId },
        data: {
          status: progress.status,
          message: progress.status === 'SUCCESS'
            ? `Successfully synced ${progress.recordsSucceeded} of ${progress.recordsProcessed} ${progress.entity} records`
            : `Sync failed: ${progress.recordsFailed} errors out of ${progress.recordsProcessed} records`,
          recordsProcessed: progress.recordsProcessed,
          recordsSucceeded: progress.recordsSucceeded,
          recordsFailed: progress.recordsFailed,
          duration,
          details,
          errorMessage: progress.errors.length > 0 
            ? progress.errors.slice(0, 5).map(e => e.error).join('; ')
            : undefined,
          updatedAt: new Date()
        }
      })

      // Update last sync timestamp on integration
      await prisma.xeroIntegration.updateMany({
        where: { 
          tenantId: this.tokens.tenantId,
          isActive: true 
        },
        data: { lastSyncAt: new Date() }
      })
    } catch (error) {
      console.error('Failed to finalize sync log:', error)
    }
  }

  /**
   * Sync Contacts with pagination and batch processing
   */
  async syncContacts(resumeFromCheckpoint: boolean = false): Promise<SyncProgress> {
    const entity = 'CONTACTS'
    const direction = 'PULL'
    const syncId = await this.initializeSyncLog(entity, direction)
    const startTime = Date.now()
    
    const progress: SyncProgress = {
      syncId,
      entity,
      direction,
      currentPage: 1,
      totalPages: 0,
      recordsProcessed: 0,
      recordsSucceeded: 0,
      recordsFailed: 0,
      status: 'IN_PROGRESS',
      startedAt: new Date(),
      lastCheckpoint: new Date(),
      errors: []
    }

    try {
      console.log(`\n=== Starting Scalable Contacts Sync ===`)
      console.log(`Sync ID: ${syncId}`)
      console.log(`Config:`, this.config)

      // Check for existing checkpoint
      let startPage = 1
      if (resumeFromCheckpoint) {
        const checkpoint = await this.getCheckpoint(syncId, entity)
        if (checkpoint) {
          startPage = checkpoint.lastPage + 1
          console.log(`Resuming from checkpoint: page ${startPage}`)
        }
      }

      let hasMorePages = true
      let currentPage = startPage
      let batch: Contact[] = []

      while (hasMorePages) {
        console.log(`\n--- Fetching page ${currentPage} ---`)
        
        try {
          // Fetch page from Xero with pagination
          const response = await this.xeroClient.accountingApi.getContacts(
            this.tokens.tenantId,
            undefined, // modifiedSince (Date)
            undefined, // where (string)
            undefined, // order (string)
            undefined, // IDs (string[])
            currentPage, // page (number)
            undefined, // includeArchived (boolean)
            undefined, // summaryOnly (boolean)
            undefined, // searchTerm (string)
            this.config.pageSize // pageSize (number)
          )
          
          const contacts = response.body.contacts || []
          console.log(`Retrieved ${contacts.length} contacts from page ${currentPage}`)
          
          if (contacts.length === 0) {
            hasMorePages = false
            break
          }

          // Add to current batch
          batch.push(...contacts)
          
          // Process batch if it reaches batchSize or it's the last page
          if (batch.length >= this.config.batchSize! || contacts.length < this.config.pageSize!) {
            const batchResults = await this.processBatch(batch, 'contact')
            
            progress.recordsProcessed += batchResults.processed
            progress.recordsSucceeded += batchResults.succeeded
            progress.recordsFailed += batchResults.failed
            progress.errors.push(...batchResults.errors)
            
            console.log(`Batch processed: ${batchResults.succeeded}/${batchResults.processed} successful`)
            
            // Save checkpoint
            await this.saveCheckpoint(
              syncId,
              entity,
              currentPage,
              batch[batch.length - 1]?.contactID
            )
            
            // Update progress log
            await this.updateSyncLog(syncId, progress, {
              lastPage: currentPage,
              lastBatchSize: batch.length
            })
            
            // Clear batch
            batch = []
            progress.lastCheckpoint = new Date()
          }

          // Check if there are more pages
          if (contacts.length < this.config.pageSize!) {
            hasMorePages = false
          } else {
            currentPage++
          }
          
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 200))
          
        } catch (error: any) {
          console.error(`Error fetching page ${currentPage}:`, error)
          progress.errors.push({
            record: `Page ${currentPage}`,
            error: error.message || 'Unknown error'
          })
          
          if (this.config.continueOnError) {
            currentPage++
            continue
          } else {
            throw error
          }
        }
      }

      // Process any remaining records in batch
      if (batch.length > 0) {
        const batchResults = await this.processBatch(batch, 'contact')
        progress.recordsProcessed += batchResults.processed
        progress.recordsSucceeded += batchResults.succeeded
        progress.recordsFailed += batchResults.failed
        progress.errors.push(...batchResults.errors)
      }

      progress.status = progress.recordsFailed === 0 ? 'SUCCESS' : 
                       progress.recordsSucceeded > 0 ? 'SUCCESS' : 'ERROR'
      progress.totalPages = currentPage - 1
      
      const duration = Date.now() - startTime
      await this.finalizeSyncLog(syncId, progress, duration)
      
      console.log(`\n=== Contacts Sync Complete ===`)
      console.log(`Total records: ${progress.recordsProcessed}`)
      console.log(`Succeeded: ${progress.recordsSucceeded}`)
      console.log(`Failed: ${progress.recordsFailed}`)
      console.log(`Duration: ${(duration / 1000).toFixed(2)}s`)
      console.log(`Pages processed: ${progress.totalPages}`)
      
      return progress
      
    } catch (error: any) {
      console.error('Fatal error in contacts sync:', error)
      progress.status = 'ERROR'
      progress.errors.push({
        record: 'Sync Operation',
        error: error.message || 'Unknown fatal error'
      })
      
      const duration = Date.now() - startTime
      await this.finalizeSyncLog(syncId, progress, duration)
      
      return progress
    }
  }

  /**
   * Sync Invoices with pagination and batch processing
   */
  async syncInvoices(resumeFromCheckpoint: boolean = false): Promise<SyncProgress> {
    const entity = 'INVOICES'
    const direction = 'PULL'
    const syncId = await this.initializeSyncLog(entity, direction)
    const startTime = Date.now()
    
    const progress: SyncProgress = {
      syncId,
      entity,
      direction,
      currentPage: 1,
      totalPages: 0,
      recordsProcessed: 0,
      recordsSucceeded: 0,
      recordsFailed: 0,
      status: 'IN_PROGRESS',
      startedAt: new Date(),
      lastCheckpoint: new Date(),
      errors: []
    }

    try {
      console.log(`\n=== Starting Scalable Invoices Sync ===`)
      console.log(`Sync ID: ${syncId}`)

      let startPage = 1
      if (resumeFromCheckpoint) {
        const checkpoint = await this.getCheckpoint(syncId, entity)
        if (checkpoint) {
          startPage = checkpoint.lastPage + 1
          console.log(`Resuming from checkpoint: page ${startPage}`)
        }
      }

      let hasMorePages = true
      let currentPage = startPage
      let batch: Invoice[] = []

      while (hasMorePages) {
        console.log(`\n--- Fetching invoices page ${currentPage} ---`)
        
        try {
          const response = await this.xeroClient.accountingApi.getInvoices(
            this.tokens.tenantId,
            undefined, // modifiedSince (Date)
            undefined, // where (string)
            undefined, // order (string)
            undefined, // IDs (string[])
            undefined, // invoice numbers (string[])
            undefined, // contact IDs (string[])
            undefined, // statuses (string[])
            currentPage, // page (number)
            undefined, // includeArchived (boolean)
            undefined, // createdByMyApp (boolean)
            undefined, // unitdp (number)
            undefined, // summaryOnly (boolean)
            this.config.pageSize, // pageSize (number)
            undefined  // searchTerm (string)
          )
          
          const invoices = response.body.invoices || []
          console.log(`Retrieved ${invoices.length} invoices from page ${currentPage}`)
          
          if (invoices.length === 0) {
            hasMorePages = false
            break
          }

          batch.push(...invoices)
          
          if (batch.length >= this.config.batchSize! || invoices.length < this.config.pageSize!) {
            const batchResults = await this.processBatch(batch, 'invoice')
            
            progress.recordsProcessed += batchResults.processed
            progress.recordsSucceeded += batchResults.succeeded
            progress.recordsFailed += batchResults.failed
            progress.errors.push(...batchResults.errors)
            
            await this.saveCheckpoint(syncId, entity, currentPage, batch[batch.length - 1]?.invoiceID)
            await this.updateSyncLog(syncId, progress, { lastPage: currentPage })
            
            batch = []
            progress.lastCheckpoint = new Date()
          }

          if (invoices.length < this.config.pageSize!) {
            hasMorePages = false
          } else {
            currentPage++
          }
          
          await new Promise(resolve => setTimeout(resolve, 200))
          
        } catch (error: any) {
          console.error(`Error fetching invoices page ${currentPage}:`, error)
          progress.errors.push({
            record: `Page ${currentPage}`,
            error: error.message || 'Unknown error'
          })
          
          if (this.config.continueOnError) {
            currentPage++
            continue
          } else {
            throw error
          }
        }
      }

      if (batch.length > 0) {
        const batchResults = await this.processBatch(batch, 'invoice')
        progress.recordsProcessed += batchResults.processed
        progress.recordsSucceeded += batchResults.succeeded
        progress.recordsFailed += batchResults.failed
        progress.errors.push(...batchResults.errors)
      }

      progress.status = progress.recordsFailed === 0 ? 'SUCCESS' : 
                       progress.recordsSucceeded > 0 ? 'SUCCESS' : 'ERROR'
      progress.totalPages = currentPage - 1
      
      const duration = Date.now() - startTime
      await this.finalizeSyncLog(syncId, progress, duration)
      
      console.log(`\n=== Invoices Sync Complete ===`)
      console.log(`Total: ${progress.recordsProcessed}, Success: ${progress.recordsSucceeded}, Failed: ${progress.recordsFailed}`)
      console.log(`Duration: ${(duration / 1000).toFixed(2)}s, Pages: ${progress.totalPages}`)
      
      return progress
      
    } catch (error: any) {
      console.error('Fatal error in invoices sync:', error)
      progress.status = 'ERROR'
      const duration = Date.now() - startTime
      await this.finalizeSyncLog(syncId, progress, duration)
      return progress
    }
  }

  /**
   * Sync Payments with pagination
   */
  async syncPayments(resumeFromCheckpoint: boolean = false): Promise<SyncProgress> {
    const entity = 'PAYMENTS'
    const direction = 'PULL'
    const syncId = await this.initializeSyncLog(entity, direction)
    const startTime = Date.now()
    
    const progress: SyncProgress = {
      syncId,
      entity,
      direction,
      currentPage: 1,
      totalPages: 0,
      recordsProcessed: 0,
      recordsSucceeded: 0,
      recordsFailed: 0,
      status: 'IN_PROGRESS',
      startedAt: new Date(),
      lastCheckpoint: new Date(),
      errors: []
    }

    try {
      console.log(`\n=== Starting Scalable Payments Sync ===`)

      let currentPage = 1
      let hasMorePages = true
      let batch: Payment[] = []

      while (hasMorePages) {
        try {
          const response = await this.xeroClient.accountingApi.getPayments(
            this.tokens.tenantId,
            undefined, // modifiedSince (Date)
            undefined, // where (string)
            undefined, // order (string)
            currentPage, // page (number)
            this.config.pageSize // pageSize (number)
          )
          
          const payments = response.body.payments || []
          console.log(`Retrieved ${payments.length} payments from page ${currentPage}`)
          
          if (payments.length === 0) {
            hasMorePages = false
            break
          }

          batch.push(...payments)
          
          if (batch.length >= this.config.batchSize! || payments.length < this.config.pageSize!) {
            const batchResults = await this.processBatch(batch, 'payment')
            
            progress.recordsProcessed += batchResults.processed
            progress.recordsSucceeded += batchResults.succeeded
            progress.recordsFailed += batchResults.failed
            progress.errors.push(...batchResults.errors)
            
            await this.saveCheckpoint(syncId, entity, currentPage)
            await this.updateSyncLog(syncId, progress)
            
            batch = []
          }

          if (payments.length < this.config.pageSize!) {
            hasMorePages = false
          } else {
            currentPage++
          }
          
          await new Promise(resolve => setTimeout(resolve, 200))
          
        } catch (error: any) {
          console.error(`Error fetching payments page ${currentPage}:`, error)
          if (this.config.continueOnError) {
            currentPage++
            continue
          } else {
            throw error
          }
        }
      }

      if (batch.length > 0) {
        const batchResults = await this.processBatch(batch, 'payment')
        progress.recordsProcessed += batchResults.processed
        progress.recordsSucceeded += batchResults.succeeded
        progress.recordsFailed += batchResults.failed
      }

      progress.status = 'SUCCESS'
      const duration = Date.now() - startTime
      await this.finalizeSyncLog(syncId, progress, duration)
      
      return progress
      
    } catch (error: any) {
      progress.status = 'ERROR'
      const duration = Date.now() - startTime
      await this.finalizeSyncLog(syncId, progress, duration)
      return progress
    }
  }

  /**
   * Process a batch of records with retry logic
   */
  private async processBatch(
    records: any[],
    type: 'contact' | 'invoice' | 'payment'
  ): Promise<{
    processed: number
    succeeded: number
    failed: number
    errors: Array<{ record: string; error: string }>
  }> {
    const result = {
      processed: records.length,
      succeeded: 0,
      failed: 0,
      errors: [] as Array<{ record: string; error: string }>
    }

    for (const record of records) {
      let retries = 0
      let success = false

      while (retries < this.config.maxRetries! && !success) {
        try {
          switch (type) {
            case 'contact':
              await this.syncSingleContact(record)
              break
            case 'invoice':
              await this.syncSingleInvoice(record)
              break
            case 'payment':
              await this.syncSinglePayment(record)
              break
          }
          success = true
          result.succeeded++
        } catch (error: any) {
          retries++
          if (retries >= this.config.maxRetries!) {
            result.failed++
            result.errors.push({
              record: this.getRecordIdentifier(record, type),
              error: error.message || 'Unknown error'
            })
          } else {
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 500 * retries))
          }
        }
      }
    }

    return result
  }

  private getRecordIdentifier(record: any, type: string): string {
    switch (type) {
      case 'contact':
        return record.name || record.contactID || 'Unknown Contact'
      case 'invoice':
        return record.invoiceNumber || record.invoiceID || 'Unknown Invoice'
      case 'payment':
        return record.paymentID || 'Unknown Payment'
      default:
        return 'Unknown Record'
    }
  }

  /**
   * Process individual contact
   */
  private async syncSingleContact(xeroContact: Contact): Promise<void> {
    if (!xeroContact.contactID || !xeroContact.name) {
      throw new Error('Contact missing required fields')
    }

    const isClient = xeroContact.isCustomer
    const isVendor = xeroContact.isSupplier

    if (!isClient && !isVendor) {
      return // Skip contacts that are neither
    }

    const systemUserId = await this.getSystemUserId()
    const primaryAddress = xeroContact.addresses?.[0]
    const phone = xeroContact.phones?.[0]?.phoneNumber || null

    if (isClient) {
      await prisma.customer.upsert({
        where: { xeroContactId: xeroContact.contactID },
        update: {
          name: xeroContact.name,
          email: xeroContact.emailAddress || null,
          phone,
          address: primaryAddress?.addressLine1 || null,
          city: primaryAddress?.city || null,
          state: primaryAddress?.region || null,
          country: primaryAddress?.country || 'Singapore',
          postalCode: primaryAddress?.postalCode || null,
          isXeroSynced: true,
          lastXeroSync: new Date(),
          updatedAt: new Date(),
        },
        create: {
          id: `xero-client-${xeroContact.contactID}`,
          name: xeroContact.name,
          email: xeroContact.emailAddress || null,
          phone,
          address: primaryAddress?.addressLine1 || null,
          city: primaryAddress?.city || null,
          state: primaryAddress?.region || null,
          country: primaryAddress?.country || 'Singapore',
          postalCode: primaryAddress?.postalCode || null,
          customerType: 'ENTERPRISE',
          isXeroSynced: true,
          lastXeroSync: new Date(),
          xeroContactId: xeroContact.contactID,
          createdById: systemUserId,
          updatedAt: new Date(),
        }
      })
    }

    if (isVendor) {
      await prisma.supplier.upsert({
        where: { xeroContactId: xeroContact.contactID },
        update: {
          name: xeroContact.name,
          email: xeroContact.emailAddress || null,
          phone,
          address: primaryAddress?.addressLine1 || null,
          city: primaryAddress?.city || null,
          state: primaryAddress?.region || null,
          country: primaryAddress?.country || 'Singapore',
          postalCode: primaryAddress?.postalCode || null,
          isXeroSynced: true,
          lastXeroSync: new Date(),
          updatedAt: new Date(),
        },
        create: {
          id: `xero-vendor-${xeroContact.contactID}`,
          name: xeroContact.name,
          email: xeroContact.emailAddress || null,
          phone,
          address: primaryAddress?.addressLine1 || null,
          city: primaryAddress?.city || null,
          state: primaryAddress?.region || null,
          country: primaryAddress?.country || 'Singapore',
          postalCode: primaryAddress?.postalCode || null,
          supplierType: 'SUPPLIER',
          isActive: true,
          isApproved: true,
          isXeroSynced: true,
          lastXeroSync: new Date(),
          xeroContactId: xeroContact.contactID,
          createdById: systemUserId,
          updatedAt: new Date(),
        }
      })
    }
  }

  /**
   * Process individual invoice (placeholder - can be expanded)
   */
  private async syncSingleInvoice(xeroInvoice: Invoice): Promise<void> {
    // Implement invoice sync logic here
    console.log(`Processing invoice: ${xeroInvoice.invoiceNumber || xeroInvoice.invoiceID}`)
    // TODO: Implement full invoice sync
  }

  /**
   * Process individual payment
   * Uses XeroPaymentPullService for comprehensive processing
   */
  private async syncSinglePayment(xeroPayment: Payment): Promise<void> {
    const { syncSinglePaymentFixed } = await import('./scalable-sync-service-fixed')
    await syncSinglePaymentFixed(xeroPayment, this.userId)
  }
}
