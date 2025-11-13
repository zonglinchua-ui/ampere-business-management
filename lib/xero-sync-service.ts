
/**
 * Xero Two-Way Sync Service
 * Implements safe, auditable bidirectional sync between Xero and web app
 * 
 * IMPORTANT: Does NOT modify existing OAuth/token management code
 */

import { XeroClient } from 'xero-node'
import { prisma } from './db'
import { XeroOAuthService, XeroTokens } from './xero-oauth-service'
import { XeroLogger, XeroSyncDirection, XeroSyncEntity, XeroSyncStatus } from './xero-logger'
import { generateClientNumber, generateSupplierNumber } from './number-generation'
import { notifySyncSuccess, notifySyncError, notifySyncWarning } from './xero-notification-service'
import { syncProgressManager } from './sync-progress'
import { logSyncFailure, logSyncSuccess, logSyncSkipped } from './xero-sync-error-logger'
import crypto from 'crypto'

// ==================== TYPES ====================

export type SyncEntityType = 'CONTACT' | 'INVOICE' | 'PAYMENT'
export type SyncStatus = 'ACTIVE' | 'ARCHIVED' | 'ERROR' | 'CONFLICT'
export type SyncDirection = 'PULL' | 'PUSH' | 'BOTH'

export interface SyncMapping {
  id: string
  entityType: SyncEntityType
  localId: string
  xeroId: string
  lastSyncedAt: Date
  syncDirection: SyncDirection
  changeHash: string
  status: SyncStatus
  lastError?: string | null
  metadata?: any
}

export interface SyncResult {
  success: boolean
  message: string
  created: number
  updated: number
  skipped: number
  errors: number
  errorDetails?: string[]
  logId?: string
}

export interface ContactSyncOptions {
  modifiedSince?: Date
  includeArchived?: boolean
  forceRefresh?: boolean
}

export interface InvoicePushOptions {
  invoiceIds: string[]
  validateOnly?: boolean
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Calculate MD5 hash of data for change detection
 */
function calculateChangeHash(data: any): string {
  const normalized = JSON.stringify(data, Object.keys(data).sort())
  return crypto.createHash('md5').update(normalized).digest('hex')
}

/**
 * Safe JSON stringify with error handling
 */
function safeStringify(obj: any): string {
  try {
    return JSON.stringify(obj)
  } catch {
    return String(obj)
  }
}

/**
 * Extract syncable fields from contact for hash calculation
 */
function extractContactSyncFields(contact: any) {
  return {
    name: contact.name || contact.Name,
    email: contact.emailAddress || contact.EmailAddress,
    phone: contact.phoneNumber || contact.PhoneNumber,
    addresses: contact.addresses || contact.Addresses,
    contactNumber: contact.contactNumber || contact.ContactNumber,
    taxNumber: contact.taxNumber || contact.TaxNumber,
    isCustomer: contact.isCustomer || contact.IsCustomer,
    isSupplier: contact.isSupplier || contact.IsSupplier
  }
}

// ==================== MAIN SERVICE CLASS ====================

export class XeroSyncService {
  private xeroClient: XeroClient
  private tokens: XeroTokens | null = null
  private userId: string

  constructor(userId: string) {
    this.userId = userId
    this.xeroClient = new XeroClient({
      clientId: process.env.XERO_CLIENT_ID!,
      clientSecret: process.env.XERO_CLIENT_SECRET!,
      redirectUris: [process.env.XERO_REDIRECT_URI!],
      scopes: process.env.XERO_SCOPES!.split(' '),
    })
  }

  /**
   * Initialize service with stored tokens (reuses existing OAuth service)
   */
  async initialize(): Promise<boolean> {
    try {
      this.tokens = await XeroOAuthService.getStoredTokens()

      if (!this.tokens) {
        console.log('⚠️ No Xero tokens found')
        return false
      }

      // Check if token needs refresh
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

      console.log('✅ Xero Sync Service initialized')
      return true

    } catch (error: any) {
      console.error('❌ Failed to initialize Xero Sync Service:', error.message)
      return false
    }
  }

  // ==================== SYNC MAPPING CRUD ====================

  /**
   * Get or create sync mapping
   */
  private async getOrCreateMapping(
    entityType: SyncEntityType,
    localId: string,
    xeroId: string,
    syncDirection: SyncDirection,
    changeHash: string
  ): Promise<SyncMapping> {
    const existingMapping = await prisma.$queryRaw<SyncMapping[]>`
      SELECT * FROM xero_sync_mappings
      WHERE entity_type = ${entityType}::text::"XeroSyncEntityType"
      AND local_id = ${localId}
      AND xero_id = ${xeroId}
      LIMIT 1
    `

    if (existingMapping && existingMapping.length > 0) {
      // Update existing mapping
      const updated = await prisma.$queryRaw<SyncMapping[]>`
        UPDATE xero_sync_mappings
        SET 
          last_synced_at = NOW(),
          change_hash = ${changeHash},
          status = 'ACTIVE'::"XeroSyncStatus",
          updated_at = NOW()
        WHERE id = ${existingMapping[0].id}
        RETURNING *
      `
      return updated[0]
    } else {
      // Create new mapping
      const id = crypto.randomUUID()
      const created = await prisma.$queryRaw<SyncMapping[]>`
        INSERT INTO xero_sync_mappings (
          id, entity_type, local_id, xero_id, last_synced_at,
          sync_direction, change_hash, status, created_at, updated_at
        ) VALUES (
          ${id}, 
          ${entityType}::text::"XeroSyncEntityType",
          ${localId},
          ${xeroId},
          NOW(),
          ${syncDirection}::text::"XeroSyncDirection",
          ${changeHash},
          'ACTIVE'::"XeroSyncStatus",
          NOW(),
          NOW()
        )
        RETURNING *
      `
      return created[0]
    }
  }

  /**
   * Find mapping by xeroId
   */
  private async findMappingByXeroId(
    entityType: SyncEntityType,
    xeroId: string
  ): Promise<SyncMapping | null> {
    const result = await prisma.$queryRaw<SyncMapping[]>`
      SELECT * FROM xero_sync_mappings
      WHERE entity_type = ${entityType}::text::"XeroSyncEntityType"
      AND xero_id = ${xeroId}
      AND status = 'ACTIVE'::"XeroSyncStatus"
      LIMIT 1
    `
    return result.length > 0 ? result[0] : null
  }

  /**
   * Find mapping by localId
   */
  private async findMappingByLocalId(
    entityType: SyncEntityType,
    localId: string
  ): Promise<SyncMapping | null> {
    const result = await prisma.$queryRaw<SyncMapping[]>`
      SELECT * FROM xero_sync_mappings
      WHERE entity_type = ${entityType}::text::"XeroSyncEntityType"
      AND local_id = ${localId}
      AND status = 'ACTIVE'::"XeroSyncStatus"
      LIMIT 1
    `
    return result.length > 0 ? result[0] : null
  }

  // ==================== CONTACTS PULL (PHASE C) ====================

