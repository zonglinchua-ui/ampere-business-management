
/**
 * Xero Contacts Backfill Service
 * 
 * Complete pagination with robust logging, retry logic, and progress tracking
 * Ensures all contacts from Xero are pulled and persisted locally
 * 
 * IMPORTANT: Does NOT modify existing OAuth/connection code
 */

import { XeroClient } from 'xero-node'
import { prisma } from './db'
import { XeroOAuthService, XeroTokens } from './xero-oauth-service'
import crypto from 'crypto'
import { generateClientNumber, generateSupplierNumber } from './number-generation'

// ==================== TYPES ====================

export interface BackfillOptions {
  tenantId: string
  pageSize?: number
  includeArchived?: boolean
  where?: string
  ifModifiedSince?: Date
  maxPages?: number
  userId: string
}

export interface BackfillProgress {
  currentPage: number
  totalFetched: number
  created: number
  updated: number
  skipped: number
  errors: number
  lastUpdatedDateUTC?: string
  status: 'running' | 'completed' | 'failed'
  message: string
}

export interface ContactRecord {
  contactID: string
  name: string
  isCustomer: boolean
  isSupplier: boolean
  emailAddress?: string
  phones?: any[]
  addresses?: any[]
  contactPersons?: any[]
  taxNumber?: string
  accountNumber?: string
  updatedDateUTC?: string
  contactStatus?: string
  website?: string
  defaultCurrency?: string
  bankAccountDetails?: string
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Delay helper for retry logic
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Calculate change hash for idempotency
 */
function calculateHash(data: any): string {
  const normalized = JSON.stringify(data, Object.keys(data).sort())
  return crypto.createHash('md5').update(normalized).digest('hex')
}

/**
 * Extract syncable fields from contact
 */
function extractSyncFields(contact: ContactRecord) {
  return {
    name: contact.name,
    email: contact.emailAddress || '',
    phone: contact.phones?.[0]?.phoneNumber || '',
    address: contact.addresses?.[0]?.addressLine1 || '',
    city: contact.addresses?.[0]?.city || '',
    taxNumber: contact.taxNumber || '',
    isCustomer: contact.isCustomer,
    isSupplier: contact.isSupplier
  }
}

// ==================== MAIN SERVICE CLASS ====================

export class XeroContactBackfillService {
  private xeroClient: XeroClient
  private tokens: XeroTokens | null = null
  private userId: string
  private progress: BackfillProgress

  constructor(userId: string) {
    this.userId = userId
    this.xeroClient = new XeroClient({
      clientId: process.env.XERO_CLIENT_ID!,
      clientSecret: process.env.XERO_CLIENT_SECRET!,
      redirectUris: [process.env.XERO_REDIRECT_URI!],
      scopes: process.env.XERO_SCOPES!.split(' ')
    })
    this.progress = {
      currentPage: 0,
      totalFetched: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      status: 'running',
      message: 'Initializing...'
    }
  }

