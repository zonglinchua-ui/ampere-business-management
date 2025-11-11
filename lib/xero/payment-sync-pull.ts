
/**
 * Xero Payment Pull/Sync Service
 * 
 * Pulls payments from Xero and stores them in the local database
 * with comprehensive validation and error logging.
 * 
 * CRITICAL: Does NOT modify existing OAuth/connection code
 */

import { Payment as XeroPayment } from 'xero-node'
import { prisma } from '../db'
import { XeroLogger } from '../xero-logger'

export interface PaymentPullValidation {
  valid: boolean
  errors: string[]
  warnings: string[]
  payment?: XeroPayment
}

export interface PaymentPullResult {
  processed: number
  succeeded: number
  failed: number
  skipped: number
  errors: Array<{
    paymentId: string
    error: string
    details?: any
  }>
}

export class XeroPaymentPullService {
  private systemUserId: string | null = null

  constructor(private userId: string) {}

  /**
   * Get or create system user for automated operations
   */
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
   * Validate payment from Xero before storing locally
   */
  async validatePayment(xeroPayment: XeroPayment): Promise<PaymentPullValidation> {
    const errors: string[] = []
    const warnings: string[] = []

    // 1. Check required fields
    if (!xeroPayment.paymentID) {
      errors.push('Missing paymentID')
    }

    if (!xeroPayment.date) {
      errors.push('Missing payment date')
    }

    if (!xeroPayment.amount || parseFloat(xeroPayment.amount.toString()) <= 0) {
      errors.push(`Invalid payment amount: ${xeroPayment.amount}`)
    }

    // 2. Check for payment target (Invoice, CreditNote, Overpayment, Prepayment)
    const hasInvoice = !!xeroPayment.invoice?.invoiceID
    const hasCreditNote = !!xeroPayment.creditNote?.creditNoteID
    const hasOverpayment = !!xeroPayment.overpayment?.overpaymentID
    const hasPrepayment = !!xeroPayment.prepayment?.prepaymentID

    const targetCount = [hasInvoice, hasCreditNote, hasOverpayment, hasPrepayment].filter(Boolean).length

    if (targetCount === 0) {
      errors.push('Payment has no target document (Invoice, CreditNote, Overpayment, or Prepayment)')
    } else if (targetCount > 1) {
      warnings.push('Payment has multiple target documents. Using primary reference.')
    }

    // 3. Check account reference
    if (!xeroPayment.account?.accountID && !xeroPayment.account?.code) {
      warnings.push('Missing bank account reference')
    }

    // 4. Check payment type
    if (!xeroPayment.paymentType) {
      warnings.push('Missing payment type')
    }

    // 5. Check for payment status
    if (xeroPayment.status && xeroPayment.status.toString() === 'DELETED') {
      errors.push('Payment is marked as DELETED in Xero')
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      payment: xeroPayment
    }
  }

  /**
   * Resolve invoice reference from Xero payment
   */
  private async resolveInvoiceReference(xeroPayment: XeroPayment): Promise<{
    localCustomerInvoiceId: string | null
    localSupplierInvoiceId: string | null
    xeroInvoiceId: string | null
    invoiceNumber: string | null
    isSupplierPayment: boolean
  }> {
    let xeroInvoiceId: string | null = null
    let invoiceNumber: string | null = null

    // Extract Xero invoice ID from payment
    if (xeroPayment.invoice?.invoiceID) {
      xeroInvoiceId = xeroPayment.invoice.invoiceID
      invoiceNumber = xeroPayment.invoice.invoiceNumber || null
    }

    // Determine payment type (ACCRECPAYMENT = customer payment received, ACCPAYPAYMENT = supplier payment sent)
    const paymentTypeStr = xeroPayment.paymentType?.toString() || ''
    const isSupplierPayment = paymentTypeStr.includes('ACCPAY') || paymentTypeStr.includes('APCREDIT')

    // Try to find local invoice by Xero ID
    if (xeroInvoiceId) {
      if (isSupplierPayment) {
        // Look for supplier invoice
        const localInvoice = await prisma.supplierInvoice.findFirst({
          where: { xeroInvoiceId }
        })

        if (localInvoice) {
          return {
            localCustomerInvoiceId: null,
            localSupplierInvoiceId: localInvoice.id,
            xeroInvoiceId,
            invoiceNumber: localInvoice.invoiceNumber,
            isSupplierPayment: true
          }
        }
      } else {
        // Look for customer invoice
        const localInvoice = await prisma.customerInvoice.findUnique({
          where: { xeroInvoiceId }
        })

        if (localInvoice) {
          return {
            localCustomerInvoiceId: localInvoice.id,
            localSupplierInvoiceId: null,
            xeroInvoiceId,
            invoiceNumber: localInvoice.invoiceNumber,
            isSupplierPayment: false
          }
        }
      }
    }

    // If not found by Xero ID, try by invoice number (less reliable)
    if (invoiceNumber) {
      if (isSupplierPayment) {
        // Look for supplier invoice by number
        const localInvoice = await prisma.supplierInvoice.findFirst({
          where: { invoiceNumber }
        })

        if (localInvoice) {
          return {
            localCustomerInvoiceId: null,
            localSupplierInvoiceId: localInvoice.id,
            xeroInvoiceId: localInvoice.xeroInvoiceId || xeroInvoiceId,
            invoiceNumber: localInvoice.invoiceNumber,
            isSupplierPayment: true
          }
        }
      } else {
        // Look for customer invoice by number
        const localInvoice = await prisma.customerInvoice.findUnique({
          where: { invoiceNumber }
        })

        if (localInvoice) {
          return {
            localCustomerInvoiceId: localInvoice.id,
            localSupplierInvoiceId: null,
            xeroInvoiceId: localInvoice.xeroInvoiceId || xeroInvoiceId,
            invoiceNumber: localInvoice.invoiceNumber,
            isSupplierPayment: false
          }
        }
      }
    }

    return {
      localCustomerInvoiceId: null,
      localSupplierInvoiceId: null,
      xeroInvoiceId,
      invoiceNumber,
      isSupplierPayment
    }
  }

