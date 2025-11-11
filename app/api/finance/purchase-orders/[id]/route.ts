
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getDefaultPOTerms } from '@/lib/po-default-terms'


export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = session?.user?.role
    const canAccessFinance = ["SUPERADMIN", "FINANCE"].includes(userRole || "")
    
    if (!canAccessFinance) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const poId = params.id

    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id: poId },
      include: {
        Supplier: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            address: true,
            contactPerson: true
          }
        },
        Project: {
          select: {
            id: true,
            name: true,
            projectNumber: true,
            status: true
          }
        },
        User_PurchaseOrder_requesterIdToUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        User_PurchaseOrder_createdByIdToUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        User_PurchaseOrder_approvedByIdToUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        PurchaseOrderItem: {
          orderBy: {
            order: 'asc'
          }
        },
        SupplierInvoice: {
          select: {
            id: true,
            invoiceNumber: true,
            status: true,
            totalAmount: true,
            invoiceDate: true
          }
        },
        PurchaseOrderActivity: {
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    })

    if (!purchaseOrder) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
    }

    const now = new Date()
    const deliveryDate = purchaseOrder.deliveryDate
    const isOverdue = deliveryDate && purchaseOrder.status !== 'COMPLETED' && purchaseOrder.status !== 'CANCELLED' && 
                     now > deliveryDate
    const daysPastDue = isOverdue && deliveryDate ? 
      Math.floor((now.getTime() - deliveryDate.getTime()) / (1000 * 60 * 60 * 24)) : 0

    const formattedPO = {
      id: purchaseOrder.id,
      poNumber: purchaseOrder.poNumber,
      supplier: purchaseOrder.Supplier,
      project: purchaseOrder.Project,
      requester: purchaseOrder.User_PurchaseOrder_requesterIdToUser ? {
        id: purchaseOrder.User_PurchaseOrder_requesterIdToUser.id,
        name: `${purchaseOrder.User_PurchaseOrder_requesterIdToUser.firstName} ${purchaseOrder.User_PurchaseOrder_requesterIdToUser.lastName}`,
        email: purchaseOrder.User_PurchaseOrder_requesterIdToUser.email
      } : null,
      subtotal: Number(purchaseOrder.subtotal),
      taxAmount: Number(purchaseOrder.taxAmount) || 0,
      totalAmount: Number(purchaseOrder.totalAmount),
      currency: purchaseOrder.currency,
      status: purchaseOrder.status,
      issueDate: purchaseOrder.issueDate?.toISOString() || null,
      deliveryDate: purchaseOrder.deliveryDate?.toISOString() || null,
      terms: purchaseOrder.terms,
      notes: purchaseOrder.notes,
      isXeroSynced: purchaseOrder.isXeroSynced,
      xeroOrderId: purchaseOrder.xeroOrderId,
      lastXeroSync: purchaseOrder.lastXeroSync?.toISOString() || null,
      createdBy: purchaseOrder.User_PurchaseOrder_createdByIdToUser ? {
        id: purchaseOrder.User_PurchaseOrder_createdByIdToUser.id,
        name: `${purchaseOrder.User_PurchaseOrder_createdByIdToUser.firstName} ${purchaseOrder.User_PurchaseOrder_createdByIdToUser.lastName}`
      } : null,
      approvedBy: purchaseOrder.User_PurchaseOrder_approvedByIdToUser ? {
        id: purchaseOrder.User_PurchaseOrder_approvedByIdToUser.id,
        name: `${purchaseOrder.User_PurchaseOrder_approvedByIdToUser.firstName} ${purchaseOrder.User_PurchaseOrder_approvedByIdToUser.lastName}`
      } : null,
      createdAt: purchaseOrder.createdAt.toISOString(),
      updatedAt: purchaseOrder.updatedAt.toISOString(),
      approvedAt: purchaseOrder.approvedAt?.toISOString() || null,
      items: purchaseOrder.PurchaseOrderItem.map((item: any) => ({
        id: item.id,
        description: item.description,
        category: item.category,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        discount: Number(item.discount) || 0,
        taxRate: Number(item.taxRate) || 0,
        subtotal: Number(item.subtotal),
        discountAmount: Number(item.discountAmount) || 0,
        taxAmount: Number(item.taxAmount) || 0,
        totalPrice: Number(item.totalPrice),
        unit: item.unit,
        notes: item.notes,
        order: item.order
      })),
      supplierInvoices: purchaseOrder.SupplierInvoice.map((invoice: any) => ({
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
        totalAmount: Number(invoice.totalAmount),
        invoiceDate: invoice.invoiceDate.toISOString()
      })),
      activities: purchaseOrder.PurchaseOrderActivity,
      isOverdue: Boolean(isOverdue),
      daysPastDue: daysPastDue > 0 ? daysPastDue : undefined
    }

    return NextResponse.json(formattedPO)

  } catch (error) {
    console.error('Error fetching purchase order:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = session?.user?.role
    const canEditPO = ["SUPERADMIN", "PROJECT_MANAGER"].includes(userRole || "")
    
    if (!canEditPO) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const poId = params.id
    const data = await request.json()

    // Check if PO exists and is editable
    const existingPO = await prisma.purchaseOrder.findUnique({
      where: { id: poId }
    })

    if (!existingPO) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
    }

    // Only allow editing of DRAFT and SUBMITTED status POs
    if (!['DRAFT', 'SUBMITTED'].includes(existingPO.status)) {
      return NextResponse.json({ 
        error: 'Can only edit purchase orders in DRAFT or SUBMITTED status' 
      }, { status: 400 })
    }

    const updatedPO = await prisma.purchaseOrder.update({
      where: { id: poId },
      data: {
        supplierId: data.supplierId,
        projectId: data.projectId,
        subtotal: data.subtotal,
        taxAmount: data.taxAmount,
        totalAmount: data.totalAmount,
        deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : undefined,
        terms: data.terms || getDefaultPOTerms(), // Use default terms if not provided
        notes: data.notes
      }
    })

    return NextResponse.json({
      id: updatedPO.id,
      poNumber: updatedPO.poNumber,
      status: updatedPO.status,
      totalAmount: Number(updatedPO.totalAmount),
      updatedAt: updatedPO.updatedAt.toISOString()
    })

  } catch (error) {
    console.error('Error updating purchase order:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
