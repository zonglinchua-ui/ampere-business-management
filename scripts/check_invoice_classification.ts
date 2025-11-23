
import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'

dotenv.config()

const prisma = new PrismaClient()

async function main() {
  try {
    // 1. Count invoices
    const customerInvoiceCount = await prisma.customerInvoice.count()
    const supplierInvoiceCount = await prisma.supplierInvoice.count()
    const xeroCustomerInvoiceCount = await prisma.customerInvoice.count({ where: { isXeroSynced: true } })
    const xeroSupplierInvoiceCount = await prisma.supplierInvoice.count({ where: { isXeroSynced: true } })

    console.log('\n📊 INVOICE COUNTS:')
    console.log(`Total Customer Invoices: ${customerInvoiceCount}`)
    console.log(`Total Supplier Invoices: ${supplierInvoiceCount}`)
    console.log(`Xero-Synced Customer Invoices: ${xeroCustomerInvoiceCount}`)
    console.log(`Xero-Synced Supplier Invoices: ${xeroSupplierInvoiceCount}`)

    // 2. Check for duplicate contacts (same xeroContactId in both Customer and Supplier)
    const customers = await prisma.customer.findMany({
      where: { xeroContactId: { not: null } },
      select: { xeroContactId: true, name: true, id: true }
    })

    const suppliers = await prisma.supplier.findMany({
      where: { xeroContactId: { not: null } },
      select: { xeroContactId: true, name: true, id: true }
    })

    const customerContactIds = new Set(customers.map(c => c.xeroContactId))
    const duplicates: any[] = []

    for (const supplier of suppliers) {
      if (customerContactIds.has(supplier.xeroContactId)) {
        const customer = customers.find(c => c.xeroContactId === supplier.xeroContactId)
        duplicates.push({
          xeroContactId: supplier.xeroContactId,
          customerName: customer?.name,
          customerId: customer?.id,
          supplierName: supplier.name,
          supplierId: supplier.id
        })
      }
    }

    console.log('\n🔍 DUPLICATE CONTACTS (same xeroContactId in both tables):')
    console.log(`Found ${duplicates.length} contacts that exist as both Customer AND Supplier`)
    
    if (duplicates.length > 0) {
      console.log('\nFirst 10 duplicates:')
      duplicates.slice(0, 10).forEach(dup => {
        console.log(`  - xeroContactId: ${dup.xeroContactId}`)
        console.log(`    Customer: ${dup.customerName} (${dup.customerId})`)
        console.log(`    Supplier: ${dup.supplierName} (${dup.supplierId})`)
      })

      // 3. Check invoices for these duplicate contacts
      console.log('\n📄 CHECKING INVOICES FOR DUPLICATE CONTACTS:')
      for (const dup of duplicates.slice(0, 5)) {
        const custInvoices = await prisma.customerInvoice.count({ 
          where: { customerId: dup.customerId }
        })
        const suppInvoices = await prisma.supplierInvoice.count({ 
          where: { supplierId: dup.supplierId }
        })
        console.log(`\n  ${dup.customerName}:`)
        console.log(`    - As Customer: ${custInvoices} invoices`)
        console.log(`    - As Supplier: ${suppInvoices} invoices`)
      }
    }

    // 4. Sample some customer invoices to check their structure
    const sampleCustomerInvoices = await prisma.customerInvoice.findMany({
      where: { isXeroSynced: true },
      take: 5,
      include: {
        Customer: {
          select: { id: true, name: true, xeroContactId: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    console.log('\n📋 SAMPLE CUSTOMER INVOICES:')
    sampleCustomerInvoices.forEach(inv => {
      console.log(`  - ${inv.invoiceNumber}: ${inv.Customer.name} (Xero: ${inv.isXeroSynced})`)
    })

    // 5. Sample some supplier invoices  
    const sampleSupplierInvoices = await prisma.supplierInvoice.findMany({
      where: { isXeroSynced: true },
      take: 5,
      include: {
        Supplier: {
          select: { id: true, name: true, xeroContactId: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    console.log('\n📋 SAMPLE SUPPLIER INVOICES:')
    sampleSupplierInvoices.forEach(inv => {
      console.log(`  - ${inv.invoiceNumber}: ${inv.Supplier.name} (Xero: ${inv.isXeroSynced})`)
    })

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
