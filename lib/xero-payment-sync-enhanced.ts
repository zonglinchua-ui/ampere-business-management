
/**
 * Xero Payment Sync - Enhanced Edition with Robust Error Logging
 * 
 * CRITICAL: Does NOT modify existing OAuth/connection code
 * Uses existing XeroOAuthService for authentication
 * 
 * Features:
 * - Comprehensive error logging with Xero ValidationErrors
 * - Local pre-validation before sending to Xero
 * - Single-payment verification mode for debugging
 * - Batch processing with stop-on-first-error option
 * - Safe retry logic with exponential backoff
 * - Invoice number to InvoiceID resolution
 */

import { XeroClient } from 'xero-node'
import { Payment as XeroPayment } from 'xero-node/dist/gen/model/accounting/payment'
import { prisma } from './db'
import { XeroOAuthService } from './xero-oauth-service'
import { XeroLogger } from './xero-logger'
import crypto from 'crypto'

// ==================== TYPES ====================

export interface PaymentSyncOptions {
  dryRun?: boolean
  forceRefresh?: boolean
  modifiedSince?: Date
  paymentIds?: string[] // Local payment IDs to sync
  direction?: 'pull' | 'push' | 'both'
  debugMode?: boolean // Stop on first error for debugging
  singlePaymentId?: string // Test single payment
}

export interface PaymentSyncResult {
  success: boolean
  message: string
  dryRun: boolean
  push: {
    created: number
    updated: number
    skipped: number
    errors: number
  }
  errors: PaymentErrorDetail[]
  logId?: string
}

export interface PaymentErrorDetail {
  paymentNumber?: string
  localId?: string
  operation: string
  error: string
  xeroValidationErrors?: XeroValidationError[]
  xeroWarnings?: string[]
  httpStatus?: number
  retryAfter?: string
  rateLimitProblem?: string
  paymentData?: {
    invoiceNumber?: string
    invoiceId?: string
    amount?: number
    date?: string
    accountId?: string
    accountCode?: string
    currency?: string
  }
}

export interface XeroValidationError {
  field?: string
  message: string
}

export interface PreValidationResult {
  valid: boolean
  errors: string[]
}

// ==================== MAIN SERVICE CLASS ====================

export class XeroPaymentSyncEnhanced {
  private xeroClient: XeroClient
  private tokens: any
  private userId: string
  private correlationId: string
  private cachedAccounts: Map<string, any> = new Map()
  private invoiceIdCache: Map<string, string> = new Map()

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

      // Set tokens in client
      this.xeroClient.setTokenSet({
        access_token: this.tokens.accessToken,
        refresh_token: this.tokens.refreshToken,
        expires_in: Math.floor((this.tokens.expiresAt - Date.now()) / 1000),
        token_type: 'Bearer',
      })

      // Cache Xero accounts for validation
      await this.cacheAccounts()