  /**
   * Resolve customer or supplier reference from Xero payment
   */
  private async resolveContactReference(xeroPayment: XeroPayment, invoiceRef: any): Promise<{
    customerId: string | null
    supplierId: string | null
  }> {
    // First, try to get contact from the linked invoice
    if (invoiceRef.localCustomerInvoiceId) {
      const invoice = await prisma.customerInvoice.findUnique({
        where: { id: invoiceRef.localCustomerInvoiceId },
        select: { customerId: true }
      })
      
      if (invoice?.customerId) {
        return {
          customerId: invoice.customerId,
          supplierId: null
        }
      }
    }

    if (invoiceRef.localSupplierInvoiceId) {
      const invoice = await prisma.supplierInvoice.findUnique({
        where: { id: invoiceRef.localSupplierInvoiceId },
        select: { supplierId: true }
      })
      
      if (invoice?.supplierId) {
        return {
          customerId: null,
          supplierId: invoice.supplierId
        }
      }
    }

    // Try to resolve by Xero contact ID
    if (xeroPayment.invoice?.contact?.contactID) {
      const xeroContactId = xeroPayment.invoice.contact.contactID
      
      // Check if it's a customer
      const customer = await prisma.customer.findFirst({
        where: { xeroContactId }
      })
      
      if (customer) {
        return {
          customerId: customer.id,
          supplierId: null
        }
      }

      // Check if it's a supplier
      const supplier = await prisma.supplier.findFirst({
        where: { xeroContactId }
      })
      
      if (supplier) {
        return {
          customerId: null,
          supplierId: supplier.id
        }
      }
    }

    // If no link found, return null for both
    return {
      customerId: null,
      supplierId: null
    }
  }