  /**
   * Initialize with stored tokens
   */
  async initialize(): Promise<boolean> {
    try {
      this.tokens = await XeroOAuthService.getStoredTokens()

      if (!this.tokens) {
        console.error('❌ No Xero tokens found')
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

      console.log('✅ Xero Contact Backfill Service initialized')
      return true

    } catch (error: any) {
      console.error('❌ Failed to initialize:', error.message)
      return false
    }
  }

  /**
   * Pull all contacts from Xero with complete pagination
   */
  async pullAllContacts(options: Partial<BackfillOptions> = {}): Promise<BackfillProgress> {
    const opts: BackfillOptions = {
      tenantId: this.tokens?.tenantId || '',
      pageSize: options.pageSize || 100,
      includeArchived: options.includeArchived !== undefined ? options.includeArchived : true,
      where: options.where,
      ifModifiedSince: options.ifModifiedSince,
      maxPages: options.maxPages || 2000,
      userId: this.userId
    }

    console.log('🚀 Starting complete contacts backfill with options:', {
      pageSize: opts.pageSize,
      includeArchived: opts.includeArchived,
      where: opts.where,
      ifModifiedSince: opts.ifModifiedSince?.toISOString(),
      maxPages: opts.maxPages
    })

    this.progress.status = 'running'
    this.progress.message = 'Starting backfill...'

    let page = 1
    let consecutiveEmptyPages = 0
    const maxConsecutiveEmptyPages = 3 // Stop if we get 3 empty pages in a row
    const maxPages = opts.maxPages || 2000

    try {
      while (page <= maxPages) {
        console.log(`\n${'='.repeat(60)}`)
        console.log(`📄 FETCHING PAGE ${page}`)
        console.log(`${'='.repeat(60)}`)
        console.log(`   Page Size: ${opts.pageSize}`)
        console.log(`   Include Archived: ${opts.includeArchived}`)
        console.log(`   Where Clause: ${opts.where || 'none'}`)
        console.log(`   If-Modified-Since: ${opts.ifModifiedSince?.toISOString() || 'none'}`)
        console.log(`   Total Fetched So Far: ${this.progress.totalFetched}`)
        console.log(`${'='.repeat(60)}\n`)

        let retryCount = 0
        const maxRetries = 3
        let pageSuccess = false

        while (retryCount <= maxRetries && !pageSuccess) {
          try {
            // Make API call with retry logic
            const response = await this.fetchContactsPage(
              opts.tenantId,
              page,
              opts.pageSize || 100,
              opts.includeArchived || true,
              opts.where,
              opts.ifModifiedSince
            )

            const contacts: ContactRecord[] = response.body?.contacts || []
            const count = contacts.length

            console.log(`✅ PAGE ${page} RESPONSE: ${count} contacts returned`)

            // Check response headers for rate limit warnings
            const headers = response.response?.headers || {}
            const rateProblem = headers['x-rate-limit-problem'] || headers['X-Rate-Limit-Problem']
            const retryAfter = headers['retry-after'] || headers['Retry-After']

            if (rateProblem || retryAfter) {
              console.warn(`⏳ RATE LIMIT WARNING:`, {
                rateProblem,
                retryAfter,
                page
              })
            }

            // Handle empty page
            if (count === 0) {
              consecutiveEmptyPages++
              console.log(`🛑 EMPTY PAGE ${page} (${consecutiveEmptyPages}/${maxConsecutiveEmptyPages} consecutive empty pages)`)
              
              if (consecutiveEmptyPages >= maxConsecutiveEmptyPages) {
                console.log(`🛑 STOPPING: ${consecutiveEmptyPages} consecutive empty pages detected`)
                this.progress.message = `Completed: ${consecutiveEmptyPages} consecutive empty pages`
                break
              }
              
              // Move to next page even if empty (might be sparse pagination)
              page++
              pageSuccess = true
              continue
            }

            // Reset consecutive empty counter
            consecutiveEmptyPages = 0

            // Track last updated date
            const lastContact = contacts[contacts.length - 1]
            if (lastContact?.updatedDateUTC) {
              this.progress.lastUpdatedDateUTC = lastContact.updatedDateUTC
              console.log(`📅 Last UpdatedDateUTC on this page: ${lastContact.updatedDateUTC}`)
            }

            // Process contacts in batches
            console.log(`📊 Processing ${count} contacts from page ${page}...`)
            await this.upsertContactsBatch(contacts)

            this.progress.totalFetched += count
            this.progress.currentPage = page

            console.log(`\n📈 CUMULATIVE PROGRESS:`)
            console.log(`   Pages Processed: ${page}`)
            console.log(`   Total Fetched: ${this.progress.totalFetched}`)
            console.log(`   Created: ${this.progress.created}`)
            console.log(`   Updated: ${this.progress.updated}`)
            console.log(`   Skipped: ${this.progress.skipped}`)
            console.log(`   Errors: ${this.progress.errors}`)

            // If fewer than pageSize, this is the last page
            const currentPageSize = opts.pageSize || 100
            if (count < currentPageSize) {
              console.log(`\n🏁 FINAL PAGE DETECTED (${count} < ${opts.pageSize})`)
              console.log(`🎉 Backfill complete! Total: ${this.progress.totalFetched} contacts`)
              this.progress.message = `Completed: Final page had ${count} contacts`
              pageSuccess = true
              break
            }

            page++
            pageSuccess = true

            // Small delay between pages to be respectful of API limits
            await delay(100)

          } catch (error: any) {
            const status = error?.response?.statusCode || error?.statusCode || 0
            const headers = error?.response?.headers || {}
            const body = error?.response?.body
            
            console.error(`\n❌ ERROR FETCHING PAGE ${page} (Attempt ${retryCount + 1}/${maxRetries + 1})`)
            console.error(`   Status Code: ${status}`)
            console.error(`   Message: ${error?.message}`)
            console.error(`   Headers:`, JSON.stringify(headers, null, 2))
            console.error(`   Body Snippet:`, typeof body === 'string' ? body.slice(0, 500) : JSON.stringify(body).slice(0, 500))

            // Handle 429 (Rate Limit)
            if (status === 429) {
              const retryAfterHeader = headers?.['retry-after'] || headers?.['Retry-After']
              const waitMs = retryAfterHeader ? parseInt(retryAfterHeader, 10) * 1000 : 60000
              
              console.warn(`🔁 429 RATE LIMIT: Waiting ${waitMs}ms before retry (attempt ${retryCount + 1})`)
              await delay(waitMs)
              retryCount++
              continue
            }

            // Handle 5xx (Server Errors) - retry with exponential backoff
            if (status >= 500 && status < 600) {
              const backoffMs = Math.min(5000 * Math.pow(2, retryCount), 30000)
              console.warn(`🔁 ${status} SERVER ERROR: Waiting ${backoffMs}ms before retry (attempt ${retryCount + 1})`)
              await delay(backoffMs)
              retryCount++
              continue
            }

            // Handle 401/403 (Auth Errors) - stop immediately
            if (status === 401 || status === 403) {
              console.error(`🔒 AUTH ERROR (${status}): Stopping backfill to preserve connection`)
              this.progress.status = 'failed'
              this.progress.message = `Auth error: ${error.message}`
              throw new Error(`Authentication error: ${error.message}`)
            }

            // Other errors - retry once
            if (retryCount < maxRetries) {
              console.warn(`🔁 RETRYING PAGE ${page} after error (attempt ${retryCount + 1})`)
              await delay(5000)
              retryCount++
              continue
            }

            // Max retries exceeded
            console.error(`❌ MAX RETRIES EXCEEDED for page ${page}`)
            this.progress.status = 'failed'
            this.progress.message = `Failed at page ${page}: ${error.message}`
            throw error
          }
        }

        // If we broke out of retry loop without success, stop
        if (!pageSuccess) {
          break
        }
      }

      // Backfill complete
      this.progress.status = 'completed'
      if (!this.progress.message.startsWith('Completed')) {
        this.progress.message = `Successfully processed ${this.progress.totalFetched} contacts`
      }

      console.log(`\n${'='.repeat(60)}`)
      console.log(`✅ BACKFILL COMPLETE`)
      console.log(`${'='.repeat(60)}`)
      console.log(`   Total Fetched: ${this.progress.totalFetched}`)
      console.log(`   Created: ${this.progress.created}`)
      console.log(`   Updated: ${this.progress.updated}`)
      console.log(`   Skipped: ${this.progress.skipped}`)
      console.log(`   Errors: ${this.progress.errors}`)
      console.log(`   Last Updated UTC: ${this.progress.lastUpdatedDateUTC || 'N/A'}`)
      console.log(`${'='.repeat(60)}\n`)

      return this.progress

    } catch (error: any) {
      console.error(`\n❌ BACKFILL FAILED:`, error)
      this.progress.status = 'failed'
      this.progress.message = error.message || 'Unknown error'
      return this.progress
    }
  }

  /**
   * Fetch a single page of contacts from Xero
   */
  private async fetchContactsPage(
    tenantId: string,
    page: number,
    pageSize: number,
    includeArchived: boolean,
    where?: string,
    ifModifiedSince?: Date
  ): Promise<any> {
    // Note: xero-node SDK getContacts signature:
    // getContacts(xeroTenantId, ifModifiedSince?, where?, order?, IDs?, page?, includeArchived?, summaryOnly?, pageSize?)
    return await this.xeroClient.accountingApi.getContacts(
      tenantId,
      ifModifiedSince, // Date | undefined
      where,           // string | undefined
      undefined,       // order
      undefined,       // IDs (string[])
      page,            // page number
      includeArchived, // boolean
      undefined,       // summaryOnly
      pageSize.toString() // pageSize as string
    )
  }

  /**
   * Upsert a batch of contacts to local database
   * Idempotent - safe to run multiple times
   */
  private async upsertContactsBatch(contacts: ContactRecord[]): Promise<void> {
    for (const contact of contacts) {
      try {
        await this.upsertSingleContact(contact)
      } catch (error: any) {
        console.error(`❌ Failed to upsert contact ${contact.name} (${contact.contactID}):`, error.message)
        this.progress.errors++
      }
    }
  }

  /**
   * Upsert a single contact (idempotent)
   */
  private async upsertSingleContact(xeroContact: ContactRecord): Promise<void> {
    const contactId = xeroContact.contactID
    const syncFields = extractSyncFields(xeroContact)
    const changeHash = calculateHash(syncFields)

    // Determine if customer, supplier, or both
    const isCustomer = xeroContact.isCustomer === true
    const isSupplier = xeroContact.isSupplier === true

    // Skip if neither (shouldn't happen, but safety check)
    if (!isCustomer && !isSupplier) {
      console.log(`⏭️  Skipping ${xeroContact.name} - no customer/supplier classification`)
      this.progress.skipped++
      return
    }

    // Extract contact data
    const contactData = this.extractContactData(xeroContact)

    // Process customer
    if (isCustomer) {
      await this.upsertCustomer(contactId, contactData, changeHash)
    }

    // Process supplier
    if (isSupplier) {
      await this.upsertSupplier(contactId, contactData, changeHash)
    }
  }

  /**
   * Extract contact data from Xero contact
   */
  private extractContactData(xeroContact: ContactRecord): any {
    const firstEmail = xeroContact.emailAddress || null
    const firstPhone = xeroContact.phones?.find((p: any) => p.phoneType === 'DEFAULT')?.phoneNumber
      || xeroContact.phones?.[0]?.phoneNumber || null
    
    const defaultAddress = xeroContact.addresses?.find((a: any) => a.addressType === 'POBOX' || a.addressType === 'STREET') 
      || xeroContact.addresses?.[0]

    const contactPerson = xeroContact.contactPersons?.[0]
      ? `${xeroContact.contactPersons[0].firstName || ''} ${xeroContact.contactPersons[0].lastName || ''}`.trim()
      : null

    return {
      name: xeroContact.name,
      email: firstEmail || undefined,
      phone: firstPhone || undefined,
      address: defaultAddress ? [
        defaultAddress.addressLine1,
        defaultAddress.addressLine2,
        defaultAddress.addressLine3,
        defaultAddress.addressLine4
      ].filter(Boolean).join(', ') : undefined,
      city: defaultAddress?.city || undefined,
      state: defaultAddress?.region || undefined,
      country: defaultAddress?.country || 'Singapore',
      postalCode: defaultAddress?.postalCode || undefined,
      contactPerson: contactPerson || undefined,
      companyReg: xeroContact.taxNumber || undefined,
      website: xeroContact.website || undefined,
      xeroContactId: xeroContact.contactID,
      xeroAccountNumber: xeroContact.accountNumber || undefined,
      xeroPhones: xeroContact.phones || undefined,
      xeroAddresses: xeroContact.addresses || undefined,
      xeroContactPersons: xeroContact.contactPersons || undefined,
      xeroDefaultCurrency: xeroContact.defaultCurrency || undefined,
      xeroTaxNumber: xeroContact.taxNumber || undefined,
      xeroUpdatedDateUTC: xeroContact.updatedDateUTC ? new Date(xeroContact.updatedDateUTC) : undefined,
      xeroContactStatus: xeroContact.contactStatus || 'ACTIVE',
      xeroBankAccountDetails: xeroContact.bankAccountDetails || undefined,
      isXeroSynced: true,
      lastXeroSync: new Date()
    }
  }

  /**
   * Upsert customer (idempotent)
   */
  private async upsertCustomer(
    xeroContactId: string,
    contactData: any,
    changeHash: string
  ): Promise<void> {
    // Check if customer exists
    const existing = await prisma.customer.findUnique({
      where: { xeroContactId }
    })

    if (existing) {
      // Check if changed
      const existingHash = calculateHash(extractSyncFields({
        contactID: existing.xeroContactId!,
        name: existing.name,
        emailAddress: existing.email || undefined,
        phones: existing.xeroPhones as any,
        addresses: existing.xeroAddresses as any,
        taxNumber: existing.xeroTaxNumber || undefined,
        isCustomer: true,
        isSupplier: false
      }))

      if (existingHash === changeHash) {
        // No changes
        this.progress.skipped++
        return
      }

      // Update
      await prisma.customer.update({
        where: { id: existing.id },
        data: {
          ...contactData,
          updatedAt: new Date()
        }
      })

      console.log(`✅ Updated customer: ${contactData.name}`)
      this.progress.updated++
    } else {
      // Create new
      const customerNumber = await generateClientNumber()
      const systemUser = await prisma.user.findFirst({
        where: { role: 'SUPERADMIN' }
      })

      if (!systemUser) {
        throw new Error('No SUPERADMIN user found')
      }

      await prisma.customer.create({
        data: {
          id: crypto.randomUUID(),
          customerNumber,
          ...contactData,
          createdById: systemUser.id,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })

      console.log(`✅ Created customer: ${contactData.name} (${customerNumber})`)
      this.progress.created++
    }
  }

  /**
   * Upsert supplier (idempotent)
   */
  private async upsertSupplier(
    xeroContactId: string,
    contactData: any,
    changeHash: string
  ): Promise<void> {
    // Check if supplier exists
    const existing = await prisma.supplier.findUnique({
      where: { xeroContactId }
    })

    if (existing) {
      // Check if changed
      const existingHash = calculateHash(extractSyncFields({
        contactID: existing.xeroContactId!,
        name: existing.name,
        emailAddress: existing.email || undefined,
        phones: existing.xeroPhones as any,
        addresses: existing.xeroAddresses as any,
        taxNumber: existing.xeroTaxNumber || undefined,
        isCustomer: false,
        isSupplier: true
      }))

      if (existingHash === changeHash) {
        // No changes
        this.progress.skipped++
        return
      }

      // Update
      await prisma.supplier.update({
        where: { id: existing.id },
        data: {
          ...contactData,
          updatedAt: new Date()
        }
      })

      console.log(`✅ Updated supplier: ${contactData.name}`)
      this.progress.updated++
    } else {
      // Create new
      const supplierNumber = await generateSupplierNumber()
      const systemUser = await prisma.user.findFirst({
        where: { role: 'SUPERADMIN' }
      })

      if (!systemUser) {
        throw new Error('No SUPERADMIN user found')
      }

      await prisma.supplier.create({
        data: {
          id: crypto.randomUUID(),
          supplierNumber,
          ...contactData,
          createdById: systemUser.id,
          isActive: true,
          isApproved: false,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })

      console.log(`✅ Created supplier: ${contactData.name} (${supplierNumber})`)
      this.progress.created++
    }
  }

  /**
   * Get current progress
   */
  getProgress(): BackfillProgress {
    return { ...this.progress }
  }
}
