import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  try {
    console.log('=== Checking Invoice Sync Error Details ===')
    const invoiceLogs = await prisma.xero_logs.findMany({
      where: {
        entity: 'INVOICES',
        status: { in: ['ERROR', 'WARNING'] }
      },
      take: 3,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        message: true,
        errorMessage: true,
        details: true,
        createdAt: true
      }
    })
    console.log('Invoice error logs:', JSON.stringify(invoiceLogs, null, 2))

    console.log('\n=== Checking Contact Sync Details ===')
    const contactLogs = await prisma.xero_logs.findMany({
      where: {
        entity: 'CONTACTS'
      },
      take: 2,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        message: true,
        details: true,
        createdAt: true
      }
    })
    console.log('Contact sync logs:', JSON.stringify(contactLogs, null, 2))

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
