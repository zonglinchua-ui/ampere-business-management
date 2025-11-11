import 'dotenv/config'
import prisma from './lib/db'

async function testInvoiceReminders() {
  console.log('=== Testing Invoice Reminders ===\n')
  
  // Check if there are active projects with progress > 0
  const activeProjects = await prisma.project.findMany({
    where: {
      isActive: true,
      contractValue: {
        not: null,
        gt: 0
      },
      progress: {
        gt: 0
      }
    },
    select: {
      id: true,
      name: true,
      projectNumber: true,
      progress: true,
      contractValue: true,
      Customer: {
        select: {
          name: true
        }
      },
      User_Project_managerIdToUser: {
        select: {
          id: true,
          name: true,
          role: true
        }
      },
      CustomerInvoice: {
        where: {
          status: {
            in: ['PAID', 'PARTIALLY_PAID']
          }
        },
        select: {
          totalAmount: true,
          amountPaid: true
        }
      }
    }
  })
  
  console.log(`Found ${activeProjects.length} active projects with progress > 0%\n`)
  
  if (activeProjects.length === 0) {
    console.log('❌ No active projects found that meet criteria:')
    console.log('   - isActive: true')
    console.log('   - contractValue: > 0')
    console.log('   - progress: > 0')
    return
  }
  
  // Analyze each project
  for (const project of activeProjects) {
    const contractValue = parseFloat(project.contractValue?.toString() || '0')
    const progress = project.progress / 100
    const earnedValue = contractValue * progress
    
    const totalClaimed = project.CustomerInvoice.reduce((sum: number, invoice: any) => {
      return sum + parseFloat(invoice.amountPaid?.toString() || invoice.totalAmount?.toString() || '0')
    }, 0)
    
    const unclaimedAmount = earnedValue - totalClaimed
    const threshold = contractValue * 0.05 // 5% threshold
    
    const shouldRemind = unclaimedAmount > threshold && unclaimedAmount > 1000
    
    console.log(`\nProject: ${project.name} (${project.projectNumber})`)
    console.log(`  Customer: ${project.Customer.name}`)
    console.log(`  Manager: ${project.User_Project_managerIdToUser?.name || 'None'} (${project.User_Project_managerIdToUser?.role || 'N/A'})`)
    console.log(`  Contract Value: $${contractValue.toLocaleString()}`)
    console.log(`  Progress: ${project.progress}%`)
    console.log(`  Earned Value: $${earnedValue.toLocaleString()}`)
    console.log(`  Total Claimed: $${totalClaimed.toLocaleString()}`)
    console.log(`  Unclaimed: $${unclaimedAmount.toLocaleString()}`)
    console.log(`  Threshold (5%): $${threshold.toLocaleString()}`)
    console.log(`  Should create reminder: ${shouldRemind ? '✅ YES' : '❌ NO'}`)
    
    if (!shouldRemind) {
      if (unclaimedAmount <= 1000) {
        console.log(`    → Reason: Unclaimed amount ($${unclaimedAmount.toLocaleString()}) <= $1,000`)
      } else {
        console.log(`    → Reason: Unclaimed amount ($${unclaimedAmount.toLocaleString()}) <= threshold ($${threshold.toLocaleString()})`)
      }
    }
  }
  
  // Check existing notifications
  const existingNotifications = await prisma.projectNotification.findMany({
    where: {
      type: 'PROJECT_INVOICE_REMINDER',
      isDismissed: false
    },
    include: {
      Project: {
        select: {
          name: true,
          projectNumber: true
        }
      },
      User: {
        select: {
          name: true,
          email: true
        }
      }
    }
  })
  
  console.log(`\n\n=== Existing Notifications ===`)
  console.log(`Found ${existingNotifications.length} invoice reminder notifications\n`)
  
  for (const notif of existingNotifications) {
    console.log(`Notification ID: ${notif.id}`)
    console.log(`  Project: ${notif.Project.name} (${notif.Project.projectNumber})`)
    console.log(`  User: ${notif.User.name} (${notif.User.email})`)
    console.log(`  Is Read: ${notif.isRead}`)
    console.log(`  Is Dismissed: ${notif.isDismissed}`)
    console.log(`  Created: ${notif.createdAt}`)
    console.log(`  Message: ${notif.message}`)
    console.log()
  }
}

testInvoiceReminders()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error)
    process.exit(1)
  })
