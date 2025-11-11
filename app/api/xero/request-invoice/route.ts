
/**
 * Request Invoice Creation in Xero
 * 
 * This endpoint creates a request for an admin to create an invoice in Xero.
 * Since Xero operates in pull-only mode, invoices cannot be automatically created.
 * Instead, this creates a task/notification for finance admins to manually create
 * the invoice in Xero, which will then be pulled into Ampere.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'

export const dynamic = 'force-dynamic'

/**
 * POST /api/xero/request-invoice
 * Create a request for invoice creation in Xero
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const userRole = (session.user as any).role
    if (!['SUPERADMIN', 'FINANCE', 'PROJECT_MANAGER'].includes(userRole)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      customerId,
      customerName,
      projectId,
      projectName,
      poNumber,
      totalAmount,
      currency = 'SGD',
      dueDate,
      description,
      lineItems = []
    } = body

    // Validation
    if (!customerName || !totalAmount) {
      return NextResponse.json(
        { error: 'Customer name and total amount are required' },
        { status: 400 }
      )
    }

    // Create Xero log for the request
    const logDetails = {
      customerId,
      customerName,
      projectId,
      projectName,
      poNumber,
      totalAmount,
      currency,
      dueDate,
      description,
      lineItems,
      requestedBy: session.user.email,
      requestedAt: new Date().toISOString()
    }

    await prisma.xero_logs.create({
      data: {
        id: uuidv4(),
        timestamp: new Date(),
        userId: session.user.id,
        direction: 'PUSH',
        entity: 'INVOICE_REQUEST',
        status: 'IN_PROGRESS',
        recordsProcessed: 1,
        recordsSucceeded: 0,
        recordsFailed: 0,
        message: `Invoice creation requested for ${customerName}`,
        duration: 0,
        details: JSON.stringify(logDetails),
        createdAt: new Date(),
        updatedAt: new Date()
      }
    })

    // Get all finance and superadmin users to notify
    const adminUsers = await prisma.user.findMany({
      where: {
        role: {
          in: ['SUPERADMIN', 'FINANCE']
        },
        isActive: true
      },
      select: {
        id: true,
        email: true,
        name: true
      }
    })

    // Create a task for each admin to handle the invoice request
    for (const admin of adminUsers) {
      const task = await prisma.task.create({
        data: {
          id: uuidv4(),
          title: `Create Invoice in Xero for ${customerName}`,
          description: `Invoice creation requested by ${session.user.email}\n\nCustomer: ${customerName}\nAmount: ${currency} ${parseFloat(totalAmount).toFixed(2)}\nProject: ${projectName || 'N/A'}\nPO: ${poNumber || 'N/A'}\n\nPlease create this invoice in Xero, then run "Sync from Xero" to pull it into Ampere.`,
          priority: 'HIGH',
          status: 'TODO',
          dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now if no due date
          assigneeId: admin.id,
          assignerId: session.user.id,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })

      // Create notification for the task
      await prisma.taskNotification.create({
        data: {
          id: uuidv4(),
          userId: admin.id,
          taskId: task.id,
          type: 'TASK_ASSIGNED',
          message: `🧾 Invoice creation requested for ${customerName} (${currency} ${parseFloat(totalAmount).toFixed(2)})`,
          isRead: false
        }
      })
    }

    return NextResponse.json({
      success: true,
      message: `Invoice creation request submitted successfully. Finance team will create the invoice in Xero.`,
      details: {
        customerName,
        totalAmount: parseFloat(totalAmount).toFixed(2),
        currency,
        notifiedAdmins: adminUsers.length,
        nextSteps: [
          'Finance team will review this request',
          'Invoice will be created in Xero manually',
          'Use "Sync from Xero" to pull the invoice into Ampere once created'
        ]
      }
    })

  } catch (error: any) {
    console.error('❌ Invoice request creation error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create invoice request' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/xero/request-invoice
 * Get all invoice creation requests
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const userRole = (session.user as any).role
    if (!['SUPERADMIN', 'FINANCE'].includes(userRole)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    // Fetch invoice requests from xero logs
    const requests = await prisma.xero_logs.findMany({
      where: {
        entity: 'INVOICE_REQUEST',
        status: {
          in: ['IN_PROGRESS', 'WARNING']
        }
      },
      orderBy: {
        timestamp: 'desc'
      },
      take: 50
    })

    return NextResponse.json({
      success: true,
      requests: requests.map(req => {
        let parsedDetails: any = {}
        try {
          parsedDetails = req.details ? JSON.parse(req.details) : {}
        } catch (e) {
          parsedDetails = {}
        }
        
        return {
          id: req.id,
          timestamp: req.timestamp,
          status: req.status,
          message: req.message,
          details: parsedDetails,
          requestedBy: parsedDetails.requestedBy || 'Unknown'
        }
      })
    })

  } catch (error: any) {
    console.error('❌ Invoice requests fetch error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch invoice requests' },
      { status: 500 }
    )
  }
}
