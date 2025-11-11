
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

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
    const pageSize = parseInt(searchParams.get('pageSize') || '10000') // Default to large page size to fetch all
    const skip = (page - 1) * pageSize

    console.log(`[Supplier Invoices API] Fetching page ${page} with pageSize ${pageSize}`)

    // Get total count
    const totalCount = await prisma.supplierInvoice.count()

    // Fetch supplier invoices with pagination
    const supplierInvoices = await prisma.supplierInvoice.findMany({
      skip,
      take: pageSize,
      include: {
        Supplier: {
          select: {
            id: true,
            name: true,
            email: true,
            supplierNumber: true
          }
        },
        Project: {
          select: {
            id: true,
            name: true,
            projectNumber: true
          }
        },
        SupplierInvoiceItem: {
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

    // Ensure supplierInvoices is an array
    const safeInvoices = Array.isArray(supplierInvoices) ? supplierInvoices : []

    const formattedInvoices = safeInvoices.map((invoice: any) => {
      const now = new Date()
      const dueDate = invoice?.dueDate
      const isOverdue = dueDate && invoice?.status !== 'PAID' && invoice?.status !== 'CANCELLED' && now > dueDate
      const daysPastDue = isOverdue && dueDate ? 
        Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)) : 0

      return {
        id: invoice?.id || '',
        invoiceNumber: invoice?.invoiceNumber || '',
        supplierInvoiceRef: invoice?.supplierInvoiceRef || '',
        supplier: {
          id: invoice?.Supplier?.id || '',
          name: invoice?.Supplier?.name || 'Unknown',
          email: invoice?.Supplier?.email || '',
          supplierNumber: invoice?.Supplier?.supplierNumber || ''
        },
        Supplier: invoice?.Supplier,
        supplierName: invoice?.Supplier?.name || 'Unknown',
        project: invoice?.Project || null,
        Project: invoice?.Project,
        projectName: invoice?.Project?.name || null,
        amount: Number(invoice?.totalAmount) || 0,
        currency: invoice?.currency || 'SGD',
        issueDate: invoice?.invoiceDate?.toISOString() || null,
        dueDate: invoice?.dueDate?.toISOString() || null,
        paidDate: invoice?.paidDate?.toISOString() || null,
        receivedDate: invoice?.receivedDate?.toISOString() || null,
        status: invoice?.status || 'DRAFT',
        description: invoice?.description || '',
        notes: invoice?.notes || '',
        xeroInvoiceId: invoice?.xeroInvoiceId || null,
        xeroUrl: invoice?.xeroUrl || null,
        isXeroSynced: invoice?.isXeroSynced || false,
        isOverdue: Boolean(isOverdue),
        daysPastDue: daysPastDue > 0 ? daysPastDue : undefined,
        itemsCount: invoice?.SupplierInvoiceItem?.length || 0,
        type: 'ACCPAY' as const, // Mark as payable (money going out)
        category: 'PAYMENT_OUT' as const, // Explicit payment out category
        purchaseOrderId: invoice?.purchaseOrderId || null,
        poNumber: invoice?.poNumber || null,
        updatedAt: invoice?.updatedAt?.toISOString() || new Date().toISOString()
      }
    })

    console.log(`[Supplier Invoices API] Returning ${formattedInvoices.length} of ${totalCount} invoices (page ${page})`)

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
    console.error('Error fetching supplier invoices:', error)
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
    console.log('Received supplier invoice creation request:', data)

    // Generate invoice number
    const currentYear = new Date().getFullYear()
    const yearPrefix = currentYear.toString()
    
    const lastInvoice = await prisma.supplierInvoice.findFirst({
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
      const match = lastInvoice.invoiceNumber.match(/SINV-(\d+)-/)
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1
      }
    }

    const invoiceNumber = `SINV-${nextNumber.toString().padStart(3, '0')}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`

    const supplierInvoice = await prisma.supplierInvoice.create({
      data: {
        id: `sinvoice_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        invoiceNumber,
        supplierId: data.supplierId,
        projectId: data.projectId || null,
        purchaseOrderId: data.purchaseOrderId || null,
        supplierInvoiceRef: data.supplierInvoiceRef || null,
        subtotal: parseFloat(data.subtotal) || 0,
        taxAmount: parseFloat(data.taxAmount) || null,
        totalAmount: parseFloat(data.totalAmount) || 0,
        currency: data.currency || 'SGD',
        status: data.status || 'DRAFT',
        invoiceDate: data.invoiceDate ? new Date(data.invoiceDate) : new Date(),
        dueDate: data.dueDate ? new Date(data.dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        description: data.description,
        notes: data.notes,
        createdById: session.user?.id || '',
        updatedAt: new Date()
      }
    })

    return NextResponse.json({
      id: supplierInvoice.id,
      invoiceNumber: supplierInvoice.invoiceNumber,
      status: supplierInvoice.status,
      amount: Number(supplierInvoice.totalAmount),
      createdAt: supplierInvoice.createdAt.toISOString()
    })

  } catch (error) {
    console.error('Error creating supplier invoice:', error)
    
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
