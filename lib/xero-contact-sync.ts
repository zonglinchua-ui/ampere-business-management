
/**
 * Xero Two-Way Contact Sync Service
 * Implements hash-based conflict detection, field ownership, and loop prevention
 * 
 * IMPORTANT: Does NOT modify existing Xero OAuth/connection code
 */

import { XeroClient } from 'xero-node'
import { prisma } from './db'
import { XeroOAuthService } from './xero-oauth-service'
import crypto from 'crypto'
import { v4 as uuidv4 } from 'uuid'

// ==================== TYPES ====================

export interface SyncOptions {
  dryRun?: boolean
  modifiedSince?: Date
  includeArchived?: boolean
  correlationId?: string
}

export interface SyncResult {
  success: boolean
  message: string
  correlationId: string
  stats: {
    pulled: number
    pushed: number
    created: number
    updated: number
    skipped: number
    conflicts: number
    errors: number
  }
  conflicts: ConflictInfo[]
  errors: string[]
  dryRun: boolean
}

export interface ConflictInfo {
  entityId: string
  entityName: string
  localData: any
  xeroData: any
  conflictFields: string[]
}

// Field ownership rules
const XERO_OWNED_FIELDS = ['xeroTaxNumber', 'xeroAccountsReceivableTaxType', 'xeroAccountsPayableTaxType', 'xeroDefaultCurrency']
const WEBAPP_OWNED_FIELDS = ['notes', 'customerType', 'supplierType', 'isActive', 'customerNumber', 'supplierNumber']

// ==================== HELPER FUNCTIONS ====================

/**
 * Calculate consistent hash for change detection
 */
function calculateHash(data: any): string {
  // Extract only syncable fields for hash
  const syncableFields = extractSyncableFields(data)
  const normalized = JSON.stringify(syncableFields, Object.keys(syncableFields).sort())
  return crypto.createHash('md5').update(normalized).digest('hex')
}

/**
 * Extract syncable fields from contact (excluding metadata fields)
 */
function extractSyncableFields(contact: any) {
  return {
    name: contact.name || '',
    email: contact.email || '',
    phone: contact.phone || '',
    address: contact.address || '',
    city: contact.city || '',
    state: contact.state || '',
    country: contact.country || '',
    postalCode: contact.postalCode || '',
    contactPerson: contact.contactPerson || '',
    companyReg: contact.companyReg || '',
    website: contact.website || '',
    taxId: contact.xeroTaxNumber || contact.taxNumber || '',
    isCustomer: contact.isCustomer || false,
    isSupplier: contact.isSupplier || false
  }
}

/**
 * Map Xero contact to local format
 */
function mapXeroToLocal(xeroContact: any) {
  const phones = xeroContact.phones || []
  const addresses = xeroContact.addresses || []
  const primaryPhone = phones.find((p: any) => p.phoneType === 'DEFAULT' || p.phoneType === 'MOBILE') || phones[0]
  const primaryAddress = addresses.find((a: any) => a.addressType === 'POBOX' || a.addressType === 'STREET') || addresses[0]

  return {
    name: xeroContact.name || '',
    email: xeroContact.emailAddress || '',
    phone: primaryPhone?.phoneNumber || '',
    address: primaryAddress?.addressLine1 || '',
    city: primaryAddress?.city || '',
    state: primaryAddress?.region || '',
    country: primaryAddress?.country || 'Singapore',
    postalCode: primaryAddress?.postalCode || '',
    contactPerson: xeroContact.contactPersons?.[0]?.firstName 
      ? `${xeroContact.contactPersons[0].firstName} ${xeroContact.contactPersons[0].lastName || ''}`.trim()
      : xeroContact.firstName || '',
    companyReg: xeroContact.taxNumber || '',
    website: xeroContact.website || '',
    xeroTaxNumber: xeroContact.taxNumber || null,
    isCustomer: xeroContact.isCustomer || false,
    isSupplier: xeroContact.isSupplier || false,
    xeroContactId: xeroContact.contactID,
    xeroAccountNumber: xeroContact.accountNumber || null,
    xeroPhones: phones,
    xeroAddresses: addresses,
    xeroContactPersons: xeroContact.contactPersons || [],
    xeroDefaultCurrency: xeroContact.defaultCurrency || null,
    xeroAccountsReceivableTaxType: xeroContact.accountsReceivableTaxType || null,
    xeroAccountsPayableTaxType: xeroContact.accountsPayableTaxType || null,
    xeroUpdatedDateUTC: xeroContact.updatedDateUTC ? new Date(xeroContact.updatedDateUTC) : null,
    xeroContactStatus: xeroContact.contactStatus || 'ACTIVE',
    xeroBankAccountDetails: xeroContact.bankAccountDetails || null
  }
}