  /**
   * Process and save a single payment from Xero
   */
  async processSinglePayment(xeroPayment: XeroPayment): Promise<{
    success: boolean
    paymentId?: string
    skipped?: boolean
    error?: string
    details?: any
  }> {
    try {
      // 1. Validate payment
      const validation = await this.validatePayment(xeroPayment)

      if (!validation.valid) {
        console.error(`❌ Validation failed for payment ${xeroPayment.paymentID}:`)
        validation.errors.forEach((err, i) => {
          console.error(`  ${i + 1}. ${err}`)
        })

        return {
          success: false,
          error: `Validation failed: ${validation.errors.join('; ')}`,
          details: {
            paymentId: xeroPayment.paymentID,
            errors: validation.errors,
            warnings: validation.warnings
          }
        }
      }

      // Log warnings if any
      if (validation.warnings.length > 0) {
        console.warn(`⚠️ Warnings for payment ${xeroPayment.paymentID}:`)
        validation.warnings.forEach((warn, i) => {
          console.warn(`  ${i + 1}. ${warn}`)
        })
      }

      // 2. Check if payment already exists
      const existingPayment = await prisma.payment.findFirst({
        where: { xeroPaymentId: xeroPayment.paymentID }
      })

      if (existingPayment) {
        console.log(`⏭️ Payment ${xeroPayment.paymentID} already exists locally. Updating...`)

        // Update existing payment
        const updated = await prisma.payment.update({
          where: { id: existingPayment.id },
          data: {
            amount: xeroPayment.amount ? parseFloat(xeroPayment.amount.toString()) : existingPayment.amount,
            paymentDate: xeroPayment.date || existingPayment.paymentDate,
            reference: xeroPayment.reference || existingPayment.reference,
            xeroPaymentType: xeroPayment.paymentType?.toString() || existingPayment.xeroPaymentType,
            xeroBankAccountId: xeroPayment.account?.accountID || existingPayment.xeroBankAccountId,
            xeroBankAccountCode: xeroPayment.account?.code || existingPayment.xeroBankAccountCode,
            xeroCurrencyRate: xeroPayment.currencyRate ? parseFloat(xeroPayment.currencyRate.toString()) : existingPayment.xeroCurrencyRate,
            isXeroSynced: true,
            lastXeroSync: new Date(),
            updatedAt: new Date()
          }
        })

        return {
          success: true,
          paymentId: updated.id,
          skipped: true
        }
      }

      // 3. Resolve invoice and contact references
      const invoiceRef = await this.resolveInvoiceReference(xeroPayment)
      const contactRef = await this.resolveContactReference(xeroPayment, invoiceRef)

      // 4. Get system user ID
      const systemUserId = await this.getSystemUserId()

      // 5. Determine payment status
      let status: 'PENDING' | 'COMPLETED' | 'FAILED' = 'COMPLETED'
      const statusStr = xeroPayment.status?.toString() || ''
      if (statusStr === 'DELETED' || statusStr === 'VOIDED') {
        status = 'FAILED'
      }

      // 6. Determine payment method from payment type
      type PaymentMethodType = 'BANK_TRANSFER' | 'CHEQUE' | 'CREDIT_CARD' | 'CASH' | 'OTHER'
      let paymentMethod: PaymentMethodType = 'BANK_TRANSFER'
      if (xeroPayment.paymentType) {
        const paymentTypeStr = xeroPayment.paymentType.toString()
        const typeMap: Record<string, PaymentMethodType> = {
          'ACCRECPAYMENT': 'BANK_TRANSFER',
          'ACCPAYPAYMENT': 'BANK_TRANSFER',
          'ARCREDITPAYMENT': 'CREDIT_CARD',
          'APCREDITPAYMENT': 'CREDIT_CARD',
          'AROVERPAYMENTPAYMENT': 'BANK_TRANSFER',
          'ARPREPAYMENTPAYMENT': 'BANK_TRANSFER'
        }
        paymentMethod = typeMap[paymentTypeStr] || 'BANK_TRANSFER'
      }

      // 7. Generate payment number
      const lastPayment = await prisma.payment.findFirst({
        where: {
          paymentNumber: {
            startsWith: 'PAY-'
          }
        },
        orderBy: {
          paymentNumber: 'desc'
        }
      })

      let nextNumber = 1
      if (lastPayment?.paymentNumber) {
        const match = lastPayment.paymentNumber.match(/PAY-(\d+)/)
        if (match) {
          nextNumber = parseInt(match[1]) + 1
        }
      }
      const paymentNumber = `PAY-${String(nextNumber).padStart(6, '0')}`

      // 8. Create new payment
      const newPayment = await prisma.payment.create({
        data: {
          id: `xero-payment-${xeroPayment.paymentID}`,
          paymentNumber,
          customerInvoiceId: invoiceRef.localCustomerInvoiceId,
          supplierInvoiceId: invoiceRef.localSupplierInvoiceId,
          customerId: contactRef.customerId,
          amount: parseFloat(xeroPayment.amount?.toString() || '0'),
          currency: 'SGD', // Default currency, can be enhanced later
          paymentMethod,
          paymentDate: xeroPayment.date || new Date(),
          reference: xeroPayment.reference || `Xero Payment ${xeroPayment.paymentID}`,
          status,
          xeroPaymentId: xeroPayment.paymentID,
          xeroContactId: xeroPayment.invoice?.contact?.contactID || null,
          xeroInvoiceId: invoiceRef.xeroInvoiceId,
          xeroPaymentType: xeroPayment.paymentType?.toString() || null,
          xeroBankAccountId: xeroPayment.account?.accountID || null,
          xeroBankAccountCode: xeroPayment.account?.code || null,
          xeroCurrencyRate: xeroPayment.currencyRate ? parseFloat(xeroPayment.currencyRate.toString()) : null,
          isXeroSynced: true,
          lastXeroSync: new Date(),
          createdById: systemUserId,
          updatedAt: new Date()
        }
      })

      const paymentTypeLabel = invoiceRef.isSupplierPayment ? 'supplier payment (sent)' : 'customer payment (received)'
      console.log(`✅ Successfully created ${paymentTypeLabel} ${paymentNumber} from Xero payment ${xeroPayment.paymentID}`)

      // 9. If invoice is linked, update its paid amount
      if (invoiceRef.localCustomerInvoiceId) {
        try {
          const invoice = await prisma.customerInvoice.findUnique({
            where: { id: invoiceRef.localCustomerInvoiceId }
          })

          if (invoice) {
            const currentPaid = invoice.amountPaid ? parseFloat(invoice.amountPaid.toString()) : 0
            const paymentAmount = parseFloat(xeroPayment.amount?.toString() || '0')
            const newPaid = currentPaid + paymentAmount
            const totalAmount = parseFloat(invoice.totalAmount.toString())
            const newAmountDue = Math.max(0, totalAmount - newPaid)

            await prisma.customerInvoice.update({
              where: { id: invoiceRef.localCustomerInvoiceId },
              data: {
                amountPaid: newPaid,
                amountDue: newAmountDue,
                status: newAmountDue <= 0.01 ? 'PAID' : 'PARTIALLY_PAID',
                paidDate: newAmountDue <= 0.01 ? new Date() : invoice.paidDate,
                updatedAt: new Date()
              }
            })

            console.log(`✅ Updated customer invoice ${invoice.invoiceNumber} payment status`)
          }
        } catch (error: any) {
          console.warn(`⚠️ Failed to update customer invoice payment status:`, error.message)
          // Don't fail the payment creation if invoice update fails
        }
      }

      // 10. If supplier invoice is linked, update its paid amount
      if (invoiceRef.localSupplierInvoiceId) {
        try {
          const invoice = await prisma.supplierInvoice.findUnique({
            where: { id: invoiceRef.localSupplierInvoiceId }
          })

          if (invoice) {
            const paymentAmount = parseFloat(xeroPayment.amount?.toString() || '0')
            const totalAmount = parseFloat(invoice.totalAmount.toString())

            // Supplier invoices don't have amountPaid field, so we just update status
            await prisma.supplierInvoice.update({
              where: { id: invoiceRef.localSupplierInvoiceId },
              data: {
                status: 'PAID',
                paidDate: new Date(),
                updatedAt: new Date()
              }
            })

            console.log(`✅ Updated supplier invoice ${invoice.invoiceNumber} payment status`)
          }
        } catch (error: any) {
          console.warn(`⚠️ Failed to update supplier invoice payment status:`, error.message)
          // Don't fail the payment creation if invoice update fails
        }
      }

      return {
        success: true,
        paymentId: newPayment.id
      }

    } catch (error: any) {
      console.error(`❌ Failed to process payment ${xeroPayment.paymentID}:`, error)

      return {
        success: false,
        error: error.message || 'Unknown error',
        details: {
          paymentId: xeroPayment.paymentID,
          stack: error.stack
        }
      }
    }
  }

