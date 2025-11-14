/**
 * Notification Checker Service
 * 
 * This service checks for upcoming deadlines and outstanding items
 * and sends WhatsApp notifications to relevant users.
 */

import { prisma } from './db'
import {
  sendTenderDeadlineNotification,
  sendTaskDeadlineNotification,
  sendOutstandingInvoiceNotification,
  sendOutstandingSubmissionNotification
} from './whatsapp-service'
import { createSystemLog } from './logger'

/**
 * Check for upcoming tender deadlines and send notifications
 */
export async function checkTenderDeadlines(): Promise<{
  checked: number
  notified: number
  errors: string[]
}> {
  const results = {
    checked: 0,
    notified: 0,
    errors: [] as string[]
  }
  
  try {
    console.log('[Notification Checker] Checking tender deadlines...')
    
    // Get tenders with deadlines in the next 3 days
    const threeDaysFromNow = new Date()
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3)
    
    const upcomingTenders = await prisma.tender.findMany({
      where: {
        submissionDeadline: {
          gte: new Date(),
          lte: threeDaysFromNow
        },
        status: {
          notIn: ['SUBMITTED', 'AWARDED', 'WON', 'LOST', 'CANCELLED', 'EXPIRED']
        }
      },
      include: {
        User_Tender_assignedToIdToUser: {
          select: {
            id: true,
            name: true,
            phone: true,
            whatsappNotifications: true
          }
        }
      }
    })
    
    results.checked = upcomingTenders.length
    console.log(`[Notification Checker] Found ${upcomingTenders.length} tenders with upcoming deadlines`)
    
    for (const tender of upcomingTenders) {
      const assignedUser = tender.User_Tender_assignedToIdToUser
      if (!assignedUser || !assignedUser.phone) {
        console.log(`[Notification Checker] Skipping tender ${tender.tenderNumber} - no assigned user or phone`)
        continue
      }
      
      // Check if user has WhatsApp notifications enabled
      if (!assignedUser.whatsappNotifications) {
        console.log(`[Notification Checker] Skipping tender ${tender.tenderNumber} - user has disabled WhatsApp notifications`)
        continue
      }
      
      const daysRemaining = Math.ceil(
        (tender.submissionDeadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      )
      
      const result = await sendTenderDeadlineNotification(
        assignedUser.phone,
        tender.tenderNumber,
        tender.title,
        tender.submissionDeadline,
        daysRemaining
      )
      
      if (result.success) {
        results.notified++
        
        // Log the notification
        await createSystemLog({
          type: 'ACTIVITY',
          action: 'WHATSAPP_NOTIFICATION_SENT',
          message: `Tender deadline notification sent to ${assignedUser.name} for tender ${tender.tenderNumber}`,
          module: 'NOTIFICATION_SERVICE',
          status: 'SUCCESS',
          userId: assignedUser.id
        })
      } else {
        results.errors.push(`Failed to send notification for tender ${tender.tenderNumber}: ${result.error}`)
      }
    }
    
    console.log(`[Notification Checker] Tender deadlines check complete: ${results.notified}/${results.checked} notified`)
    
  } catch (error: any) {
    console.error('[Notification Checker] Error checking tender deadlines:', error)
    results.errors.push(error.message)
  }
  
  return results
}

/**
 * Check for upcoming task deadlines and send notifications
 */