  /**
   * Pull contacts from Xero to App (idempotent, safe)
   * ALL contacts are always synced - no toggle required
   */
  async pullContacts(options: ContactSyncOptions = {}): Promise<SyncResult> {
    const startTime = Date.now()
    let logId: string | undefined
    const result: SyncResult = {
      success: false,
      message: '',
      created: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      errorDetails: []
    }

    try {
      if (!this.tokens) {
        throw new Error('Service not initialized')
      }

      // Start logging
      logId = await XeroLogger.logSyncOperation({
        timestamp: new Date(),
        userId: this.userId,
        direction: 'PULL',
        entity: 'CONTACTS',
        status: 'IN_PROGRESS',
        recordsProcessed: 0,
        recordsSucceeded: 0,
        recordsFailed: 0,
        message: 'Starting contact pull from Xero (syncing ALL contacts: Customers + Suppliers + General)',
        duration: 0
      })

      // Fetch contacts from Xero with pagination
      console.log('📥 Fetching ALL contacts from Xero (with pagination)...')
      
      const params: any = {}
      if (options.modifiedSince) {
        params.modifiedSince = options.modifiedSince.toISOString()
      }
      if (options.includeArchived !== true) {
        params.where = 'ContactStatus=="ACTIVE"'
      }

      // Implement pagination to fetch ALL contacts
      let page = 1
      let xeroContacts: any[] = []
      let hasMorePages = true

      while (hasMorePages) {
        console.log(`📄 Fetching page ${page} from Xero...`)
        
        const response = await this.xeroClient.accountingApi.getContacts(
          this.tokens.tenantId,
          undefined, // ifModifiedSince
          params.where,
          undefined, // order
          undefined, // IDs
          page,      // page number
          options.includeArchived
        )

        const pageContacts = response.body.contacts || []
        
        if (pageContacts.length === 0) {
          // No more contacts, exit loop
          hasMorePages = false
        } else {
          xeroContacts = xeroContacts.concat(pageContacts)
          console.log(`✅ Page ${page}: Fetched ${pageContacts.length} contacts (total so far: ${xeroContacts.length})`)
          page++
        }
      }

      console.log(`✅ Fetched ${xeroContacts.length} total contacts from Xero across ${page - 1} pages`)

      // Start progress tracking
      syncProgressManager.startSync('contacts', xeroContacts.length)

      // Process each contact - ALL contacts are now synced
      let processedCount = 0
      let customerCount = 0
      let supplierCount = 0
      let bothCount = 0
      let generalCount = 0
      const skippedContacts: Array<{ name: string, reason: string, timestamp: string }> = []
      
      for (const xeroContact of xeroContacts) {
        try {
          const contactResult = await this.processContactPull(xeroContact, options, result, skippedContacts)
          processedCount++
          
          // Count by contact type
          if (contactResult?.isCustomer && contactResult?.isSupplier) {
            bothCount++
          } else if (contactResult?.isCustomer) {
            customerCount++
          } else if (contactResult?.isSupplier) {
            supplierCount++
          } else if (contactResult?.isGeneral) {
            generalCount++
          }
          
          // Update progress every 10 contacts or on last contact
          if (processedCount % 10 === 0 || processedCount === xeroContacts.length) {
            syncProgressManager.incrementProgress(
              'contacts',
              processedCount,
              `Processing contacts (${processedCount}/${xeroContacts.length}): ${customerCount} customers, ${supplierCount} suppliers, ${bothCount} both, ${generalCount} general`
            )
          }
        } catch (error: any) {
          result.errors++
          result.errorDetails?.push(`Contact ${xeroContact.name}: ${error.message}`)
          console.error(`❌ Failed to process contact ${xeroContact.name}:`, error)
          
          // Log error to data quality system
          await logSyncFailure(
            'CONTACT',
            error,
            undefined,
            xeroContact.name || 'Unknown',
            xeroContact.contactID,
            { xeroContact, errorStack: error.stack }
          )
        }
      }

      // Calculate final stats
      const duration = Date.now() - startTime
      result.success = result.errors === 0
      result.message = result.success
        ? `Successfully synced ${result.created + result.updated} contacts (${result.created} created, ${result.updated} updated, ${result.skipped} skipped). Breakdown: ${customerCount} customers, ${supplierCount} suppliers, ${bothCount} both, ${generalCount} general.`
        : `Synced with ${result.errors} errors (${result.created} created, ${result.updated} updated, ${result.skipped} skipped, ${result.errors} failed). Breakdown: ${customerCount} customers, ${supplierCount} suppliers, ${bothCount} both, ${generalCount} general.`

      // Update log
      if (logId) {
        await XeroLogger.updateLogEntry(logId, {
          status: result.success ? 'SUCCESS' : 'WARNING',
          message: result.message,
          recordsProcessed: xeroContacts.length,
          recordsSucceeded: result.created + result.updated + result.skipped,
          recordsFailed: result.errors,
          duration,
          details: {
            created: result.created,
            updated: result.updated,
            skipped: result.skipped,
            errors: result.errors,
            errorDetails: result.errorDetails,
            breakdown: {
              customers: customerCount,
              suppliers: supplierCount,
              both: bothCount,
              general: generalCount
            },
            skippedContacts: skippedContacts
          }
        })
      }

      // Complete progress tracking
      if (result.success) {
        syncProgressManager.completeSync('contacts', result.message)
      } else {
        syncProgressManager.failSync('contacts', result.message)
      }

      result.logId = logId
      return result

    } catch (error: any) {
      const duration = Date.now() - startTime
      const errorMessage = error.message || 'Unknown error'
      
      result.success = false
      result.message = `Failed to pull contacts: ${errorMessage}`
      
      if (logId) {
        await XeroLogger.updateLogEntry(logId, {
          status: 'ERROR',
          message: result.message,
          errorMessage: errorMessage,
          errorStack: error.stack,
          duration
        })
      }

      // Mark progress as failed
      syncProgressManager.failSync('contacts', errorMessage)

      console.error('❌ Contact pull failed:', error)
      return result
    }
  }

  /**
   * Process single contact from Xero
   * ALL contacts are synced - no exclusions based on type
   */
  private async processContactPull(
    xeroContact: any,
    options: ContactSyncOptions,
    result: SyncResult,
    skippedContacts: Array<{ name: string, reason: string, timestamp: string }> = []
  ): Promise<{ isCustomer: boolean, isSupplier: boolean, isGeneral: boolean }> {
    const contactId = xeroContact.contactID
    const contactName = xeroContact.name
    
    // Use Xero's flags for categorization
    const isCustomer = xeroContact.isCustomer === true
    const isSupplier = xeroContact.isSupplier === true
    const isGeneral = !isCustomer && !isSupplier

    // Determine contact type for display
    let contactType = 'general'
    if (isCustomer && !isSupplier) contactType = 'customer'
    if (isSupplier && !isCustomer) contactType = 'supplier'
    if (isCustomer && isSupplier) contactType = 'both'

    // Only log general contacts to track them specifically
    if (isGeneral) {
      console.log(`📝 Processing GENERAL contact: ${contactName}`)
    }

    // Calculate change hash
    const syncFields = extractContactSyncFields(xeroContact)
    const changeHash = calculateChangeHash(syncFields)

    // Check existing mapping
    const existingMapping = await this.findMappingByXeroId('CONTACT', contactId)
    
    // If mapping exists and hash unchanged, skip
    if (existingMapping && existingMapping.changeHash === changeHash && !options.forceRefresh) {
      console.log(`⏭️  Skipping ${contactName} - no changes detected`)
      result.skipped++
      return { isCustomer, isSupplier, isGeneral }
    }

    // Extract contact data
    const contactData = this.extractContactData(xeroContact)

    // Sync to appropriate tables based on contact type
    if (isCustomer && isSupplier) {
      // Create/update in BOTH Customer and Supplier tables
      await this.syncContactToClient(contactId, contactData, changeHash, existingMapping, result, false)
      await this.syncContactToSupplier(contactId, contactData, changeHash, existingMapping, result)
    } else if (isCustomer) {
      // Customer only
      await this.syncContactToClient(contactId, contactData, changeHash, existingMapping, result, false)
    } else if (isSupplier) {
      // Supplier only
      await this.syncContactToSupplier(contactId, contactData, changeHash, existingMapping, result)
    } else if (isGeneral) {
      // General contact - store in Customer table with a note
      console.log(`  ➡️  Syncing general contact "${contactName}" to Customer table...`)
      await this.syncContactToClient(contactId, { 
        ...contactData,
        // Add a note that this is a general contact
        notes: (contactData.notes ? contactData.notes + '\n' : '') + '[General Contact - synced from Xero]'
      }, changeHash, existingMapping, result, true)
    }

    return { isCustomer, isSupplier, isGeneral }
  }

  /**
   * Extract contact data from Xero contact object
   */
  private extractContactData(xeroContact: any): any {
    const firstEmail = xeroContact.emailAddress || xeroContact.emailAddresses?.[0]?.emailAddress || null
    const firstPhone = xeroContact.phones?.find((p: any) => p.phoneType === 'DEFAULT')?.phoneNumber
      || xeroContact.phones?.[0]?.phoneNumber || null
    
    const defaultAddress = xeroContact.addresses?.find((a: any) => a.addressType === 'POBOX' || a.addressType === 'STREET') 
      || xeroContact.addresses?.[0]

    const contactPerson = xeroContact.contactPersons?.[0]
      ? `${xeroContact.contactPersons[0].firstName || ''} ${xeroContact.contactPersons[0].lastName || ''}`.trim()
      : null

    return {
      name: xeroContact.name,
      email: firstEmail,
      phone: firstPhone,
      address: defaultAddress ? [
        defaultAddress.addressLine1,
        defaultAddress.addressLine2,
        defaultAddress.addressLine3,
        defaultAddress.addressLine4
      ].filter(Boolean).join(', ') : null,
      city: defaultAddress?.city || null,
      state: defaultAddress?.region || null,
      country: defaultAddress?.country || 'Singapore',
      postalCode: defaultAddress?.postalCode || null,
      contactPerson,
      companyReg: xeroContact.taxNumber || null,
      website: xeroContact.website || null,
      xeroContactId: xeroContact.contactID,
      xeroAccountNumber: xeroContact.accountNumber || null,
      xeroPhones: xeroContact.phones || null,
      xeroAddresses: xeroContact.addresses || null,
      xeroContactPersons: xeroContact.contactPersons || null,
      xeroDefaultCurrency: xeroContact.defaultCurrency || null,
      xeroTaxNumber: xeroContact.taxNumber || null,
      xeroUpdatedDateUTC: xeroContact.updatedDateUTC ? new Date(xeroContact.updatedDateUTC) : null,
      xeroContactStatus: xeroContact.contactStatus || 'ACTIVE',
      xeroBankAccountDetails: xeroContact.bankAccountDetails || null,
      isXeroSynced: true,
      lastXeroSync: new Date()
    }
  }