      return true
    } catch (error: any) {
      console.error('❌ Failed to initialize payment sync service:', error)
      return false
    }
  }

  /**
   * Cache Xero accounts for validation
   */
  private async cacheAccounts(): Promise<void> {
    try {
      console.log('📥 Caching Xero accounts for validation...')
      const response = await this.xeroClient.accountingApi.getAccounts(
        this.tokens.tenantId
      )

      const accounts = response.body.accounts || []
      for (const account of accounts) {
        if (account.accountID) {
          this.cachedAccounts.set(account.accountID, account)
          if (account.code) {
            this.cachedAccounts.set(account.code, account)
          }
        }
      }

      console.log(`✅ Cached ${this.cachedAccounts.size / 2} accounts`)
    } catch (error: any) {
      console.error('⚠️ Failed to cache accounts:', error.message)
    }
  }

  /**
   * Resolve invoice number to Xero InvoiceID
   */
  private async resolveInvoiceId(invoiceNumber: string): Promise<string | null> {
    // Check cache first
    if (this.invoiceIdCache.has(invoiceNumber)) {
      return this.invoiceIdCache.get(invoiceNumber)!
    }

    try {
      console.log(`🔍 Resolving invoice number ${invoiceNumber} to InvoiceID...`)
      const response = await this.xeroClient.accountingApi.getInvoices(
        this.tokens.tenantId,
        undefined, // modifiedSince
        undefined, // where
        undefined, // order
        [invoiceNumber], // invoiceNumbers
        undefined, // invoiceIDs
        undefined, // contactIDs
        undefined, // statuses
        undefined, // page
        undefined, // includeArchived
        undefined, // createdByMyApp
        undefined  // unitdp
      )

      const invoices = response.body.invoices || []
      if (invoices.length > 0 && invoices[0].invoiceID) {
        const invoiceId = invoices[0].invoiceID
        this.invoiceIdCache.set(invoiceNumber, invoiceId)
        console.log(`✅ Resolved ${invoiceNumber} to ${invoiceId}`)
        return invoiceId
      }

      console.warn(`⚠️ Invoice ${invoiceNumber} not found in Xero`)
      return null
    } catch (error: any) {
      console.error(`❌ Failed to resolve invoice ${invoiceNumber}:`, error.message)
      return null
    }
  }

  /**
   * Pre-validate payment before sending to Xero
   */
  private async preValidatePayment(payment: any, invoice: any, customer: any): Promise<PreValidationResult> {
    const errors: string[] = []

    // 1. Check for payment reference (InvoiceID required)
    if (!invoice?.xeroInvoiceId) {
      if (invoice?.invoiceNumber) {
        // Try to resolve invoice number to ID
        const resolvedId = await this.resolveInvoiceId(invoice.invoiceNumber)
        if (!resolvedId) {
          errors.push(`Missing Xero InvoiceID for invoice ${invoice.invoiceNumber}. Invoice must be synced to Xero first.`)
        }
      } else {
        errors.push('Missing invoice reference (InvoiceID, CreditNoteID, Overpayment, or Prepayment)')
      }
    }

    // 2. Check amount
    if (!payment.amount || parseFloat(payment.amount.toString()) <= 0) {
      errors.push(`Invalid amount: ${payment.amount}. Amount must be greater than 0.`)
    }

    // 3. Check currency match
    if (invoice && payment.currency !== invoice.currency) {
      errors.push(`Currency mismatch: payment currency (${payment.currency}) does not match invoice currency (${invoice.currency})`)
    }

    // 4. Validate against invoice AmountDue
    if (invoice && parseFloat(payment.amount.toString()) > parseFloat(invoice.amountDue?.toString() || '0')) {
      errors.push(`Payment amount (${payment.amount}) exceeds invoice amount due (${invoice.amountDue}). Adjust payment amount.`)
    }

    // 5. Check bank account (if provided)
    if (payment.xeroBankAccountId || payment.xeroBankAccountCode) {
      const accountKey = payment.xeroBankAccountId || payment.xeroBankAccountCode
      const account = this.cachedAccounts.get(accountKey)
      
      if (!account) {
        errors.push(`Bank account ${accountKey} not found in Xero`)
      } else if (account.type !== 'BANK') {
        errors.push(`Account ${accountKey} (${account.name}) is not a BANK type account. Current type: ${account.type}`)
      } else if (account.status !== 'ACTIVE') {
        errors.push(`Bank account ${accountKey} is not active. Current status: ${account.status}`)
      }
    }

    // 6. Check invoice status
    if (invoice?.status === 'DRAFT') {
      errors.push(`Invoice ${invoice.invoiceNumber} is in DRAFT status. Authorize invoice before creating payment.`)
    } else if (invoice?.status === 'DELETED' || invoice?.status === 'VOIDED') {
      errors.push(`Invoice ${invoice.invoiceNumber} is ${invoice.status}. Cannot create payment for deleted/voided invoice.`)
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * Extract Xero validation errors from API error response
   */
  private extractXeroValidationErrors(error: any): {
    validationErrors: XeroValidationError[]
    warnings: string[]
    httpStatus?: number
    retryAfter?: string
    rateLimitProblem?: string
    bodyMessage?: string
  } {
    const result: any = {
      validationErrors: [],
      warnings: [],
      httpStatus: error.response?.statusCode || error.statusCode,
      retryAfter: error.response?.headers?.['retry-after'],
      rateLimitProblem: error.response?.headers?.['x-rate-limit-problem']
    }

    // Extract body message
    if (error.response?.body) {
      const body = error.response.body
      result.bodyMessage = body.Message || body.message
      
      // Extract ValidationErrors
      if (body.Elements && Array.isArray(body.Elements)) {
        for (const element of body.Elements) {
          if (element.ValidationErrors && Array.isArray(element.ValidationErrors)) {
            result.validationErrors.push(...element.ValidationErrors.map((ve: any) => ({
              field: ve.Field,
              message: ve.Message
            })))
          }
          if (element.Warnings && Array.isArray(element.Warnings)) {
            result.warnings.push(...element.Warnings.map((w: any) => w.Message || w))
          }
        }
      }
    } else if (error.body) {
      const body = typeof error.body === 'string' ? JSON.parse(error.body) : error.body
      result.bodyMessage = body.Message || body.message

      if (body.Elements && Array.isArray(body.Elements)) {
        for (const element of body.Elements) {
          if (element.ValidationErrors && Array.isArray(element.ValidationErrors)) {
            result.validationErrors.push(...element.ValidationErrors.map((ve: any) => ({
              field: ve.Field,
              message: ve.Message
            })))
          }
          if (element.Warnings && Array.isArray(element.Warnings)) {
            result.warnings.push(...element.Warnings.map((w: any) => w.Message || w))
          }
        }
      }
    }

    return result
  }

  /**
   * Log detailed error information
   */
  private logDetailedError(
    payment: any,
    invoice: any,
    operation: string,
    error: any
  ): PaymentErrorDetail {
    const xeroErrors = this.extractXeroValidationErrors(error)

    const errorDetail: PaymentErrorDetail = {
      paymentNumber: payment.paymentNumber,
      localId: payment.id,
      operation,
      error: error.message || 'Unknown error',
      xeroValidationErrors: xeroErrors.validationErrors,
      xeroWarnings: xeroErrors.warnings,
      httpStatus: xeroErrors.httpStatus,
      retryAfter: xeroErrors.retryAfter,
      rateLimitProblem: xeroErrors.rateLimitProblem,
      paymentData: {
        invoiceNumber: invoice?.invoiceNumber,
        invoiceId: invoice?.xeroInvoiceId,
        amount: parseFloat(payment.amount.toString()),
        date: payment.paymentDate?.toISOString(),
        accountId: payment.xeroBankAccountId,
        accountCode: payment.xeroBankAccountCode,
        currency: payment.currency
      }
    }

    // Log to console with rich formatting
    console.error('\n' + '='.repeat(80))
    console.error(`❌ PAYMENT SYNC ERROR: ${operation}`)
    console.error('='.repeat(80))
    console.error('Payment:', {
      number: payment.paymentNumber,
      id: payment.id,
      amount: payment.amount,
      currency: payment.currency,
      date: payment.paymentDate
    })
    console.error('Invoice:', {
      number: invoice?.invoiceNumber,
      xeroId: invoice?.xeroInvoiceId,
      amountDue: invoice?.amountDue,
      status: invoice?.status
    })
    console.error('HTTP Status:', xeroErrors.httpStatus)
    if (xeroErrors.bodyMessage) {
      console.error('Message:', xeroErrors.bodyMessage)
    }
    if (xeroErrors.retryAfter) {
      console.error('Retry-After:', xeroErrors.retryAfter)
    }
    if (xeroErrors.rateLimitProblem) {
      console.error('Rate Limit Problem:', xeroErrors.rateLimitProblem)
    }
    if (xeroErrors.validationErrors.length > 0) {
      console.error('Validation Errors:')
      xeroErrors.validationErrors.forEach((ve, i) => {
        console.error(`  ${i + 1}. [${ve.field || 'N/A'}] ${ve.message}`)
      })
    }
    if (xeroErrors.warnings.length > 0) {
      console.error('Warnings:')
      xeroErrors.warnings.forEach((w, i) => {
        console.error(`  ${i + 1}. ${w}`)
      })
    }
    console.error('='.repeat(80) + '\n')

    return errorDetail
  }

  /**
   * Create a single payment in Xero with retry logic
   */
  private async createXeroPayment(
    payment: any,
    invoice: any,
    customer: any,
    options: { maxRetries?: number; debugMode?: boolean } = {}
  ): Promise<{ success: boolean; xeroPaymentId?: string; error?: PaymentErrorDetail }> {
    const maxRetries = options.maxRetries || 3
    let attempt = 0

    while (attempt < maxRetries) {
      try {
        attempt++

        // Pre-validate payment
        const validation = await this.preValidatePayment(payment, invoice, customer)
        if (!validation.valid) {
          const errorDetail: PaymentErrorDetail = {
            paymentNumber: payment.paymentNumber,
            localId: payment.id,
            operation: 'PRE_VALIDATION',
            error: 'Pre-validation failed',
            xeroValidationErrors: validation.errors.map(e => ({ message: e })),
            paymentData: {
              invoiceNumber: invoice?.invoiceNumber,
              invoiceId: invoice?.xeroInvoiceId,
              amount: parseFloat(payment.amount.toString()),
              date: payment.paymentDate?.toISOString(),
              accountId: payment.xeroBankAccountId,
              accountCode: payment.xeroBankAccountCode,
              currency: payment.currency
            }
          }

          console.error('\n' + '='.repeat(80))
          console.error(`❌ PRE-VALIDATION FAILED: ${payment.paymentNumber}`)
          console.error('='.repeat(80))
          validation.errors.forEach((e, i) => {
            console.error(`  ${i + 1}. ${e}`)
          })
          console.error('='.repeat(80) + '\n')

          return { success: false, error: errorDetail }
        }

        // Build Xero payment object
        const xeroPayment: XeroPayment = {
          invoice: {
            invoiceID: invoice.xeroInvoiceId
          },
          account: payment.xeroBankAccountId ? {
            accountID: payment.xeroBankAccountId
          } : payment.xeroBankAccountCode ? {
            code: payment.xeroBankAccountCode
          } : undefined,
          date: payment.paymentDate,
          amount: parseFloat(payment.amount.toString()),
          reference: payment.reference || undefined
        }

        console.log(`📤 Sending payment to Xero (attempt ${attempt}/${maxRetries}):`, {
          paymentNumber: payment.paymentNumber,
          invoiceId: invoice.xeroInvoiceId,
          amount: xeroPayment.amount,
          currency: payment.currency
        })

        // Send to Xero
        const response = await this.xeroClient.accountingApi.createPayments(
          this.tokens.tenantId,
          { payments: [xeroPayment] }
        )

        const createdPayment = response.body.payments?.[0]
        if (createdPayment?.paymentID) {
          console.log(`✅ Payment created in Xero: ${createdPayment.paymentID}`)
          return { success: true, xeroPaymentId: createdPayment.paymentID }
        } else {
          throw new Error('No payment ID returned from Xero')
        }

      } catch (error: any) {
        const errorDetail = this.logDetailedError(payment, invoice, 'CREATE', error)

        // Check if we should retry
        const isRetryable = error.response?.statusCode === 429 || // Rate limit
                           error.response?.statusCode >= 500 || // Server error
                           error.statusCode === 429 ||
                           error.statusCode >= 500

        if (isRetryable && attempt < maxRetries) {
          const retryAfter = error.response?.headers?.['retry-after']
          const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, attempt) * 1000
          
          console.log(`⏳ Retrying in ${waitTime}ms (attempt ${attempt}/${maxRetries})...`)
          await new Promise(resolve => setTimeout(resolve, waitTime))
          continue
        }

        // In debug mode, stop on first error
        if (options.debugMode) {
          console.log('🔍 DEBUG MODE: Stopping on first error')
        }

        return { success: false, error: errorDetail }
      }
    }

    return {
      success: false,
      error: {
        paymentNumber: payment.paymentNumber,
        localId: payment.id,
        operation: 'CREATE',
        error: 'Max retries exceeded'
      }
    }
  }

  /**
   * Sync single payment (for debugging)
   */
  async syncSinglePayment(paymentId: string): Promise<PaymentSyncResult> {
    const startTime = Date.now()
    let logId: string | undefined

    const result: PaymentSyncResult = {
      success: false,
      message: '',
      dryRun: false,
      push: {
        created: 0,
        updated: 0,
        skipped: 0,
        errors: 0
      },
      errors: []
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
        entity: 'PAYMENTS',
        status: 'IN_PROGRESS',
        recordsProcessed: 0,
        recordsSucceeded: 0,
        recordsFailed: 0,
        message: `Testing single payment: ${paymentId}`,
        duration: 0
      })

      console.log(`\n🔍 SINGLE PAYMENT DEBUG MODE: ${paymentId}\n`)

      // Fetch payment with related data
      const payment = await prisma.payment.findUnique({
        where: { id: paymentId },
        include: {
          CustomerInvoice: true,
          Customer: true
        }
      })

      if (!payment) {
        throw new Error(`Payment ${paymentId} not found`)
      }

      console.log('Payment data:', {
        id: payment.id,
        number: payment.paymentNumber,
        amount: payment.amount,
        currency: payment.currency,
        date: payment.paymentDate,
        invoiceId: payment.customerInvoiceId,
        customerId: payment.customerId
      })

      // Attempt to create payment
      const createResult = await this.createXeroPayment(
        payment,
        payment.CustomerInvoice,
        payment.Customer,
        { maxRetries: 1, debugMode: true }
      )

      if (createResult.success && createResult.xeroPaymentId) {
        result.push.created++
        result.success = true
        result.message = `Successfully created payment ${payment.paymentNumber} in Xero (ID: ${createResult.xeroPaymentId})`

        // Update local record
        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            xeroPaymentId: createResult.xeroPaymentId,
            isXeroSynced: true,
            lastXeroSync: new Date(),
            updatedAt: new Date()
          }
        })
      } else {
        result.push.errors++
        if (createResult.error) {
          result.errors.push(createResult.error)
        }
        result.success = false
        result.message = `Failed to create payment: ${createResult.error?.error || 'Unknown error'}`
      }

      // Update log
      if (logId) {
        await XeroLogger.updateLogEntry(logId, {
          status: result.success ? 'SUCCESS' : 'ERROR',
          message: result.message,
          recordsProcessed: 1,
          recordsSucceeded: result.push.created,
          recordsFailed: result.push.errors,
          duration: Date.now() - startTime,
          details: {
            errors: result.errors
          }
        })
      }

      return result

    } catch (error: any) {
      console.error('❌ Single payment sync failed:', error)

      if (logId) {
        await XeroLogger.updateLogEntry(logId, {
          status: 'ERROR',
          message: `Single payment sync failed: ${error.message}`,
          recordsProcessed: 1,
          recordsSucceeded: 0,
          recordsFailed: 1,
          duration: Date.now() - startTime,
          errorMessage: error.message,
          errorStack: error.stack
        })
      }

      result.success = false
      result.message = `Single payment sync failed: ${error.message}`
      result.push.errors++
      return result
    }
  }

  /**
   * Push local payments to Xero (batch or single)
   */
  async pushPayments(options: PaymentSyncOptions = {}): Promise<PaymentSyncResult> {
    // If single payment mode, use dedicated method
    if (options.singlePaymentId) {
      return this.syncSinglePayment(options.singlePaymentId)
    }

    const startTime = Date.now()
    let logId: string | undefined

    const result: PaymentSyncResult = {
      success: false,
      message: '',
      dryRun: options.dryRun || false,
      push: {
        created: 0,
        updated: 0,
        skipped: 0,
        errors: 0
      },
      errors: []
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
        entity: 'PAYMENTS',
        status: 'IN_PROGRESS',
        recordsProcessed: 0,
        recordsSucceeded: 0,
        recordsFailed: 0,
        message: options.dryRun ? 'Dry run: Validating payments for Xero sync' : 'Pushing payments to Xero',
        duration: 0
      })

      console.log('📤 Pushing payments to Xero...', {
        dryRun: options.dryRun,
        debugMode: options.debugMode,
        paymentCount: options.paymentIds?.length || 'all unsynced'
      })

      // Build query
      const where: any = {
        isXeroSynced: false,
        customerInvoiceId: { not: null }
      }

      if (options.paymentIds && options.paymentIds.length > 0) {
        where.id = { in: options.paymentIds }
      }

      // Fetch payments with related data
      const payments = await prisma.payment.findMany({
        where,
        include: {
          CustomerInvoice: true,
          Customer: true
        },
        orderBy: { createdAt: 'asc' }
      })

      console.log(`📊 Found ${payments.length} payments to sync`)

      if (payments.length === 0) {
        result.success = true
        result.message = 'No payments to sync'
        return result
      }

      // Process each payment
      for (let i = 0; i < payments.length; i++) {
        const payment = payments[i]
        console.log(`\n📤 Processing payment ${i + 1}/${payments.length}: ${payment.paymentNumber}`)

        try {
          if (options.dryRun) {
            // Dry run: only validate
            const validation = await this.preValidatePayment(
              payment,
              payment.CustomerInvoice,
              payment.Customer
            )

            if (validation.valid) {
              result.push.created++
              console.log(`✅ Validation passed: ${payment.paymentNumber}`)
            } else {
              result.push.errors++
              result.errors.push({
                paymentNumber: payment.paymentNumber,
                localId: payment.id,
                operation: 'VALIDATION',
                error: 'Pre-validation failed',
                xeroValidationErrors: validation.errors.map(e => ({ message: e }))
              })
              console.error(`❌ Validation failed: ${payment.paymentNumber}`)
              validation.errors.forEach((e, idx) => {
                console.error(`  ${idx + 1}. ${e}`)
              })
            }
          } else {
            // Real sync: create payment
            const createResult = await this.createXeroPayment(
              payment,
              payment.CustomerInvoice,
              payment.Customer,
              { debugMode: options.debugMode }
            )

            if (createResult.success && createResult.xeroPaymentId) {
              result.push.created++
              
              // Update local record
              await prisma.payment.update({
                where: { id: payment.id },
                data: {
                  xeroPaymentId: createResult.xeroPaymentId,
                  isXeroSynced: true,
                  lastXeroSync: new Date(),
                  updatedAt: new Date()
                }
              })

              console.log(`✅ Created payment: ${payment.paymentNumber} (Xero ID: ${createResult.xeroPaymentId})`)
            } else {
              result.push.errors++
              if (createResult.error) {
                result.errors.push(createResult.error)
              }

              // In debug mode, stop on first error
              if (options.debugMode) {
                console.log('🛑 Stopping batch processing due to error in debug mode')
                break
              }
            }
          }

          // Log progress every 5 payments
          if ((i + 1) % 5 === 0 || (i + 1) === payments.length) {
            console.log(`✅ Progress: ${i + 1}/${payments.length} payments processed`)
          }

        } catch (error: any) {
          result.push.errors++
          result.errors.push({
            paymentNumber: payment.paymentNumber,
            localId: payment.id,
            operation: 'PROCESS',
            error: error.message
          })
          console.error(`❌ Failed to process payment ${payment.paymentNumber}:`, error.message)

          if (options.debugMode) {
            console.log('🛑 Stopping batch processing due to error in debug mode')
            break
          }
        }
      }

      // Calculate final stats
      const duration = Date.now() - startTime
      result.success = result.push.errors === 0
      result.message = options.dryRun
        ? `Dry run complete: ${result.push.created} payments valid, ${result.push.errors} invalid`
        : result.success
          ? `Successfully synced ${result.push.created} payments to Xero`
          : `Synced with ${result.push.errors} errors (${result.push.created} created, ${result.push.errors} failed)`

      // Update log
      if (logId) {
        await XeroLogger.updateLogEntry(logId, {
          status: result.success ? 'SUCCESS' : result.push.created > 0 ? 'WARNING' : 'ERROR',
          message: result.message,
          recordsProcessed: payments.length,
          recordsSucceeded: result.push.created,
          recordsFailed: result.push.errors,
          duration,
          details: {
            created: result.push.created,
            errors: result.push.errors,
            errorDetails: result.errors
          }
        })
      }

      console.log(`\n✅ Payment sync complete: ${result.message}`)
      return result

    } catch (error: any) {
      console.error('❌ Payment sync failed:', error)

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

      result.success = false
      result.message = `Payment sync failed: ${error.message}`
      result.push.errors++
      return result
    }
  }
}
