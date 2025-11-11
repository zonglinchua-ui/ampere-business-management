
/**
 * Find duplicate invoices across CustomerInvoice and SupplierInvoice tables
 */

import dotenv from 'dotenv'
import { PrismaClient } from '@prisma/client'

// Load environment variables
dotenv.config()

const prisma = new PrismaClient()

async function findDuplicates() {
  try {
    console.log('🔍 Finding duplicate invoices...\n')

    // Find invoices that appear in both tables
    const customerInvoices = await prisma.customerInvoice.findMany({
      where: {
        isXeroSynced: true,
        xeroInvoiceId: {
          not: null
        }
      },
      select: {
        id: true,
        invoiceNumber: true,
        xeroInvoiceId: true,
        totalAmount: true,
        issueDate: true,
        Customer: {
          select: {
            name: true,
            xeroContactId: true
          }
        }
      }
    })

    const supplierInvoices = await prisma.supplierInvoice.findMany({
      where: {
        isXeroSynced: true,
        xeroInvoiceId: {
          not: null
        }
      },
      select: {
        id: true,
        invoiceNumber: true,
        xeroInvoiceId: true,
        totalAmount: true,
        invoiceDate: true,
        Supplier: {
          select: {
            name: true,
            xeroContactId: true
          }
        }
      }
    })

    console.log(`📊 Total Customer Invoices (Xero synced): ${customerInvoices.length}`)
    console.log(`📊 Total Supplier Invoices (Xero synced): ${supplierInvoices.length}`)
    console.log('')

    // Create maps by Xero Invoice ID
    const customerInvoicesByXeroId = new Map(
      customerInvoices.map(inv => [inv.xeroInvoiceId!, inv])
    )
    const supplierInvoicesByXeroId = new Map(
      supplierInvoices.map(inv => [inv.xeroInvoiceId!, inv])
    )

    // Find duplicates
    const duplicates: any[] = []
    for (const [xeroId, customerInv] of customerInvoicesByXeroId.entries()) {
      if (supplierInvoicesByXeroId.has(xeroId)) {
        const supplierInv = supplierInvoicesByXeroId.get(xeroId)!
        duplicates.push({
          xeroInvoiceId: xeroId,
          invoiceNumber: customerInv.invoiceNumber,
          customerEntry: {
            id: customerInv.id,
            name: customerInv.Customer?.name || 'Unknown',
            xeroContactId: customerInv.Customer?.xeroContactId,
            amount: Number(customerInv.totalAmount),
            date: customerInv.issueDate.toISOString().split('T')[0]
          },
          supplierEntry: {
            id: supplierInv.id,
            name: supplierInv.Supplier?.name || 'Unknown',
            xeroContactId: supplierInv.Supplier?.xeroContactId,
            amount: Number(supplierInv.totalAmount),
            date: supplierInv.invoiceDate.toISOString().split('T')[0]
          }
        })
      }
    }

    if (duplicates.length > 0) {
      console.log(`❌ Found ${duplicates.length} DUPLICATE invoices (same Xero Invoice ID in both tables):\n`)
      
      for (const dup of duplicates) {
        console.log(`📄 Invoice: ${dup.invoiceNumber}`)
        console.log(`   Xero Invoice ID: ${dup.xeroInvoiceId}`)
        console.log(`   In CUSTOMER table:`)
        console.log(`     - Internal ID: ${dup.customerEntry.id}`)
        console.log(`     - Contact: ${dup.customerEntry.name}`)
        console.log(`     - Xero Contact ID: ${dup.customerEntry.xeroContactId}`)
        console.log(`     - Amount: ${dup.customerEntry.amount}`)
        console.log(`     - Date: ${dup.customerEntry.date}`)
        console.log(`   In SUPPLIER table:`)
        console.log(`     - Internal ID: ${dup.supplierEntry.id}`)
        console.log(`     - Contact: ${dup.supplierEntry.name}`)
        console.log(`     - Xero Contact ID: ${dup.supplierEntry.xeroContactId}`)
        console.log(`     - Amount: ${dup.supplierEntry.amount}`)
        console.log(`     - Date: ${dup.supplierEntry.date}`)
        console.log('')
      }

      console.log(`\n⚠️  ISSUE: These ${duplicates.length} invoices exist in BOTH tables!`)
      console.log(`   They should only exist in ONE table based on their Xero type:`)
      console.log(`   - ACCREC (money IN) → CustomerInvoice only`)
      console.log(`   - ACCPAY (money OUT) → SupplierInvoice only`)
      console.log('')
      console.log(`💡 SOLUTION: We need to:`)
      console.log(`   1. Query Xero API to get the actual invoice type for each duplicate`)
      console.log(`   2. Delete the invoice from the WRONG table`)
      console.log(`   3. Keep the invoice in the CORRECT table only`)
    } else {
      console.log('✅ No duplicate invoices found! All invoices are in the correct table.')
    }

    console.log('\n✅ Diagnostic complete')

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

findDuplicates()
