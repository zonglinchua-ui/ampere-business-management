
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'

/**
 * POST /api/servicing/check-invoice-reminders
 * Check all service contracts and create notifications when work is completed but not fully invoiced
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only SUPERADMIN, FINANCE, and PROJECT_MANAGER can run this check
    if (!['SUPERADMIN', 'FINANCE', 'PROJECT_MANAGER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const reminders = []
    
    // Get all active service contracts with completed/in-progress jobs
    const contracts = await prisma.serviceContract.findMany({
      where: {
        status: 'Active',
        contractValue: {
          not: null,
          gt: 0
        }
      },
      include: {
        Customer: {
          select: {
            id: true,
            name: true
          }
        },
        User_ServiceContract_managerIdToUser: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        ServiceJob: {
          where: {
            status: {
              in: ['Completed', 'InProgress']
            }
          },
          select: {
            id: true,
            status: true,
            scheduledDate: true,
            completedAt: true,
            ServiceInvoice: {
              where: {
                status: {
                  in: ['Paid']
                }
              },
              select: {
                amount: true
              }
            }
          }
        }
      }
    })

    for (const contract of contracts) {
      const contractValue = parseFloat(contract.contractValue?.toString() || '0')
      const totalJobs = contract.ServiceJob.length
      const completedJobs = contract.ServiceJob.filter((j: any) => j.status === 'Completed').length
      
      if (totalJobs === 0) continue // Skip if no jobs yet
      
      // Calculate earned value based on completed jobs
      const completionRate = totalJobs > 0 ? completedJobs / totalJobs : 0
      const earnedValue = contractValue * completionRate
      
      // Calculate total invoiced amount from all job invoices
      const totalInvoiced = contract.ServiceJob.reduce((sum: number, job: any) => {
        const jobInvoices = job.ServiceInvoice || []
        return sum + jobInvoices.reduce((jobSum: number, invoice: any) => {
          return jobSum + parseFloat(invoice.amount?.toString() || '0')
        }, 0)
      }, 0)
      
      // Calculate uninvoiced amount
      const uninvoicedAmount = earnedValue - totalInvoiced
      
      // If uninvoiced amount is more than 5% of contract value, create reminder
      const threshold = contractValue * 0.05 // 5% threshold
      
      if (uninvoicedAmount > threshold && uninvoicedAmount > 500) { // At least $500 uninvoiced
        // Check if there's already a recent reminder (within last 7 days)
        const recentReminder = await prisma.serviceNotification.findFirst({
          where: {
            contractId: contract.id,
            type: 'SERVICE_INVOICE_REMINDER',
            isRead: false,
            isDismissed: false,
            createdAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
            }
          }
        })

        if (!recentReminder) {
          // Create notification for contract manager
          const usersToNotify = []
          if (contract.User_ServiceContract_managerIdToUser) {
            usersToNotify.push(contract.User_ServiceContract_managerIdToUser)
          }
          
          for (const user of usersToNotify) {
            const notification = await prisma.serviceNotification.create({
              data: {
                id: uuidv4(),
                contractId: contract.id,
                userId: user.id,
                type: 'SERVICE_INVOICE_REMINDER',
                message: `Service Contract "${contract.contractNo}": ${completedJobs} of ${totalJobs} jobs completed (${(completionRate * 100).toFixed(1)}%) but only ${((totalInvoiced / contractValue) * 100).toFixed(1)}% invoiced. Uninvoiced: $${uninvoicedAmount.toFixed(2)}`,
                metadata: {
                  contractValue,
                  completionRate: completionRate * 100,
                  earnedValue,
                  totalInvoiced,
                  uninvoicedAmount,
                  completedJobs,
                  totalJobs,
                  customerName: contract.Customer?.name
                },
                sentAt: new Date(),
                createdAt: new Date()
              }
            })
            
            reminders.push({
              contractId: contract.id,
              contractNo: contract.contractNo,
              userId: user.id,
              userName: user.name,
              uninvoicedAmount,
              notificationId: notification.id
            })
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      remindersCreated: reminders.length,
      reminders
    })

  } catch (error) {
    console.error('Error checking servicing invoice reminders:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/servicing/check-invoice-reminders
 * Get all service contract notifications for current user
 * NOTE: Reminders are shown every time, regardless of dismissed/read status
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch ALL notifications for the user, ignoring isRead and isDismissed
    const notifications = await prisma.serviceNotification.findMany({
      where: {
        userId: session.user.id,
        type: 'SERVICE_INVOICE_REMINDER'
      },
      include: {
        ServiceContract: {
          select: {
            id: true,
            contractNo: true,
            serviceType: true,
            contractValue: true,
            Customer: {
              select: {
                name: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json({ notifications })

  } catch (error) {
    console.error('Error fetching service notifications:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
