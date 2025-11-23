
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'

/**
 * POST /api/projects/check-invoice-reminders
 * Check all projects and create notifications when progress exceeds claimed amount
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
    
    // Get all active projects with contract value
    const projects = await prisma.project.findMany({
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
      include: {
        Customer: {
          select: {
            id: true,
            name: true
          }
        },
        User_Project_managerIdToUser: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        User_Project_salespersonIdToUser: {
          select: {
            id: true,
            name: true,
            email: true
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

    for (const project of projects) {
      const contractValue = parseFloat(project.contractValue?.toString() || '0')
      const progress = project.progress / 100 // Convert percentage to decimal
      
      // Calculate earned value (what should be claimed based on progress)
      const earnedValue = contractValue * progress
      
      // Calculate total claimed amount from customer
      const totalClaimed = project.CustomerInvoice.reduce((sum: number, invoice: any) => {
        return sum + parseFloat(invoice.amountPaid?.toString() || invoice.totalAmount?.toString() || '0')
      }, 0)
      
      // Calculate unclaimed amount
      const unclaimedAmount = earnedValue - totalClaimed
      
      // If unclaimed amount is more than 5% of contract value, create reminder
      const threshold = contractValue * 0.05 // 5% threshold
      
      if (unclaimedAmount > threshold && unclaimedAmount > 1000) { // At least $1000 unclaimed
        // Check if there's already a recent reminder (within last 7 days)
        const recentReminder = await prisma.projectNotification.findFirst({
          where: {
            projectId: project.id,
            type: 'PROJECT_INVOICE_REMINDER',
            isRead: false,
            isDismissed: false,
            createdAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
            }
          }
        })

        if (!recentReminder) {
          // Create notifications for project manager and salesperson
          const usersToNotify = []
          if (project.User_Project_managerIdToUser) usersToNotify.push(project.User_Project_managerIdToUser)
          if (project.User_Project_salespersonIdToUser && project.User_Project_salespersonIdToUser.id !== project.User_Project_managerIdToUser?.id) {
            usersToNotify.push(project.User_Project_salespersonIdToUser)
          }
          
          for (const user of usersToNotify) {
            const notification = await prisma.projectNotification.create({
              data: {
                id: uuidv4(),
                projectId: project.id,
                userId: user.id,
                type: 'PROJECT_INVOICE_REMINDER',
                message: `Project "${project.name}" (${project.projectNumber}): ${project.progress}% complete but only ${((totalClaimed / contractValue) * 100).toFixed(1)}% claimed. Unclaimed: $${unclaimedAmount.toFixed(2)}`,
                metadata: {
                  contractValue,
                  progress: project.progress,
                  earnedValue,
                  totalClaimed,
                  unclaimedAmount,
                  customerName: project.Customer.name
                },
                sentAt: new Date(),
                createdAt: new Date()
              }
            })
            
            reminders.push({
              projectId: project.id,
              projectName: project.name,
              projectNumber: project.projectNumber,
              userId: user.id,
              userName: user.name,
              unclaimedAmount,
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
    console.error('Error checking invoice reminders:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/projects/check-invoice-reminders
 * Get all project notifications for current user
 * NOTE: Reminders are shown every time, regardless of dismissed/read status
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch ALL notifications for the user, ignoring isRead and isDismissed
    // This ensures reminders are shown every time the user logs in
    const notifications = await prisma.projectNotification.findMany({
      where: {
        userId: session.user.id,
        type: 'PROJECT_INVOICE_REMINDER'
      },
      include: {
        Project: {
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
    console.error('Error fetching project notifications:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
