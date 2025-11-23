/**
 * Match Payments to Invoices
 * 
 * This script ensures all payments from Xero are correctly matched
 * to their corresponding invoices in the local database.
 */

import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') })

const prisma = new PrismaClient()

interface MatchResult {
  totalPayments: number
  customerPaymentsMatched: number
  supplierPaymentsMatched: number
  unmatchable: number
  errors: string[]
}

async function matchPaymentsToInvoices(): Promise<MatchResult> {
  const result: MatchResult = {
    totalPayments: 0,
    customerPaymentsMatched: 0,
    supplierPaymentsMatched: 0,
    unmatchable: 0,
    errors: []
  }

  try {
    console.log('🔍 Finding unmatched payments...\n')

    // 1. Find all payments with xeroInvoiceId but no local invoice match
    const unmatchedPayments = await prisma.payment.findMany({
      where: {
        xeroInvoiceId: { not: null },
        OR: [
          { customerInvoiceId: null },
          { supplierInvoiceId: null }
        ]
      },
      select: {
        id: true,
        paymentNumber: true,
        xeroInvoiceId: true,
        xeroPaymentType: true,
        amount: true,
        paymentDate: true,
        customerInvoiceId: true,
        supplierInvoiceId: true
      }
    })

    result.totalPayments = unmatchedPayments.length
    console.log(`📊 Found ${unmatchedPayments.length} unmatched payments\n`)

    if (unmatchedPayments.length === 0) {
      console.log('✅ All payments are already matched!')
      return result
    }

    // 2. Process each unmatched payment
    for (let i = 0; i < unmatchedPayments.length; i++) {
      const payment = unmatchedPayments[i]
      const progress = `[${i + 1}/${unmatchedPayments.length}]`
      
      console.log(`${progress} Processing payment ${payment.paymentNumber}...`)

      try {
        // Determine if this is a customer or supplier payment
        const paymentType = payment.xeroPaymentType || ''
        const isSupplierPayment = paymentType.includes('ACCPAY') || paymentType.includes('APCREDIT')
        const isCustomerPayment = paymentType.includes('ACCREC') || paymentType.includes('ARCREDIT')

        if (!isSupplierPayment && !isCustomerPayment) {
          console.log(`  ⚠️  Cannot determine payment type from: ${paymentType}`)
          result.unmatchable++
          continue
        }

        // Try to match customer payment
        if (isCustomerPayment && !payment.customerInvoiceId) {
          const matchingInvoice = await prisma.customerInvoice.findFirst({
            where: { xeroInvoiceId: payment.xeroInvoiceId! }
          })

          if (matchingInvoice) {
            // Update payment with invoice link
            await prisma.payment.update({
              where: { id: payment.id },
              data: {
                customerInvoiceId: matchingInvoice.id,
                customerId: matchingInvoice.customerId,
                updatedAt: new Date()
              }
            })

            // Update invoice payment status
            const currentPaid = matchingInvoice.amountPaid 
              ? parseFloat(matchingInvoice.amountPaid.toString()) 
              : 0
            const paymentAmount = parseFloat(payment.amount.toString())
            const newPaid = currentPaid + paymentAmount
            const totalAmount = parseFloat(matchingInvoice.totalAmount.toString())
            const newAmountDue = Math.max(0, totalAmount - newPaid)

            await prisma.customerInvoice.update({
              where: { id: matchingInvoice.id },
              data: {
                amountPaid: newPaid,
                amountDue: newAmountDue,
                status: newAmountDue <= 0.01 ? 'PAID' : 'PARTIALLY_PAID',
                paidDate: newAmountDue <= 0.01 ? new Date() : matchingInvoice.paidDate,
                updatedAt: new Date()
              }
            })

            console.log(`  ✅ Matched to customer invoice ${matchingInvoice.invoiceNumber}`)
            console.log(`     Invoice status: ${newAmountDue <= 0.01 ? 'PAID' : 'PARTIALLY_PAID'}`)
            console.log(`     Amount paid: $${newPaid.toFixed(2)} / $${totalAmount.toFixed(2)}`)
            result.customerPaymentsMatched++
            continue
          }
        }

        // Try to match supplier payment
        if (isSupplierPayment && !payment.supplierInvoiceId) {
          const matchingInvoice = await prisma.supplierInvoice.findFirst({
            where: { xeroInvoiceId: payment.xeroInvoiceId! }
          })

          if (matchingInvoice) {
            // Update payment with invoice link
            await prisma.payment.update({
              where: { id: payment.id },
              data: {
                supplierInvoiceId: matchingInvoice.id,
                updatedAt: new Date()
              }
            })

            // Update invoice payment status
            await prisma.supplierInvoice.update({
              where: { id: matchingInvoice.id },
              data: {
                status: 'PAID',
                paidDate: new Date(),
                updatedAt: new Date()
              }
            })

            console.log(`  ✅ Matched to supplier invoice ${matchingInvoice.invoiceNumber}`)
            console.log(`     Invoice status: PAID`)
            result.supplierPaymentsMatched++
            continue
          }
        }

        // If we reach here, no matching invoice was found
        console.log(`  ⚠️  No matching invoice found in database (Xero Invoice ID: ${payment.xeroInvoiceId})`)
        result.unmatchable++

      } catch (error: any) {
        const errorMsg = `Failed to match payment ${payment.paymentNumber}: ${error.message}`
        console.error(`  ❌ ${errorMsg}`)
        result.errors.push(errorMsg)
      }
    }

    console.log('\n' + '='.repeat(80))
    console.log('📊 MATCHING COMPLETE')
    console.log('='.repeat(80))
    console.log(`Total Payments Processed: ${result.totalPayments}`)
    console.log(`Customer Payments Matched: ${result.customerPaymentsMatched}`)
    console.log(`Supplier Payments Matched: ${result.supplierPaymentsMatched}`)
    console.log(`Unmatchable (no invoice in DB): ${result.unmatchable}`)
    console.log(`Errors: ${result.errors.length}`)
    console.log('='.repeat(80) + '\n')

    if (result.errors.length > 0) {
      console.log('❌ Errors encountered:')
      result.errors.forEach((err, i) => {
        console.log(`  ${i + 1}. ${err}`)
      })
    }

    return result

  } catch (error: any) {
    console.error('❌ Fatal error during payment matching:', error)
    result.errors.push(`Fatal error: ${error.message}`)
    return result
  }
}

// Run the matching
matchPaymentsToInvoices()
  .then((result) => {
    if (result.errors.length === 0) {
      console.log('✅ Payment matching completed successfully!')
      process.exit(0)
    } else {
      console.error('⚠️  Payment matching completed with errors')
      process.exit(1)
    }
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
