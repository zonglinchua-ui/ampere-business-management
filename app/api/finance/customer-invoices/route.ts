
/**
 * Customer Invoices API
 * Fetch and manage customer invoices (including Xero-synced invoices)
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export const dynamic = 'force-dynamic'

/**
 * GET /api/finance/customer-invoices
 * Fetch all customer invoices with optional filtering
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const user = session.user as any
    const userRole = user?.role || 'UNKNOWN'
    const allowedRoles = ['SUPERADMIN', 'FINANCE', 'PROJECT_MANAGER']

    if (!allowedRoles.includes(userRole)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Insufficient permissions',
          message: `You need Super Admin, Finance, or Project Manager role. Your current role: ${userRole}`
        },
        { status: 403 }
      )
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '10000') // Default to large page size to fetch all
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const customerId = searchParams.get('customerId') || ''
    const projectId = searchParams.get('projectId') || ''
    const isXeroSynced = searchParams.get('isXeroSynced')

    // Build where clause
    const where: any = {}

    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { Customer: { name: { contains: search, mode: 'insensitive' } } }
      ]
    }

    if (status && status !== 'all') {
      where.status = status
    }

    if (customerId && customerId !== 'all') {
      where.customerId = customerId
    }

    if (projectId && projectId !== 'all') {
      where.projectId = projectId
    }

    if (isXeroSynced !== null && isXeroSynced !== '') {
      where.isXeroSynced = isXeroSynced === 'true'
    }

    // Calculate pagination
    const skip = (page - 1) * pageSize

    // Fetch invoices and total count
    const [invoices, total] = await Promise.all([
      prisma.customerInvoice.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          Customer: {
            select: {
              id: true,
              name: true,
              email: true,
              customerNumber: true,
              xeroContactId: true
            }
          },
          Project: {
            select: {
              id: true,
              name: true,
              projectNumber: true
            }
          },
          Quotation: {
            select: {
              id: true,
              quotationNumber: true
            }
          },
          CustomerInvoiceItem: {
            orderBy: { order: 'asc' },
            select: {
              id: true,
              description: true,
              quantity: true,
              unitPrice: true,
              taxRate: true,
              subtotal: true,
              taxAmount: true,
              totalPrice: true,
              order: true
            }
          }
        },
        orderBy: {
          issueDate: 'desc'
        }
      }),
      prisma.customerInvoice.count({ where })
    ])

    console.log(`📊 Fetched ${invoices.length} customer invoices (page ${page}, total: ${total})`)

    // Transform invoices to include calculated fields
    const transformedInvoices = invoices.map((invoice: any) => {
      const dueDate = new Date(invoice.dueDate)
      const today = new Date()
      const isOverdue = dueDate < today && invoice.status !== 'PAID' && invoice.status !== 'CANCELLED'
      const daysPastDue = isOverdue ? Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)) : 0

      return {
        ...invoice,
        isOverdue,
        daysPastDue,
        type: 'ACCREC' as const, // Mark as receivable (money coming in)
        category: 'PAYMENT_IN' as const, // Explicit payment in category
        // Convert Decimal to number for JSON serialization
        subtotal: parseFloat(invoice.subtotal.toString()),
        taxAmount: invoice.taxAmount ? parseFloat(invoice.taxAmount.toString()) : 0,
        totalAmount: parseFloat(invoice.totalAmount.toString()),
        amountDue: invoice.amountDue ? parseFloat(invoice.amountDue.toString()) : parseFloat(invoice.totalAmount.toString()),
        amountPaid: invoice.amountPaid ? parseFloat(invoice.amountPaid.toString()) : 0,
        CustomerInvoiceItem: invoice.CustomerInvoiceItem?.map((item: any) => ({
          ...item,
          quantity: parseFloat(item.quantity.toString()),
          unitPrice: parseFloat(item.unitPrice.toString()),
          taxRate: item.taxRate ? parseFloat(item.taxRate.toString()) : 0,
          subtotal: parseFloat(item.subtotal.toString()),
          taxAmount: item.taxAmount ? parseFloat(item.taxAmount.toString()) : 0,
          totalPrice: parseFloat(item.totalPrice.toString())
        }))
      }
    })

    return NextResponse.json({
      success: true,
      invoices: transformedInvoices,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    })

  } catch (error: any) {
    console.error('❌ GET /api/finance/customer-invoices error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch customer invoices',
        message: error.message || 'An unexpected error occurred'
      },
      { status: 500 }
    )
  }
}
