
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/db'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params

    const invoice = await prisma.supplierInvoice.findUnique({
      where: { id },
      include: {
        Supplier: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            contactPerson: true,
          },
        },
        Project: {
          select: {
            id: true,
            name: true,
            projectNumber: true,
          },
        },
        PurchaseOrder: {
          select: {
            id: true,
            poNumber: true,
            totalAmount: true,
          },
        },
        User_SupplierInvoice_createdByIdToUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        User_SupplierInvoice_projectApprovedByIdToUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        User_SupplierInvoice_financeApprovedByIdToUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        SupplierInvoiceItem: {
          orderBy: {
            order: 'asc',
          },
          include: {
            BudgetCategory: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
        SupplierInvoiceActivity: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 10,
        },
      },
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Transform the data to match frontend expectations
    const transformedInvoice = {
      ...invoice,
      items: invoice.SupplierInvoiceItem || [],
      activities: invoice.SupplierInvoiceActivity || [],
      CreatedBy: invoice.User_SupplierInvoice_createdByIdToUser,
      ProjectApprovedBy: invoice.User_SupplierInvoice_projectApprovedByIdToUser,
      FinanceApprovedBy: invoice.User_SupplierInvoice_financeApprovedByIdToUser,
    }

    return NextResponse.json(transformedInvoice)
  } catch (error) {
    console.error('❌ Error fetching supplier invoice:', error)
    return NextResponse.json(
      { error: 'Failed to fetch supplier invoice' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, role: true },
    })

    if (!user || !['SUPERADMIN', 'PROJECT_MANAGER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = params

    // Check if invoice exists and is not synced to Xero
    const invoice = await prisma.supplierInvoice.findUnique({
      where: { id },
      select: {
        id: true,
        invoiceNumber: true,
        isXeroSynced: true,
        status: true,
      },
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    if (invoice.isXeroSynced) {
      return NextResponse.json(
        { error: 'Cannot delete invoice that has been synced to Xero' },
        { status: 400 }
      )
    }

    // Delete the invoice (cascade will delete related items and activities)
    await prisma.supplierInvoice.delete({
      where: { id },
    })

    console.log(`✅ Deleted supplier invoice: ${invoice.invoiceNumber}`)

    return NextResponse.json({
      success: true,
      message: 'Supplier invoice deleted successfully',
    })
  } catch (error) {
    console.error('❌ Error deleting supplier invoice:', error)
    return NextResponse.json(
      { error: 'Failed to delete supplier invoice' },
      { status: 500 }
    )
  }
}
