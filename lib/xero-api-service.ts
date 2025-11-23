
/**
 * Xero API Service - Data Sync Operations
 * Handles all Xero API interactions for syncing data
 */

import { XeroClient } from 'xero-node'
import { prisma } from './db'
import { XeroOAuthService, XeroTokens } from './xero-oauth-service'

export interface SyncResult {
  success: boolean
  message: string
  syncedCount?: number
  totalCount?: number
  errors?: string[]
}

/**
 * Xero API Service for data synchronization
 */
export class XeroApiService {
  private xeroClient: XeroClient
  private tokens: XeroTokens | null = null

  constructor() {
    this.xeroClient = new XeroClient({
      clientId: process.env.XERO_CLIENT_ID!,
      clientSecret: process.env.XERO_CLIENT_SECRET!,
      redirectUris: [process.env.XERO_REDIRECT_URI!],
      scopes: process.env.XERO_SCOPES!.split(' '),
    })
  }

  /**
   * Initialize service with stored tokens
   * Automatically refreshes tokens if they expire within 20 minutes (proactive approach)
   * This ensures tokens are ALWAYS fresh before any API operations
   */
  async initialize(): Promise<boolean> {
    try {
      // Import auto-refresh helper
      const { ensureXeroTokensFresh } = await import('./xero-auto-refresh')
      
      // CRITICAL: Ensure tokens are fresh before any operations
      // This is the key to preventing Xero re-authentication
      const tokensFresh = await ensureXeroTokensFresh(20) // Ensure at least 20 minutes validity
      
      if (!tokensFresh) {
        console.error('❌ Failed to ensure tokens are fresh during initialization')
        return false
      }

      // Get fresh tokens from database (may have been refreshed by ensureXeroTokensFresh)
      this.tokens = await XeroOAuthService.getStoredTokens()

      if (!this.tokens) {
        console.log('⚠️ No Xero tokens found')
        return false
      }

      const timeUntilExpiry = Math.round((this.tokens.expiresAt.getTime() - Date.now()) / 1000 / 60)
      console.log(`✅ Tokens ensured fresh - valid for ${timeUntilExpiry} more minutes`)

      // Set tokens in Xero client
      this.xeroClient.setTokenSet({
        access_token: this.tokens.accessToken,
        refresh_token: this.tokens.refreshToken,
        expires_at: this.tokens.expiresAt.getTime()
      })

      console.log('✅ Xero API service initialized with tenant:', this.tokens.tenantId)
      return true

    } catch (error: any) {
      console.error('❌ Failed to initialize Xero API service:', error.message)
      return false
    }
  }

  /**
   * Refresh the current access token
   * Extracted into separate method for reusability
   */
  private async refreshToken(): Promise<boolean> {
    if (!this.tokens) {
      return false
    }

    try {
      const oauthService = new XeroOAuthService()
      const newTokens = await oauthService.refreshAccessToken(
        this.tokens.refreshToken,
        this.tokens.tenantId
      )

      if (!newTokens) {
        return false
      }

      this.tokens = newTokens
      
      // Update Xero client with new tokens
      this.xeroClient.setTokenSet({
        access_token: this.tokens.accessToken,
        refresh_token: this.tokens.refreshToken,
        expires_at: this.tokens.expiresAt.getTime()
      })

      return true
    } catch (error: any) {
      console.error('❌ Token refresh failed:', error.message)
      return false
    }
  }

  /**
   * Make API call with automatic token refresh on 401 errors
   * This ensures seamless operation even if token expires mid-operation
   */
  private async makeApiCallWithRetry<T>(
    apiCall: () => Promise<T>,
    retryOnAuthError: boolean = true
  ): Promise<T> {
    try {
      return await apiCall()
    } catch (error: any) {
      const status = error?.response?.statusCode || error?.statusCode
      
      // If we get a 401 (Unauthorized) and haven't retried yet, refresh token and retry
      if (status === 401 && retryOnAuthError) {
        console.log('🔄 Received 401 error, attempting token refresh and retry...')
        
        const refreshed = await this.refreshToken()
        
        if (refreshed) {
          console.log('✅ Token refreshed, retrying API call...')
          // Retry the API call once (retryOnAuthError = false to prevent infinite loop)
          return await this.makeApiCallWithRetry(apiCall, false)
        } else {
          console.error('❌ Token refresh failed, cannot retry')
          throw new Error('Xero session expired. Please reconnect to Xero.')
        }
      }
      
      // Re-throw the error if it's not a 401 or if retry already failed
      throw error
    }
  }

