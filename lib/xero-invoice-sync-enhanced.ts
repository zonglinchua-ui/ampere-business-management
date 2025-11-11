
/**
 * Xero Invoice Two-Way Sync - Enhanced Edition
 * 
 * CRITICAL: Does NOT modify existing OAuth/connection code
 * Uses existing XeroSyncService for authentication
 * 
 * Features:
 * - Idempotent upserts (never duplicate)
 * - XeroSyncState tracking with hashes and timestamps
 * - Field ownership (Xero owns tax/totals/accounting, webapp owns workflow tags/notes)
 * - Conflict detection (both sides changed)
 * - Loop prevention (sync_origin + correlation_id)
 * - Comprehensive audit logging with before/after snapshots
 * - Dry-run mode for reconciliation reports
 */

import { XeroClient } from 'xero-node'
import { prisma } from './db'
import { XeroOAuthService } from './xero-oauth-service'
import crypto from 'crypto'
import { v4 as uuidv4 } from 'uuid'

// ==================== TYPES ====================

export interface InvoiceSyncOptions {
  dryRun?: boolean
  forceRefresh?: boolean
  modifiedSince?: Date
  invoiceIds?: string[] // Specific invoice IDs to sync
  direction?: 'pull' | 'push' | 'both'
}

export interface InvoiceSyncResult {
  success: boolean
  message: string
  dryRun: boolean
  pull: {
    created: number
    updated: number
    skipped: number
    conflicts: number
    errors: number
  }
  push: {
    created: number
    updated: number
    skipped: number
    conflicts: number
    errors: number
  }
  conflicts: ConflictDetail[]
  errors: ErrorDetail[]
  logId?: string
}

export interface ConflictDetail {
  invoiceNumber: string
  localId: string
  xeroId: string
  conflictType: string
  localData: any
  xeroData: any
  recommendation: string
}

export interface ErrorDetail {
  invoiceNumber: string
  operation: string
  error: string
}

// Field ownership configuration
const XERO_OWNED_FIELDS = [
  'subtotal',
  'taxAmount', 
  'totalAmount',
  'amountDue',
  'amountPaid'
]

const WEBAPP_OWNED_FIELDS = [
  'notes',
  'projectId',
  'quotationId'
]

const XERO_OWNED_LINE_FIELDS = [
  'taxType',
  'accountCode',
  'taxRate',
  'taxAmount',
  'subtotal',
  'totalPrice'
]

const WEBAPP_OWNED_LINE_FIELDS = [
  'notes',
  'category',
  'unit'
]

// ==================== MAIN SERVICE CLASS ====================

export class XeroInvoiceSyncEnhanced {
  private xeroClient: XeroClient
  private tokens: any
  private userId: string
  private correlationId: string

  constructor(userId: string) {
    this.userId = userId
    this.correlationId = crypto.randomUUID()
    this.xeroClient = new XeroClient({
      clientId: process.env.XERO_CLIENT_ID!,
      clientSecret: process.env.XERO_CLIENT_SECRET!,
      redirectUris: [process.env.XERO_REDIRECT_URI!],
      scopes: process.env.XERO_SCOPES!.split(' '),
    })
  }