  /**
   * Process a batch of payments
   */
  async processBatch(xeroPayments: XeroPayment[]): Promise<PaymentPullResult> {
    const result: PaymentPullResult = {
      processed: xeroPayments.length,
      succeeded: 0,
      failed: 0,
      skipped: 0,
      errors: []
    }

    console.log(`\n📥 Processing batch of ${xeroPayments.length} payments from Xero...`)

    for (let i = 0; i < xeroPayments.length; i++) {
      const payment = xeroPayments[i]
      
      try {
        const paymentResult = await this.processSinglePayment(payment)

        if (paymentResult.success) {
          if (paymentResult.skipped) {
            result.skipped++
            console.log(`  [${i + 1}/${xeroPayments.length}] ⏭️ Skipped (already exists)`)
          } else {
            result.succeeded++
            console.log(`  [${i + 1}/${xeroPayments.length}] ✅ Success`)
          }
        } else {
          result.failed++
          result.errors.push({
            paymentId: payment.paymentID || 'unknown',
            error: paymentResult.error || 'Unknown error',
            details: paymentResult.details
          })
          console.log(`  [${i + 1}/${xeroPayments.length}] ❌ Failed: ${paymentResult.error}`)
        }
      } catch (error: any) {
        result.failed++
        result.errors.push({
          paymentId: payment.paymentID || 'unknown',
          error: error.message || 'Unknown error',
          details: { stack: error.stack }
        })
        console.log(`  [${i + 1}/${xeroPayments.length}] ❌ Failed: ${error.message}`)
      }
    }

    console.log(`\n📊 Batch complete: ${result.succeeded} succeeded, ${result.skipped} skipped, ${result.failed} failed`)

    return result
  }
}