  /**
   * Test Xero connection
   * Now with automatic token refresh on auth errors
   */
  async testConnection(): Promise<{ success: boolean; organization?: any; error?: string }> {
    if (!this.tokens) {
      return { success: false, error: 'Not connected to Xero' }
    }

    try {
      const response = await this.makeApiCallWithRetry(async () => {
        return await this.xeroClient.accountingApi.getOrganisations(
          this.tokens!.tenantId
        )
      })
      
      const organization = response.body.organisations?.[0]

      if (organization) {
        return { success: true, organization }
      }

      return { success: false, error: 'No organization found' }

    } catch (error: any) {
      console.error('❌ Connection test failed:', error.message)
      return {
        success: false,
        error: error.message || 'Connection test failed'
      }
    }
  }

  /**
   * Sync contacts from Xero
   * Maps Xero contacts to Clients and Suppliers based on IsCustomer/IsSupplier flags
   * Note: Xero doesn't assign client/supplier numbers - we maintain our internal numbering
   */
  async syncContacts(): Promise<SyncResult> {
    if (!this.tokens) {
      return {
        success: false,
        message: 'Not connected to Xero. Please connect first.'
      }
    }

    try {
      console.log('📥 Fetching contacts from Xero with pagination...')

      // Fetch ALL contacts using pagination
      let allContacts: any[] = []
      let currentPage = 1
      let hasMorePages = true
      const pageSize = 100 // Xero's max page size

      while (hasMorePages) {
        console.log(`📊 [Page ${currentPage}] Fetching contacts...`)
        
        let retries = 0
        const maxRetries = 3
        let pageSuccess = false
        
        while (retries < maxRetries && !pageSuccess) {
          try {
            // Use automatic token refresh on auth errors
            const response = await this.makeApiCallWithRetry(async () => {
              return await this.xeroClient.accountingApi.getContacts(
                this.tokens!.tenantId,
                undefined, // ifModifiedSince
                undefined, // where
                undefined, // order
                undefined, // IDs
                currentPage, // page number
                true, // includeArchived - to get all contacts
                undefined, // summaryOnly
                undefined, // searchTerm
                pageSize // pageSize
              )
            })

            const pageContacts = response.body.contacts || []
            const beforeCount = allContacts.length
            const afterCount = beforeCount + pageContacts.length
            
            console.log(`✅ [Page ${currentPage}] Retrieved ${pageContacts.length} contacts`)
            console.log(`📊 [Page ${currentPage}] Cumulative: ${afterCount} contacts (${beforeCount} + ${pageContacts.length})`)
            
            // Safety check: ensure we're not getting an empty page mid-sync
            if (pageContacts.length === 0 && currentPage === 1) {
              console.warn('⚠️ [Page 1] Received 0 contacts - this may indicate an API issue')
            }
            
            allContacts.push(...pageContacts)
            pageSuccess = true
            
            // Check if there are more pages
            // Continue if we got a full page, stop if we got a partial page
            if (pageContacts.length < pageSize) {
              hasMorePages = false
              console.log(`🏁 [Page ${currentPage}] Last page reached (received ${pageContacts.length} < ${pageSize})`)
              console.log(`📋 Total pages fetched: ${currentPage}`)
              console.log(`📦 Total contacts accumulated: ${allContacts.length}`)
            } else {
              console.log(`➡️  [Page ${currentPage}] Full page received, continuing to next page...`)
              currentPage++
              // Add small delay to avoid rate limiting
              await new Promise(resolve => setTimeout(resolve, 250))
            }
          } catch (error: any) {
            retries++
            const status = error?.response?.statusCode || error?.statusCode
            
            console.error(`❌ [Page ${currentPage}] Fetch failed (attempt ${retries}/${maxRetries}):`, {
              status,
              message: error?.message,
              body: error?.response?.body,
            })
            
            // Handle rate limiting (429)
            if (status === 429) {
              const retryAfter = error?.response?.headers?.['retry-after'] || '10'
              const delayMs = parseInt(retryAfter) * 1000
              console.warn(`⏳ [Page ${currentPage}] Rate limited (429). Waiting ${delayMs}ms before retry...`)
              await new Promise(r => setTimeout(r, delayMs))
              continue
            }
            
            // Handle server errors (5xx)
            if (status >= 500 && status < 600) {
              const delayMs = 10000 * retries // Exponential backoff: 10s, 20s, 30s
              console.warn(`⏳ [Page ${currentPage}] Server error (${status}). Retrying in ${delayMs}ms...`)
              await new Promise(r => setTimeout(r, delayMs))
              continue
            }
            
            // If max retries reached, throw error
            if (retries >= maxRetries) {
              console.error(`🛑 [Page ${currentPage}] Failed after ${maxRetries} attempts. Aborting pagination.`)
              throw new Error(`Failed to fetch page ${currentPage} after ${maxRetries} attempts: ${error.message}`)
            }
          }
        }
        
        // Ensure we don't have an infinite loop
        if (currentPage > 200) {
          console.error('🛑 Safety limit reached: processed 200 pages (20,000 contacts). Stopping pagination.')
          hasMorePages = false
          break
        }
      }

      const contacts = allContacts
      console.log(`✅ Total fetched from Xero: ${contacts.length} contacts (across ${currentPage} pages)`)

      let newClientsCreated = 0
      let existingClientsUpdated = 0
      let newSuppliersCreated = 0
      let existingSuppliersUpdated = 0
      let newGeneralContactsCreated = 0
      let existingGeneralContactsUpdated = 0
      let skippedCount = 0
      let processedCount = 0
      const errors: string[] = []

      // Get system user for created by field
      let systemUser
      try {
        systemUser = await this.getSystemUser()
      } catch (error: any) {
        console.error('❌ Failed to get system user:', error.message)
        return {
          success: false,
          message: `Failed to initialize sync: ${error.message}. Please ensure at least one admin user exists.`
        }
      }

      console.log(`\n🔄 Starting to process ${contacts.length} contacts...`)
      console.log(`⏱️  Estimated time: ${Math.ceil((contacts.length * 150) / 1000 / 60)} minutes\n`)

      for (const contact of contacts) {
        processedCount++
        
        // Progress update every 100 contacts
        if (processedCount % 100 === 0 || processedCount === contacts.length) {
          const percentage = ((processedCount / contacts.length) * 100).toFixed(1)
          console.log(`⏳ Progress: ${processedCount}/${contacts.length} (${percentage}%) - Customers: ${newClientsCreated + existingClientsUpdated}, Suppliers: ${newSuppliersCreated + existingSuppliersUpdated}, General: ${newGeneralContactsCreated + existingGeneralContactsUpdated}, Skipped: ${skippedCount}, Errors: ${errors.length}`)
        }
        try {
          // Determine contact type based on Xero flags
          const isCustomer = contact.isCustomer === true
          const isSupplier = contact.isSupplier === true
          const isGeneral = !isCustomer && !isSupplier
          
          const type = isSupplier && !isCustomer ? 'supplier' : 'client' // Sync general contacts as clients

          // === SYNC AS CLIENT (includes customers and general contacts) ===
          if (type === 'client') {
            // Check if client already exists by xeroContactId, email, or name
            let existingClient = null
            
            // First try by xeroContactId (most reliable)
            if (contact.contactID) {
              existingClient = await prisma.customer.findUnique({
                where: { xeroContactId: contact.contactID }
              })
            }

            // If not found, try by email to avoid duplicating manually created clients
            if (!existingClient && contact.emailAddress) {
              existingClient = await prisma.customer.findFirst({
                where: { 
                  email: {
                    equals: contact.emailAddress,
                    mode: 'insensitive'
                  }
                }
              })
            }

            // If still not found, try by exact name match
            if (!existingClient && contact.name) {
              existingClient = await prisma.customer.findFirst({
                where: { 
                  name: contact.name
                }
              })
            }

            // Add note for general contacts (neither customer nor supplier in Xero)
            const existingNotes = existingClient?.notes || ''
            const generalContactNote = '[General Contact - synced from Xero]'
            const notes = isGeneral && !existingNotes.includes(generalContactNote)
              ? (existingNotes ? `${existingNotes}\n${generalContactNote}` : generalContactNote)
              : existingNotes || null

            const clientData = {
              name: contact.name || '',
              email: contact.emailAddress || null,
              phone: this.extractPhone(contact),
              address: this.formatAddress(contact.addresses?.[0]),
              city: contact.addresses?.[0]?.city || null,
              state: contact.addresses?.[0]?.region || null,
              country: contact.addresses?.[0]?.country || 'Singapore',
              postalCode: contact.addresses?.[0]?.postalCode || null,
              contactPerson: (contact.contactPersons && contact.contactPersons.length > 0) 
                ? `${contact.contactPersons[0].firstName || ''} ${contact.contactPersons[0].lastName || ''}`.trim() 
                : null,
              website: contact.website || null,
              notes: notes,
              isXeroSynced: true,
              xeroContactId: contact.contactID || null,
              lastXeroSync: new Date(),
              updatedAt: new Date(),
              // CRITICAL: Set isCustomer and isSupplier flags from Xero for proper categorization
              isCustomer: isCustomer ? true : (isGeneral ? false : null),
              isSupplier: isSupplier ? true : false,
              // Comprehensive Xero fields
              xeroAccountNumber: contact.accountNumber || null,
              xeroPhones: contact.phones ? JSON.parse(JSON.stringify(contact.phones)) : null,
              xeroAddresses: contact.addresses ? JSON.parse(JSON.stringify(contact.addresses)) : null,
              xeroContactPersons: contact.contactPersons ? JSON.parse(JSON.stringify(contact.contactPersons)) : null,
              xeroDefaultCurrency: contact.defaultCurrency ? String(contact.defaultCurrency) : null,
              xeroTaxNumber: contact.taxNumber || null,
              xeroAccountsReceivableTaxType: contact.accountsReceivableTaxType || null,
              xeroAccountsPayableTaxType: contact.accountsPayableTaxType || null,
              xeroUpdatedDateUTC: contact.updatedDateUTC ? new Date(contact.updatedDateUTC) : null,
              xeroContactStatus: contact.contactStatus ? String(contact.contactStatus) : 'ACTIVE',
              xeroBankAccountDetails: contact.bankAccountDetails || null,
              xeroSkypeUserName: (contact as any).skypeUserName || null,
              xeroBatchPayments: contact.batchPayments ? JSON.parse(JSON.stringify(contact.batchPayments)) : null
            }

            if (existingClient) {
              // Update existing client (preserve internal customerNumber)
              await prisma.customer.update({
                where: { id: existingClient.id },
                data: clientData
              })
              if (isGeneral) {
                existingGeneralContactsUpdated++
              } else {
                existingClientsUpdated++
              }
            } else {
              // Create new client with auto-generated internal client number
              const nextClientNumber = await this.getNextClientNumber()
              
              await prisma.customer.create({
                data: {
                  id: `xero-client-${contact.contactID}`,
                  ...clientData,
                  customerNumber: nextClientNumber,
                  customerType: 'ENTERPRISE',
                  createdById: systemUser.id
                }
              })
              if (isGeneral) {
                newGeneralContactsCreated++
              } else {
                newClientsCreated++
              }
            }
          }

          // === SYNC AS SUPPLIER ===
          if (type === 'supplier') {
            // Check if supplier already exists by xeroContactId, email, or name
            let existingSupplier = null
            
            // First try by xeroContactId (most reliable)
            if (contact.contactID) {
              existingSupplier = await prisma.supplier.findUnique({
                where: { xeroContactId: contact.contactID }
              })
            }

            // If not found, try by email to avoid duplicating manually created suppliers
            if (!existingSupplier && contact.emailAddress) {
              existingSupplier = await prisma.supplier.findFirst({
                where: { 
                  email: {
                    equals: contact.emailAddress,
                    mode: 'insensitive'
                  }
                }
              })
            }

            // If still not found, try by exact name match
            if (!existingSupplier && contact.name) {
              existingSupplier = await prisma.supplier.findFirst({
                where: { 
                  name: contact.name
                }
              })
            }

            const supplierData = {
              name: contact.name || '',
              email: contact.emailAddress || null,
              phone: this.extractPhone(contact),
              address: this.formatAddress(contact.addresses?.[0]),
              city: contact.addresses?.[0]?.city || null,
              state: contact.addresses?.[0]?.region || null,
              country: contact.addresses?.[0]?.country || 'Singapore',
              postalCode: contact.addresses?.[0]?.postalCode || null,
              contactPerson: (contact.contactPersons && contact.contactPersons.length > 0) 
                ? `${contact.contactPersons[0].firstName || ''} ${contact.contactPersons[0].lastName || ''}`.trim() 
                : null,
              website: contact.website || null,
              isXeroSynced: true,
              xeroContactId: contact.contactID || null,
              lastXeroSync: new Date(),
              updatedAt: new Date(),
              // CRITICAL: Set isCustomer and isSupplier flags from Xero for proper categorization
              isCustomer: isCustomer ? true : false,
              isSupplier: true,
              // Comprehensive Xero fields
              xeroAccountNumber: contact.accountNumber || null,
              xeroPhones: contact.phones ? JSON.parse(JSON.stringify(contact.phones)) : null,
              xeroAddresses: contact.addresses ? JSON.parse(JSON.stringify(contact.addresses)) : null,
              xeroContactPersons: contact.contactPersons ? JSON.parse(JSON.stringify(contact.contactPersons)) : null,
              xeroDefaultCurrency: contact.defaultCurrency ? String(contact.defaultCurrency) : null,
              xeroTaxNumber: contact.taxNumber || null,
              xeroAccountsReceivableTaxType: contact.accountsReceivableTaxType || null,
              xeroAccountsPayableTaxType: contact.accountsPayableTaxType || null,
              xeroUpdatedDateUTC: contact.updatedDateUTC ? new Date(contact.updatedDateUTC) : null,
              xeroContactStatus: contact.contactStatus ? String(contact.contactStatus) : 'ACTIVE',
              xeroBankAccountDetails: contact.bankAccountDetails || null,
              xeroSkypeUserName: (contact as any).skypeUserName || null,
              xeroBatchPayments: contact.batchPayments ? JSON.parse(JSON.stringify(contact.batchPayments)) : null
            }

            if (existingSupplier) {
              // Update existing supplier (preserve internal supplierNumber)
              await prisma.supplier.update({
                where: { id: existingSupplier.id },
                data: supplierData
              })
              existingSuppliersUpdated++
            } else {
              // Create new supplier with auto-generated internal supplier number
              const nextSupplierNumber = await this.getNextSupplierNumber()
              
              await prisma.supplier.create({
                data: {
                  id: `xero-supplier-${contact.contactID}`,
                  ...supplierData,
                  supplierNumber: nextSupplierNumber,
                  supplierType: 'SUPPLIER',
                  isActive: true,
                  isApproved: true,
                  createdById: systemUser.id
                }
              })
              newSuppliersCreated++
            }
          }

        } catch (error: any) {
          const errorMsg = `[${processedCount}/${contacts.length}] ${contact.name || contact.contactID}: ${error.message}`
          console.error(`❌ ${errorMsg}`)
          errors.push(errorMsg)
          
          // If we're getting too many errors, log a warning
          if (errors.length >= 50 && errors.length % 50 === 0) {
            console.warn(`⚠️  High error count: ${errors.length} errors so far. Continuing...`)
          }
        }
      }
      
      console.log(`\n✅ Finished processing ${processedCount} contacts`)
      console.log(`📊 Results: ${newClientsCreated + existingClientsUpdated} customers, ${newSuppliersCreated + existingSuppliersUpdated} suppliers, ${newGeneralContactsCreated + existingGeneralContactsUpdated} general contacts, ${skippedCount} skipped, ${errors.length} errors\n`)

      // Update last sync time
      await prisma.xeroIntegration.updateMany({
        where: { tenantId: this.tokens.tenantId, isActive: true },
        data: { lastSyncAt: new Date() }
      })

      // Calculate totals
      const totalClients = newClientsCreated + existingClientsUpdated
      const totalSuppliers = newSuppliersCreated + existingSuppliersUpdated
      const totalGeneralContacts = newGeneralContactsCreated + existingGeneralContactsUpdated
      const totalSynced = totalClients + totalSuppliers + totalGeneralContacts

      // Log summary
      console.log('\n📊 ========== Xero Contact Sync Summary ==========')
      console.log(`   Total fetched from Xero: ${contacts.length} contacts`)
      console.log(`   
   ✅ CUSTOMERS:
      • New customers created:     ${newClientsCreated}
      • Existing customers updated: ${existingClientsUpdated}
      • Total customers synced:    ${totalClients}
   
   ✅ SUPPLIERS:
      • New suppliers created:     ${newSuppliersCreated}
      • Existing suppliers updated: ${existingSuppliersUpdated}
      • Total suppliers synced:    ${totalSuppliers}
   
   ✅ GENERAL CONTACTS:
      • New general contacts:      ${newGeneralContactsCreated}
      • Updated general contacts:  ${existingGeneralContactsUpdated}
      • Total general contacts:    ${totalGeneralContacts}
   
   📋 OTHER:
      • Skipped:                   ${skippedCount}
      • Errors:                    ${errors.length}
   
   🎯 FINAL TOTALS:
      • Successfully synced:       ${totalSynced} of ${contacts.length} contacts
      • Success rate:              ${((totalSynced / contacts.length) * 100).toFixed(1)}%`)
      console.log('===================================================\n')

      const message = `Synced ${totalSynced} contacts: ${totalClients} customers (${newClientsCreated} new, ${existingClientsUpdated} updated), ${totalSuppliers} suppliers (${newSuppliersCreated} new, ${existingSuppliersUpdated} updated), ${totalGeneralContacts} general contacts (${newGeneralContactsCreated} new, ${existingGeneralContactsUpdated} updated)${skippedCount > 0 ? `, ${skippedCount} skipped` : ''}${errors.length > 0 ? `, ${errors.length} errors` : ''}`

      return {
        success: true,
        message,
        syncedCount: totalSynced,
        totalCount: contacts.length,
        errors: errors.length > 0 ? errors : undefined
      }

    } catch (error: any) {
      console.error('❌ Contact sync failed:', error.message, error.stack)
      return {
        success: false,
        message: `Contact sync failed: ${error.message}`
      }
    }
  }

