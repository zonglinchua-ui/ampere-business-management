
/**
 * Xero Sync Diagnostics API
 * 
 * GET /api/xero/diagnostics
 * Returns comprehensive diagnostic information about Xero sync status
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getXeroClient } from '@/lib/xero-config'
import { XeroOAuthService } from '@/lib/xero-oauth-service'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const user = session.user as any
    const userRole = user?.role || 'UNKNOWN'
    const allowedRoles = ['SUPERADMIN', 'FINANCE']
    
    if (!allowedRoles.includes(userRole)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    console.log('🔍 Starting Xero sync diagnostics...')

    // 1. Check Xero connection
    const tokens = await XeroOAuthService.getStoredTokens()
    
    if (!tokens) {
      return NextResponse.json({
        connected: false,
        error: 'No Xero connection found'
      })
    }

    const xeroClient = getXeroClient()
    xeroClient.setTokenSet({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expires_in: Math.floor((tokens.expiresAt.getTime() - Date.now()) / 1000),
      token_type: 'Bearer',
    })

    // 2. Fetch invoices from Xero (with pagination)
    console.log('📥 Fetching invoices from Xero...')
    let allXeroInvoices: any[] = []
    let page = 1
    let hasMore = true

    while (hasMore && page <= 50) { // Safety limit
      try {
        const response = await xeroClient.accountingApi.getInvoices(
          tokens.tenantId,
          undefined, // ifModifiedSince
          undefined, // where
          undefined, // order
          undefined, // IDs
          undefined, // invoiceNumbers
          undefined, // contactIDs
          undefined, // statuses
          page
        )

        const invoices = response.body.invoices || []
        allXeroInvoices.push(...invoices)
        console.log(`   Page ${page}: ${invoices.length} invoices`)

        if (invoices.length < 100) {
          hasMore = false
        } else {
          page++
        }
      } catch (error: any) {
        console.error(`Error fetching page ${page}:`, error.message)
        break
      }
    }

    const xeroCustomerInvoices = allXeroInvoices.filter(inv => inv.type === 'ACCREC')
    const xeroSupplierInvoices = allXeroInvoices.filter(inv => inv.type === 'ACCPAY')

    // 3. Check local database
    console.log('💾 Checking local database...')
    
    const [
      localCustomerInvoices,
      localSupplierInvoices,
      localPayments,
      localCustomers,
      localSuppliers,
      allCustomerInvoices,
      allSupplierInvoices
    ] = await Promise.all([
      prisma.customerInvoice.count({ where: { isXeroSynced: true } }),
      prisma.supplierInvoice.count({ where: { isXeroSynced: true } }),
      prisma.payment.count({ where: { isXeroSynced: true } }),
      prisma.customer.count({ where: { isXeroSynced: true } }),
      prisma.supplier.count({ where: { isXeroSynced: true } }),
      prisma.customerInvoice.count(),
      prisma.supplierInvoice.count()
    ])

    // 4. Get sample missing invoices
    const localCustomerInvoiceIds = await prisma.customerInvoice.findMany({
      where: { isXeroSynced: true },
      select: { xeroInvoiceId: true }
    })
    const localCustomerXeroIds = new Set(
      localCustomerInvoiceIds
        .filter(inv => inv.xeroInvoiceId)
        .map(inv => inv.xeroInvoiceId!)
    )

    const localSupplierInvoiceIds = await prisma.supplierInvoice.findMany({
      where: { isXeroSynced: true },
      select: { xeroInvoiceId: true }
    })
    const localSupplierXeroIds = new Set(
      localSupplierInvoiceIds
        .filter(inv => inv.xeroInvoiceId)
        .map(inv => inv.xeroInvoiceId!)
    )

    const missingCustomerInvoices = xeroCustomerInvoices
      .filter(xInv => !localCustomerXeroIds.has(xInv.invoiceID))
      .slice(0, 10)
      .map(inv => ({
        invoiceNumber: inv.invoiceNumber,
        contactName: inv.contact?.name,
        total: inv.total,
        date: inv.date,
        status: inv.status
      }))

    const missingSupplierInvoices = xeroSupplierInvoices
      .filter(xInv => !localSupplierXeroIds.has(xInv.invoiceID))
      .slice(0, 10)
      .map(inv => ({
        invoiceNumber: inv.invoiceNumber,
        contactName: inv.contact?.name,
        total: inv.total,
        date: inv.date,
        status: inv.status
      }))

    // 5. Check contact matching issues
    const missingCustomerContacts = new Set()
    const missingSupplierContacts = new Set()

    const [localCustomerContactIds, localSupplierContactIds] = await Promise.all([
      prisma.customer.findMany({
        where: { isXeroSynced: true },
        select: { xeroContactId: true }
      }),
      prisma.supplier.findMany({
        where: { isXeroSynced: true },
        select: { xeroContactId: true }
      })
    ])

    const localCustomerXeroContactIds = new Set(
      localCustomerContactIds.filter(c => c.xeroContactId).map(c => c.xeroContactId!)
    )
    const localSupplierXeroContactIds = new Set(
      localSupplierContactIds.filter(s => s.xeroContactId).map(s => s.xeroContactId!)
    )

    xeroCustomerInvoices.slice(0, 100).forEach(inv => {
      const contactId = inv.contact?.contactID
      if (contactId && !localCustomerXeroContactIds.has(contactId)) {
        missingCustomerContacts.add(contactId)
      }
    })

    xeroSupplierInvoices.slice(0, 100).forEach(inv => {
      const contactId = inv.contact?.contactID
      if (contactId && !localSupplierXeroContactIds.has(contactId)) {
        missingSupplierContacts.add(contactId)
      }
    })

    // 6. Check payment matching
    const unmatchedPayments = await prisma.payment.count({
      where: {
        isXeroSynced: true,
        AND: [
          { customerInvoiceId: null },
          { supplierInvoiceId: null }
        ]
      }
    })

    // 7. Build response
    const diagnostics = {
      connected: true,
      tenantName: tokens.tenantName,
      tenantId: tokens.tenantId,
      xero: {
        customerInvoices: xeroCustomerInvoices.length,
        supplierInvoices: xeroSupplierInvoices.length,
        totalInvoices: allXeroInvoices.length
      },
      local: {
        customerInvoicesSynced: localCustomerInvoices,
        supplierInvoicesSynced: localSupplierInvoices,
        customerInvoicesTotal: allCustomerInvoices,
        supplierInvoicesTotal: allSupplierInvoices,
        paymentsSynced: localPayments,
        customersSynced: localCustomers,
        suppliersSynced: localSuppliers
      },
      gaps: {
        missingCustomerInvoices: xeroCustomerInvoices.length - localCustomerInvoices,
        missingSupplierInvoices: xeroSupplierInvoices.length - localSupplierInvoices,
        missingCustomerContacts: missingCustomerContacts.size,
        missingSupplierContacts: missingSupplierContacts.size,
        unmatchedPayments
      },
      samples: {
        missingCustomerInvoices,
        missingSupplierInvoices
      },
      recommendations: [] as Array<{
        priority: string
        action: string
        reason: string
        steps: string[]
      }>
    }

    // Add recommendations
    if (missingCustomerContacts.size > 0 || missingSupplierContacts.size > 0) {
      diagnostics.recommendations.push({
        priority: 'HIGH',
        action: 'Sync Contacts First',
        reason: 'Some invoices cannot be synced because their associated contacts (customers/suppliers) are missing.',
        steps: [
          'Go to Finance module',
          'Click on "Sync" dropdown',
          'Select "Sync Contacts" to pull all contacts from Xero'
        ]
      })
    }

    if (diagnostics.gaps.missingCustomerInvoices > 0 || diagnostics.gaps.missingSupplierInvoices > 0) {
      diagnostics.recommendations.push({
        priority: 'HIGH',
        action: 'Sync Invoices',
        reason: `${diagnostics.gaps.missingCustomerInvoices + diagnostics.gaps.missingSupplierInvoices} invoices from Xero are not in your local database.`,
        steps: [
          'Go to Finance module',
          'Click on "Sync" dropdown',
          'Select "Sync Invoices" to pull all invoices from Xero'
        ]
      })
    }

    if (unmatchedPayments > 0) {
      diagnostics.recommendations.push({
        priority: 'MEDIUM',
        action: 'Re-match Payments',
        reason: `${unmatchedPayments} payments are not linked to any invoices.`,
        steps: [
          'First ensure all invoices are synced',
          'Go to Finance module',
          'Click on "Sync" dropdown',
          'Select "Sync Payments" to re-match payments to invoices'
        ]
      })
    }

    console.log('✅ Diagnostics complete')

    return NextResponse.json(diagnostics)

  } catch (error: any) {
    console.error('❌ Diagnostics failed:', error)
    return NextResponse.json(
      {
        error: 'Diagnostics failed',
        message: error.message
      },
      { status: 500 }
    )
  }
}
