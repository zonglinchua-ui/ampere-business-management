

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

interface ActivityItem {
  id: string
  type: 'project' | 'invoice' | 'quotation' | 'general'
  action: string
  description: string
  date: string
  entityId?: string
  entityName?: string
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const customerId = params.id
    
    // Verify customer exists
    const customer = await prisma.customer.findUnique({
      where: {
        id: customerId,
        isActive: true,
      },
    })

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 })
    }

    const activities: ActivityItem[] = []

    // Get project activities (using project creation and updates as activities)
    const projects = await prisma.project.findMany({
      where: {
        customerId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    projects.forEach((project: any) => {
      // Project created activity
      activities.push({
        id: `project-created-${project.id}`,
        type: 'project',
        action: 'PROJECT_CREATED',
        description: `Project "${project.name}" was created`,
        date: project.createdAt.toISOString(),
        entityId: project.id,
        entityName: project.name,
      })

      // If project was updated after creation, add update activity
      if (project.updatedAt && project.updatedAt.getTime() > project.createdAt.getTime()) {
        activities.push({
          id: `project-updated-${project.id}`,
          type: 'project',
          action: 'PROJECT_UPDATED',
          description: `Project "${project.name}" was updated (Status: ${project.status})`,
          date: project.updatedAt.toISOString(),
          entityId: project.id,
          entityName: project.name,
        })
      }
    })

    // Get quotation activities
    const quotationActivities = await prisma.quotationActivity.findMany({
      where: {
        Quotation: {
          customerId,
        },
      },
      include: {
        Quotation: {
          select: {
            id: true,
            quotationNumber: true,
            title: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50, // Limit to recent activities
    })

    quotationActivities.forEach((activity: any) => {
      activities.push({
        id: `quotation-${activity.id}`,
        type: 'quotation',
        action: activity.action,
        description: activity.description || `Quotation ${activity.Quotation.quotationNumber}: ${activity.action}`,
        date: activity.createdAt.toISOString(),
        entityId: activity.Quotation.id,
        entityName: activity.Quotation.quotationNumber,
      })
    })

    // Get invoice activities (using invoice creation and status changes as activities)
    const invoices = await prisma.customerInvoice.findMany({
      where: {
        customerId,
      },
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        totalAmount: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    invoices.forEach((invoice: any) => {
      // Invoice created activity
      activities.push({
        id: `invoice-created-${invoice.id}`,
        type: 'invoice',
        action: 'INVOICE_CREATED',
        description: `Invoice ${invoice.invoiceNumber} created for $${invoice.totalAmount}`,
        date: invoice.createdAt.toISOString(),
        entityId: invoice.id,
        entityName: invoice.invoiceNumber,
      })

      // Add status-based activities
      if (invoice.status === 'PAID') {
        activities.push({
          id: `invoice-paid-${invoice.id}`,
          type: 'invoice',
          action: 'INVOICE_PAID',
          description: `Invoice ${invoice.invoiceNumber} has been paid ($${invoice.totalAmount})`,
          date: invoice.updatedAt.toISOString(),
          entityId: invoice.id,
          entityName: invoice.invoiceNumber,
        })
      } else if (invoice.status === 'OVERDUE') {
        activities.push({
          id: `invoice-overdue-${invoice.id}`,
          type: 'invoice',
          action: 'INVOICE_OVERDUE',
          description: `Invoice ${invoice.invoiceNumber} is overdue ($${invoice.totalAmount})`,
          date: invoice.updatedAt.toISOString(),
          entityId: invoice.id,
          entityName: invoice.invoiceNumber,
        })
      }
    })

    // Get general audit logs for this client
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        entityType: 'CUSTOMER',
        entityId: customerId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 20,
    })

    auditLogs.forEach((log: any) => {
      activities.push({
        id: `audit-${log.id}`,
        type: 'general',
        action: log.action,
        description: log.action === 'UPDATE' 
          ? `Customer information was updated`
          : `Customer ${log.action.toLowerCase()}`,
        date: log.createdAt.toISOString(),
      })
    })

    // Sort all activities by date (newest first)
    activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    // Take only the most recent 100 activities
    const recentActivities = activities.slice(0, 100)

    return NextResponse.json({ activities: recentActivities })
  } catch (error) {
    console.error("GET /api/customers/[id]/activities error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export const dynamic = "force-dynamic"