  /**
   * Helper: Get next available client number
   * Format: C-0001 (e.g., C-0001, C-0002, ...)
   * Supports both new format (C-0001) and legacy format (AE-C-001)
   */
  private async getNextClientNumber(): Promise<string> {
    // Get all client numbers to find the highest
    const allClients = await prisma.customer.findMany({
      where: {
        customerNumber: {
          not: null
        }
      },
      select: {
        customerNumber: true
      },
      orderBy: {
        customerNumber: 'desc'
      }
    })

    let highestNumber = 0

    // Parse all client numbers to find the highest sequential number
    for (const customer of allClients) {
      if (!customer.customerNumber) continue

      // Try new format: C-0001
      let match = customer.customerNumber.match(/^C-(\d+)$/)
      if (match) {
        const num = parseInt(match[1], 10)
        if (num > highestNumber) highestNumber = num
        continue
      }

      // Also check legacy format: AE-C-001
      match = customer.customerNumber.match(/AE-C-(\d+)/)
      if (match) {
        const num = parseInt(match[1], 10)
        if (num > highestNumber) highestNumber = num
      }
    }

    const nextNumber = highestNumber + 1
    return `C-${nextNumber.toString().padStart(4, '0')}`
  }

  /**
   * Helper: Get next available supplier number
   * Format: SXXXX (e.g., S1, S2, S1001)
   * Supports current format (SXXXX), legacy formats (AE-S-001, AE-V-001), and old dash format (S-0001)
   */
  private async getNextSupplierNumber(): Promise<string> {
    // Get all supplier numbers to find the highest
    const allSuppliers = await prisma.supplier.findMany({
      where: {
        supplierNumber: {
          not: null
        }
      },
      select: {
        supplierNumber: true
      },
      orderBy: {
        supplierNumber: 'desc'
      }
    })

    let highestNumber = 0

    // Parse all supplier numbers to find the highest sequential number
    for (const supplier of allSuppliers) {
      if (!supplier.supplierNumber) continue

      // Try current format: S1001 (without dash)
      let match = supplier.supplierNumber.match(/^S(\d+)$/)
      if (match) {
        const num = parseInt(match[1], 10)
        if (num > highestNumber) highestNumber = num
        continue
      }

      // Also check legacy format: AE-S-001
      match = supplier.supplierNumber.match(/AE-S-(\d+)/)
      if (match) {
        const num = parseInt(match[1], 10)
        if (num > highestNumber) highestNumber = num
        continue
      }

      // Also check older legacy format: AE-V-001
      match = supplier.supplierNumber.match(/AE-V-(\d+)/)
      if (match) {
        const num = parseInt(match[1], 10)
        if (num > highestNumber) highestNumber = num
        continue
      }

      // Also check dash format for backwards compatibility: S-0001
      match = supplier.supplierNumber.match(/^S-(\d+)$/)
      if (match) {
        const num = parseInt(match[1], 10)
        if (num > highestNumber) highestNumber = num
      }
    }

    // Increment and format - use the existing SXXXX format (no dash, no zero-padding)
    const nextNumber = highestNumber + 1
    return `S${nextNumber}`
  }

