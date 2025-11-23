import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  try {
    console.log('=== Checking Xero Sync Logs ===')
    const recentLogs = await prisma.xero_logs.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        direction: true,
        entity: true,
        status: true,
        recordsProcessed: true,
        recordsSucceeded: true,
        recordsFailed: true,
        message: true,
        createdAt: true
      }
    })
    console.log('Recent logs:', JSON.stringify(recentLogs, null, 2))

    console.log('\n=== Checking Invoice Counts ===')
    const invoiceCount = await prisma.customerInvoice.count()
    const xeroSyncedInvoices = await prisma.customerInvoice.count({
      where: { isXeroSynced: true }
    })
    console.log(`Total invoices: ${invoiceCount}`)
    console.log(`Xero synced invoices: ${xeroSyncedInvoices}`)

    console.log('\n=== Checking Customer Counts ===')
    const customerCount = await prisma.customer.count()
    const xeroSyncedCustomers = await prisma.customer.count({
      where: { isXeroSynced: true }
    })
    console.log(`Total customers: ${customerCount}`)
    console.log(`Xero synced customers: ${xeroSyncedCustomers}`)

    console.log('\n=== Checking General Contacts ===')
    const generalContacts = await prisma.customer.count({
      where: {
        notes: {
          contains: '[General Contact - synced from Xero]'
        }
      }
    })
    console.log(`General contacts: ${generalContacts}`)

    console.log('\n=== Sample Xero Synced Invoices ===')
    const sampleInvoices = await prisma.customerInvoice.findMany({
      where: { isXeroSynced: true },
      take: 5,
      select: {
        id: true,
        invoiceNumber: true,
        totalAmount: true,
        status: true,
        xeroInvoiceId: true,
        Customer: {
          select: {
            name: true,
            xeroContactId: true
          }
        }
      }
    })
    console.log('Sample invoices:', JSON.stringify(sampleInvoices, null, 2))

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