/**
 * Map local contact to Xero format
 */
function mapLocalToXero(localContact: any) {
  const xeroContact: any = {
    name: localContact.name,
    emailAddress: localContact.email || undefined,
    contactStatus: localContact.isActive ? 'ACTIVE' : 'ARCHIVED',
    isCustomer: localContact.isCustomer || false,
    isSupplier: localContact.isSupplier || false
  }

  // Map phones
  if (localContact.phone) {
    xeroContact.phones = [{
      phoneType: 'DEFAULT',
      phoneNumber: localContact.phone
    }]
  }

  // Map addresses
  if (localContact.address || localContact.city || localContact.state || localContact.postalCode) {
    xeroContact.addresses = [{
      addressType: 'STREET',
      addressLine1: localContact.address || undefined,
      city: localContact.city || undefined,
      region: localContact.state || undefined,
      country: localContact.country || undefined,
      postalCode: localContact.postalCode || undefined
    }]
  }

  // Map tax number (Xero-owned field)
  if (localContact.xeroTaxNumber) {
    xeroContact.taxNumber = localContact.xeroTaxNumber
  }

  // Map contact person
  if (localContact.contactPerson) {
    const names = localContact.contactPerson.split(' ')
    xeroContact.contactPersons = [{
      firstName: names[0],
      lastName: names.slice(1).join(' ') || undefined
    }]
  }

  return xeroContact
}

/**
 * Detect conflicts between local and remote data
 */
function detectConflicts(localData: any, remoteData: any, syncState: any): string[] {
  const conflicts: string[] = []
  const localFields = extractSyncableFields(localData) as Record<string, any>
  const remoteFields = extractSyncableFields(remoteData) as Record<string, any>

  for (const field in localFields) {
    if (localFields[field] !== remoteFields[field]) {
      // Check if field was modified on both sides since last sync
      const localModified = localData.updatedAt > (syncState?.lastSyncedAt || new Date(0))
      const remoteModified = remoteData.xeroUpdatedDateUTC > (syncState?.lastSyncedAt || new Date(0))
      
      if (localModified && remoteModified) {
        conflicts.push(field)
      }
    }
  }

  return conflicts
}

/**
 * Merge data respecting field ownership
 */
function mergeWithOwnership(localData: any, remoteData: any, direction: 'pull' | 'push') {
  const merged = { ...localData }

  if (direction === 'pull') {
    // Pull from Xero: respect Xero-owned fields
    for (const field of XERO_OWNED_FIELDS) {
      if (remoteData[field] !== undefined) {
        merged[field] = remoteData[field]
      }
    }
    // Also sync core fields
    merged.name = remoteData.name
    merged.email = remoteData.email
    merged.phone = remoteData.phone
    merged.address = remoteData.address
    merged.city = remoteData.city
    merged.state = remoteData.state
    merged.country = remoteData.country
    merged.postalCode = remoteData.postalCode
    merged.contactPerson = remoteData.contactPerson
    merged.isCustomer = remoteData.isCustomer
    merged.isSupplier = remoteData.isSupplier
    merged.xeroContactId = remoteData.xeroContactId
    merged.xeroUpdatedDateUTC = remoteData.xeroUpdatedDateUTC
  } else {
    // Push to Xero: respect webapp-owned fields (keep local values)
    // Only sync fields that Xero can accept
    merged.name = localData.name
    merged.email = localData.email
    merged.phone = localData.phone
    merged.address = localData.address
    merged.city = localData.city
    merged.state = localData.state
    merged.country = localData.country
    merged.postalCode = localData.postalCode
    merged.contactPerson = localData.contactPerson
    merged.isCustomer = localData.isCustomer
    merged.isSupplier = localData.isSupplier
  }

  return merged
}