  /**
   * Initialize service with stored tokens (reuses existing OAuth)
   */
  async initialize(): Promise<boolean> {
    try {
      this.tokens = await XeroOAuthService.getStoredTokens()

      if (!this.tokens) {
        console.log('⚠️ No Xero tokens found')
        return false
      }

      // Check token expiry
      const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000)
      if (this.tokens.expiresAt <= fiveMinutesFromNow) {
        console.log('🔄 Token expires soon, refreshing...')
        const oauthService = new XeroOAuthService()
        const newTokens = await oauthService.refreshAccessToken(
          this.tokens.refreshToken,
          this.tokens.tenantId
        )

        if (!newTokens) {
          console.error('❌ Failed to refresh token')
          return false
        }

        this.tokens = newTokens
      }

      this.xeroClient.setTokenSet({
        access_token: this.tokens.accessToken,
        refresh_token: this.tokens.refreshToken,
        expires_at: this.tokens.expiresAt.getTime()
      })

      console.log('✅ Xero Invoice Sync Enhanced initialized')
      return true

    } catch (error: any) {
      console.error('❌ Failed to initialize:', error.message)
      return false
    }
  }

  /**
   * Main sync entry point - Two-way sync with conflict detection
   */
  async syncInvoices(options: InvoiceSyncOptions = {}): Promise<InvoiceSyncResult> {
    const startTime = Date.now()
    const result: InvoiceSyncResult = {
      success: false,
      message: '',
      dryRun: options.dryRun || false,
      pull: { created: 0, updated: 0, skipped: 0, conflicts: 0, errors: 0 },
      push: { created: 0, updated: 0, skipped: 0, conflicts: 0, errors: 0 },
      conflicts: [],
      errors: []
    }

    try {
      if (!this.tokens) {
        throw new Error('Service not initialized')
      }

      // Generate new correlation ID for this sync batch
      this.correlationId = crypto.randomUUID()

      console.log(`🔄 Starting invoice sync (correlation: ${this.correlationId})`)
      console.log(`   Mode: ${options.dryRun ? 'DRY RUN' : 'LIVE'}`)
      console.log(`   Direction: ${options.direction || 'both'}`)

      // Log sync start
      const logId = await this.createSyncLog('START', {
        correlationId: this.correlationId,
        options
      })
      result.logId = logId

      // Pull from Xero (if direction is 'pull' or 'both')
      if (!options.direction || options.direction === 'pull' || options.direction === 'both') {
        await this.pullInvoicesFromXero(options, result)
      }

      // Push to Xero (if direction is 'push' or 'both')
      if (!options.direction || options.direction === 'push' || options.direction === 'both') {
        await this.pushInvoicesToXero(options, result)
      }

      // Calculate totals
      const totalOps = 
        result.pull.created + result.pull.updated + result.push.created + result.push.updated
      const totalConflicts = result.pull.conflicts + result.push.conflicts
      const totalErrors = result.pull.errors + result.push.errors

      result.success = totalErrors === 0 && totalConflicts === 0
      result.message = options.dryRun
        ? `DRY RUN: Would sync ${totalOps} invoices (${totalConflicts} conflicts detected)`
        : `Synced ${totalOps} invoices (${totalConflicts} conflicts, ${totalErrors} errors)`

      // Log sync completion
      await this.updateSyncLog(logId, 'SUCCESS', result)

      const duration = Date.now() - startTime
      console.log(`✅ Sync completed in ${duration}ms`)
      console.log(`   Pull: ${result.pull.created} created, ${result.pull.updated} updated, ${result.pull.skipped} skipped`)
      console.log(`   Push: ${result.push.created} created, ${result.push.updated} updated, ${result.push.skipped} skipped`)
      if (totalConflicts > 0) {
        console.warn(`   ⚠️  ${totalConflicts} conflicts detected`)
      }

      return result

    } catch (error: any) {
      console.error('❌ Sync failed:', error)
      result.success = false
      result.message = `Sync failed: ${error.message}`
      
      if (result.logId) {
        await this.updateSyncLog(result.logId, 'ERROR', result, error.message)
      }

      return result
    }
  }

  // ==================== PULL FROM XERO ====================

  /**
   * Pull invoices from Xero to local database
   */
  private async pullInvoicesFromXero(
    options: InvoiceSyncOptions,
    result: InvoiceSyncResult
  ): Promise<void> {
    try {
      console.log('📥 Pulling invoices from Xero...')

      // Build query parameters
      const params: any = {}
      if (options.modifiedSince) {
        params.where = `UpdatedDateUTC >= DateTime(${options.modifiedSince.toISOString()})`
      }
      if (options.invoiceIds && options.invoiceIds.length > 0) {
        params.IDs = options.invoiceIds
      }

      // Fetch all invoices from Xero with pagination
      let allInvoices: any[] = []
      let page = 1
      let hasMorePages = true

      while (hasMorePages) {
        console.log(`📥 Fetching page ${page} from Xero...`)
        
        const response = await this.xeroClient.accountingApi.getInvoices(
          this.tokens.tenantId,
          undefined, // ifModifiedSince
          params.where,
          undefined, // order
          params.IDs,
          undefined, // invoiceNumbers
          undefined, // contactIDs
          undefined, // statuses
          page  // page number
        )

        const xeroInvoices = response.body.invoices || []
        allInvoices = allInvoices.concat(xeroInvoices)
        
        console.log(`📥 Fetched ${xeroInvoices.length} invoices from page ${page} (total: ${allInvoices.length})`)

        // Check if there are more pages
        // Xero typically returns 100 invoices per page
        if (xeroInvoices.length < 100) {
          hasMorePages = false
        } else {
          page++
        }
      }

      console.log(`✅ Total invoices fetched from Xero: ${allInvoices.length}`)

      // Process each invoice
      for (const xeroInvoice of allInvoices) {
        await this.processXeroInvoice(xeroInvoice, options, result)
      }

    } catch (error: any) {
      console.error('❌ Pull failed:', error)
      result.pull.errors++
      result.errors.push({
        invoiceNumber: 'N/A',
        operation: 'pull',
        error: error.message
      })
    }
  }

  /**
   * Process single Xero invoice for pull operation
   */
  private async processXeroInvoice(
    xeroInvoice: any,
    options: InvoiceSyncOptions,
    result: InvoiceSyncResult
  ): Promise<void> {
    const invoiceNumber = xeroInvoice.invoiceNumber || 'UNKNOWN'
    
    try {
      const xeroId = xeroInvoice.invoiceID
      const contactId = xeroInvoice.contact?.contactID
      const invoiceType = xeroInvoice.type // ACCREC (customer) or ACCPAY (supplier)

      if (!xeroId || !contactId) {
        console.warn(`⚠️  Skipping invoice ${invoiceNumber} - missing required fields`)
        result.pull.skipped++
        return
      }

      // Validate invoice type
      if (invoiceType !== 'ACCREC' && invoiceType !== 'ACCPAY') {
        console.warn(`⚠️  Skipping invoice ${invoiceNumber} - unexpected type: ${invoiceType}`)
        result.pull.skipped++
        return
      }

      // Route to appropriate handler based on invoice type
      if (invoiceType === 'ACCPAY') {
        // Handle supplier invoice (bill)
        await this.handleSupplierInvoiceSync(xeroInvoice, invoiceNumber, contactId, xeroId, options, result)
        return
      }

      // Handle customer invoice (ACCREC)
      // Find local customer by Xero contact ID
      const customer = await prisma.customer.findUnique({
        where: { xeroContactId: contactId }
      })

      if (!customer) {
        console.warn(`⚠️  Skipping invoice ${invoiceNumber} - customer not synced`)
        result.pull.skipped++
        result.errors.push({
          invoiceNumber,
          operation: 'pull',
          error: 'Customer not found - please sync contacts first'
        })
        return
      }

      // Calculate remote hash
      const remoteHash = this.calculateInvoiceHash(this.extractXeroInvoiceData(xeroInvoice))

      // Find existing sync state
      const existingState = await prisma.xero_sync_state.findFirst({
        where: {
          entityType: 'CLIENT_INVOICE',
          xeroId: xeroId
        }
      })

      // Find local invoice
      const localInvoice = await prisma.customerInvoice.findFirst({
        where: {
          OR: [
            { xeroInvoiceId: xeroId },
            { invoiceNumber: invoiceNumber, customerId: customer.id }
          ]
        },
        include: {
          CustomerInvoiceItem: {
            orderBy: { order: 'asc' }
          }
        }
      })

      if (localInvoice) {
        // Calculate local hash
        const localHash = this.calculateInvoiceHash(this.extractLocalInvoiceData(localInvoice))

        // CONFLICT DETECTION: Check if both sides changed
        if (existingState?.lastLocalHash && existingState?.lastRemoteHash) {
          const localChanged = localHash !== existingState.lastLocalHash
          const remoteChanged = remoteHash !== existingState.lastRemoteHash
          
          if (localChanged && remoteChanged) {
            console.warn(`⚠️  CONFLICT detected for invoice ${invoiceNumber}`)
            result.pull.conflicts++
            
            // Record conflict
            await this.recordConflict(
              localInvoice.id,
              xeroId,
              invoiceNumber,
              localInvoice,
              xeroInvoice,
              options.dryRun || false
            )

            result.conflicts.push({
              invoiceNumber,
              localId: localInvoice.id,
              xeroId,
              conflictType: 'BOTH_MODIFIED',
              localData: this.extractLocalInvoiceData(localInvoice),
              xeroData: this.extractXeroInvoiceData(xeroInvoice),
              recommendation: 'Manual review required - both local and Xero data modified'
            })

            return
          }

          // Skip if no changes
          if (!remoteChanged && !options.forceRefresh) {
            console.log(`⏭️  Skipping ${invoiceNumber} - no remote changes`)
            result.pull.skipped++
            return
          }
        }

        // UPDATE existing invoice (only Xero-owned fields)
        await this.updateLocalInvoiceFromXero(
          localInvoice.id,
          xeroInvoice,
          customer.id,
          remoteHash,
          options.dryRun || false,
          result
        )

        result.pull.updated++
        console.log(`✅ Updated local invoice: ${invoiceNumber}`)

      } else {
        // CREATE new invoice
        await this.createLocalInvoiceFromXero(
          xeroInvoice,
          xeroId,
          customer.id,
          remoteHash,
          options.dryRun || false,
          result
        )

        result.pull.created++
        console.log(`✅ Created local invoice: ${invoiceNumber}`)
      }

    } catch (error: any) {
      console.error(`❌ Failed to process invoice ${invoiceNumber}:`, error)
      result.pull.errors++
      result.errors.push({
        invoiceNumber,
        operation: 'pull',
        error: error.message
      })
    }
  }

  /**
   * Handle supplier invoice (ACCPAY) sync from Xero
   */
  private async handleSupplierInvoiceSync(
    xeroInvoice: any,
    invoiceNumber: string,
    contactId: string,
    xeroId: string,
    options: InvoiceSyncOptions,
    result: InvoiceSyncResult
  ) {
    try {
      console.log(`📥 Processing supplier invoice (ACCPAY): ${invoiceNumber}`)

      // Find local supplier by Xero contact ID
      const supplier = await prisma.supplier.findUnique({
        where: { xeroContactId: contactId }
      })

      if (!supplier) {
        console.warn(`⚠️  Skipping supplier invoice ${invoiceNumber} - supplier not synced`)
        result.pull.skipped++
        result.errors.push({
          invoiceNumber,
          operation: 'pull',
          error: 'Supplier not found - please sync contacts first'
        })
        return
      }

      // Find existing supplier invoice
      const existingInvoice = await prisma.supplierInvoice.findFirst({
        where: {
          OR: [
            { xeroInvoiceId: xeroId },
            { invoiceNumber: invoiceNumber, supplierId: supplier.id }
          ]
        }
      })

      if (existingInvoice) {
        // Update existing supplier invoice
        await this.updateSupplierInvoiceFromXero(
          existingInvoice.id,
          xeroInvoice,
          supplier.id,
          options.dryRun || false,
          result
        )
      } else {
        // Create new supplier invoice
        await this.createSupplierInvoiceFromXero(
          xeroInvoice,
          xeroId,
          supplier.id,
          options.dryRun || false,
          result
        )
      }

    } catch (error: any) {
      console.error(`❌ Failed to process supplier invoice ${invoiceNumber}:`, error)
      result.pull.errors++
      result.errors.push({
        invoiceNumber,
        operation: 'pull',
        error: error.message
      })
    }
  }

  /**
   * Create supplier invoice from Xero data
   */
  private async createSupplierInvoiceFromXero(
    xeroInvoice: any,
    xeroId: string,
    supplierId: string,
    dryRun: boolean,
    result: InvoiceSyncResult
  ) {
    const invoiceNumber = xeroInvoice.invoiceNumber || 'UNKNOWN'

    if (dryRun) {
      console.log(`[DRY RUN] Would create supplier invoice ${invoiceNumber}`)
      result.pull.created++
      return
    }

    try {
      // Parse dates
      const invoiceDate = xeroInvoice.date ? new Date(xeroInvoice.date) : new Date()
      const dueDate = xeroInvoice.dueDate ? new Date(xeroInvoice.dueDate) : new Date()

      // Parse amounts
      const subtotal = parseFloat(xeroInvoice.subTotal) || 0
      const taxAmount = parseFloat(xeroInvoice.totalTax) || 0
      const totalAmount = parseFloat(xeroInvoice.total) || 0
      const amountDue = parseFloat(xeroInvoice.amountDue) || totalAmount
      const amountPaid = parseFloat(xeroInvoice.amountPaid) || 0

      // Map Xero status to SupplierInvoiceStatus enum
      const statusMap: { [key: string]: any } = {
        'DRAFT': 'DRAFT',
        'SUBMITTED': 'RECEIVED',
        'AUTHORISED': 'APPROVED',
        'PAID': 'PAID',
        'VOIDED': 'REJECTED'
      }
      const status = statusMap[xeroInvoice.status] || 'RECEIVED'

      // Create supplier invoice
      const supplierInvoice = await prisma.supplierInvoice.create({
        data: {
          id: `sinv_xero_${xeroId}_${Date.now()}`,
          invoiceNumber,
          supplierId,
          xeroInvoiceId: xeroId,
          isXeroSynced: true,
          invoiceDate,
          dueDate,
          receivedDate: new Date(), // Mark as received when synced from Xero
          subtotal,
          taxAmount,
          totalAmount,
          currency: xeroInvoice.currencyCode || 'SGD',
          status: status as any,
          description: xeroInvoice.reference || '',
          notes: xeroInvoice.reference || '',
          createdById: 'system_xero_sync',
          updatedAt: new Date()
        }
      })

      console.log(`✅ Created supplier invoice ${invoiceNumber} (ID: ${supplierInvoice.id})`)
      result.pull.created++

    } catch (error: any) {
      console.error(`❌ Failed to create supplier invoice ${invoiceNumber}:`, error)
      result.pull.errors++
      throw error
    }
  }

  /**
   * Update supplier invoice from Xero data
   */
  private async updateSupplierInvoiceFromXero(
    supplierInvoiceId: string,
    xeroInvoice: any,
    supplierId: string,
    dryRun: boolean,
    result: InvoiceSyncResult
  ) {
    const invoiceNumber = xeroInvoice.invoiceNumber || 'UNKNOWN'

    if (dryRun) {
      console.log(`[DRY RUN] Would update supplier invoice ${invoiceNumber}`)
      result.pull.updated++
      return
    }

    try {
      // Parse amounts
      const subtotal = parseFloat(xeroInvoice.subTotal) || 0
      const taxAmount = parseFloat(xeroInvoice.totalTax) || 0
      const totalAmount = parseFloat(xeroInvoice.total) || 0

      // Map Xero status to SupplierInvoiceStatus enum
      const statusMap: { [key: string]: any } = {
        'DRAFT': 'DRAFT',
        'SUBMITTED': 'RECEIVED',
        'AUTHORISED': 'APPROVED',
        'PAID': 'PAID',
        'VOIDED': 'REJECTED'
      }
      const status = statusMap[xeroInvoice.status] || 'RECEIVED'

      // Update supplier invoice (only Xero-owned fields)
      await prisma.supplierInvoice.update({
        where: { id: supplierInvoiceId },
        data: {
          subtotal,
          taxAmount,
          totalAmount,
          status: status as any,
          isXeroSynced: true,
          xeroInvoiceId: xeroInvoice.invoiceID,
          lastXeroSync: new Date(),
          updatedAt: new Date()
        }
      })

      console.log(`✅ Updated supplier invoice ${invoiceNumber}`)
      result.pull.updated++

    } catch (error: any) {
      console.error(`❌ Failed to update supplier invoice ${invoiceNumber}:`, error)
      result.pull.errors++
      throw error
    }
  }

  /**
   * Create local invoice from Xero data
   */
  private async createLocalInvoiceFromXero(
    xeroInvoice: any,
    xeroId: string,
    customerId: string,
    remoteHash: string,
    dryRun: boolean,
    result: InvoiceSyncResult
  ): Promise<void> {
    const invoiceData = this.extractXeroInvoiceData(xeroInvoice)
    const invoiceNumber = xeroInvoice.invoiceNumber
    
    if (dryRun) {
      console.log(`   [DRY RUN] Would create invoice: ${invoiceNumber}`)
      return
    }

    // Get system user for createdById
    const systemUser = await prisma.user.findFirst({
      where: { role: 'SUPERADMIN' }
    })

    if (!systemUser) {
      throw new Error('No SUPERADMIN user found')
    }

    const newInvoiceId = crypto.randomUUID()

    // Log before snapshot
    await this.logInvoiceOperation(
      this.correlationId,
      'CREATE',
      newInvoiceId,
      xeroId,
      invoiceNumber,
      'remote',
      null,
      invoiceData,
      'SUCCESS'
    )

    // Create invoice
    await prisma.customerInvoice.create({
      data: {
        id: newInvoiceId,
        invoiceNumber,
        customerId,
        subtotal: invoiceData.subtotal,
        taxAmount: invoiceData.taxAmount,
        totalAmount: invoiceData.totalAmount,
        amountDue: invoiceData.amountDue,
        amountPaid: invoiceData.amountPaid,
        currency: invoiceData.currency,
        status: invoiceData.status,
        issueDate: invoiceData.issueDate,
        dueDate: invoiceData.dueDate,
        description: invoiceData.description,
        xeroInvoiceId: xeroId,
        isXeroSynced: true,
        lastXeroSync: new Date(),
        createdById: systemUser.id,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    })

    // Create line items
    const lineItems = this.extractXeroLineItems(xeroInvoice, newInvoiceId)
    if (lineItems.length > 0) {
      await prisma.customerInvoiceItem.createMany({
        data: lineItems
      })
    }

    // Create sync state
    await prisma.xero_sync_state.create({
      data: {
        id: crypto.randomUUID(),
        entityType: 'CLIENT_INVOICE',
        entityId: newInvoiceId,
        xeroId,
        lastLocalHash: remoteHash, // Local now matches remote
        lastRemoteHash: remoteHash,
        lastSyncedAt: new Date(),
        lastRemoteModified: xeroInvoice.updatedDateUTC ? new Date(xeroInvoice.updatedDateUTC) : new Date(),
        syncOrigin: 'remote',
        correlationId: this.correlationId,
        status: 'ACTIVE',
        updatedAt: new Date()
      }
    })
  }

  /**
   * Update local invoice from Xero data (only Xero-owned fields)
   */
  private async updateLocalInvoiceFromXero(
    localId: string,
    xeroInvoice: any,
    customerId: string,
    remoteHash: string,
    dryRun: boolean,
    result: InvoiceSyncResult
  ): Promise<void> {
    const invoiceData = this.extractXeroInvoiceData(xeroInvoice)
    const invoiceNumber = xeroInvoice.invoiceNumber

    if (dryRun) {
      console.log(`   [DRY RUN] Would update invoice: ${invoiceNumber}`)
      return
    }

    // Get current invoice for before snapshot
    const beforeInvoice = await prisma.customerInvoice.findUnique({
      where: { id: localId },
      include: { CustomerInvoiceItem: true }
    })

    // Update invoice (only Xero-owned fields)
    await prisma.customerInvoice.update({
      where: { id: localId },
      data: {
        // Xero-owned fields only
        subtotal: invoiceData.subtotal,
        taxAmount: invoiceData.taxAmount,
        totalAmount: invoiceData.totalAmount,
        amountDue: invoiceData.amountDue,
        amountPaid: invoiceData.amountPaid,
        status: invoiceData.status,
        issueDate: invoiceData.issueDate,
        dueDate: invoiceData.dueDate,
        xeroInvoiceId: xeroInvoice.invoiceID,
        isXeroSynced: true,
        lastXeroSync: new Date(),
        updatedAt: new Date()
        // DO NOT update: notes, projectId, quotationId (webapp-owned)
      }
    })

    // Update line items (delete and recreate)
    await prisma.customerInvoiceItem.deleteMany({
      where: { customerInvoiceId: localId }
    })

    const lineItems = this.extractXeroLineItems(xeroInvoice, localId)
    if (lineItems.length > 0) {
      await prisma.customerInvoiceItem.createMany({
        data: lineItems
      })
    }

    // Calculate new local hash
    const afterInvoice = await prisma.customerInvoice.findUnique({
      where: { id: localId },
      include: { CustomerInvoiceItem: true }
    })
    const newLocalHash = this.calculateInvoiceHash(this.extractLocalInvoiceData(afterInvoice!))

    // Log operation
    await this.logInvoiceOperation(
      this.correlationId,
      'UPDATE',
      localId,
      xeroInvoice.invoiceID,
      invoiceNumber,
      'remote',
      this.extractLocalInvoiceData(beforeInvoice!),
      this.extractLocalInvoiceData(afterInvoice!),
      'SUCCESS'
    )

    // Update sync state
    await prisma.xero_sync_state.upsert({
      where: {
        entityType_entityId: {
          entityType: 'CLIENT_INVOICE',
          entityId: localId
        }
      },
      create: {
        id: crypto.randomUUID(),
        entityType: 'CLIENT_INVOICE',
        entityId: localId,
        xeroId: xeroInvoice.invoiceID,
        lastLocalHash: newLocalHash,
        lastRemoteHash: remoteHash,
        lastSyncedAt: new Date(),
        lastRemoteModified: xeroInvoice.updatedDateUTC ? new Date(xeroInvoice.updatedDateUTC) : new Date(),
        syncOrigin: 'remote',
        correlationId: this.correlationId,
        status: 'ACTIVE',
        updatedAt: new Date()
      },
      update: {
        lastLocalHash: newLocalHash,
        lastRemoteHash: remoteHash,
        lastSyncedAt: new Date(),
        lastRemoteModified: xeroInvoice.updatedDateUTC ? new Date(xeroInvoice.updatedDateUTC) : new Date(),
        syncOrigin: 'remote',
        correlationId: this.correlationId,
        status: 'ACTIVE',
        updatedAt: new Date()
      }
    })
  }

  // ==================== PUSH TO XERO ====================

  /**
   * Push invoices from local database to Xero
   */
  private async pushInvoicesToXero(
    options: InvoiceSyncOptions,
    result: InvoiceSyncResult
  ): Promise<void> {
    try {
      console.log('📤 Pushing invoices to Xero...')

      // Find invoices to push
      const invoicesToPush = await this.findInvoicesToPush(options)
      console.log(`📋 Found ${invoicesToPush.length} invoices to push`)

      // Process each invoice
      for (const invoice of invoicesToPush) {
        await this.processLocalInvoice(invoice, options, result)
      }

    } catch (error: any) {
      console.error('❌ Push failed:', error)
      result.push.errors++
      result.errors.push({
        invoiceNumber: 'N/A',
        operation: 'push',
        error: error.message
      })
    }
  }

  /**
   * Find invoices that need to be pushed to Xero
   */
  private async findInvoicesToPush(options: InvoiceSyncOptions): Promise<any[]> {
    const where: any = {}

    if (options.invoiceIds && options.invoiceIds.length > 0) {
      where.id = { in: options.invoiceIds }
    } else {
      // Find invoices that are unsynced or modified since last sync
      where.OR = [
        { isXeroSynced: false },
        { xeroInvoiceId: null }
      ]
    }

    return await prisma.customerInvoice.findMany({
      where,
      include: {
        Customer: true,
        CustomerInvoiceItem: {
          orderBy: { order: 'asc' }
        }
      }
    })
  }

  /**
   * Process single local invoice for push operation
   */
  private async processLocalInvoice(
    invoice: any,
    options: InvoiceSyncOptions,
    result: InvoiceSyncResult
  ): Promise<void> {
    const invoiceNumber = invoice.invoiceNumber

    try {
      // Validate client has Xero contact ID
      if (!invoice.Client.xeroContactId) {
        console.warn(`⚠️  Skipping invoice ${invoiceNumber} - client not synced`)
        result.push.skipped++
        result.errors.push({
          invoiceNumber,
          operation: 'push',
          error: 'Client not synced with Xero'
        })
        return
      }

      // Calculate local hash
      const localHash = this.calculateInvoiceHash(this.extractLocalInvoiceData(invoice))

      // Find existing sync state
      const existingState = await prisma.xero_sync_state.findFirst({
        where: {
          entityType: 'CLIENT_INVOICE',
          entityId: invoice.id
        }
      })

      // Check if invoice exists in Xero
      if (invoice.xeroInvoiceId) {
        // Fetch current Xero invoice
        const xeroResponse = await this.xeroClient.accountingApi.getInvoice(
          this.tokens.tenantId,
          invoice.xeroInvoiceId
        )

        const xeroInvoice = xeroResponse.body.invoices?.[0]

        if (xeroInvoice) {
          // Calculate remote hash
          const remoteHash = this.calculateInvoiceHash(this.extractXeroInvoiceData(xeroInvoice))

          // CONFLICT DETECTION
          if (existingState?.lastLocalHash && existingState?.lastRemoteHash) {
            const localChanged = localHash !== existingState.lastLocalHash
            const remoteChanged = remoteHash !== existingState.lastRemoteHash

            if (localChanged && remoteChanged) {
              console.warn(`⚠️  CONFLICT detected for invoice ${invoiceNumber}`)
              result.push.conflicts++
              
              await this.recordConflict(
                invoice.id,
                invoice.xeroInvoiceId,
                invoiceNumber,
                invoice,
                xeroInvoice,
                options.dryRun || false
              )

              result.conflicts.push({
                invoiceNumber,
                localId: invoice.id,
                xeroId: invoice.xeroInvoiceId,
                conflictType: 'BOTH_MODIFIED',
                localData: this.extractLocalInvoiceData(invoice),
                xeroData: this.extractXeroInvoiceData(xeroInvoice),
                recommendation: 'Manual review required - both local and Xero data modified'
              })

              return
            }

            // Skip if no local changes
            if (!localChanged && !options.forceRefresh) {
              console.log(`⏭️  Skipping ${invoiceNumber} - no local changes`)
              result.push.skipped++
              return
            }
          }

          // UPDATE Xero invoice
          await this.updateXeroInvoice(
            invoice,
            localHash,
            options.dryRun || false,
            result
          )

          result.push.updated++
          console.log(`✅ Updated Xero invoice: ${invoiceNumber}`)

        } else {
          // Xero invoice not found - treat as create
          await this.createXeroInvoice(
            invoice,
            localHash,
            options.dryRun || false,
            result
          )

          result.push.created++
          console.log(`✅ Created Xero invoice: ${invoiceNumber}`)
        }

      } else {
        // CREATE new Xero invoice
        await this.createXeroInvoice(
          invoice,
          localHash,
          options.dryRun || false,
          result
        )

        result.push.created++
        console.log(`✅ Created Xero invoice: ${invoiceNumber}`)
      }

    } catch (error: any) {
      console.error(`❌ Failed to process invoice ${invoiceNumber}:`, error)
      result.push.errors++
      result.errors.push({
        invoiceNumber,
        operation: 'push',
        error: error.message
      })
    }
  }

  /**
   * Create invoice in Xero with comprehensive error handling
   */
  private async createXeroInvoice(
    invoice: any,
    localHash: string,
    dryRun: boolean,
    result: InvoiceSyncResult
  ): Promise<void> {
    if (dryRun) {
      console.log(`   [DRY RUN] Would create Xero invoice: ${invoice.invoiceNumber}`)
      return
    }

    const xeroInvoice = this.buildXeroInvoiceFromLocal(invoice)
    
    // Retry logic with exponential backoff
    let retries = 0
    const maxRetries = 3
    let lastError: any = null

    while (retries < maxRetries) {
      try {
        const response = await this.xeroClient.accountingApi.createInvoices(
          this.tokens.tenantId,
          { invoices: [xeroInvoice] }
        )

        const createdInvoice = response.body.invoices?.[0]

        // Check for validation errors in the response
        if (createdInvoice?.hasErrors || createdInvoice?.validationErrors?.length) {
          const validationErrors = createdInvoice.validationErrors || []
          const errorMessages = validationErrors.map((err: any) => err.message).join('; ')
          
          console.error(`❌ Xero validation errors for invoice ${invoice.invoiceNumber}:`, {
            invoiceNumber: invoice.invoiceNumber,
            validationErrors: validationErrors,
            invoiceData: {
              contactId: invoice.Customer?.xeroContactId,
              contactName: invoice.Customer?.name,
              lineItems: xeroInvoice.lineItems.map((item: any) => ({
                description: item.description,
                quantity: item.quantity,
                unitAmount: item.unitAmount,
                taxType: item.taxType,
                accountCode: item.accountCode
              })),
              status: xeroInvoice.status,
              currency: xeroInvoice.currencyCode
            }
          })

          // Log detailed validation error
          await this.logInvoiceOperation(
            this.correlationId,
            'CREATE',
            invoice.id,
            null,
            invoice.invoiceNumber,
            'local',
            this.extractLocalInvoiceData(invoice),
            null,
            'VALIDATION_ERROR',
            `Xero validation errors: ${errorMessages}`
          )

          throw new Error(`Xero validation failed: ${errorMessages}`)
        }

        if (!createdInvoice || !createdInvoice.invoiceID) {
          throw new Error('Failed to get invoiceID from Xero response')
        }

        // Log successful operation
        await this.logInvoiceOperation(
          this.correlationId,
          'CREATE',
          invoice.id,
          createdInvoice.invoiceID,
          invoice.invoiceNumber,
          'local',
          null,
          this.extractXeroInvoiceData(createdInvoice),
          'SUCCESS'
        )

        // Update local invoice with Xero ID
        await prisma.customerInvoice.update({
          where: { id: invoice.id },
          data: {
            xeroInvoiceId: createdInvoice.invoiceID,
            isXeroSynced: true,
            lastXeroSync: new Date(),
            updatedAt: new Date()
          }
        })

        // Calculate remote hash
        const remoteHash = this.calculateInvoiceHash(this.extractXeroInvoiceData(createdInvoice))

        // Create sync state
        await prisma.xero_sync_state.create({
          data: {
            id: crypto.randomUUID(),
            entityType: 'CLIENT_INVOICE',
            entityId: invoice.id,
            xeroId: createdInvoice.invoiceID,
            lastLocalHash: localHash,
            lastRemoteHash: remoteHash,
            lastSyncedAt: new Date(),
            lastLocalModified: invoice.updatedAt,
            lastRemoteModified: createdInvoice.updatedDateUTC ? new Date(createdInvoice.updatedDateUTC) : new Date(),
            syncOrigin: 'local',
            correlationId: this.correlationId,
            status: 'ACTIVE',
            updatedAt: new Date()
          }
        })

        // Success - return from retry loop
        return

      } catch (error: any) {
        lastError = error
        retries++
        
        const statusCode = error?.response?.statusCode || error?.statusCode
        const responseBody = error?.response?.body

        // Log detailed error information
        console.error(`❌ Attempt ${retries}/${maxRetries} failed for invoice ${invoice.invoiceNumber}:`, {
          statusCode,
          message: error.message,
          responseBody,
          invoiceNumber: invoice.invoiceNumber,
          contactId: invoice.Customer?.xeroContactId,
          contactName: invoice.Customer?.name
        })

        // Check for validation errors in error response (Elements array)
        if (responseBody?.Elements && Array.isArray(responseBody.Elements)) {
          responseBody.Elements.forEach((element: any, idx: number) => {
            if (element.ValidationErrors?.length) {
              console.error(`❌ Invoice ${idx} validation errors:`, {
                validationErrors: element.ValidationErrors,
                invoiceNumber: invoice.invoiceNumber,
                invoiceData: xeroInvoice
              })
            }
          })
        }

        // Handle rate limiting (429)
        if (statusCode === 429) {
          const retryAfter = error?.response?.headers?.['retry-after']
          const delayMs = retryAfter ? parseInt(retryAfter) * 1000 : 5000
          console.warn(`🔁 Rate limited. Retrying invoice ${invoice.invoiceNumber} in ${delayMs}ms`)
          await new Promise(r => setTimeout(r, delayMs))
          continue
        }

        // Handle server errors (5xx) with exponential backoff
        if (statusCode >= 500 && statusCode < 600) {
          const delayMs = 5000 * retries
          console.warn(`🔁 Server error. Retrying invoice ${invoice.invoiceNumber} in ${delayMs}ms`)
          await new Promise(r => setTimeout(r, delayMs))
          continue
        }

        // For validation errors (400), don't retry
        if (statusCode === 400) {
          console.error(`❌ Validation error for invoice ${invoice.invoiceNumber} - not retrying`)
          
          // Log validation error details
          await this.logInvoiceOperation(
            this.correlationId,
            'CREATE',
            invoice.id,
            null,
            invoice.invoiceNumber,
            'local',
            this.extractLocalInvoiceData(invoice),
            null,
            'VALIDATION_ERROR',
            `Xero API error: ${error.message}. Response: ${JSON.stringify(responseBody)}`
          )
          
          throw error
        }

        // If max retries reached, throw error
        if (retries >= maxRetries) {
          console.error(`❌ Max retries (${maxRetries}) reached for invoice ${invoice.invoiceNumber}`)
          
          // Log final failure
          await this.logInvoiceOperation(
            this.correlationId,
            'CREATE',
            invoice.id,
            null,
            invoice.invoiceNumber,
            'local',
            this.extractLocalInvoiceData(invoice),
            null,
            'ERROR',
            `Failed after ${maxRetries} attempts: ${error.message}`
          )
          
          throw error
        }

        // For other errors, retry with exponential backoff
        const delayMs = 1000 * Math.pow(2, retries - 1)
        console.warn(`🔁 Retrying invoice ${invoice.invoiceNumber} in ${delayMs}ms (attempt ${retries}/${maxRetries})`)
        await new Promise(r => setTimeout(r, delayMs))
      }
    }

    // If we get here, all retries failed
    throw lastError || new Error('Failed to create invoice in Xero after all retries')
  }

  /**
   * Update invoice in Xero with comprehensive error handling
   */
  private async updateXeroInvoice(
    invoice: any,
    localHash: string,
    dryRun: boolean,
    result: InvoiceSyncResult
  ): Promise<void> {
    if (dryRun) {
      console.log(`   [DRY RUN] Would update Xero invoice: ${invoice.invoiceNumber}`)
      return
    }

    const xeroInvoice = this.buildXeroInvoiceFromLocal(invoice)

    // Retry logic with exponential backoff
    let retries = 0
    const maxRetries = 3
    let lastError: any = null
    let beforeInvoice: any = null

    while (retries < maxRetries) {
      try {
        // Get before state
        const beforeResponse = await this.xeroClient.accountingApi.getInvoice(
          this.tokens.tenantId,
          invoice.xeroInvoiceId
        )
        beforeInvoice = beforeResponse.body.invoices?.[0]

        // Update
        const updateResponse = await this.xeroClient.accountingApi.updateInvoice(
          this.tokens.tenantId,
          invoice.xeroInvoiceId,
          { invoices: [xeroInvoice] }
        )

        const updatedInvoice = updateResponse.body.invoices?.[0]

        // Check for validation errors in the response
        if (updatedInvoice?.hasErrors || updatedInvoice?.validationErrors?.length) {
          const validationErrors = updatedInvoice.validationErrors || []
          const errorMessages = validationErrors.map((err: any) => err.message).join('; ')
          
          console.error(`❌ Xero validation errors for invoice ${invoice.invoiceNumber}:`, {
            invoiceNumber: invoice.invoiceNumber,
            validationErrors: validationErrors,
            invoiceData: {
              contactId: invoice.Customer?.xeroContactId,
              contactName: invoice.Customer?.name,
              xeroInvoiceId: invoice.xeroInvoiceId,
              lineItems: xeroInvoice.lineItems.map((item: any) => ({
                description: item.description,
                quantity: item.quantity,
                unitAmount: item.unitAmount,
                taxType: item.taxType,
                accountCode: item.accountCode
              })),
              status: xeroInvoice.status,
              currency: xeroInvoice.currencyCode
            }
          })

          // Log detailed validation error
          await this.logInvoiceOperation(
            this.correlationId,
            'UPDATE',
            invoice.id,
            invoice.xeroInvoiceId,
            invoice.invoiceNumber,
            'local',
            this.extractXeroInvoiceData(beforeInvoice),
            null,
            'VALIDATION_ERROR',
            `Xero validation errors: ${errorMessages}`
          )

          throw new Error(`Xero validation failed: ${errorMessages}`)
        }

        // Get after state
        const afterResponse = await this.xeroClient.accountingApi.getInvoice(
          this.tokens.tenantId,
          invoice.xeroInvoiceId
        )
        const afterInvoice = afterResponse.body.invoices?.[0]

        if (!afterInvoice) {
          throw new Error('Failed to fetch updated invoice from Xero')
        }

        // Calculate new remote hash
        const remoteHash = this.calculateInvoiceHash(this.extractXeroInvoiceData(afterInvoice))

        // Log operation
        await this.logInvoiceOperation(
          this.correlationId,
          'UPDATE',
          invoice.id,
          invoice.xeroInvoiceId,
          invoice.invoiceNumber,
          'local',
          this.extractXeroInvoiceData(beforeInvoice),
          this.extractXeroInvoiceData(afterInvoice),
          'SUCCESS'
        )

        // Update local sync flag
        await prisma.customerInvoice.update({
          where: { id: invoice.id },
          data: {
            isXeroSynced: true,
            lastXeroSync: new Date(),
            updatedAt: new Date()
          }
        })

        // Update sync state
        await prisma.xero_sync_state.upsert({
          where: {
            entityType_entityId: {
              entityType: 'CLIENT_INVOICE',
              entityId: invoice.id
            }
          },
          create: {
            id: crypto.randomUUID(),
            entityType: 'CLIENT_INVOICE',
            entityId: invoice.id,
            xeroId: invoice.xeroInvoiceId,
            lastLocalHash: localHash,
            lastRemoteHash: remoteHash,
            lastSyncedAt: new Date(),
            lastLocalModified: invoice.updatedAt,
            lastRemoteModified: afterInvoice.updatedDateUTC ? new Date(afterInvoice.updatedDateUTC) : new Date(),
            syncOrigin: 'local',
            correlationId: this.correlationId,
            status: 'ACTIVE',
            updatedAt: new Date()
          },
          update: {
            lastLocalHash: localHash,
            lastRemoteHash: remoteHash,
            lastSyncedAt: new Date(),
            lastLocalModified: invoice.updatedAt,
            lastRemoteModified: afterInvoice.updatedDateUTC ? new Date(afterInvoice.updatedDateUTC) : new Date(),
            syncOrigin: 'local',
            correlationId: this.correlationId,
            status: 'ACTIVE',
            updatedAt: new Date()
          }
        })

        // Success - return from retry loop
        return

      } catch (error: any) {
        lastError = error
        retries++
        
        const statusCode = error?.response?.statusCode || error?.statusCode
        const responseBody = error?.response?.body

        // Log detailed error information
        console.error(`❌ Attempt ${retries}/${maxRetries} failed for invoice ${invoice.invoiceNumber}:`, {
          statusCode,
          message: error.message,
          responseBody,
          invoiceNumber: invoice.invoiceNumber,
          xeroInvoiceId: invoice.xeroInvoiceId,
          contactId: invoice.Customer?.xeroContactId,
          contactName: invoice.Customer?.name
        })

        // Check for validation errors in error response (Elements array)
        if (responseBody?.Elements && Array.isArray(responseBody.Elements)) {
          responseBody.Elements.forEach((element: any, idx: number) => {
            if (element.ValidationErrors?.length) {
              console.error(`❌ Invoice ${idx} validation errors:`, {
                validationErrors: element.ValidationErrors,
                invoiceNumber: invoice.invoiceNumber,
                xeroInvoiceId: invoice.xeroInvoiceId,
                invoiceData: xeroInvoice
              })
            }
          })
        }

        // Handle rate limiting (429)
        if (statusCode === 429) {
          const retryAfter = error?.response?.headers?.['retry-after']
          const delayMs = retryAfter ? parseInt(retryAfter) * 1000 : 5000
          console.warn(`🔁 Rate limited. Retrying invoice ${invoice.invoiceNumber} in ${delayMs}ms`)
          await new Promise(r => setTimeout(r, delayMs))
          continue
        }

        // Handle server errors (5xx) with exponential backoff
        if (statusCode >= 500 && statusCode < 600) {
          const delayMs = 5000 * retries
          console.warn(`🔁 Server error. Retrying invoice ${invoice.invoiceNumber} in ${delayMs}ms`)
          await new Promise(r => setTimeout(r, delayMs))
          continue
        }

        // For validation errors (400), don't retry
        if (statusCode === 400) {
          console.error(`❌ Validation error for invoice ${invoice.invoiceNumber} - not retrying`)
          
          // Log validation error details
          await this.logInvoiceOperation(
            this.correlationId,
            'UPDATE',
            invoice.id,
            invoice.xeroInvoiceId,
            invoice.invoiceNumber,
            'local',
            this.extractXeroInvoiceData(beforeInvoice),
            null,
            'VALIDATION_ERROR',
            `Xero API error: ${error.message}. Response: ${JSON.stringify(responseBody)}`
          )
          
          throw error
        }

        // Handle "Invoice not of valid status for modification" errors (400)
        if (error.message?.includes('not of valid status')) {
          console.error(`❌ Invoice ${invoice.invoiceNumber} cannot be modified - wrong status`)
          
          // Log status error
          await this.logInvoiceOperation(
            this.correlationId,
            'UPDATE',
            invoice.id,
            invoice.xeroInvoiceId,
            invoice.invoiceNumber,
            'local',
            this.extractXeroInvoiceData(beforeInvoice),
            null,
            'STATUS_ERROR',
            `Cannot modify invoice: ${error.message}`
          )
          
          throw error
        }

        // If max retries reached, throw error
        if (retries >= maxRetries) {
          console.error(`❌ Max retries (${maxRetries}) reached for invoice ${invoice.invoiceNumber}`)
          
          // Log final failure
          await this.logInvoiceOperation(
            this.correlationId,
            'UPDATE',
            invoice.id,
            invoice.xeroInvoiceId,
            invoice.invoiceNumber,
            'local',
            this.extractXeroInvoiceData(beforeInvoice),
            null,
            'ERROR',
            `Failed after ${maxRetries} attempts: ${error.message}`
          )
          
          throw error
        }

        // For other errors, retry with exponential backoff
        const delayMs = 1000 * Math.pow(2, retries - 1)
        console.warn(`🔁 Retrying invoice ${invoice.invoiceNumber} in ${delayMs}ms (attempt ${retries}/${maxRetries})`)
        await new Promise(r => setTimeout(r, delayMs))
      }
    }

    // If we get here, all retries failed
    throw lastError || new Error('Failed to update invoice in Xero after all retries')
  }

  // ==================== HELPER METHODS ====================

  /**
   * Calculate hash of invoice data for change detection
   */
  private calculateInvoiceHash(data: any): string {
    const normalized = JSON.stringify(data, Object.keys(data).sort())
    return crypto.createHash('md5').update(normalized).digest('hex')
  }

  /**
   * Extract invoice data from Xero invoice
   */
  private extractXeroInvoiceData(xeroInvoice: any): any {
    return {
      invoiceNumber: xeroInvoice.invoiceNumber,
      subtotal: parseFloat(xeroInvoice.subTotal || '0'),
      taxAmount: parseFloat(xeroInvoice.totalTax || '0'),
      totalAmount: parseFloat(xeroInvoice.total || '0'),
      amountDue: parseFloat(xeroInvoice.amountDue || '0'),
      amountPaid: parseFloat(xeroInvoice.amountPaid || '0'),
      currency: xeroInvoice.currencyCode || 'SGD',
      status: this.mapXeroInvoiceStatus(xeroInvoice.status),
      issueDate: xeroInvoice.date ? new Date(xeroInvoice.date) : new Date(),
      dueDate: xeroInvoice.dueDate ? new Date(xeroInvoice.dueDate) : new Date(),
      description: xeroInvoice.reference || null,
      lineItems: (xeroInvoice.lineItems || []).map((item: any) => ({
        description: item.description,
        quantity: parseFloat(item.quantity || '1'),
        unitPrice: parseFloat(item.unitAmount || '0'),
        taxType: item.taxType,
        accountCode: item.accountCode
      }))
    }
  }

  /**
   * Extract invoice data from local invoice
   */
  private extractLocalInvoiceData(invoice: any): any {
    return {
      invoiceNumber: invoice.invoiceNumber,
      subtotal: parseFloat(invoice.subtotal.toString()),
      taxAmount: parseFloat(invoice.taxAmount?.toString() || '0'),
      totalAmount: parseFloat(invoice.totalAmount.toString()),
      amountDue: parseFloat(invoice.amountDue?.toString() || '0'),
      amountPaid: parseFloat(invoice.amountPaid?.toString() || '0'),
      currency: invoice.currency,
      status: invoice.status,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      description: invoice.description,
      lineItems: (invoice.CustomerInvoiceItem || []).map((item: any) => ({
        description: item.description,
        quantity: parseFloat(item.quantity.toString()),
        unitPrice: parseFloat(item.unitPrice.toString()),
        taxType: item.taxType,
        accountCode: item.accountCode
      }))
    }
  }

  /**
   * Extract line items from Xero invoice
   */
  private extractXeroLineItems(xeroInvoice: any, invoiceId: string): any[] {
    const lineItems = xeroInvoice.lineItems || []
    
    return lineItems.map((item: any, index: number) => {
      const quantity = parseFloat(item.quantity || '1')
      const unitPrice = parseFloat(item.unitAmount || '0')
      const taxAmount = parseFloat(item.taxAmount || '0')
      const subtotal = quantity * unitPrice
      const taxRate = subtotal > 0 ? (taxAmount / subtotal) * 100 : 0
      const totalPrice = subtotal + taxAmount

      return {
        id: crypto.randomUUID(),
        customerInvoiceId: invoiceId,
        description: item.description || 'Item',
        quantity,
        unitPrice,
        taxRate,
        taxType: item.taxType || 'OUTPUT2',
        accountCode: item.accountCode || '200',
        subtotal,
        taxAmount,
        totalPrice,
        order: index
      }
    })
  }

  /**
   * Build Xero invoice object from local invoice
   */
  private buildXeroInvoiceFromLocal(invoice: any): any {
    // Build contact object with both ID and name for better validation
    const contact: any = {
      contactID: invoice.Customer?.xeroContactId || invoice.Client?.xeroContactId
    }
    
    // Always include contact name as a fallback (Xero validation requirement)
    const contactName = invoice.Customer?.name || invoice.Client?.name
    if (contactName) {
      contact.name = contactName
    }

    return {
      type: 'ACCREC', // Accounts Receivable (sales invoice)
      contact,
      invoiceNumber: invoice.invoiceNumber,
      date: invoice.issueDate.toISOString().split('T')[0],
      dueDate: invoice.dueDate.toISOString().split('T')[0],
      status: this.mapLocalInvoiceStatusToXero(invoice.status),
      currencyCode: invoice.currency || 'SGD',
      reference: invoice.description || undefined,
      lineItems: invoice.CustomerInvoiceItem.map((item: any) => {
        // Ensure quantity and unitAmount are positive numbers
        const quantity = Math.abs(parseFloat(item.quantity?.toString() || '0'))
        const unitAmount = Math.abs(parseFloat(item.unitPrice?.toString() || '0'))
        
        return {
          description: item.description || 'Item',
          quantity: quantity || 1,
          unitAmount: unitAmount || 0,
          taxType: item.taxType || 'OUTPUT2',
          accountCode: item.accountCode || '200'
        }
      })
    }
  }

  /**
   * Map Xero invoice status to local status
   */
  private mapXeroInvoiceStatus(xeroStatus: string): string {
    const statusMap: { [key: string]: string } = {
      'DRAFT': 'DRAFT',
      'SUBMITTED': 'SENT',
      'AUTHORISED': 'SENT',
      'PAID': 'PAID',
      'VOIDED': 'CANCELLED',
      'DELETED': 'CANCELLED'
    }
    return statusMap[xeroStatus] || 'DRAFT'
  }

  /**
   * Map local invoice status to Xero status
   */
  private mapLocalInvoiceStatusToXero(localStatus: string): string {
    const statusMap: { [key: string]: string } = {
      'DRAFT': 'DRAFT',
      'SENT': 'AUTHORISED',
      'PAID': 'AUTHORISED', // Let Xero calculate payment status
      'PARTIALLY_PAID': 'AUTHORISED',
      'OVERDUE': 'AUTHORISED',
      'CANCELLED': 'VOIDED'
    }
    return statusMap[localStatus] || 'DRAFT'
  }

  /**
   * Record conflict in database
   */
  private async recordConflict(
    localId: string,
    xeroId: string,
    invoiceNumber: string,
    localData: any,
    xeroData: any,
    dryRun: boolean
  ): Promise<void> {
    if (dryRun) {
      console.log(`   [DRY RUN] Would record conflict for invoice ${invoiceNumber}`)
      return
    }

    // Update sync state to CONFLICT status
    await prisma.xero_sync_state.updateMany({
      where: {
        entityType: 'CLIENT_INVOICE',
        entityId: localId
      },
      data: {
        status: 'CONFLICT',
        conflictData: {
          localData: this.extractLocalInvoiceData(localData),
          xeroData: this.extractXeroInvoiceData(xeroData),
          detectedAt: new Date().toISOString()
        },
        updatedAt: new Date()
      }
    })

    // Log conflict
    await this.logInvoiceOperation(
      this.correlationId,
      'CONFLICT',
      localId,
      xeroId,
      invoiceNumber,
      'both',
      this.extractLocalInvoiceData(localData),
      this.extractXeroInvoiceData(xeroData),
      'CONFLICT'
    )
  }

  /**
   * Log invoice operation to XeroSyncLog
   */
  private async logInvoiceOperation(
    correlationId: string,
    operation: string,
    entityId: string,
    xeroId: string | null,
    invoiceNumber: string,
    syncOrigin: string,
    beforeSnapshot: any,
    afterSnapshot: any,
    status: string,
    errorMessage?: string
  ): Promise<void> {
    try {
      await prisma.xero_sync_log.create({
        data: {
          id: crypto.randomUUID(),
          correlationId,
          entityType: 'CLIENT_INVOICE',
          entityId,
          xeroId: xeroId || undefined,
          operation,
          syncOrigin,
          beforeSnapshot: beforeSnapshot ? JSON.parse(JSON.stringify(beforeSnapshot)) : undefined,
          afterSnapshot: afterSnapshot ? JSON.parse(JSON.stringify(afterSnapshot)) : undefined,
          changeHash: afterSnapshot ? this.calculateInvoiceHash(afterSnapshot) : undefined,
          status,
          errorMessage: errorMessage || undefined,
          userId: this.userId,
          timestamp: new Date()
        }
      })
    } catch (error: any) {
      console.error('Failed to log invoice operation:', error)
    }
  }

  /**
   * Create sync log entry
   */
  private async createSyncLog(status: string, details: any): Promise<string> {
    try {
      const log = await prisma.xero_sync_log.create({
        data: {
          id: crypto.randomUUID(),
          correlationId: this.correlationId,
          entityType: 'CLIENT_INVOICE',
          entityId: 'BATCH',
          xeroId: undefined,
          operation: 'SYNC',
          syncOrigin: details.options?.direction || 'both',
          beforeSnapshot: undefined,
          afterSnapshot: details,
          changeHash: undefined,
          status,
          errorMessage: undefined,
          userId: this.userId,
          timestamp: new Date()
        }
      })
      return log.id
    } catch (error: any) {
      console.error('Failed to create sync log:', error)
      return crypto.randomUUID()
    }
  }

  /**
   * Update sync log entry
   */
  private async updateSyncLog(
    logId: string,
    status: string,
    result: InvoiceSyncResult,
    errorMessage?: string
  ): Promise<void> {
    try {
      await prisma.xero_sync_log.update({
        where: { id: logId },
        data: {
          status,
          afterSnapshot: JSON.parse(JSON.stringify(result)),
          errorMessage: errorMessage || null
        }
      })
    } catch (error: any) {
      console.error('Failed to update sync log:', error)
    }
  }
}
