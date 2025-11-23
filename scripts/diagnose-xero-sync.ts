/**
 * Xero Sync Diagnostic Script
 * 
 * Diagnoses and reports on Xero sync issues:
 * 1. Missing invoices
 * 2. Invoice-to-customer/supplier alignment
 * 3. Payment-to-invoice matching
 */

import { prisma } from '../lib/db'
import { getXeroClient } from '../lib/xero-config'
import { XeroOAuthService } from '../lib/xero-oauth-service'

async function runDiagnostics() {
  console.log('\n' + '='.repeat(80))
  console.log('XERO SYNC DIAGNOSTICS')
  console.log('='.repeat(80) + '\n')

  try {
    // 1. Check Xero connection
    console.log('📡 Checking Xero connection...')
    const tokens = await XeroOAuthService.getStoredTokens()
    
    if (!tokens) {
      console.error('❌ No Xero tokens found. Please connect to Xero first.')
      return
    }

    const xeroClient = getXeroClient()
    xeroClient.setTokenSet({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expires_in: Math.floor((tokens.expiresAt.getTime() - Date.now()) / 1000),
      token_type: 'Bearer',
    })

    console.log('✅ Connected to Xero')
    console.log(`   Tenant: ${tokens.tenantName}`)
    console.log(`   Tenant ID: ${tokens.tenantId}\n`)

    // 2. Fetch all invoices from Xero (with pagination)
    console.log('📥 Fetching invoices from Xero...')
    let allXeroInvoices: any[] = []
    let page = 1
    let hasMore = true

    while (hasMore) {
      const response = await xeroClient.accountingApi.getInvoices(
        tokens.tenantId,
        undefined, // ifModifiedSince
        undefined, // where
        undefined, // order
        undefined, // IDs
        undefined, // invoiceNumbers
        undefined, // contactIDs
        undefined, // statuses
        page      // page number
      )

      const invoices = response.body.invoices || []
      allXeroInvoices.push(...invoices)
      console.log(`   Page ${page}: ${invoices.length} invoices`)

      if (invoices.length < 100) {
        hasMore = false
      } else {
        page++
      }
    }

    const xeroCustomerInvoices = allXeroInvoices.filter(inv => inv.type === 'ACCREC')
    const xeroSupplierInvoices = allXeroInvoices.filter(inv => inv.type === 'ACCPAY')

    console.log(`✅ Total invoices in Xero: ${allXeroInvoices.length}`)
    console.log(`   Customer invoices (ACCREC): ${xeroCustomerInvoices.length}`)
    console.log(`   Supplier invoices (ACCPAY): ${xeroSupplierInvoices.length}\n`)

    // 3. Check local database
    console.log('💾 Checking local database...')
    
    const localCustomerInvoices = await prisma.customerInvoice.findMany({
      where: { isXeroSynced: true }
    })
    
    const localSupplierInvoices = await prisma.supplierInvoice.findMany({
      where: { isXeroSynced: true }
    })
    
    const localPayments = await prisma.payment.findMany({
      where: { isXeroSynced: true }
    })

    const localCustomers = await prisma.customer.findMany({
      where: { isXeroSynced: true }
    })

    const localSuppliers = await prisma.supplier.findMany({
      where: { isXeroSynced: true }
    })

    console.log(`✅ Local database:`)
    console.log(`   Customer invoices (synced): ${localCustomerInvoices.length}`)
    console.log(`   Supplier invoices (synced): ${localSupplierInvoices.length}`)
    console.log(`   Payments (synced): ${localPayments.length}`)
    console.log(`   Customers (synced): ${localCustomers.length}`)
    console.log(`   Suppliers (synced): ${localSuppliers.length}\n`)

    // 4. Analyze missing invoices
    console.log('🔍 Analyzing missing invoices...')
    
    const missingCustomerInvoices = xeroCustomerInvoices.filter(xInv => {
      return !localCustomerInvoices.some(lInv => lInv.xeroInvoiceId === xInv.invoiceID)
    })
    
    const missingSupplierInvoices = xeroSupplierInvoices.filter(xInv => {
      return !localSupplierInvoices.some(lInv => lInv.xeroInvoiceId === xInv.invoiceID)
    })

    console.log(`❌ Missing customer invoices: ${missingCustomerInvoices.length}`)
    console.log(`❌ Missing supplier invoices: ${missingSupplierInvoices.length}\n`)

    // 5. Analyze contact matching issues
    console.log('🔍 Analyzing contact matching issues...')
    
    const missingCustomerContacts = new Set()
    const missingSupplierContacts = new Set()

    for (const inv of missingCustomerInvoices.slice(0, 100)) {
      const contactId = inv.contact?.contactID
      if (contactId) {
        const hasContact = localCustomers.some(c => c.xeroContactId === contactId)
        if (!hasContact) {
          missingCustomerContacts.add(contactId)
        }
      }
    }

    for (const inv of missingSupplierInvoices.slice(0, 100)) {
      const contactId = inv.contact?.contactID
      if (contactId) {
        const hasContact = localSuppliers.some(s => s.xeroContactId === contactId)
        if (!hasContact) {
          missingSupplierContacts.add(contactId)
        }
      }
    }

    console.log(`❌ Missing customer contacts: ${missingCustomerContacts.size}`)
    console.log(`❌ Missing supplier contacts: ${missingSupplierContacts.size}\n`)

    // 6. Analyze payment matching
    console.log('🔍 Analyzing payment matching...')
    
    const unmatchedPayments = localPayments.filter(p => 
      !p.customerInvoiceId && !p.supplierInvoiceId
    )

    console.log(`❌ Unmatched payments: ${unmatchedPayments.length} out of ${localPayments.length}\n`)

    // 7. Summary and recommendations
    console.log('=' .repeat(80))
    console.log('SUMMARY & RECOMMENDATIONS')
    console.log('='.repeat(80) + '\n')

    console.log('📊 Gap Analysis:')
    console.log(`   Xero has ${xeroCustomerInvoices.length} customer invoices, local has ${localCustomerInvoices.length} (${missingCustomerInvoices.length} missing)`)
    console.log(`   Xero has ${xeroSupplierInvoices.length} supplier invoices, local has ${localSupplierInvoices.length} (${missingSupplierInvoices.length} missing)\n`)

    if (missingCustomerContacts.size > 0 || missingSupplierContacts.size > 0) {
      console.log('⚠️  ROOT CAUSE: Missing Contacts')
      console.log('   Some invoices cannot be synced because their associated contacts')
      console.log('   (customers/suppliers) have not been synced from Xero.\n')
      console.log('   📋 STEP 1: Run contact sync first')
      console.log('      npm run sync-contacts\n')
    }

    if (missingCustomerInvoices.length > 0 || missingSupplierInvoices.length > 0) {
      console.log('⚠️  ISSUE: Missing Invoices')
      console.log('   After syncing contacts, run invoice sync to pull all invoices.\n')
      console.log('   📋 STEP 2: Run invoice sync')
      console.log('      npm run sync-invoices\n')
    }

    if (unmatchedPayments.length > 0) {
      console.log('⚠️  ISSUE: Unmatched Payments')
      console.log('   Some payments are not linked to invoices. This happens when:')
      console.log('   1. The invoice was synced after the payment')
      console.log('   2. The invoice is missing from the local database\n')
      console.log('   📋 STEP 3: Run payment re-matching')
      console.log('      npm run rematch-payments\n')
    }

    // 8. Sample missing invoices
    if (missingCustomerInvoices.length > 0) {
      console.log('\n📋 Sample Missing Customer Invoices (first 10):')
      missingCustomerInvoices.slice(0, 10).forEach((inv, i) => {
        console.log(`   ${i + 1}. ${inv.invoiceNumber} - ${inv.contact?.name} - ${inv.total}`)
      })
    }

    if (missingSupplierInvoices.length > 0) {
      console.log('\n📋 Sample Missing Supplier Invoices (first 10):')
      missingSupplierInvoices.slice(0, 10).forEach((inv, i) => {
        console.log(`   ${i + 1}. ${inv.invoiceNumber} - ${inv.contact?.name} - ${inv.total}`)
      })
    }

    console.log('\n' + '='.repeat(80))
    console.log('DIAGNOSTIC COMPLETE')
    console.log('='.repeat(80) + '\n')

  } catch (error: any) {
    console.error('\n❌ Diagnostic failed:', error.message)
    console.error(error.stack)
  } finally {
    await prisma.$disconnect()
  }
}

runDiagnostics()
