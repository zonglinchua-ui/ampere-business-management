
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// GET /api/finance/unsynced-invoices
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only SUPERADMIN, FINANCE, and PROJECT_MANAGER can access
    const allowedRoles = ['SUPERADMIN', 'FINANCE', 'PROJECT_MANAGER']
    if (!allowedRoles.includes(session.user?.role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Fetch customer invoices with projectId that haven't been synced to Xero
    const customerInvoices = await prisma.customerInvoice.findMany({
      where: {
        projectId: {
          not: null
        },
        status: 'DRAFT',
        isXeroSynced: false,
      },
      include: {
        Customer: {
          select: {
            id: true,
            name: true,
            email: true,
            customerNumber: true,
          },
        },
        Project: {
          select: {
            id: true,
            name: true,
            projectNumber: true,
          },
        },
        CustomerInvoiceItem: {
          orderBy: {
            order: 'asc'
          }
        },
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Fetch supplier invoices with projectId that haven't been synced to Xero
    const supplierInvoices = await prisma.supplierInvoice.findMany({
      where: {
        projectId: {
          not: null
        },
        isXeroSynced: false,
      },
      include: {
        Supplier: {
          select: {
            id: true,
            name: true,
            email: true,
            supplierNumber: true,
          },
        },
        Project: {
          select: {
            id: true,
            name: true,
            projectNumber: true,
          },
        },
        SupplierInvoiceItem: {
          orderBy: {
            order: 'asc'
          }
        },
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Calculate totals
    const totalCustomerAmount = customerInvoices.reduce((sum, inv) => sum + parseFloat(inv.totalAmount.toString()), 0)
    const totalSupplierAmount = supplierInvoices.reduce((sum, inv) => sum + parseFloat(inv.totalAmount.toString()), 0)
    const totalAmount = totalCustomerAmount + totalSupplierAmount
    const totalInvoices = customerInvoices.length + supplierInvoices.length

    // Map customer invoices to a unified format
    const formattedCustomerInvoices = customerInvoices.map(inv => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      type: 'CUSTOMER' as const,
      party: {
        id: inv.Customer.id,
        name: inv.Customer.name,
        email: inv.Customer.email,
        number: inv.Customer.customerNumber,
      },
      project: inv.Project ? {
        id: inv.Project.id,
        name: inv.Project.name,
        projectNumber: inv.Project.projectNumber,
      } : null,
      subtotal: parseFloat(inv.subtotal.toString()),
      taxAmount: inv.taxAmount ? parseFloat(inv.taxAmount.toString()) : null,
      totalAmount: parseFloat(inv.totalAmount.toString()),
      currency: inv.currency,
      issueDate: inv.issueDate.toISOString(),
      dueDate: inv.dueDate.toISOString(),
      description: inv.description,
      status: inv.status,
      createdAt: inv.createdAt.toISOString(),
      items: inv.CustomerInvoiceItem || []
    }))

    // Map supplier invoices to a unified format
    const formattedSupplierInvoices = supplierInvoices.map(inv => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      type: 'SUPPLIER' as const,
      party: {
        id: inv.Supplier.id,
        name: inv.Supplier.name,
        email: inv.Supplier.email,
        number: inv.Supplier.supplierNumber,
      },
      project: inv.Project ? {
        id: inv.Project.id,
        name: inv.Project.name,
        projectNumber: inv.Project.projectNumber,
      } : null,
      subtotal: parseFloat(inv.subtotal.toString()),
      taxAmount: inv.taxAmount ? parseFloat(inv.taxAmount.toString()) : null,
      totalAmount: parseFloat(inv.totalAmount.toString()),
      currency: inv.currency,
      issueDate: inv.invoiceDate.toISOString(),
      dueDate: inv.dueDate.toISOString(),
      description: inv.description,
      status: inv.status,
      createdAt: inv.createdAt.toISOString(),
      items: inv.SupplierInvoiceItem || []
    }))

    // Combine and sort by creation date
    const allInvoices = [...formattedCustomerInvoices, ...formattedSupplierInvoices]
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return NextResponse.json({
      success: true,
      invoices: allInvoices,
      summary: {
        totalInvoices,
        totalAmount,
        customerInvoices: {
          count: customerInvoices.length,
          amount: totalCustomerAmount
        },
        supplierInvoices: {
          count: supplierInvoices.length,
          amount: totalSupplierAmount
        },
        currency: 'SGD'
      }
    })
  } catch (error: any) {
    console.error('GET /api/finance/unsynced-invoices error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'