  /**
   * Helper: Get or create system user
   */
  private async getSystemUser() {
    let systemUser = await prisma.user.findFirst({
      where: {
        OR: [
          { role: 'SUPERADMIN' },
          { email: 'system@ampere.com' }
        ]
      }
    })

    if (!systemUser) {
      systemUser = await prisma.user.findFirst({
        where: { role: 'PROJECT_MANAGER' }
      })
    }

    if (!systemUser) {
      throw new Error('No system user found for Xero sync')
    }

    return systemUser
  }

  /**
   * Helper: Extract phone from contact
   */
  private extractPhone(contact: any): string | null {
    if (!contact.phones || contact.phones.length === 0) {
      return null
    }

    const defaultPhone = contact.phones.find(
      (p: any) => p.phoneType === 'DEFAULT' || p.phoneType === 'MOBILE'
    )

    return defaultPhone?.phoneNumber || contact.phones[0]?.phoneNumber || null
  }

  /**
   * Helper: Format address
   */
  private formatAddress(address: any): string | null {
    if (!address) return null

    const parts = [
      address.addressLine1,
      address.addressLine2,
      address.addressLine3,
      address.addressLine4
    ].filter(Boolean)

    return parts.length > 0 ? parts.join(', ') : null
  }
}

/**
 * Factory method to create initialized service
 */
export async function createXeroApiService(): Promise<XeroApiService | null> {
  const service = new XeroApiService()
  const initialized = await service.initialize()

  if (!initialized) {
    return null
  }

  return service
}
