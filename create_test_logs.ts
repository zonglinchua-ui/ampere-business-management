
import { PrismaClient } from '@prisma/client'
import dotenv from 'dotenv'
import { v4 as uuidv4 } from 'uuid'

dotenv.config()

const prisma = new PrismaClient()

async function createTestLogs() {
  try {
    // Get the first SUPERADMIN user
    const adminUser = await prisma.user.findFirst({
      where: { role: 'SUPERADMIN' }
    })

    if (!adminUser) {
      console.error('No SUPERADMIN user found')
      return
    }

    console.log('Creating test Xero logs...')
    
    // Create some test log entries
    const testLogs = [
      {
        id: uuidv4(),
        timestamp: new Date(Date.now() - 3600000), // 1 hour ago
        userId: adminUser.id,
        direction: 'PULL',
        entity: 'CONTACTS',
        status: 'SUCCESS',
        recordsProcessed: 10,
        recordsSucceeded: 10,
        recordsFailed: 0,
        message: 'Successfully imported 10 contacts from Xero',
        duration: 2340,
        updatedAt: new Date()
      },
      {
        id: uuidv4(),
        timestamp: new Date(Date.now() - 7200000), // 2 hours ago
        userId: adminUser.id,
        direction: 'PUSH',
        entity: 'INVOICES',
        status: 'ERROR',
        recordsProcessed: 5,
        recordsSucceeded: 3,
        recordsFailed: 2,
        message: 'Failed to sync 2 invoices to Xero',
        errorMessage: 'Xero API rate limit exceeded',
        duration: 1560,
        updatedAt: new Date()
      },
      {
        id: uuidv4(),
        timestamp: new Date(Date.now() - 14400000), // 4 hours ago
        userId: adminUser.id,
        direction: 'BOTH',
        entity: 'ALL',
        status: 'WARNING',
        recordsProcessed: 25,
        recordsSucceeded: 20,
        recordsFailed: 5,
        message: 'Full sync completed with warnings',
        errorMessage: 'Some records had validation issues',
        details: JSON.stringify({
          contacts: { processed: 10, succeeded: 10, failed: 0 },
          invoices: { processed: 8, succeeded: 5, failed: 3 },
          payments: { processed: 7, succeeded: 5, failed: 2 }
        }),
        duration: 5670,
        updatedAt: new Date()
      }
    ]

    for (const logData of testLogs) {
      await prisma.xero_logs.create({ data: logData })
      console.log(`Created log entry: ${logData.message}`)
    }

    console.log('Test logs created successfully!')

  } catch (error) {
    console.error('Error creating test logs:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createTestLogs()
