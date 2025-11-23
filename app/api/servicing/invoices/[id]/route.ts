
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'


// GET /api/servicing/invoices/[id] - Get invoice by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = session.user?.role
    const canView = ["SUPERADMIN", "ADMIN", "PROJECT_MANAGER", "FINANCE"].includes(userRole || "")
    
    if (!canView) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const invoice = await prisma.serviceInvoice.findUnique({
      where: { id: params.id },
      include: {
        ServiceJob: {
          include: {
            ServiceContract: {
              select: {
                id: true,
                contractNo: true,
                serviceType: true
              }
            },
            Customer: {
              select: {
                id: true,
                name: true,
                customerNumber: true,
                email: true,
                phone: true
              }
            },
            Project: {
              select: {
                id: true,
                projectNumber: true,
                name: true
              }
            }
          }
        }
      }
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Service invoice not found' }, { status: 404 })
    }

    return NextResponse.json(invoice)

  } catch (error) {
    console.error('Error fetching service invoice:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/servicing/invoices/[id] - Update invoice (approval, status, sync to Xero)
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = session.user?.role
    const data = await request.json()

    // Check permissions based on what's being updated
    const canUpdateStatus = ["SUPERADMIN", "ADMIN", "PROJECT_MANAGER", "FINANCE"].includes(userRole || "")
    const canApprove = ["SUPERADMIN", "ADMIN", "FINANCE"].includes(userRole || "")
    const canSyncXero = ["SUPERADMIN", "ADMIN", "FINANCE"].includes(userRole || "")

    // Validate permissions for specific operations
    if (data.status && !canUpdateStatus) {
      return NextResponse.json({ error: 'Insufficient permissions to update invoice status' }, { status: 403 })
    }

    if ((data.status === 'Approved' || data.status === 'Rejected') && !canApprove) {
      return NextResponse.json({ error: 'Insufficient permissions to approve/reject invoices' }, { status: 403 })
    }

    if (data.xeroId && !canSyncXero) {
      return NextResponse.json({ error: 'Insufficient permissions to sync with Xero' }, { status: 403 })
    }

    // Prepare update data
    const updateData: any = {
      updatedAt: new Date()
    }

    if (data.status !== undefined) updateData.status = data.status
    if (data.amount !== undefined) updateData.amount = parseFloat(data.amount)
    if (data.xeroId !== undefined) updateData.xeroId = data.xeroId
    if (data.filePath !== undefined) updateData.filePath = data.filePath

    const invoice = await prisma.serviceInvoice.update({
      where: { id: params.id },
      data: updateData,
      include: {
        ServiceJob: {
          include: {
            ServiceContract: {
              select: {
                id: true,
                contractNo: true,
                serviceType: true
              }
            },
            Customer: {
              select: {
                id: true,
                name: true,
                customerNumber: true,
                email: true,
                phone: true
              }
            },
            Project: {
              select: {
                id: true,
                projectNumber: true,
                name: true
              }
            }
          }
        }
      }
    })

    // Here you would implement Xero sync logic if xeroId is provided
    if (data.xeroId && data.syncToXero) {
      // TODO: Implement Xero API integration
      console.log(`Would sync invoice ${invoice.invoiceNo} to Xero with ID ${data.xeroId}`)
    }

    return NextResponse.json(invoice)

  } catch (error) {
    console.error('Error updating service invoice:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/servicing/invoices/[id] - Delete invoice
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = session.user?.role
    const canDelete = ["SUPERADMIN", "ADMIN"].includes(userRole || "")
    
    if (!canDelete) {
      return NextResponse.json({ error: 'Insufficient permissions to delete invoices' }, { status: 403 })
    }

    // Check if invoice is in a state that allows deletion
    const invoice = await prisma.serviceInvoice.findUnique({
      where: { id: params.id },
      select: { status: true }
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Service invoice not found' }, { status: 404 })
    }

    if (!['Draft', 'Rejected'].includes(invoice.status)) {
      return NextResponse.json({ 
        error: 'Can only delete invoices in Draft or Rejected status' 
      }, { status: 400 })
    }

    await prisma.serviceInvoice.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ message: 'Service invoice deleted successfully' })

  } catch (error) {
    console.error('Error deleting service invoice:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