  /**
   * Sync contact to Client table
   */
  private async syncContactToClient(
    xeroContactId: string,
    contactData: any,
    changeHash: string,
    existingMapping: SyncMapping | null,
    result: SyncResult,
    isGeneral: boolean = false
  ): Promise<void> {
    // Check if client already exists
    const existingClient = await prisma.customer.findUnique({
      where: { xeroContactId }
    })

    if (existingClient) {
      // Update existing client
      await prisma.customer.update({
        where: { id: existingClient.id },
        data: {
          ...contactData,
          updatedAt: new Date()
        }
      })

      // Update mapping
      await this.getOrCreateMapping('CONTACT', existingClient.id, xeroContactId, 'PULL', changeHash)
      
      if (isGeneral) {
        console.log(`  ✅ Updated GENERAL contact in Customer table: ${contactData.name}`)
      }
      result.updated++
    } else {
      // Create new client with auto-generated client number
      const customerNumber = await generateClientNumber()

      // Get system user for createdById
      const systemUser = await prisma.user.findFirst({
        where: { role: 'SUPERADMIN' }
      })

      if (!systemUser) {
        throw new Error('No SUPERADMIN user found for creating client')
      }

      const newClient = await prisma.customer.create({
        data: {
          id: crypto.randomUUID(),
          customerNumber,
          ...contactData,
          createdById: systemUser.id,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })

      // Create mapping
      await this.getOrCreateMapping('CONTACT', newClient.id, xeroContactId, 'PULL', changeHash)
      
      if (isGeneral) {
        console.log(`  ✅ Created GENERAL contact in Customer table: ${contactData.name} (${customerNumber})`)
      }
      result.created++
    }
  }

  /**
   * Sync contact to Supplier table
   */
  private async syncContactToSupplier(
    xeroContactId: string,
    contactData: any,
    changeHash: string,
    existingMapping: SyncMapping | null,
    result: SyncResult
  ): Promise<void> {
    // Check if supplier already exists
    const existingSupplier = await prisma.supplier.findUnique({
      where: { xeroContactId }
    })

    if (existingSupplier) {
      // Update existing supplier
      await prisma.supplier.update({
        where: { id: existingSupplier.id },
        data: {
          ...contactData,
          updatedAt: new Date()
        }
      })

      // Update mapping
      await this.getOrCreateMapping('CONTACT', existingSupplier.id, xeroContactId, 'PULL', changeHash)
      
      console.log(`✅ Updated supplier: ${contactData.name}`)
      result.updated++
    } else {
      // Create new supplier with auto-generated supplier number
      const supplierNumber = await generateSupplierNumber()

      // Get system user for createdById
      const systemUser = await prisma.user.findFirst({
        where: { role: 'SUPERADMIN' }
      })

      if (!systemUser) {
        throw new Error('No SUPERADMIN user found for creating supplier')
      }

      const newSupplier = await prisma.supplier.create({
        data: {
          id: crypto.randomUUID(),
          supplierNumber,
          ...contactData,
          createdById: systemUser.id,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })

      // Create mapping
      await this.getOrCreateMapping('CONTACT', newSupplier.id, xeroContactId, 'PULL', changeHash)
      
      console.log(`✅ Created supplier: ${contactData.name} (${supplierNumber})`)
      result.created++
    }
  }

  // ==================== CONTACTS PUSH (PHASE D) ====================

  /**
   * Push local contacts (Clients/Suppliers) to Xero
   */
  async pushContacts(options: {
    customerIds?: string[]
    supplierIds?: string[]
    pushAll?: boolean
    onlyUnsynced?: boolean
  } = {}): Promise<SyncResult> {
    const startTime = Date.now()
    let logId: string | undefined
    const result: SyncResult = {
      success: false,
      message: '',
      created: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      errorDetails: []
    }

    try {
      if (!this.tokens) {
        throw new Error('Service not initialized')
      }

      // Start logging
      logId = await XeroLogger.logSyncOperation({
        timestamp: new Date(),
        userId: this.userId,
        direction: 'PUSH',
        entity: 'CONTACTS',
        status: 'IN_PROGRESS',
        recordsProcessed: 0,
        recordsSucceeded: 0,
        recordsFailed: 0,
        message: 'Starting contact push to Xero',
        duration: 0
      })

      console.log('📤 Starting contact push to Xero...', options)

      // Fetch clients to push
      const clientsToSync = await this.fetchClientsForPush(options)
      console.log(`📋 Found ${clientsToSync.length} clients to push`)

      // Fetch suppliers to push
      const suppliersToSync = await this.fetchSuppliersForPush(options)
      console.log(`📋 Found ${suppliersToSync.length} suppliers to push`)

      // Push clients
      for (const customer of clientsToSync) {
        try {
          await this.pushClientToXero(customer, result)
        } catch (error: any) {
          result.errors++
          result.errorDetails?.push(`Client ${customer.name}: ${error.message}`)
          console.error(`❌ Failed to push client ${customer.name}:`, error)
        }
      }

      // Push suppliers
      for (const supplier of suppliersToSync) {
        try {
          await this.pushSupplierToXero(supplier, result)
        } catch (error: any) {
          result.errors++
          result.errorDetails?.push(`Supplier ${supplier.name}: ${error.message}`)
          console.error(`❌ Failed to push supplier ${supplier.name}:`, error)
        }
      }

      // Calculate final stats
      const duration = Date.now() - startTime
      const totalProcessed = clientsToSync.length + suppliersToSync.length
      result.success = result.errors === 0
      result.message = result.success
        ? `Successfully pushed ${result.created + result.updated} contacts (${result.created} created, ${result.updated} updated, ${result.skipped} skipped)`
        : `Pushed with ${result.errors} errors (${result.created} created, ${result.updated} updated, ${result.skipped} skipped, ${result.errors} failed)`

      // Update log
      if (logId) {
        await XeroLogger.updateLogEntry(logId, {
          status: result.success ? 'SUCCESS' : 'WARNING',
          message: result.message,
          recordsProcessed: totalProcessed,
          recordsSucceeded: result.created + result.updated + result.skipped,
          recordsFailed: result.errors,
          duration,
          details: {
            created: result.created,
            updated: result.updated,
            skipped: result.skipped,
            errors: result.errors,
            errorDetails: result.errorDetails,
            clientsPushed: clientsToSync.length,
            suppliersPushed: suppliersToSync.length
          }
        })
      }

      result.logId = logId
      return result

    } catch (error: any) {
      const duration = Date.now() - startTime
      const errorMessage = error.message || 'Unknown error'
      
      result.success = false
      result.message = `Failed to push contacts: ${errorMessage}`
      
      if (logId) {
        await XeroLogger.updateLogEntry(logId, {
          status: 'ERROR',
          message: result.message,
          errorMessage: errorMessage,
          errorStack: error.stack,
          duration
        })
      }

      console.error('❌ Contact push failed:', error)
      return result
    }
  }

  /**
   * Fetch clients for push operation
   */
  private async fetchClientsForPush(options: any): Promise<any[]> {
    const where: any = { isActive: true }

    if (options.customerIds && options.customerIds.length > 0) {
      where.id = { in: options.customerIds }
    } else if (options.onlyUnsynced) {
      where.OR = [
        { isXeroSynced: false },
        { xeroContactId: null }
      ]
    } else if (!options.pushAll) {
      // By default, only push unsynced clients
      where.OR = [
        { isXeroSynced: false },
        { xeroContactId: null }
      ]
    }

    return await prisma.customer.findMany({ where })
  }

  /**
   * Fetch suppliers for push operation
   */
  private async fetchSuppliersForPush(options: any): Promise<any[]> {
    const where: any = { isActive: true }

    if (options.supplierIds && options.supplierIds.length > 0) {
      where.id = { in: options.supplierIds }
    } else if (options.onlyUnsynced) {
      where.OR = [
        { isXeroSynced: false },
        { xeroContactId: null }
      ]
    } else if (!options.pushAll) {
      // By default, only push unsynced suppliers
      where.OR = [
        { isXeroSynced: false },
        { xeroContactId: null }
      ]
    }

    return await prisma.supplier.findMany({ where })
  }

  /**
   * Push client to Xero
   */
  private async pushClientToXero(customer: any, result: SyncResult): Promise<void> {
    // Check if already synced and unchanged
    const existingMapping = await this.findMappingByLocalId('CONTACT', customer.id)
    
    // Calculate current hash
    const currentHash = calculateChangeHash({
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      address: customer.address,
      city: customer.city,
      state: customer.state,
      country: customer.country,
      postalCode: customer.postalCode,
      contactPerson: customer.contactPerson,
      companyReg: customer.companyReg,
      website: customer.website
    })

    // Skip if unchanged
    if (existingMapping && existingMapping.changeHash === currentHash && customer.xeroContactId) {
      console.log(`⏭️  Skipping client ${customer.name} - no changes detected`)
      result.skipped++
      return
    }

    // Build Xero contact object
    const xeroContact = this.buildXeroContactFromCustomer(customer)

    try {
      if (customer.xeroContactId) {
        // Update existing Xero contact
        console.log(`📤 Updating Xero contact for client: ${customer.name}`)
        
        await this.xeroClient.accountingApi.updateContact(
          this.tokens!.tenantId,
          customer.xeroContactId,
          { contacts: [xeroContact] }
        )

        // Update mapping
        await this.getOrCreateMapping('CONTACT', customer.id, customer.xeroContactId, 'PUSH', currentHash)
        
        // Update local record
        await prisma.customer.update({
          where: { id: customer.id },
          data: {
            isXeroSynced: true,
            lastXeroSync: new Date()
          }
        })

        console.log(`✅ Updated Xero contact for client: ${customer.name}`)
        result.updated++

      } else {
        // Create new Xero contact
        console.log(`📤 Creating Xero contact for client: ${customer.name}`)
        
        const response = await this.xeroClient.accountingApi.createContacts(
          this.tokens!.tenantId,
          { contacts: [xeroContact] }
        )

        const createdContact = response.body.contacts?.[0]
        
        if (!createdContact || !createdContact.contactID) {
          throw new Error('Failed to get contactID from Xero response')
        }

        // Create mapping
        await this.getOrCreateMapping('CONTACT', customer.id, createdContact.contactID, 'PUSH', currentHash)
        
        // Update local record with Xero ID
        await prisma.customer.update({
          where: { id: customer.id },
          data: {
            xeroContactId: createdContact.contactID,
            xeroAccountNumber: createdContact.accountNumber || null,
            isXeroSynced: true,
            lastXeroSync: new Date()
          }
        })

        console.log(`✅ Created Xero contact for client: ${customer.name}`)
        result.created++
      }

    } catch (error: any) {
      console.error(`❌ Failed to push client ${customer.name}:`, error.message)
      throw error
    }
  }

  /**
   * Push supplier to Xero
   */
  private async pushSupplierToXero(supplier: any, result: SyncResult): Promise<void> {
    // Check if already synced and unchanged
    const existingMapping = await this.findMappingByLocalId('CONTACT', supplier.id)
    
    // Calculate current hash
    const currentHash = calculateChangeHash({
      name: supplier.name,
      email: supplier.email,
      phone: supplier.phone,
      address: supplier.address,
      city: supplier.city,
      state: supplier.state,
      country: supplier.country,
      postalCode: supplier.postalCode,
      contactPerson: supplier.contactPerson,
      companyReg: supplier.companyReg,
      website: supplier.website
    })

    // Skip if unchanged
    if (existingMapping && existingMapping.changeHash === currentHash && supplier.xeroContactId) {
      console.log(`⏭️  Skipping supplier ${supplier.name} - no changes detected`)
      result.skipped++
      return
    }

    // Build Xero contact object
    const xeroContact = this.buildXeroContactFromSupplier(supplier)

    try {
      if (supplier.xeroContactId) {
        // Update existing Xero contact
        console.log(`📤 Updating Xero contact for supplier: ${supplier.name}`)
        
        await this.xeroClient.accountingApi.updateContact(
          this.tokens!.tenantId,
          supplier.xeroContactId,
          { contacts: [xeroContact] }
        )

        // Update mapping
        await this.getOrCreateMapping('CONTACT', supplier.id, supplier.xeroContactId, 'PUSH', currentHash)
        
        // Update local record
        await prisma.supplier.update({
          where: { id: supplier.id },
          data: {
            isXeroSynced: true,
            lastXeroSync: new Date()
          }
        })

        console.log(`✅ Updated Xero contact for supplier: ${supplier.name}`)
        result.updated++

      } else {
        // Create new Xero contact
        console.log(`📤 Creating Xero contact for supplier: ${supplier.name}`)
        
        const response = await this.xeroClient.accountingApi.createContacts(
          this.tokens!.tenantId,
          { contacts: [xeroContact] }
        )

        const createdContact = response.body.contacts?.[0]
        
        if (!createdContact || !createdContact.contactID) {
          throw new Error('Failed to get contactID from Xero response')
        }

        // Create mapping
        await this.getOrCreateMapping('CONTACT', supplier.id, createdContact.contactID, 'PUSH', currentHash)
        
        // Update local record with Xero ID
        await prisma.supplier.update({
          where: { id: supplier.id },
          data: {
            xeroContactId: createdContact.contactID,
            xeroAccountNumber: createdContact.accountNumber || null,
            isXeroSynced: true,
            lastXeroSync: new Date()
          }
        })

        console.log(`✅ Created Xero contact for supplier: ${supplier.name}`)
        result.created++
      }

    } catch (error: any) {
      console.error(`❌ Failed to push supplier ${supplier.name}:`, error.message)
      throw error
    }
  }

  /**
   * Build Xero contact object from Customer
   */
  private buildXeroContactFromCustomer(customer: any): any {
    const contact: any = {
      name: customer.name,
      emailAddress: customer.email || undefined,
      isCustomer: true,
      isSupplier: false
    }

    // Add contact ID if updating
    if (customer.xeroContactId) {
      contact.contactID = customer.xeroContactId
    }

    // Add phone
    if (customer.phone) {
      contact.phones = [
        {
          phoneType: 'DEFAULT',
          phoneNumber: customer.phone
        }
      ]
    }

    // Add address
    if (customer.address || customer.city || customer.state || customer.country || customer.postalCode) {
      contact.addresses = [
        {
          addressType: 'POBOX',
          addressLine1: customer.address || undefined,
          city: customer.city || undefined,
          region: customer.state || undefined,
          country: customer.country || 'Singapore',
          postalCode: customer.postalCode || undefined
        }
      ]
    }

    // Add contact person
    if (customer.contactPerson) {
      const names = customer.contactPerson.split(' ')
      contact.contactPersons = [
        {
          firstName: names[0],
          lastName: names.slice(1).join(' ') || undefined,
          emailAddress: customer.email || undefined
        }
      ]
    }

    // Add tax number (company registration)
    if (customer.companyReg) {
      contact.taxNumber = customer.companyReg
    }

    // Add website
    if (customer.website) {
      contact.website = customer.website
    }

    // Add account number (customer number)
    if (customer.customerNumber) {
      contact.accountNumber = customer.customerNumber
    }

    // Add bank details if available
    if (customer.bankAccountNumber || customer.bankName) {
      contact.bankAccountDetails = JSON.stringify({
        bankName: customer.bankName,
        accountNumber: customer.bankAccountNumber,
        accountName: customer.bankAccountName,
        swiftCode: customer.bankSwiftCode,
        bankAddress: customer.bankAddress
      })
    }

    return contact
  }

  /**
   * Build Xero contact object from Supplier
   */
  private buildXeroContactFromSupplier(supplier: any): any {
    const contact: any = {
      name: supplier.name,
      emailAddress: supplier.email || undefined,
      isCustomer: false,
      isSupplier: true
    }

    // Add contact ID if updating
    if (supplier.xeroContactId) {
      contact.contactID = supplier.xeroContactId
    }

    // Add phone
    if (supplier.phone) {
      contact.phones = [
        {
          phoneType: 'DEFAULT',
          phoneNumber: supplier.phone
        }
      ]
    }

    // Add address
    if (supplier.address || supplier.city || supplier.state || supplier.country || supplier.postalCode) {
      contact.addresses = [
        {
          addressType: 'POBOX',
          addressLine1: supplier.address || undefined,
          city: supplier.city || undefined,
          region: supplier.state || undefined,
          country: supplier.country || 'Singapore',
          postalCode: supplier.postalCode || undefined
        }
      ]
    }

    // Add contact person
    if (supplier.contactPerson) {
      const names = supplier.contactPerson.split(' ')
      contact.contactPersons = [
        {
          firstName: names[0],
          lastName: names.slice(1).join(' ') || undefined,
          emailAddress: supplier.email || undefined
        }
      ]
    }

    // Add tax number (company registration)
    if (supplier.companyReg) {
      contact.taxNumber = supplier.companyReg
    }

    // Add website
    if (supplier.website) {
      contact.website = supplier.website
    }

    // Add account number (supplier number)
    if (supplier.supplierNumber) {
      contact.accountNumber = supplier.supplierNumber
    }

    // Add bank details if available
    if (supplier.bankAccountNumber || supplier.bankName) {
      contact.bankAccountDetails = JSON.stringify({
        bankName: supplier.bankName,
        accountNumber: supplier.bankAccountNumber,
        accountName: supplier.bankAccountName,
        swiftCode: supplier.bankSwiftCode,
        bankAddress: supplier.bankAddress
      })
    }

    return contact
  }

  // ==================== INVOICES PULL (PHASE E) ====================

  /**
   * Pull invoices from Xero to App (idempotent, safe)
   */
  async pullInvoices(options: {
    modifiedSince?: Date
    includeArchived?: boolean
    forceRefresh?: boolean
    invoiceIds?: string[]
  } = {}): Promise<SyncResult> {
    const startTime = Date.now()
    let logId: string | undefined
    const result: SyncResult = {
      success: false,
      message: '',
      created: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      errorDetails: []
    }

    try {
      if (!this.tokens) {
        throw new Error('Service not initialized')
      }

      // Start logging
      logId = await XeroLogger.logSyncOperation({
        timestamp: new Date(),
        userId: this.userId,
        direction: 'PULL',
        entity: 'INVOICES',
        status: 'IN_PROGRESS',
        recordsProcessed: 0,
        recordsSucceeded: 0,
        recordsFailed: 0,
        message: 'Starting invoice pull from Xero',
        duration: 0
      })

      console.log('📥 Fetching invoices from Xero...', {
        includeArchived: options.includeArchived,
        forceRefresh: options.forceRefresh,
        modifiedSince: options.modifiedSince?.toISOString(),
        invoiceCount: options.invoiceIds?.length || 0
      })
      
      // Build query parameters
      const params: any = {}
      if (options.modifiedSince) {
        params.modifiedSince = options.modifiedSince.toISOString()
      }
      if (options.invoiceIds && options.invoiceIds.length > 0) {
        params.IDs = options.invoiceIds
      }
      if (!options.includeArchived) {
        params.statuses = ['DRAFT', 'SUBMITTED', 'AUTHORISED', 'PAID', 'VOIDED']
      }

      // Fetch ALL invoices from Xero with pagination (not just recent/YTD)
      console.log('📥 Fetching ALL invoices from Xero (including historical data)...')
      let allInvoices: any[] = []
      let page = 1
      let hasMorePages = true
      const pageSize = 100 // Xero's default page size

      while (hasMorePages) {
        try {
          console.log(`  📄 Fetching page ${page}...`)
          
          const response = await this.xeroClient.accountingApi.getInvoices(
            this.tokens.tenantId,
            options.modifiedSince, // Only use if explicitly provided
            undefined, // where
            undefined, // order
            params.IDs,
            undefined, // invoiceNumbers
            undefined, // contactIDs
            params.statuses,
            page // page number for pagination
          )

          const pageInvoices = response.body.invoices || []
          allInvoices = allInvoices.concat(pageInvoices)
          
          console.log(`  ✅ Page ${page}: ${pageInvoices.length} invoices (total: ${allInvoices.length})`)

          // Check if there are more pages
          if (pageInvoices.length < pageSize) {
            hasMorePages = false
            console.log('  ℹ️ Last page reached')
          } else {
            page++
            // Rate limiting: wait 200ms between pages to avoid hitting Xero API limits
            await new Promise(resolve => setTimeout(resolve, 200))
          }
        } catch (apiError: any) {
          console.error(`❌ Failed to fetch invoices page ${page} from Xero API:`, apiError)
          
          // Handle rate limiting
          if (apiError.response?.statusCode === 429) {
            const retryAfter = apiError.response.headers?.['retry-after'] || '60'
            console.log(`  ⏳ Rate limited. Waiting ${retryAfter}s before retry...`)
            await new Promise(resolve => setTimeout(resolve, parseInt(retryAfter) * 1000))
            continue // Retry the same page
          }
          
          throw new Error(`Xero API error on page ${page}: ${apiError.message || 'Failed to fetch invoices'}`)
        }
      }

      const xeroInvoices = allInvoices
      console.log(`✅ Fetched ${xeroInvoices.length} total invoices from Xero across ${page} pages`)

      // Process each invoice - Route by type (ACCREC vs ACCPAY)
      let processed = 0
      console.log('📊 Starting invoice processing...')
      
      for (const xeroInvoice of xeroInvoices) {
        try {
          const invoiceType = xeroInvoice.type || 'UNKNOWN'
          console.log(`📥 Processing ${invoiceType} invoice ${processed + 1}/${xeroInvoices.length}: ${xeroInvoice.invoiceNumber} (${xeroInvoice.contact?.name || 'Unknown'})`)
          
          // Route by invoice type
          if (invoiceType === 'ACCREC') {
            // Customer Invoice (Accounts Receivable)
            await this.processXeroCustomerInvoice(xeroInvoice, result, options.forceRefresh)
          } else if (invoiceType === 'ACCPAY') {
            // Supplier Invoice (Accounts Payable / Bill)
            await this.processXeroSupplierInvoice(xeroInvoice, result, options.forceRefresh)
          } else {
            console.warn(`⚠️  Unknown invoice type: ${invoiceType} for invoice ${xeroInvoice.invoiceNumber}`)
            result.skipped++
          }
          
          processed++
          
          // Log progress every 10 invoices or at the end
          if (processed % 10 === 0 || processed === xeroInvoices.length) {
            console.log(`✅ Progress: ${processed}/${xeroInvoices.length} invoices processed (${result.created} new, ${result.updated} updated, ${result.skipped} skipped, ${result.errors} errors)`)
          }
        } catch (error: any) {
          result.errors++
          result.errorDetails?.push(`Invoice ${xeroInvoice.invoiceNumber}: ${error.message}`)
          console.error(`❌ Failed to process invoice ${xeroInvoice.invoiceNumber}:`, error)
          
          // Log error to data quality system
          await logSyncFailure(
            'INVOICE',
            error,
            undefined,
            xeroInvoice.invoiceNumber || 'Unknown',
            xeroInvoice.invoiceID,
            { xeroInvoice, errorStack: error.stack }
          )
          
          processed++
        }
      }
      
      console.log(`✅ Invoice processing complete: ${processed} invoices processed`)

      // Calculate final stats
      const duration = Date.now() - startTime
      result.success = result.errors === 0
      result.message = result.success
        ? `Successfully synced ${result.created + result.updated} invoices (${result.created} new, ${result.updated} updated, ${result.skipped} skipped)`
        : `Synced with ${result.errors} errors (${result.created} new, ${result.updated} updated, ${result.skipped} skipped, ${result.errors} failed)`

      // Update log
      if (logId) {
        await XeroLogger.updateLogEntry(logId, {
          status: result.success ? 'SUCCESS' : 'WARNING',
          message: result.message,
          recordsProcessed: xeroInvoices.length,
          recordsSucceeded: result.created + result.updated + result.skipped,
          recordsFailed: result.errors,
          duration,
          details: {
            created: result.created,
            updated: result.updated,
            skipped: result.skipped,
            errors: result.errors,
            errorDetails: result.errorDetails
          }
        })
      }

      // Send push notifications
      console.log('📬 Sending push notifications for invoice sync...')
      if (result.success) {
        // Success notification
        await notifySyncSuccess('INVOICE', result.created, result.updated, result.skipped)
      } else {
        // Warning notification (partial success)
        await notifySyncWarning('INVOICE', result.created, result.updated, result.skipped, result.errors)
      }

      result.logId = logId
      return result

    } catch (error: any) {
      const duration = Date.now() - startTime
      const errorMessage = error.message || 'Unknown error'
      
      result.success = false
      result.message = `Failed to pull invoices: ${errorMessage}`
      
      if (logId) {
        await XeroLogger.updateLogEntry(logId, {
          status: 'ERROR',
          message: result.message,
          errorMessage: errorMessage,
          errorStack: error.stack,
          duration
        })
      }

      // Send error notification
      console.log('📬 Sending error notification for invoice sync...')
      await notifySyncError('INVOICE', errorMessage, {
        duration,
        errorStack: error.stack
      })

      console.error('❌ Invoice pull failed:', error)
      return result
    }
  }

  /**
   * Process a single Xero CUSTOMER invoice (ACCREC type)
   */
  private async processXeroCustomerInvoice(
    xeroInvoice: any,
    result: SyncResult,
    forceRefresh: boolean = false
  ): Promise<void> {
    const invoiceId = xeroInvoice.invoiceID
    const invoiceNumber = xeroInvoice.invoiceNumber
    const contactId = xeroInvoice.contact?.contactID
    const contactName = xeroInvoice.contact?.name || 'Unknown'

    if (!invoiceId || !invoiceNumber || !contactId) {
      console.warn(`⚠️  Skipping customer invoice - missing required fields`)
      result.skipped++
      return
    }

    // Find local customer by Xero contact ID
    console.log(`🔍 Looking up customer for Xero contact ID: ${contactId}`)
    const customer = await prisma.customer.findUnique({
      where: { xeroContactId: contactId }
    })

    if (!customer) {
      const errorMsg = `Customer not found for Xero contact ${contactName} (${contactId}). Please sync contacts first.`
      console.error(`❌ Customer invoice ${invoiceNumber}: ${errorMsg}`)
      result.errors++
      result.errorDetails?.push(`Customer invoice ${invoiceNumber}: ${errorMsg}`)
      return
    }

    console.log(`✅ Found customer: ${customer.name} (${customer.customerNumber})`)

    // Calculate change hash
    const changeHash = calculateChangeHash({
      invoiceNumber: xeroInvoice.invoiceNumber,
      date: xeroInvoice.date,
      dueDate: xeroInvoice.dueDate,
      status: xeroInvoice.status,
      subTotal: xeroInvoice.subTotal,
      totalTax: xeroInvoice.totalTax,
      total: xeroInvoice.total,
      amountDue: xeroInvoice.amountDue,
      amountPaid: xeroInvoice.amountPaid,
      lineItems: xeroInvoice.lineItems?.map((li: any) => ({
        description: li.description,
        quantity: li.quantity,
        unitAmount: li.unitAmount,
        taxType: li.taxType,
        accountCode: li.accountCode
      }))
    })

    // Check existing mapping
    const existingMapping = await this.findMappingByXeroId('INVOICE', invoiceId)

    // Skip if unchanged (unless force refresh)
    if (existingMapping && existingMapping.changeHash === changeHash && !forceRefresh) {
      console.log(`⏭️  Skipping invoice ${invoiceNumber} - no changes detected (last synced: ${existingMapping.lastSyncedAt.toLocaleString()})`)
      result.skipped++
      return
    }

    // Extract invoice data
    console.log(`📋 Extracting invoice data for ${invoiceNumber}...`)
    const invoiceData = this.extractInvoiceData(xeroInvoice, customer.id)

    // Check if invoice exists locally
    const existingInvoice = await prisma.customerInvoice.findFirst({
      where: {
        OR: [
          { xeroInvoiceId: invoiceId },
          { invoiceNumber: invoiceNumber, customerId: customer.id }
        ]
      },
      include: {
        CustomerInvoiceItem: true
      }
    })

    if (existingInvoice) {
      // Update existing invoice
      console.log(`🔄 Updating existing invoice ${invoiceNumber}...`)
      await prisma.customerInvoice.update({
        where: { id: existingInvoice.id },
        data: {
          ...invoiceData,
          updatedAt: new Date()
        }
      })

      // Delete old line items
      console.log(`🗑️  Deleting ${existingInvoice.CustomerInvoiceItem.length} old line items...`)
      await prisma.customerInvoiceItem.deleteMany({
        where: { customerInvoiceId: existingInvoice.id }
      })

      // Create new line items
      const lineItems = this.extractInvoiceLineItems(xeroInvoice, existingInvoice.id)
      if (lineItems.length > 0) {
        console.log(`➕ Creating ${lineItems.length} new line items...`)
        await prisma.customerInvoiceItem.createMany({
          data: lineItems
        })
      }

      // Update mapping
      await this.getOrCreateMapping('INVOICE', existingInvoice.id, invoiceId, 'PULL', changeHash)
      
      console.log(`✅ Updated invoice: ${invoiceNumber} (Total: ${invoiceData.currency} ${invoiceData.totalAmount})`)
      result.updated++

    } else {
      // Get system user for createdById
      console.log(`➕ Creating new invoice ${invoiceNumber}...`)
      const systemUser = await prisma.user.findFirst({
        where: { role: 'SUPERADMIN' }
      })

      if (!systemUser) {
        throw new Error('No SUPERADMIN user found for creating invoice')
      }

      // Create new invoice
      const newInvoiceId = crypto.randomUUID()
      await prisma.customerInvoice.create({
        data: {
          id: newInvoiceId,
          ...invoiceData,
          createdById: systemUser.id,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })

      // Create line items
      const lineItems = this.extractInvoiceLineItems(xeroInvoice, newInvoiceId)
      if (lineItems.length > 0) {
        console.log(`➕ Creating ${lineItems.length} line items...`)
        await prisma.customerInvoiceItem.createMany({
          data: lineItems
        })
      }

      // Create mapping
      await this.getOrCreateMapping('INVOICE', newInvoiceId, invoiceId, 'PULL', changeHash)
      
      console.log(`✅ Created invoice: ${invoiceNumber} (Total: ${invoiceData.currency} ${invoiceData.totalAmount})`)
      result.created++
    }
  }

  /**
   * Process a single Xero SUPPLIER invoice (ACCPAY type)
   */
  private async processXeroSupplierInvoice(
    xeroInvoice: any,
    result: SyncResult,
    forceRefresh: boolean = false
  ): Promise<void> {
    const invoiceId = xeroInvoice.invoiceID
    const invoiceNumber = xeroInvoice.invoiceNumber
    const contactId = xeroInvoice.contact?.contactID
    const contactName = xeroInvoice.contact?.name || 'Unknown'

    if (!invoiceId || !invoiceNumber || !contactId) {
      console.warn(`⚠️  Skipping supplier invoice - missing required fields`)
      result.skipped++
      return
    }

    // Find local supplier by Xero contact ID
    console.log(`🔍 Looking up supplier for Xero contact ID: ${contactId}`)
    const supplier = await prisma.supplier.findUnique({
      where: { xeroContactId: contactId }
    })

    if (!supplier) {
      const errorMsg = `Supplier not found for Xero contact ${contactName} (${contactId}). Please sync contacts first.`
      console.error(`❌ Supplier invoice ${invoiceNumber}: ${errorMsg}`)
      result.errors++
      result.errorDetails?.push(`Supplier invoice ${invoiceNumber}: ${errorMsg}`)
      return
    }

    console.log(`✅ Found supplier: ${supplier.name} (${supplier.supplierNumber})`)

    // Calculate change hash
    const changeHash = calculateChangeHash({
      invoiceNumber: xeroInvoice.invoiceNumber,
      date: xeroInvoice.date,
      dueDate: xeroInvoice.dueDate,
      status: xeroInvoice.status,
      subTotal: xeroInvoice.subTotal,
      totalTax: xeroInvoice.totalTax,
      total: xeroInvoice.total,
      lineItems: xeroInvoice.lineItems?.map((li: any) => ({
        description: li.description,
        quantity: li.quantity,
        unitAmount: li.unitAmount,
        taxType: li.taxType,
        accountCode: li.accountCode
      }))
    })

    // Check existing mapping
    const existingMapping = await this.findMappingByXeroId('INVOICE', invoiceId)

    // Skip if unchanged (unless force refresh)
    if (existingMapping && existingMapping.changeHash === changeHash && !forceRefresh) {
      console.log(`⏭️  Skipping supplier invoice ${invoiceNumber} - no changes detected (last synced: ${existingMapping.lastSyncedAt.toLocaleString()})`)
      result.skipped++
      return
    }

    // Extract invoice data
    console.log(`📋 Extracting supplier invoice data for ${invoiceNumber}...`)
    const invoiceData = this.extractSupplierInvoiceData(xeroInvoice, supplier.id)

    // Check if invoice exists locally
    const existingInvoice = await prisma.supplierInvoice.findFirst({
      where: {
        OR: [
          { xeroInvoiceId: invoiceId },
          { invoiceNumber: invoiceNumber, supplierId: supplier.id }
        ]
      },
      include: {
        SupplierInvoiceItem: true
      }
    })

    if (existingInvoice) {
      // Update existing invoice
      console.log(`🔄 Updating existing supplier invoice ${invoiceNumber}...`)
      await prisma.supplierInvoice.update({
        where: { id: existingInvoice.id },
        data: {
          ...invoiceData,
          updatedAt: new Date()
        }
      })

      // Delete old line items
      console.log(`🗑️  Deleting ${existingInvoice.SupplierInvoiceItem.length} old line items...`)
      await prisma.supplierInvoiceItem.deleteMany({
        where: { supplierInvoiceId: existingInvoice.id }
      })

      // Create new line items
      const lineItems = this.extractSupplierInvoiceLineItems(xeroInvoice, existingInvoice.id)
      if (lineItems.length > 0) {
        console.log(`➕ Creating ${lineItems.length} new line items...`)
        await prisma.supplierInvoiceItem.createMany({
          data: lineItems
        })
      }

      // Update mapping
      await this.getOrCreateMapping('INVOICE', existingInvoice.id, invoiceId, 'PULL', changeHash)
      
      console.log(`✅ Updated supplier invoice: ${invoiceNumber} (Total: ${invoiceData.currency} ${invoiceData.totalAmount})`)
      result.updated++

    } else {
      // Get system user for createdById
      console.log(`➕ Creating new supplier invoice ${invoiceNumber}...`)
      const systemUser = await prisma.user.findFirst({
        where: { role: 'SUPERADMIN' }
      })

      if (!systemUser) {
        throw new Error('No SUPERADMIN user found for creating supplier invoice')
      }

      // Create new invoice
      const newInvoiceId = crypto.randomUUID()
      await prisma.supplierInvoice.create({
        data: {
          id: newInvoiceId,
          ...invoiceData,
          createdById: systemUser.id,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })

      // Create line items
      const lineItems = this.extractSupplierInvoiceLineItems(xeroInvoice, newInvoiceId)
      if (lineItems.length > 0) {
        console.log(`➕ Creating ${lineItems.length} line items...`)
        await prisma.supplierInvoiceItem.createMany({
          data: lineItems
        })
      }

      // Create mapping
      await this.getOrCreateMapping('INVOICE', newInvoiceId, invoiceId, 'PULL', changeHash)
      
      console.log(`✅ Created supplier invoice: ${invoiceNumber} (Total: ${invoiceData.currency} ${invoiceData.totalAmount})`)
      result.created++
    }
  }

  /**
   * Extract customer invoice data from Xero invoice
   */
  private extractInvoiceData(xeroInvoice: any, customerId: string): any {
    return {
      invoiceNumber: xeroInvoice.invoiceNumber,
      customerId: customerId,
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
      terms: null,
      notes: null,
      xeroInvoiceId: xeroInvoice.invoiceID,
      xeroType: xeroInvoice.type || 'ACCREC',
      isXeroSynced: true,
      lastXeroSync: new Date()
    }
  }

  /**
   * Extract line items from Xero invoice
   */
  private extractInvoiceLineItems(xeroInvoice: any, invoiceId: string): any[] {
    const lineItems = xeroInvoice.lineItems || []
    
    return lineItems.map((item: any, index: number) => {
      try {
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
          quantity: quantity,
          unitPrice: unitPrice,
          taxRate: taxRate,
          taxType: item.taxType || 'OUTPUT2',
          accountCode: item.accountCode || '200',
          subtotal: subtotal,
          taxAmount: taxAmount,
          totalPrice: totalPrice,
          order: index
        }
      } catch (error) {
        console.error(`Failed to parse line item ${index + 1} for invoice ${xeroInvoice.invoiceNumber}:`, error)
        throw new Error(`Invalid line item data at position ${index + 1}`)
      }
    })
  }

  /**
   * Extract supplier invoice data from Xero invoice
   */
  private extractSupplierInvoiceData(xeroInvoice: any, supplierId: string): any {
    return {
      invoiceNumber: xeroInvoice.invoiceNumber,
      supplierInvoiceRef: xeroInvoice.reference || null,
      supplierId: supplierId,
      subtotal: parseFloat(xeroInvoice.subTotal || '0'),
      taxAmount: parseFloat(xeroInvoice.totalTax || '0'),
      totalAmount: parseFloat(xeroInvoice.total || '0'),
      currency: xeroInvoice.currencyCode || 'SGD',
      status: this.mapXeroSupplierInvoiceStatus(xeroInvoice.status),
      invoiceDate: xeroInvoice.date ? new Date(xeroInvoice.date) : new Date(),
      dueDate: xeroInvoice.dueDate ? new Date(xeroInvoice.dueDate) : new Date(),
      description: xeroInvoice.reference || null,
      xeroInvoiceId: xeroInvoice.invoiceID,
      xeroType: xeroInvoice.type || 'ACCPAY',
      isXeroSynced: true,
      lastXeroSync: new Date()
    }
  }

  /**
   * Extract line items from Xero supplier invoice
   */
  private extractSupplierInvoiceLineItems(xeroInvoice: any, invoiceId: string): any[] {
    const lineItems = xeroInvoice.lineItems || []
    
    return lineItems.map((item: any, index: number) => {
      try {
        const quantity = parseFloat(item.quantity || '1')
        const unitPrice = parseFloat(item.unitAmount || '0')
        const taxAmount = parseFloat(item.taxAmount || '0')
        const subtotal = quantity * unitPrice
        const taxRate = subtotal > 0 ? (taxAmount / subtotal) * 100 : 0
        const totalPrice = subtotal + taxAmount

        return {
          id: crypto.randomUUID(),
          supplierInvoiceId: invoiceId,
          description: item.description || 'Item',
          quantity: quantity,
          unitPrice: unitPrice,
          taxRate: taxRate,
          subtotal: subtotal,
          taxAmount: taxAmount,
          totalPrice: totalPrice,
          order: index
        }
      } catch (error) {
        console.error(`Failed to parse line item ${index + 1} for supplier invoice ${xeroInvoice.invoiceNumber}:`, error)
        throw new Error(`Invalid line item data at position ${index + 1}`)
      }
    })
  }

  /**
   * Map Xero invoice status to local customer invoice status
   */
  private mapXeroInvoiceStatus(xeroStatus: string): string {
    const statusMap: { [key: string]: string } = {
      'DRAFT': 'DRAFT',
      'SUBMITTED': 'SENT',
      'AUTHORISED': 'APPROVED',
      'PAID': 'PAID',
      'VOIDED': 'CANCELLED'
    }
    return statusMap[xeroStatus] || 'DRAFT'
  }

  /**
   * Map Xero invoice status to local supplier invoice status
   */
  private mapXeroSupplierInvoiceStatus(xeroStatus: string): string {
    const statusMap: { [key: string]: string } = {
      'DRAFT': 'DRAFT',
      'SUBMITTED': 'PENDING_APPROVAL',
      'AUTHORISED': 'APPROVED',
      'PAID': 'PAID',
      'VOIDED': 'CANCELLED'
    }
    return statusMap[xeroStatus] || 'DRAFT'
  }

  // ==================== INVOICES PUSH (PHASE E) ====================

  /**
   * Push local invoices to Xero
   */
  async pushInvoices(options: {
    invoiceIds?: string[]
    pushAll?: boolean
    onlyUnsynced?: boolean
  } = {}): Promise<SyncResult> {
    const startTime = Date.now()
    let logId: string | undefined
    const result: SyncResult = {
      success: false,
      message: '',
      created: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      errorDetails: []
    }

    try {
      if (!this.tokens) {
        throw new Error('Service not initialized')
      }

      // Start logging
      logId = await XeroLogger.logSyncOperation({
        timestamp: new Date(),
        userId: this.userId,
        direction: 'PUSH',
        entity: 'INVOICES',
        status: 'IN_PROGRESS',
        recordsProcessed: 0,
        recordsSucceeded: 0,
        recordsFailed: 0,
        message: 'Starting invoice push to Xero',
        duration: 0
      })

      console.log('📤 Starting invoice push to Xero...', options)

      // Fetch invoices to push
      const invoicesToSync = await this.fetchInvoicesForPush(options)
      console.log(`📋 Found ${invoicesToSync.length} invoices to push`)

      // Push invoices
      for (const invoice of invoicesToSync) {
        try {
          await this.pushInvoiceToXero(invoice, result)
        } catch (error: any) {
          result.errors++
          result.errorDetails?.push(`Invoice ${invoice.invoiceNumber}: ${error.message}`)
          console.error(`❌ Failed to push invoice ${invoice.invoiceNumber}:`, error)
        }
      }

      // Calculate final stats
      const duration = Date.now() - startTime
      result.success = result.errors === 0
      result.message = result.success
        ? `Successfully pushed ${result.created + result.updated} invoices (${result.created} created, ${result.updated} updated, ${result.skipped} skipped)`
        : `Pushed with ${result.errors} errors (${result.created} created, ${result.updated} updated, ${result.skipped} skipped, ${result.errors} failed)`

      // Update log
      if (logId) {
        await XeroLogger.updateLogEntry(logId, {
          status: result.success ? 'SUCCESS' : 'WARNING',
          message: result.message,
          recordsProcessed: invoicesToSync.length,
          recordsSucceeded: result.created + result.updated + result.skipped,
          recordsFailed: result.errors,
          duration,
          details: {
            created: result.created,
            updated: result.updated,
            skipped: result.skipped,
            errors: result.errors,
            errorDetails: result.errorDetails
          }
        })
      }

      result.logId = logId
      return result

    } catch (error: any) {
      const duration = Date.now() - startTime
      const errorMessage = error.message || 'Unknown error'
      
      result.success = false
      result.message = `Failed to push invoices: ${errorMessage}`
      
      if (logId) {
        await XeroLogger.updateLogEntry(logId, {
          status: 'ERROR',
          message: result.message,
          errorMessage: errorMessage,
          errorStack: error.stack,
          duration
        })
      }

      console.error('❌ Invoice push failed:', error)
      return result
    }
  }

  /**
   * Fetch invoices for push operation
   */
  private async fetchInvoicesForPush(options: any): Promise<any[]> {
    const where: any = {}

    if (options.invoiceIds && options.invoiceIds.length > 0) {
      where.id = { in: options.invoiceIds }
    } else if (options.onlyUnsynced) {
      where.OR = [
        { isXeroSynced: false },
        { xeroInvoiceId: null }
      ]
    } else if (!options.pushAll) {
      // By default, only push unsynced invoices
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
   * Push invoice to Xero
   */
  private async pushInvoiceToXero(invoice: any, result: SyncResult): Promise<void> {
    // Validate client has Xero contact ID
    if (!invoice.Client.xeroContactId) {
      console.warn(`⚠️  Skipping invoice ${invoice.invoiceNumber} - client not synced with Xero`)
      result.skipped++
      return
    }

    // Check if already synced and unchanged
    const existingMapping = await this.findMappingByLocalId('INVOICE', invoice.id)
    
    // Calculate current hash
    const currentHash = calculateChangeHash({
      invoiceNumber: invoice.invoiceNumber,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      status: invoice.status,
      subtotal: invoice.subtotal.toString(),
      taxAmount: invoice.taxAmount?.toString(),
      totalAmount: invoice.totalAmount.toString(),
      lineItems: invoice.CustomerInvoiceItem.map((item: any) => ({
        description: item.description,
        quantity: item.quantity.toString(),
        unitPrice: item.unitPrice.toString(),
        taxType: item.taxType,
        accountCode: item.accountCode
      }))
    })

    // Skip if unchanged
    if (existingMapping && existingMapping.changeHash === currentHash && invoice.xeroInvoiceId) {
      console.log(`⏭️  Skipping invoice ${invoice.invoiceNumber} - no changes detected`)
      result.skipped++
      return
    }

    // Build Xero invoice object
    const xeroInvoice = this.buildXeroInvoiceFromLocal(invoice)

    try {
      if (invoice.xeroInvoiceId) {
        // Update existing Xero invoice
        console.log(`📤 Updating Xero invoice: ${invoice.invoiceNumber}`)
        
        await this.xeroClient.accountingApi.updateInvoice(
          this.tokens!.tenantId,
          invoice.xeroInvoiceId,
          { invoices: [xeroInvoice] }
        )

        // Update mapping
        await this.getOrCreateMapping('INVOICE', invoice.id, invoice.xeroInvoiceId, 'PUSH', currentHash)
        
        // Update local record
        await prisma.customerInvoice.update({
          where: { id: invoice.id },
          data: {
            isXeroSynced: true,
            lastXeroSync: new Date()
          }
        })

        console.log(`✅ Updated Xero invoice: ${invoice.invoiceNumber}`)
        result.updated++

      } else {
        // Create new Xero invoice
        console.log(`📤 Creating Xero invoice: ${invoice.invoiceNumber}`)
        
        const response = await this.xeroClient.accountingApi.createInvoices(
          this.tokens!.tenantId,
          { invoices: [xeroInvoice] }
        )

        const createdInvoice = response.body.invoices?.[0]
        
        if (!createdInvoice || !createdInvoice.invoiceID) {
          throw new Error('Failed to get invoiceID from Xero response')
        }

        // Create mapping
        await this.getOrCreateMapping('INVOICE', invoice.id, createdInvoice.invoiceID, 'PUSH', currentHash)
        
        // Update local record with Xero ID
        await prisma.customerInvoice.update({
          where: { id: invoice.id },
          data: {
            xeroInvoiceId: createdInvoice.invoiceID,
            isXeroSynced: true,
            lastXeroSync: new Date()
          }
        })

        console.log(`✅ Created Xero invoice: ${invoice.invoiceNumber}`)
        result.created++
      }

    } catch (error: any) {
      console.error(`❌ Failed to push invoice ${invoice.invoiceNumber}:`, error.message)
      throw error
    }
  }

  /**
   * Build Xero invoice object from local invoice
   */
  private buildXeroInvoiceFromLocal(invoice: any): any {
    const xeroInvoice: any = {
      type: 'ACCREC', // Accounts Receivable (sales invoice)
      contact: {
        contactID: invoice.Client.xeroContactId
      },
      invoiceNumber: invoice.invoiceNumber,
      date: invoice.issueDate.toISOString().split('T')[0],
      dueDate: invoice.dueDate.toISOString().split('T')[0],
      status: this.mapLocalInvoiceStatusToXero(invoice.status),
      currencyCode: invoice.currency || 'SGD',
      lineItems: invoice.CustomerInvoiceItem.map((item: any) => ({
        description: item.description,
        quantity: parseFloat(item.quantity.toString()),
        unitAmount: parseFloat(item.unitPrice.toString()),
        taxType: item.taxType || 'OUTPUT2',
        accountCode: item.accountCode || '200'
      }))
    }

    // Add reference (description)
    if (invoice.description) {
      xeroInvoice.reference = invoice.description
    }

    return xeroInvoice
  }

  /**
   * Map local invoice status to Xero status
   */
  private mapLocalInvoiceStatusToXero(localStatus: string): string {
    const statusMap: { [key: string]: string } = {
      'DRAFT': 'DRAFT',
      'APPROVED': 'AUTHORISED',
      'SENT': 'SUBMITTED',
      'PAID': 'PAID',
      'PARTIALLY_PAID': 'AUTHORISED',
      'OVERDUE': 'AUTHORISED',
      'CANCELLED': 'VOIDED'
    }
    return statusMap[localStatus] || 'DRAFT'
  }

  // ==================== PAYMENT SYNC ====================

  /**
   * Pull payments from Xero and sync to local database
   * Automatically matches payments to invoices and updates payment status
   */
  async pullPayments(options: {
    modifiedSince?: Date
    includeArchived?: boolean
    forceRefresh?: boolean
    paymentIds?: string[]
  } = {}): Promise<SyncResult> {
    const startTime = Date.now()
    let logId: string | undefined
    const result: SyncResult = {
      success: false,
      message: '',
      created: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      errorDetails: []
    }

    try {
      if (!this.tokens) {
        throw new Error('Service not initialized')
      }

      // Start logging
      logId = await XeroLogger.logSyncOperation({
        timestamp: new Date(),
        userId: this.userId,
        direction: 'PULL',
        entity: 'PAYMENTS',
        status: 'IN_PROGRESS',
        recordsProcessed: 0,
        recordsSucceeded: 0,
        recordsFailed: 0,
        message: 'Starting payment pull from Xero',
        duration: 0
      })

      console.log('📥 Fetching payments from Xero...', {
        includeArchived: options.includeArchived,
        forceRefresh: options.forceRefresh,
        modifiedSince: options.modifiedSince?.toISOString(),
        paymentCount: options.paymentIds?.length || 0
      })
      
      // Build query parameters
      const params: any = {}
      if (options.modifiedSince) {
        params.modifiedSince = options.modifiedSince
      }
      if (options.paymentIds && options.paymentIds.length > 0) {
        params.paymentIDs = options.paymentIds
      }

      // Fetch ALL payments from Xero with pagination (ENHANCED for full historical sync)
      console.log('📥 Fetching ALL payments from Xero (including historical data) with pagination...')
      let allPayments: any[] = []
      let page = 1
      let hasMorePages = true
      const pageSize = 100 // Xero's recommended page size

      while (hasMorePages) {
        try {
          console.log(`  💳 Fetching page ${page}...`)
          
          const response = await this.xeroClient.accountingApi.getPayments(
            this.tokens.tenantId,
            params.modifiedSince,
            undefined, // where
            undefined, // order
            page, // page number for pagination (ENHANCED)
            pageSize  // pageSize (ENHANCED)
          )

          const pagePayments = response.body.payments || []
          allPayments = allPayments.concat(pagePayments)
          
          console.log(`  ✅ Page ${page}: ${pagePayments.length} payments (total: ${allPayments.length})`)

          // Check if there are more pages
          if (pagePayments.length < pageSize) {
            hasMorePages = false
            console.log('  ℹ️ Last page reached')
          } else {
            page++
            // Rate limiting: wait 200ms between pages to avoid hitting Xero API limits
            await new Promise(resolve => setTimeout(resolve, 200))
          }
        } catch (apiError: any) {
          console.error(`❌ Failed to fetch payments page ${page} from Xero API:`, apiError)
          
          // Handle rate limiting
          if (apiError.response?.statusCode === 429) {
            const retryAfter = apiError.response.headers?.['retry-after'] || '60'
            console.log(`  ⏳ Rate limited. Waiting ${retryAfter}s before retry...`)
            await new Promise(resolve => setTimeout(resolve, parseInt(retryAfter) * 1000))
            continue // Retry the same page
          }
          
          throw new Error(`Xero API error on page ${page}: ${apiError.message || 'Failed to fetch payments'}`)
        }
      }

      const xeroPayments = allPayments
      console.log(`✅ Fetched ${xeroPayments.length} total payments from Xero across ${page} pages`)

      // Track matched invoices for status updates
      const matchedInvoices = new Set<string>()

      // Process each payment
      let processed = 0
      console.log('📊 Starting payment processing...')
      
      for (const xeroPayment of xeroPayments) {
        try {
          console.log(`📥 Processing payment ${processed + 1}/${xeroPayments.length}: ${xeroPayment.paymentID} (${xeroPayment.invoice?.contact?.name || 'Unknown'})`)
          
          // Skip if no payment ID
          if (!xeroPayment.paymentID) {
            console.warn('⚠️  Skipping payment without ID')
            result.skipped++
            processed++
            continue
          }

          // Find or create system user for synced payments
          let systemUser = await prisma.user.findFirst({
            where: { email: 'xero-sync@system.local' }
          })

          if (!systemUser) {
            systemUser = await prisma.user.create({
              data: {
                id: crypto.randomUUID(),
                email: 'xero-sync@system.local',
                name: 'Xero Sync System',
                role: 'SUPERADMIN',
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date()
              }
            })
          }

          // Find matching local invoice by Xero invoice ID
          let localInvoice = null
          if (xeroPayment.invoice?.invoiceID) {
            localInvoice = await prisma.customerInvoice.findUnique({
              where: { xeroInvoiceId: xeroPayment.invoice.invoiceID }
            })
          }

          // Find matching local customer by Xero contact ID
          let localCustomer = null
          if (xeroPayment.invoice?.contact?.contactID) {
            localCustomer = await prisma.customer.findUnique({
              where: { xeroContactId: xeroPayment.invoice.contact.contactID }
            })
          }

          // Check if payment already exists
          const existingPayment = await prisma.payment.findFirst({
            where: { xeroPaymentId: xeroPayment.paymentID }
          })

          // Map Xero payment data
          const paymentData = {
            paymentNumber: existingPayment?.paymentNumber || `XP-${xeroPayment.paymentID.substring(0, 8)}`,
            customerInvoiceId: localInvoice?.id || null,
            customerId: localCustomer?.id || null,
            amount: xeroPayment.amount ? parseFloat(xeroPayment.amount.toString()) : 0,
            currency: xeroPayment.invoice?.currencyCode?.toString() || 'SGD',
            paymentMethod: 'BANK_TRANSFER' as const,
            paymentDate: xeroPayment.date ? new Date(xeroPayment.date) : new Date(),
            reference: xeroPayment.reference || null,
            notes: null,
            status: xeroPayment.status?.toString() === 'AUTHORISED' ? 'COMPLETED' as const : 'PENDING' as const,
            xeroPaymentId: xeroPayment.paymentID,
            xeroContactId: xeroPayment.invoice?.contact?.contactID || null,
            paymentType: xeroPayment.paymentType?.toString() || null,
            currencyRate: xeroPayment.currencyRate ? parseFloat(xeroPayment.currencyRate.toString()) : null,
            isXeroSynced: true,
            lastXeroSync: new Date(),
            createdById: systemUser.id,
            updatedAt: new Date()
          }

          if (existingPayment) {
            // Update existing payment
            await prisma.payment.update({
              where: { id: existingPayment.id },
              data: paymentData
            })
            result.updated++
            console.log(`✅ Updated payment: ${existingPayment.paymentNumber}`)
          } else {
            // Create new payment
            await prisma.payment.create({
              data: {
                ...paymentData,
                id: crypto.randomUUID(),
                createdAt: new Date()
              }
            })
            result.created++
            console.log(`✅ Created payment: ${paymentData.paymentNumber}`)
          }

          // Track invoice for status update
          if (localInvoice) {
            matchedInvoices.add(localInvoice.id)
          }

          processed++
          
          // Log progress every 5 payments or at the end
          if (processed % 5 === 0 || processed === xeroPayments.length) {
            console.log(`✅ Progress: ${processed}/${xeroPayments.length} payments processed (${result.created} new, ${result.updated} updated, ${result.skipped} skipped, ${result.errors} errors)`)
          }
        } catch (error: any) {
          result.errors++
          result.errorDetails?.push(`Payment ${xeroPayment.paymentID}: ${error.message}`)
          console.error(`❌ Failed to process payment ${xeroPayment.paymentID}:`, error)
          
          // Log error to data quality system
          await logSyncFailure(
            'PAYMENT',
            error,
            undefined,
            `Payment ${xeroPayment.paymentID}`,
            xeroPayment.paymentID,
            { xeroPayment, errorStack: error.stack }
          )
          
          processed++
        }
      }
      
      console.log(`✅ Payment processing complete: ${processed} payments processed`)

      // Update invoice statuses based on payment totals
      let updatedInvoices = 0
      console.log(`📊 Updating ${matchedInvoices.size} invoice payment statuses...`)
      
      for (const invoiceId of matchedInvoices) {
        try {
          // Get total payments for this invoice
          const totalPayments = await prisma.payment.aggregate({
            _sum: { amount: true },
            where: {
              customerInvoiceId: invoiceId,
              status: 'COMPLETED'
            }
          })

          const paidAmount = totalPayments._sum.amount || 0
          
          // Get invoice details
          const invoice = await prisma.customerInvoice.findUnique({
            where: { id: invoiceId },
            select: { totalAmount: true, invoiceNumber: true }
          })

          if (!invoice) continue

          // Determine payment status
          const totalAmount = parseFloat(invoice.totalAmount.toString())
          const paidAmountNum = parseFloat(paidAmount.toString())
          
          let newStatus: 'PAID' | 'PARTIALLY_PAID' | 'APPROVED' = 'APPROVED'
          if (paidAmountNum >= totalAmount) {
            newStatus = 'PAID'
          } else if (paidAmountNum > 0) {
            newStatus = 'PARTIALLY_PAID'
          }

          // Update invoice
          await prisma.customerInvoice.update({
            where: { id: invoiceId },
            data: {
              status: newStatus,
              amountPaid: paidAmount,
              amountDue: totalAmount - paidAmountNum,
              paidDate: newStatus === 'PAID' ? new Date() : null
            }
          })

          updatedInvoices++
          console.log(`✅ Updated invoice ${invoice.invoiceNumber}: ${newStatus} (Paid: $${paidAmountNum.toFixed(2)} / $${totalAmount.toFixed(2)})`)
        } catch (error: any) {
          console.error(`❌ Failed to update invoice ${invoiceId} status:`, error)
        }
      }

      console.log(`✅ Updated ${updatedInvoices} invoice payment statuses`)

      // Calculate final stats
      const duration = Date.now() - startTime
      result.success = result.errors === 0
      result.message = result.success
        ? `Successfully synced ${result.created + result.updated} payments and updated ${updatedInvoices} invoices (${result.created} new, ${result.updated} updated, ${result.skipped} skipped)`
        : `Synced with ${result.errors} errors (${result.created} new, ${result.updated} updated, ${result.skipped} skipped, ${result.errors} failed)`

      // Update log
      if (logId) {
        await XeroLogger.updateLogEntry(logId, {
          status: result.success ? 'SUCCESS' : 'WARNING',
          message: result.message,
          recordsProcessed: xeroPayments.length,
          recordsSucceeded: result.created + result.updated + result.skipped,
          recordsFailed: result.errors,
          duration,
          details: {
            created: result.created,
            updated: result.updated,
            skipped: result.skipped,
            errors: result.errors,
            updatedInvoices,
            errorDetails: result.errorDetails
          }
        })
      }

      // Send push notifications
      console.log('📬 Sending push notifications for payment sync...')
      if (result.success) {
        await notifySyncSuccess('PAYMENT', result.created, result.updated, result.skipped)
      } else if (result.errors > 0 && (result.created + result.updated) > 0) {
        await notifySyncWarning('PAYMENT', result.created, result.updated, result.skipped, result.errors)
      } else {
        await notifySyncError('PAYMENT', result.message)
      }

      console.log(`✅ Payment sync complete: ${result.message}`)
      return result

    } catch (error: any) {
      console.error('❌ Payment sync failed:', error)
      
      // Update log with error
      if (logId) {
        await XeroLogger.updateLogEntry(logId, {
          status: 'ERROR',
          message: `Payment sync failed: ${error.message}`,
          recordsProcessed: 0,
          recordsSucceeded: 0,
          recordsFailed: 1,
          duration: Date.now() - startTime,
          errorMessage: error.message,
          errorStack: error.stack
        })
      }

      // Send error notification
      await notifySyncError('PAYMENT', error.message)

      result.success = false
      result.message = `Payment sync failed: ${error.message}`
      result.errors = 1
      return result
    }
  }
}