export async function checkTaskDeadlines(): Promise<{
  checked: number
  notified: number
  errors: string[]
}> {
  const results = {
    checked: 0,
    notified: 0,
    errors: [] as string[]
  }
  
  try {
    console.log('[Notification Checker] Checking task deadlines...')
    
    // Get tasks with deadlines in the next 2 days
    const twoDaysFromNow = new Date()
    twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2)
    
    const upcomingTasks = await prisma.task.findMany({
      where: {
        dueDate: {
          gte: new Date(),
          lte: twoDaysFromNow
        },
        status: {
          notIn: ['COMPLETED', 'CANCELLED']
        }
      },
      include: {
        User_Task_assigneeIdToUser: {
          select: {
            id: true,
            name: true,
            phone: true,
            whatsappNotifications: true
          }
        }
      }
    })
    
    results.checked = upcomingTasks.length
    console.log(`[Notification Checker] Found ${upcomingTasks.length} tasks with upcoming deadlines`)
    
    for (const task of upcomingTasks) {
      const assignedUser = task.User_Task_assigneeIdToUser
      if (!assignedUser || !assignedUser.phone) {
        console.log(`[Notification Checker] Skipping task ${task.id} - no assigned user or phone`)
        continue
      }
      
      // Check if user has WhatsApp notifications enabled
      if (!assignedUser.whatsappNotifications) {
        console.log(`[Notification Checker] Skipping task ${task.id} - user has disabled WhatsApp notifications`)
        continue
      }
      
      // Skip if no due date
      if (!task.dueDate) {
        console.log(`[Notification Checker] Skipping task ${task.id} - no due date`)
        continue
      }
      
      const daysRemaining = Math.ceil(
        (task.dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      )
      
      const result = await sendTaskDeadlineNotification(
        assignedUser.phone,
        task.title,
        task.description,
        task.dueDate,
        daysRemaining
      )
      
      if (result.success) {
        results.notified++
        
        // Log the notification
        await createSystemLog({
          type: 'ACTIVITY',
          action: 'WHATSAPP_NOTIFICATION_SENT',
          message: `Task deadline notification sent to ${assignedUser.name} for task "${task.title}"`,
          module: 'NOTIFICATION_SERVICE',
          status: 'SUCCESS',
          userId: assignedUser.id
        })
      } else {
        results.errors.push(`Failed to send notification for task ${task.id}: ${result.error}`)
      }
    }
    
    console.log(`[Notification Checker] Task deadlines check complete: ${results.notified}/${results.checked} notified`)
    
  } catch (error: any) {
    console.error('[Notification Checker] Error checking task deadlines:', error)
    results.errors.push(error.message)
  }
  
  return results
}

/**
 * Check for outstanding invoices and send notifications
 */
export async function checkOutstandingInvoices(): Promise<{
  checked: number
  notified: number
  errors: string[]
}> {
  const results = {
    checked: 0,
    notified: 0,
    errors: [] as string[]
  }
  
  try {
    console.log('[Notification Checker] Checking outstanding invoices...')
    
    // Get invoices that are due within 7 days or overdue
    const sevenDaysFromNow = new Date()
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)
    
    const outstandingInvoices = await prisma.customerInvoice.findMany({
      where: {
        dueDate: {
          lte: sevenDaysFromNow
        },
        status: {
          in: ['SENT', 'OVERDUE']
        }
      },
      include: {
        Customer: {
          select: {
            id: true,
            name: true,
            phone: true
          }
        }
      }
    })
    
    results.checked = outstandingInvoices.length
    console.log(`[Notification Checker] Found ${outstandingInvoices.length} outstanding invoices`)
    
    for (const invoice of outstandingInvoices) {
      if (!invoice.Customer || !invoice.Customer.phone) {
        console.log(`[Notification Checker] Skipping invoice ${invoice.invoiceNumber} - no customer or phone`)
        continue
      }
      
      const daysOverdue = Math.ceil(
        (Date.now() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24)
      )
      
      const result = await sendOutstandingInvoiceNotification(
        invoice.Customer.phone,
        invoice.invoiceNumber,
        invoice.Customer.name,
        Number(invoice.totalAmount),
        invoice.dueDate,
        daysOverdue
      )
      
      if (result.success) {
        results.notified++
        
        // Log the notification
        await createSystemLog({
          type: 'ACTIVITY',
          action: 'WHATSAPP_NOTIFICATION_SENT',
          message: `Outstanding invoice notification sent to ${invoice.Customer.name} for invoice ${invoice.invoiceNumber}`,
          module: 'NOTIFICATION_SERVICE',
          status: 'SUCCESS'
        })
      } else {
        results.errors.push(`Failed to send notification for invoice ${invoice.invoiceNumber}: ${result.error}`)
      }
    }
    
    console.log(`[Notification Checker] Outstanding invoices check complete: ${results.notified}/${results.checked} notified`)
    
  } catch (error: any) {
    console.error('[Notification Checker] Error checking outstanding invoices:', error)
    results.errors.push(error.message)
  }
  
  return results
}

/**
 * Check for outstanding progress claims and send notifications
 */