// ==================== MAIN SERVICE CLASS ====================

export class XeroContactSyncService {
  private xeroClient: XeroClient
  private userId: string
  private tenantId: string | null = null

  constructor(userId: string) {
    this.userId = userId
    this.xeroClient = new XeroClient({
      clientId: process.env.XERO_CLIENT_ID!,
      clientSecret: process.env.XERO_CLIENT_SECRET!,
      redirectUris: [process.env.XERO_REDIRECT_URI!],
      scopes: process.env.XERO_SCOPES!.split(' ')
    })
  }

  /**
   * Initialize with stored tokens
   */
  async initialize(): Promise<boolean> {
    try {
      const tokens = await XeroOAuthService.getStoredTokens()
      if (!tokens) {
        console.error('❌ No Xero tokens found')
        return false
      }

      // Check if token needs refresh
      const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000)
      if (tokens.expiresAt <= fiveMinutesFromNow) {
        const oauthService = new XeroOAuthService()
        const newTokens = await oauthService.refreshAccessToken(tokens.refreshToken, tokens.tenantId)
        if (!newTokens) {
          console.error('❌ Failed to refresh token')
          return false
        }
        this.xeroClient.setTokenSet({
          access_token: newTokens.accessToken,
          refresh_token: newTokens.refreshToken,
          expires_at: newTokens.expiresAt.getTime()
        })
        this.tenantId = newTokens.tenantId
      } else {
        this.xeroClient.setTokenSet({
          access_token: tokens.accessToken,
          refresh_token: tokens.refreshToken,
          expires_at: tokens.expiresAt.getTime()
        })
        this.tenantId = tokens.tenantId
      }

      return true
    } catch (error) {
      console.error('❌ Failed to initialize:', error)
      return false
    }
  }

  /**
   * Pull contacts from Xero (with conflict detection)
   */
  async pullContacts(options: SyncOptions = {}): Promise<SyncResult> {
    const correlationId = options.correlationId || crypto.randomUUID()
    const result: SyncResult = {
      success: false,
      message: '',
      correlationId,
      stats: { pulled: 0, pushed: 0, created: 0, updated: 0, skipped: 0, conflicts: 0, errors: 0 },
      conflicts: [],
      errors: [],
      dryRun: options.dryRun || false
    }

    try {
      if (!this.tenantId) {
        throw new Error('Service not initialized')
      }

      console.log(`📥 ${options.dryRun ? '[DRY RUN] ' : ''}Pulling contacts from Xero...`)

      // Fetch contacts from Xero
      const whereClause = options.includeArchived ? undefined : 'ContactStatus=="ACTIVE"'
      const response = await this.xeroClient.accountingApi.getContacts(
        this.tenantId,
        options.modifiedSince,
        whereClause
      )

      const xeroContacts = response.body.contacts || []
      console.log(`📦 Fetched ${xeroContacts.length} contacts from Xero`)

      for (const xeroContact of xeroContacts) {
        try {
          await this.syncContactFromXero(xeroContact, correlationId, options.dryRun || false, result)
        } catch (error: any) {
          result.stats.errors++
          result.errors.push(`${xeroContact.name}: ${error.message}`)
        }
      }

      result.success = result.stats.errors === 0
      result.message = options.dryRun
        ? `Dry run completed: ${result.stats.created} would be created, ${result.stats.updated} would be updated, ${result.stats.conflicts} conflicts detected`
        : `Sync completed: ${result.stats.created} created, ${result.stats.updated} updated, ${result.stats.conflicts} conflicts`

      console.log(`✅ ${result.message}`)
      return result

    } catch (error: any) {
      result.errors.push(error.message)
      result.message = `Sync failed: ${error.message}`
      console.error('❌', result.message)
      return result
    }
  }

  /**
   * Push contacts to Xero (with conflict detection)
   */
  async pushContacts(contactIds: string[], options: SyncOptions = {}): Promise<SyncResult> {
    const correlationId = options.correlationId || crypto.randomUUID()
    const result: SyncResult = {
      success: false,
      message: '',
      correlationId,
      stats: { pulled: 0, pushed: 0, created: 0, updated: 0, skipped: 0, conflicts: 0, errors: 0 },
      conflicts: [],
      errors: [],
      dryRun: options.dryRun || false
    }

    try {
      if (!this.tenantId) {
        throw new Error('Service not initialized')
      }

      console.log(`📤 ${options.dryRun ? '[DRY RUN] ' : ''}Pushing ${contactIds.length} contacts to Xero...`)

      for (const contactId of contactIds) {
        try {
          // Determine if it's a client or supplier
          let localContact = await prisma.customer.findUnique({ where: { id: contactId } })
          let entityType = 'CLIENT'
          
          if (!localContact) {
            localContact = await prisma.supplier.findUnique({ where: { id: contactId } }) as any
            entityType = 'SUPPLIER'
          }

          if (!localContact) {
            result.errors.push(`Contact ${contactId} not found`)
            result.stats.errors++
            continue
          }

          await this.syncContactToXero(localContact as any, entityType, correlationId, options.dryRun || false, result)

        } catch (error: any) {
          result.stats.errors++
          result.errors.push(`${contactId}: ${error.message}`)
        }
      }

      result.success = result.stats.errors === 0
      result.message = options.dryRun
        ? `Dry run completed: ${result.stats.created} would be created, ${result.stats.updated} would be updated, ${result.stats.conflicts} conflicts detected`
        : `Push completed: ${result.stats.created} created, ${result.stats.updated} updated, ${result.stats.conflicts} conflicts`

      console.log(`✅ ${result.message}`)
      return result

    } catch (error: any) {
      result.errors.push(error.message)
      result.message = `Push failed: ${error.message}`
      console.error('❌', result.message)
      return result
    }
  }

  /**
   * Sync single contact from Xero to local DB
   */
  private async syncContactFromXero(
    xeroContact: any,
    correlationId: string,
    dryRun: boolean,
    result: SyncResult
  ): Promise<void> {
    const xeroContactId = xeroContact.contactID
    const remoteData = mapXeroToLocal(xeroContact)
    const remoteHash = calculateHash(remoteData)

    // Find existing contact by xeroContactId
    let localContact: any = await prisma.customer.findUnique({
      where: { xeroContactId: xeroContactId }
    })
    
    let entityType = 'CLIENT'
    if (!localContact) {
      localContact = await prisma.supplier.findUnique({
        where: { xeroContactId: xeroContactId }
      })
      entityType = 'SUPPLIER'
    }

    // Get sync state
    const syncState = localContact
      ? await prisma.xero_sync_state.findUnique({
          where: { entityType_entityId: { entityType, entityId: localContact.id } }
        })
      : null

    // Check if already synced with same hash
    if (syncState?.lastRemoteHash === remoteHash && syncState?.syncOrigin !== 'local') {
      result.stats.skipped++
      return
    }

    // Check for conflicts
    if (localContact && syncState) {
      const localHash = calculateHash(extractSyncableFields(localContact))
      const conflictFields = detectConflicts(localContact, remoteData, syncState)

      if (conflictFields.length > 0 && syncState.syncOrigin === 'local') {
        // Conflict detected: both sides modified
        result.stats.conflicts++
        result.conflicts.push({
          entityId: localContact.id,
          entityName: localContact.name,
          localData: extractSyncableFields(localContact),
          xeroData: extractSyncableFields(remoteData),
          conflictFields
        })

        if (!dryRun) {
          // Mark as conflict in sync state
          await prisma.xero_sync_state.update({
            where: { id: syncState.id },
            data: {
              status: 'CONFLICT',
              conflictData: {
                localData: extractSyncableFields(localContact),
                xeroData: extractSyncableFields(remoteData),
                conflictFields,
                detectedAt: new Date().toISOString()
              }
            }
          })

          // Log conflict
          await prisma.xero_sync_log.create({
            data: {
              id: uuidv4(),
              correlationId,
              entityType,
              entityId: localContact.id,
              xeroId: xeroContactId,
              operation: 'CONFLICT',
              syncOrigin: 'remote',
              beforeSnapshot: extractSyncableFields(localContact),
              afterSnapshot: extractSyncableFields(remoteData),
              changeHash: remoteHash,
              status: 'CONFLICT',
              userId: this.userId,
              timestamp: new Date()
            }
          })
        }
        return
      }
    }

    // No conflict - proceed with sync
    const mergedData = localContact ? mergeWithOwnership(localContact, remoteData, 'pull') : remoteData

    if (dryRun) {
      if (localContact) {
        result.stats.updated++
      } else {
        result.stats.created++
      }
      return
    }

    // Perform upsert
    const beforeSnapshot = localContact ? extractSyncableFields(localContact) : null

    if (entityType === 'CLIENT' || (!localContact && xeroContact.isCustomer)) {
      // Determine entity type for new contact
      if (!localContact) {
        entityType = 'CLIENT'
      }

      const upsertData = {
        name: mergedData.name,
        email: mergedData.email,
        phone: mergedData.phone,
        address: mergedData.address,
        city: mergedData.city,
        state: mergedData.state,
        country: mergedData.country,
        postalCode: mergedData.postalCode,
        contactPerson: mergedData.contactPerson,
        website: mergedData.website,
        xeroContactId: xeroContactId,
        xeroTaxNumber: mergedData.xeroTaxNumber,
        xeroPhones: mergedData.xeroPhones,
        xeroAddresses: mergedData.xeroAddresses,
        xeroContactPersons: mergedData.xeroContactPersons,
        xeroDefaultCurrency: mergedData.xeroDefaultCurrency,
        xeroAccountsReceivableTaxType: mergedData.xeroAccountsReceivableTaxType,
        xeroAccountsPayableTaxType: mergedData.xeroAccountsPayableTaxType,
        xeroUpdatedDateUTC: mergedData.xeroUpdatedDateUTC,
        xeroContactStatus: mergedData.xeroContactStatus,
        xeroAccountNumber: mergedData.xeroAccountNumber,
        xeroBankAccountDetails: mergedData.xeroBankAccountDetails,
        isXeroSynced: true,
        lastXeroSync: new Date(),
        updatedAt: new Date()
      }

      localContact = await prisma.customer.upsert({
        where: { xeroContactId: xeroContactId },
        update: upsertData,
        create: {
          id: crypto.randomUUID(),
          ...upsertData,
          createdById: this.userId,
          isActive: true
        }
      })

      entityType = 'CLIENT'
    } else {
      // Supplier
      if (!localContact) {
        entityType = 'SUPPLIER'
      }

      const upsertData = {
        name: mergedData.name,
        email: mergedData.email,
        phone: mergedData.phone,
        address: mergedData.address,
        city: mergedData.city,
        state: mergedData.state,
        country: mergedData.country,
        postalCode: mergedData.postalCode,
        contactPerson: mergedData.contactPerson,
        website: mergedData.website,
        xeroContactId: xeroContactId,
        xeroTaxNumber: mergedData.xeroTaxNumber,
        xeroPhones: mergedData.xeroPhones,
        xeroAddresses: mergedData.xeroAddresses,
        xeroContactPersons: mergedData.xeroContactPersons,
        xeroDefaultCurrency: mergedData.xeroDefaultCurrency,
        xeroAccountsReceivableTaxType: mergedData.xeroAccountsReceivableTaxType,
        xeroAccountsPayableTaxType: mergedData.xeroAccountsPayableTaxType,
        xeroUpdatedDateUTC: mergedData.xeroUpdatedDateUTC,
        xeroContactStatus: mergedData.xeroContactStatus,
        xeroAccountNumber: mergedData.xeroAccountNumber,
        xeroBankAccountDetails: mergedData.xeroBankAccountDetails,
        isXeroSynced: true,
        lastXeroSync: new Date(),
        updatedAt: new Date()
      }

      localContact = await prisma.supplier.upsert({
        where: { xeroContactId: xeroContactId },
        update: upsertData,
        create: {
          id: crypto.randomUUID(),
          ...upsertData,
          createdById: this.userId,
          isActive: true,
          isApproved: false
        }
      })

      entityType = 'SUPPLIER'
    }

    const afterSnapshot = extractSyncableFields(localContact)

    // Update/create sync state
    await prisma.xero_sync_state.upsert({
      where: { entityType_entityId: { entityType, entityId: localContact.id } },
      update: {
        xeroId: xeroContactId,
        lastRemoteHash: remoteHash,
        lastLocalHash: calculateHash(afterSnapshot),
        lastSyncedAt: new Date(),
        lastRemoteModified: mergedData.xeroUpdatedDateUTC,
        lastLocalModified: localContact.updatedAt,
        syncOrigin: 'remote',
        correlationId,
        status: 'ACTIVE'
      },
      create: {
        id: crypto.randomUUID(),
        entityType,
        entityId: localContact.id,
        xeroId: xeroContactId,
        lastRemoteHash: remoteHash,
        lastLocalHash: calculateHash(afterSnapshot),
        lastSyncedAt: new Date(),
        lastRemoteModified: mergedData.xeroUpdatedDateUTC,
        lastLocalModified: localContact.updatedAt,
        syncOrigin: 'remote',
        correlationId,
        status: 'ACTIVE',
        updatedAt: new Date()
      }
    })

    // Log sync operation
    await prisma.xero_sync_log.create({
      data: {
        id: uuidv4(),
        correlationId,
        entityType,
        entityId: localContact.id,
        xeroId: xeroContactId,
        operation: beforeSnapshot ? 'UPDATE' : 'CREATE',
        syncOrigin: 'remote',
        beforeSnapshot: beforeSnapshot || undefined,
        afterSnapshot: afterSnapshot,
        changeHash: remoteHash,
        status: 'SUCCESS',
        userId: this.userId,
        timestamp: new Date()
      }
    })

    if (beforeSnapshot) {
      result.stats.updated++
    } else {
      result.stats.created++
    }
  }

  /**
   * Sync single contact from local DB to Xero
   */
  private async syncContactToXero(
    localContact: any,
    entityType: string,
    correlationId: string,
    dryRun: boolean,
    result: SyncResult
  ): Promise<void> {
    const localHash = calculateHash(extractSyncableFields(localContact))

    // Get sync state
    const syncState = await prisma.xero_sync_state.findUnique({
      where: { entityType_entityId: { entityType, entityId: localContact.id } }
    })

    // Check if already synced
    if (syncState?.lastLocalHash === localHash && syncState?.syncOrigin !== 'remote') {
      result.stats.skipped++
      return
    }

    // Check for conflicts if already synced
    if (syncState?.xeroId && syncState.syncOrigin === 'remote') {
      // Fetch current Xero data
      try {
        const xeroResponse = await this.xeroClient.accountingApi.getContact(
          this.tenantId!,
          syncState.xeroId
        )
        const xeroContact = xeroResponse.body.contacts?.[0]

        if (xeroContact) {
          const remoteData = mapXeroToLocal(xeroContact)
          const remoteHash = calculateHash(remoteData)
          const conflictFields = detectConflicts(localContact, remoteData, syncState)

          if (conflictFields.length > 0 && remoteHash !== syncState.lastRemoteHash) {
            // Conflict: both sides modified
            result.stats.conflicts++
            result.conflicts.push({
              entityId: localContact.id,
              entityName: localContact.name,
              localData: extractSyncableFields(localContact),
              xeroData: extractSyncableFields(remoteData),
              conflictFields
            })

            if (!dryRun) {
              await prisma.xero_sync_state.update({
                where: { id: syncState.id },
                data: {
                  status: 'CONFLICT',
                  conflictData: {
                    localData: extractSyncableFields(localContact),
                    xeroData: extractSyncableFields(remoteData),
                    conflictFields,
                    detectedAt: new Date().toISOString()
                  }
                }
              })

              await prisma.xero_sync_log.create({
                data: {
                  id: uuidv4(),
                  correlationId,
                  entityType,
                  entityId: localContact.id,
                  xeroId: syncState.xeroId,
                  operation: 'CONFLICT',
                  syncOrigin: 'local',
                  beforeSnapshot: extractSyncableFields(remoteData),
                  afterSnapshot: extractSyncableFields(localContact),
                  changeHash: localHash,
                  status: 'CONFLICT',
                  userId: this.userId,
                  timestamp: new Date()
                }
              })
            }
            return
          }
        }
      } catch (error) {
        console.warn(`⚠️ Could not fetch Xero contact for conflict check: ${error}`)
      }
    }

    if (dryRun) {
      if (syncState?.xeroId) {
        result.stats.updated++
      } else {
        result.stats.created++
      }
      return
    }

    // Map to Xero format
    const xeroData = mapLocalToXero(localContact)
    const beforeSnapshot = extractSyncableFields(localContact)

    // Create or update in Xero
    let xeroContact: any
    let operation: string

    if (syncState?.xeroId) {
      // Update existing
      xeroData.contactID = syncState.xeroId
      const response = await this.xeroClient.accountingApi.updateContact(
        this.tenantId!,
        syncState.xeroId,
        { contacts: [xeroData] }
      )
      xeroContact = response.body.contacts?.[0]
      operation = 'UPDATE'
      result.stats.updated++
    } else {
      // Create new
      const response = await this.xeroClient.accountingApi.createContacts(
        this.tenantId!,
        { contacts: [xeroData] }
      )
      xeroContact = response.body.contacts?.[0]
      operation = 'CREATE'
      result.stats.created++
    }

    if (!xeroContact) {
      throw new Error('Failed to create/update contact in Xero')
    }

    const xeroContactId = xeroContact.contactID

    // Update local contact with xeroContactId
    const updateData = {
      xeroContactId: xeroContactId,
      isXeroSynced: true,
      lastXeroSync: new Date()
    }

    if (entityType === 'CLIENT') {
      await prisma.customer.update({
        where: { id: localContact.id },
        data: updateData
      })
    } else {
      await prisma.supplier.update({
        where: { id: localContact.id },
        data: updateData
      })
    }

    // Update/create sync state
    await prisma.xero_sync_state.upsert({
      where: { entityType_entityId: { entityType, entityId: localContact.id } },
      update: {
        xeroId: xeroContactId,
        lastLocalHash: localHash,
        lastRemoteHash: calculateHash(mapXeroToLocal(xeroContact)),
        lastSyncedAt: new Date(),
        lastLocalModified: localContact.updatedAt,
        lastRemoteModified: xeroContact.updatedDateUTC ? new Date(xeroContact.updatedDateUTC) : new Date(),
        syncOrigin: 'local',
        correlationId,
        status: 'ACTIVE'
      },
      create: {
        id: crypto.randomUUID(),
        entityType,
        entityId: localContact.id,
        xeroId: xeroContactId,
        lastLocalHash: localHash,
        lastRemoteHash: calculateHash(mapXeroToLocal(xeroContact)),
        lastSyncedAt: new Date(),
        lastLocalModified: localContact.updatedAt,
        lastRemoteModified: xeroContact.updatedDateUTC ? new Date(xeroContact.updatedDateUTC) : new Date(),
        syncOrigin: 'local',
        correlationId,
        status: 'ACTIVE',
        updatedAt: new Date()
      }
    })

    // Log sync operation
    await prisma.xero_sync_log.create({
      data: {
        id: uuidv4(),
        correlationId,
        entityType,
        entityId: localContact.id,
        xeroId: xeroContactId,
        operation,
        syncOrigin: 'local',
        beforeSnapshot: beforeSnapshot,
        afterSnapshot: extractSyncableFields(localContact),
        changeHash: localHash,
        status: 'SUCCESS',
        userId: this.userId,
        timestamp: new Date()
      }
    })
  }

  /**
   * Get sync conflicts
   */
  async getConflicts(): Promise<any[]> {
    return prisma.xero_sync_state.findMany({
      where: { status: 'CONFLICT' }
    })
  }

  /**
   * Resolve conflict
   */
  async resolveConflict(
    entityType: string,
    entityId: string,
    resolution: 'use_local' | 'use_remote' | 'manual',
    manualData?: any
  ): Promise<void> {
    const syncState = await prisma.xero_sync_state.findUnique({
      where: { entityType_entityId: { entityType, entityId } }
    })

    if (!syncState || syncState.status !== 'CONFLICT') {
      throw new Error('No conflict found for this entity')
    }

    const correlationId = crypto.randomUUID()

    if (resolution === 'use_local') {
      // Push local version to Xero
      let localContact
      if (entityType === 'CLIENT') {
        localContact = await prisma.customer.findUnique({ where: { id: entityId } })
      } else {
        localContact = await prisma.supplier.findUnique({ where: { id: entityId } })
      }

      if (localContact) {
        const dummyResult: SyncResult = {
          success: false,
          message: '',
          correlationId,
          stats: { pulled: 0, pushed: 0, created: 0, updated: 0, skipped: 0, conflicts: 0, errors: 0 },
          conflicts: [],
          errors: [],
          dryRun: false
        }
        await this.syncContactToXero(localContact, entityType, correlationId, false, dummyResult)
      }
    } else if (resolution === 'use_remote') {
      // Pull from Xero
      if (syncState.xeroId) {
        const xeroResponse = await this.xeroClient.accountingApi.getContact(
          this.tenantId!,
          syncState.xeroId
        )
        const xeroContact = xeroResponse.body.contacts?.[0]
        if (xeroContact) {
          const dummyResult: SyncResult = {
            success: false,
            message: '',
            correlationId,
            stats: { pulled: 0, pushed: 0, created: 0, updated: 0, skipped: 0, conflicts: 0, errors: 0 },
            conflicts: [],
            errors: [],
            dryRun: false
          }
          // Force sync by clearing hashes
          await prisma.xero_sync_state.update({
            where: { id: syncState.id },
            data: { lastRemoteHash: null, status: 'ACTIVE' }
          })
          await this.syncContactFromXero(xeroContact, correlationId, false, dummyResult)
        }
      }
    } else if (resolution === 'manual' && manualData) {
      // Apply manual resolution
      if (entityType === 'CLIENT') {
        await prisma.customer.update({
          where: { id: entityId },
          data: { ...manualData, updatedAt: new Date() }
        })
      } else {
        await prisma.supplier.update({
          where: { id: entityId },
          data: { ...manualData, updatedAt: new Date() }
        })
      }

      // Then push to Xero
      let localContact
      if (entityType === 'CLIENT') {
        localContact = await prisma.customer.findUnique({ where: { id: entityId } })
      } else {
        localContact = await prisma.supplier.findUnique({ where: { id: entityId } })
      }

      if (localContact) {
        const dummyResult: SyncResult = {
          success: false,
          message: '',
          correlationId,
          stats: { pulled: 0, pushed: 0, created: 0, updated: 0, skipped: 0, conflicts: 0, errors: 0 },
          conflicts: [],
          errors: [],
          dryRun: false
        }
        await this.syncContactToXero(localContact, entityType, correlationId, false, dummyResult)
      }
    }

    // Mark as resolved
    await prisma.xero_sync_state.update({
      where: { id: syncState.id },
      data: {
        status: 'ACTIVE',
        conflictData: undefined
      }
    })
  }
}
