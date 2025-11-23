
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = session?.user?.role
    const canAccessFinance = ["SUPERADMIN", "FINANCE", "PROJECT_MANAGER"].includes(userRole || "")
    
    if (!canAccessFinance) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Get pagination parameters
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '100')
    const skip = (page - 1) * pageSize

    console.log(`[Customer Invoices API] Fetching page ${page} with pageSize ${pageSize}`)

    // Get total count
    const totalCount = await prisma.customerInvoice.count()

    // Fetch customer invoices with pagination
    const clientInvoices = await prisma.customerInvoice.findMany({
      skip,
      take: pageSize,
      include: {
        Customer: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        Project: {
          select: {
            id: true,
            name: true,
            projectNumber: true
          }
        },
        CustomerInvoiceItem: {
          select: {
            id: true,
            description: true,
            quantity: true,
            unitPrice: true,
            totalPrice: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Ensure clientInvoices is an array
    const safeInvoices = Array.isArray(clientInvoices) ? clientInvoices : []

    const formattedInvoices = safeInvoices.map((invoice: any) => {
      const now = new Date()
      const dueDate = invoice?.dueDate
      const isOverdue = dueDate && invoice?.status !== 'PAID' && invoice?.status !== 'CANCELLED' && now > dueDate
      const daysPastDue = isOverdue && dueDate ? 
        Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)) : 0

      return {
        id: invoice?.id || '',
        invoiceNumber: invoice?.invoiceNumber || '',
        customer: {
          id: invoice?.Customer?.id || '',
          name: invoice?.Customer?.name || 'Unknown',
          email: invoice?.Customer?.email || ''
        },
        Customer: invoice?.Customer,
        project: invoice?.Project || null,
        Project: invoice?.Project,
        totalAmount: Number(invoice?.totalAmount) || 0,
        amount: Number(invoice?.totalAmount) || 0,
        amountDue: Number(invoice?.amountDue || invoice?.totalAmount) || 0,
        amountPaid: Number(invoice?.amountPaid) || 0,
        currency: invoice?.currency || 'SGD',
        issueDate: invoice?.issueDate?.toISOString() || null,
        dueDate: invoice?.dueDate?.toISOString() || null,
        paidDate: invoice?.paidDate?.toISOString() || null,
        status: invoice?.status || 'DRAFT',
        description: invoice?.description || '',
        notes: invoice?.notes || '',
        xeroInvoiceId: invoice?.xeroInvoiceId || null,
        xeroUrl: invoice?.xeroUrl || null,
        isXeroSynced: invoice?.isXeroSynced || false,
        isOverdue: Boolean(isOverdue),
        daysPastDue: daysPastDue > 0 ? daysPastDue : undefined,
        itemsCount: invoice?.CustomerInvoiceItem?.length || 0,
        type: 'ACCREC' as const, // Mark as receivable (money coming in)
        category: 'PAYMENT_IN' as const, // Explicit payment in category
        updatedAt: invoice?.updatedAt?.toISOString() || new Date().toISOString()
      }
    })

    console.log(`[Customer Invoices API] Returning ${formattedInvoices.length} of ${totalCount} invoices (page ${page})`)

    return NextResponse.json({
      success: true,
      invoices: formattedInvoices || [],
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize)
      }
    })

  } catch (error) {
    console.error('Error fetching client invoices:', error)
    // Return empty array with pagination to prevent .map() errors
    return NextResponse.json({
      success: false,
      invoices: [],
      pagination: {
        page: 1,
        pageSize: 100,
        totalCount: 0,
        totalPages: 0
      }
    })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = session?.user?.role
    const canCreateInvoice = ["SUPERADMIN", "FINANCE", "PROJECT_MANAGER"].includes(userRole || "")
    
    if (!canCreateInvoice) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const data = await request.json()
    console.log('Received client invoice creation request:', data)

    // Generate invoice number
    const currentYear = new Date().getFullYear()
    const yearPrefix = currentYear.toString()
    
    const lastInvoice = await prisma.customerInvoice.findFirst({
      where: {
        invoiceNumber: {
          contains: yearPrefix
        }
      },
      orderBy: {
        invoiceNumber: 'desc'
      }
    })

    let nextNumber = 1
    if (lastInvoice) {
      const match = lastInvoice.invoiceNumber.match(/INV-(\d+)-/)
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1
      }
    }

    const invoiceNumber = `INV-${nextNumber.toString().padStart(3, '0')}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`

    const clientInvoice = await prisma.customerInvoice.create({
      data: {
        id: `cinvoice_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        invoiceNumber,
        customerId: data.customerId,
        projectId: data.projectId || null,
        quotationId: data.quotationId || null,
        subtotal: parseFloat(data.subtotal) || 0,
        taxAmount: parseFloat(data.taxAmount) || 0,
        discountAmount: parseFloat(data.discountAmount) || 0,
        totalAmount: parseFloat(data.totalAmount) || 0,
        amountDue: parseFloat(data.totalAmount) || 0,
        amountPaid: 0,
        currency: data.currency || 'SGD',
        status: data.status || 'DRAFT',
        issueDate: data.issueDate ? new Date(data.issueDate) : new Date(),
        dueDate: data.dueDate ? new Date(data.dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        description: data.description,
        terms: data.terms,
        notes: data.notes,
        createdById: session.user?.id || '',
        updatedAt: new Date()
      }
    })

    return NextResponse.json({
      id: clientInvoice.id,
      invoiceNumber: clientInvoice.invoiceNumber,
      status: clientInvoice.status,
      amount: Number(clientInvoice.totalAmount),
      createdAt: clientInvoice.createdAt.toISOString()
    })

  } catch (error) {
    console.error('Error creating client invoice:', error)
    
    if (error instanceof Error) {
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
    }
    
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
