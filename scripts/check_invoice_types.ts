
/**
 * Check invoice types to identify any mismatches
 * This script will help identify if invoices are stored in the wrong table
 */

import dotenv from 'dotenv'
import { PrismaClient } from '@prisma/client'

// Load environment variables
dotenv.config()

const prisma = new PrismaClient()

async function checkInvoiceTypes() {
  try {
    console.log('🔍 Checking invoice storage by type...\n')

    // Get sample customer invoices with their Xero data
    const customerInvoices = await prisma.customerInvoice.findMany({
      where: {
        isXeroSynced: true
      },
      include: {
        Customer: {
          select: {
            name: true,
            xeroContactId: true
          }
        }
      },
      take: 20,
      orderBy: {
        createdAt: 'desc'
      }
    })

    console.log('📊 Customer Invoices (should all be ACCREC - money IN):')
    console.log('Total:', customerInvoices.length)
    for (const inv of customerInvoices) {
      console.log(`  - ${inv.invoiceNumber} | ${inv.Customer?.name || 'Unknown'} | Status: ${inv.status}`)
    }
    console.log('')

    // Get sample supplier invoices with their Xero data
    const supplierInvoices = await prisma.supplierInvoice.findMany({
      where: {
        isXeroSynced: true
      },
      include: {
        Supplier: {
          select: {
            name: true,
            xeroContactId: true
          }
        }
      },
      take: 20,
      orderBy: {
        createdAt: 'desc'
      }
    })

    console.log('📊 Supplier Invoices (should all be ACCPAY - money OUT):')
    console.log('Total:', supplierInvoices.length)
    for (const inv of supplierInvoices) {
      console.log(`  - ${inv.invoiceNumber} | ${inv.Supplier?.name || 'Unknown'} | Status: ${inv.status}`)
    }
    console.log('')

    // Check for YF Design and Build specifically
    console.log('\n🔍 Checking YF Design and Build Pte Ltd specifically...\n')
    
    const yfAsCustomer = await prisma.customer.findFirst({
      where: {
        name: {
          contains: 'YF Design',
          mode: 'insensitive'
        }
      },
      include: {
        CustomerInvoice: {
          take: 5,
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    })

    const yfAsSupplier = await prisma.supplier.findFirst({
      where: {
        name: {
          contains: 'YF Design',
          mode: 'insensitive'
        }
      },
      include: {
        SupplierInvoice: {
          take: 5,
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    })

    if (yfAsCustomer) {
      console.log('YF as Customer:')
      console.log(`  Name: ${yfAsCustomer.name}`)
      console.log(`  Xero Contact ID: ${yfAsCustomer.xeroContactId}`)
      console.log(`  Customer Invoices: ${yfAsCustomer.CustomerInvoice.length}`)
      for (const inv of yfAsCustomer.CustomerInvoice) {
        console.log(`    - ${inv.invoiceNumber} | ${inv.status} | ${inv.totalAmount} | ${inv.issueDate.toISOString().split('T')[0]}`)
      }
    } else {
      console.log('YF NOT found as Customer')
    }
    console.log('')

    if (yfAsSupplier) {
      console.log('YF as Supplier:')
      console.log(`  Name: ${yfAsSupplier.name}`)
      console.log(`  Xero Contact ID: ${yfAsSupplier.xeroContactId}`)
      console.log(`  Supplier Invoices: ${yfAsSupplier.SupplierInvoice.length}`)
      for (const inv of yfAsSupplier.SupplierInvoice) {
        console.log(`    - ${inv.invoiceNumber} | ${inv.status} | ${inv.totalAmount} | ${inv.invoiceDate.toISOString().split('T')[0]}`)
      }
    } else {
      console.log('YF NOT found as Supplier')
    }
    console.log('')

    // Check for JCH engineering
    console.log('\n🔍 Checking JCH engineering pte ltd specifically...\n')
    
    const jchAsCustomer = await prisma.customer.findFirst({
      where: {
        name: {
          contains: 'JCH',
          mode: 'insensitive'
        }
      },
      include: {
        CustomerInvoice: {
          take: 5,
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    })

    const jchAsSupplier = await prisma.supplier.findFirst({
      where: {
        name: {
          contains: 'JCH',
          mode: 'insensitive'
        }
      },
      include: {
        SupplierInvoice: {
          take: 5,
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    })

    if (jchAsCustomer) {
      console.log('JCH as Customer:')
      console.log(`  Name: ${jchAsCustomer.name}`)
      console.log(`  Xero Contact ID: ${jchAsCustomer.xeroContactId}`)
      console.log(`  Customer Invoices: ${jchAsCustomer.CustomerInvoice.length}`)
      for (const inv of jchAsCustomer.CustomerInvoice) {
        console.log(`    - ${inv.invoiceNumber} | ${inv.status} | ${inv.totalAmount} | ${inv.issueDate.toISOString().split('T')[0]}`)
      }
    } else {
      console.log('JCH NOT found as Customer')
    }
    console.log('')

    if (jchAsSupplier) {
      console.log('JCH as Supplier:')
      console.log(`  Name: ${jchAsSupplier.name}`)
      console.log(`  Xero Contact ID: ${jchAsSupplier.xeroContactId}`)
      console.log(`  Supplier Invoices: ${jchAsSupplier.SupplierInvoice.length}`)
      for (const inv of jchAsSupplier.SupplierInvoice) {
        console.log(`    - ${inv.invoiceNumber} | ${inv.status} | ${inv.totalAmount} | ${inv.invoiceDate.toISOString().split('T')[0]}`)
      }
    } else {
      console.log('JCH NOT found as Supplier')
    }

    console.log('\n✅ Diagnostic complete')

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkInvoiceTypes()
