
/**
 * Debug Single Payment from Xero
 * 
 * Fetches and processes a single payment by ID for debugging validation issues
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getXeroClient } from '@/lib/xero-config'
import { XeroOAuthService } from '@/lib/xero-oauth-service'
import { XeroPaymentPullService } from '@/lib/xero/payment-sync-pull'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * POST handler to debug a single payment from Xero
 */
export async function POST(request: NextRequest) {
  // Disable in production for security
  if (process.env.NODE_ENV === 'production' || process.env.DEPLOYMENT_MODE === 'production') {
    return NextResponse.json(
      { error: 'Debug endpoints disabled in production' },
      { status: 403 }
    )
  }

  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const user = session.user as any
    const userRole = user?.role || 'UNKNOWN'
    const allowedRoles = ['SUPERADMIN', 'FINANCE', 'PROJECT_MANAGER']
    
    if (!allowedRoles.includes(userRole)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Insufficient permissions'
        },
        { status: 403 }
      )
    }

    // Parse request body
    const body = await request.json().catch(() => ({}))
    const { paymentId } = body

    if (!paymentId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Payment ID required',
          message: 'Please provide a Xero paymentId (GUID) to debug'
        },
        { status: 400 }
      )
    }

    console.log('🔍 Debugging single Xero payment:', paymentId)

    // Get Xero tokens
    const tokens = await XeroOAuthService.getStoredTokens()
    if (!tokens) {
      throw new Error('No Xero tokens found')
    }

    // Initialize Xero client
    const xeroClient = getXeroClient()
    xeroClient.setTokenSet({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expires_in: Math.floor((tokens.expiresAt.getTime() - Date.now()) / 1000),
      token_type: 'Bearer',
    })

    // Fetch single payment from Xero
    console.log('📥 Fetching payment from Xero...')
    const response = await xeroClient.accountingApi.getPayment(
      tokens.tenantId,
      paymentId
    )

    const xeroPayment = response.body.payments?.[0]
    if (!xeroPayment) {
      return NextResponse.json(
        {
          success: false,
          error: 'Payment not found in Xero',
          paymentId
        },
        { status: 404 }
      )
    }

    console.log('✅ Payment fetched from Xero:', {
      paymentId: xeroPayment.paymentID,
      amount: xeroPayment.amount,
      date: xeroPayment.date,
      status: xeroPayment.status,
      type: xeroPayment.paymentType
    })

    // Initialize pull service and validate
    const pullService = new XeroPaymentPullService(user.id)
    
    // Validate payment
    const validation = await pullService.validatePayment(xeroPayment)

    console.log('📋 Validation result:', {
      valid: validation.valid,
      errors: validation.errors,
      warnings: validation.warnings
    })

    // Attempt to process payment
    let processResult = null
    if (validation.valid) {
      console.log('✅ Validation passed. Processing payment...')
      processResult = await pullService.processSinglePayment(xeroPayment)
      console.log('Processing result:', processResult)
    }

    // Return detailed debug information
    return NextResponse.json({
      success: validation.valid && processResult?.success,
      paymentId: xeroPayment.paymentID,
      xeroPayment: {
        paymentID: xeroPayment.paymentID,
        amount: xeroPayment.amount,
        currencyRate: xeroPayment.currencyRate,
        date: xeroPayment.date,
        reference: xeroPayment.reference,
        status: xeroPayment.status,
        paymentType: xeroPayment.paymentType,
        invoice: xeroPayment.invoice ? {
          invoiceID: xeroPayment.invoice.invoiceID,
          invoiceNumber: xeroPayment.invoice.invoiceNumber,
          contact: xeroPayment.invoice.contact ? {
            contactID: xeroPayment.invoice.contact.contactID,
            name: xeroPayment.invoice.contact.name
          } : null
        } : null,
        creditNote: xeroPayment.creditNote ? {
          creditNoteID: xeroPayment.creditNote.creditNoteID,
          creditNoteNumber: xeroPayment.creditNote.creditNoteNumber
        } : null,
        overpayment: xeroPayment.overpayment ? {
          overpaymentID: xeroPayment.overpayment.overpaymentID
        } : null,
        prepayment: xeroPayment.prepayment ? {
          prepaymentID: xeroPayment.prepayment.prepaymentID
        } : null,
        account: xeroPayment.account ? {
          accountID: xeroPayment.account.accountID,
          code: xeroPayment.account.code,
          name: xeroPayment.account.name
        } : null
      },
      validation: {
        valid: validation.valid,
        errors: validation.errors,
        warnings: validation.warnings
      },
      processing: processResult || { message: 'Not processed due to validation failure' },
      recommendations: generateRecommendations(validation, xeroPayment)
    })

  } catch (error: any) {
    console.error('❌ Debug single payment failed:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Debug failed',
        message: error.message || 'An unexpected error occurred',
        details: {
          statusCode: error.response?.statusCode,
          headers: error.response?.headers,
          body: error.response?.body
        }
      },
      { status: 500 }
    )
  }
}

/**
 * Generate recommendations based on validation results
 */
function generateRecommendations(validation: any, xeroPayment: any): string[] {
  const recommendations: string[] = []

  if (!validation.valid) {
    // Check common issues
    if (validation.errors.some((e: string) => e.includes('target document'))) {
      recommendations.push('This payment needs to be linked to an Invoice, Credit Note, Overpayment, or Prepayment in Xero')
    }

    if (validation.errors.some((e: string) => e.includes('DELETED'))) {
      recommendations.push('This payment is marked as DELETED in Xero and should not be synced')
    }

    if (validation.errors.some((e: string) => e.includes('amount'))) {
      recommendations.push('Check that the payment amount is valid and greater than 0')
    }
  }

  if (validation.warnings.length > 0) {
    if (validation.warnings.some((w: string) => w.includes('bank account'))) {
      recommendations.push('Consider setting a bank account reference for better tracking')
    }

    if (validation.warnings.some((w: string) => w.includes('multiple target'))) {
      recommendations.push('This payment references multiple documents. Verify which one is the primary target.')
    }
  }

  // Check if invoice exists locally
  if (xeroPayment.invoice?.invoiceID) {
    recommendations.push(`Verify that invoice ${xeroPayment.invoice.invoiceNumber || xeroPayment.invoice.invoiceID} exists in your local database`)
  }

  return recommendations
}