export async function checkOutstandingProgressClaims(): Promise<{
  checked: number
  notified: number
  errors: string[]
}> {
  const results = {
    checked: 0,
    notified: 0,
    errors: [] as string[]
  }
  
  try {
    console.log('[Notification Checker] Checking outstanding progress claims...')
    
    // Get progress claims that are due within 5 days
    const fiveDaysFromNow = new Date()
    fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5)
    
    const outstandingClaims = await prisma.progressClaim.findMany({
      where: {
        claimDate: {
          gte: new Date(),
          lte: fiveDaysFromNow
        },
        status: {
          in: ['DRAFT']
        }
      },
      include: {
        Project: {
          select: {
            projectNumber: true,
            name: true,
            User_Project_managerIdToUser: {
              select: {
                id: true,
                name: true,
                phone: true,
                whatsappNotifications: true
              }
            }
          }
        }
      }
    })
    
    results.checked = outstandingClaims.length
    console.log(`[Notification Checker] Found ${outstandingClaims.length} outstanding progress claims`)
    
    for (const claim of outstandingClaims) {
      const projectManager = claim.Project.User_Project_managerIdToUser
      if (!projectManager || !projectManager.phone) {
        console.log(`[Notification Checker] Skipping claim ${claim.claimNumber} - no project manager or phone`)
        continue
      }
      
      // Check if user has WhatsApp notifications enabled
      if (!projectManager.whatsappNotifications) {
        console.log(`[Notification Checker] Skipping claim ${claim.claimNumber} - user has disabled WhatsApp notifications`)
        continue
      }
      
      const daysRemaining = Math.ceil(
        (claim.claimDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      )
      
      const result = await sendOutstandingSubmissionNotification(
        projectManager.phone,
        'Progress Claim',
        claim.Project.projectNumber,
        claim.Project.name,
        claim.claimDate,
        daysRemaining
      )
      
      if (result.success) {
        results.notified++
        
        // Log the notification
        await createSystemLog({
          type: 'ACTIVITY',
          action: 'WHATSAPP_NOTIFICATION_SENT',
          message: `Progress claim notification sent to ${projectManager.name} for claim ${claim.claimNumber}`,
          module: 'NOTIFICATION_SERVICE',
          status: 'SUCCESS',
          userId: projectManager.id
        })
      } else {
        results.errors.push(`Failed to send notification for claim ${claim.claimNumber}: ${result.error}`)
      }
    }
    
    console.log(`[Notification Checker] Outstanding progress claims check complete: ${results.notified}/${results.checked} notified`)
    
  } catch (error: any) {
    console.error('[Notification Checker] Error checking outstanding progress claims:', error)
    results.errors.push(error.message)
  }
  
  return results
}

/**
 * Run all notification checks
 */
export async function runAllNotificationChecks(): Promise<{
  tenders: { checked: number; notified: number; errors: string[] }
  tasks: { checked: number; notified: number; errors: string[] }
  invoices: { checked: number; notified: number; errors: string[] }
  progressClaims: { checked: number; notified: number; errors: string[] }
  totalNotified: number
  totalErrors: number
}> {
  console.log('\n🔔 [Notification Checker] Starting notification checks...')
  
  const tenders = await checkTenderDeadlines()
  const tasks = await checkTaskDeadlines()
  const invoices = await checkOutstandingInvoices()
  const progressClaims = await checkOutstandingProgressClaims()
  
  const totalNotified = tenders.notified + tasks.notified + invoices.notified + progressClaims.notified
  const totalErrors = tenders.errors.length + tasks.errors.length + invoices.errors.length + progressClaims.errors.length
  
  console.log('\n📊 [Notification Checker] Summary:')
  console.log(`  Tenders: ${tenders.notified}/${tenders.checked} notified`)
  console.log(`  Tasks: ${tasks.notified}/${tasks.checked} notified`)
  console.log(`  Invoices: ${invoices.notified}/${invoices.checked} notified`)
  console.log(`  Progress Claims: ${progressClaims.notified}/${progressClaims.checked} notified`)
  console.log(`  Total: ${totalNotified} notifications sent`)
  if (totalErrors > 0) {
    console.log(`  Errors: ${totalErrors}`)
  }
  console.log('')
  
  return {
    tenders,
    tasks,
    invoices,
    progressClaims,
    totalNotified,
    totalErrors
  }
}
