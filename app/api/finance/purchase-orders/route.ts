
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { generateAndStorePOPDF } from '@/lib/po-pdf-utils'
import { getDefaultPOTerms } from '@/lib/po-default-terms'


export async function GET(req: NextRequest) {
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

    // Extract query parameters
    const { searchParams } = new URL(req.url)
    const supplierId = searchParams.get("supplierId") || ""
    const customerId = searchParams.get("customerId") || ""
    const projectId = searchParams.get("projectId") || ""
    const type = searchParams.get("type") || "" // 'OUTGOING', 'INCOMING', or empty for all

    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where: {
        ...(supplierId && { supplierId }),
        ...(customerId && { customerId }),
        ...(projectId && { projectId }),
        ...(type && { type: type as 'OUTGOING' | 'INCOMING' }),
      },
      include: {
        Supplier: {
          select: {
            id: true,
            name: true
          }
        },
        Customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        },
        Project: {
          select: {
            id: true,
            name: true,
            projectNumber: true
          }
        },
        User_PurchaseOrder_requesterIdToUser: {
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
          select: {
            id: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    const formattedPOs = purchaseOrders.map((po: any) => {
      const now = new Date()
      const deliveryDate = po.deliveryDate
      const isOverdue = deliveryDate && po.status !== 'COMPLETED' && po.status !== 'CANCELLED' && 
                       now > deliveryDate
      const daysPastDue = isOverdue && deliveryDate ? 
        Math.floor((now.getTime() - deliveryDate.getTime()) / (1000 * 60 * 60 * 24)) : 0

      return {
        id: po.id,
        poNumber: po.poNumber,
        type: po.type,
        supplier: po.Supplier ? {
          id: po.Supplier.id,
          name: po.Supplier.name,
          companyName: po.Supplier.name
        } : null,
        customer: po.Customer ? {
          id: po.Customer.id,
          name: po.Customer.name,
          email: po.Customer.email,
          phone: po.Customer.phone
        } : null,
        // Keep 'vendor' for backward compatibility (will be supplier for outgoing POs)
        vendor: po.Supplier ? {
          id: po.Supplier.id,
          name: po.Supplier.name,
          companyName: po.Supplier.name
        } : null,
        project: po.Project ? {
          id: po.Project.id,
          name: po.Project.name,
          projectNumber: po.Project.projectNumber
        } : null,
        requester: {
          id: po.User_PurchaseOrder_requesterIdToUser.id,
          firstName: po.User_PurchaseOrder_requesterIdToUser.firstName,
          lastName: po.User_PurchaseOrder_requesterIdToUser.lastName
        },
        subtotal: Number(po.subtotal),
        taxAmount: Number(po.taxAmount) || 0,
        totalAmount: Number(po.totalAmount),
        currency: po.currency,
        status: po.status,
        issueDate: po.issueDate?.toISOString() || null,
        deliveryDate: po.deliveryDate?.toISOString() || null,
        deliveryAddress: po.deliveryAddress,
        terms: po.terms,
        notes: po.notes,
        documentPath: po.documentPath,
        approvedBy: po.User_PurchaseOrder_approvedByIdToUser ? {
          id: po.User_PurchaseOrder_approvedByIdToUser.id,
          firstName: po.User_PurchaseOrder_approvedByIdToUser.firstName,
          lastName: po.User_PurchaseOrder_approvedByIdToUser.lastName
        } : null,
        approvedAt: po.approvedAt?.toISOString() || null,
        createdAt: po.createdAt.toISOString(),
        updatedAt: po.updatedAt.toISOString(),
        itemsCount: po.PurchaseOrderItem.length,
        isOverdue: Boolean(isOverdue),
        daysPastDue: daysPastDue > 0 ? daysPastDue : undefined
      }
    })

    return NextResponse.json(formattedPOs)

  } catch (error) {
    console.error('Error fetching purchase orders:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = session?.user?.role
    const canCreatePO = ["SUPERADMIN", "PROJECT_MANAGER"].includes(userRole || "")
    
    if (!canCreatePO) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const data = await request.json()
    console.log('Received PO creation request:', data)

    // Generate PO number
    const currentYear = new Date().getFullYear()
    const yearPrefix = currentYear.toString()
    
    // Find the last PO number for this year
    const lastPO = await prisma.purchaseOrder.findFirst({
      where: {
        poNumber: {
          contains: yearPrefix
        }
      },
      orderBy: {
        poNumber: 'desc'
      }
    })

    let nextNumber = 1
    if (lastPO) {
      // Extract number from PO format (e.g., PO-001-VEN-20240315)
      const match = lastPO.poNumber.match(/PO-(\d+)-/)
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1
      }
    }

    const poNumber = `PO-${nextNumber.toString().padStart(3, '0')}-${data.vendorCode || 'GEN'}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`

    // Validate based on PO type
    const poType = data.type || 'OUTGOING'
    if (poType === 'OUTGOING' && !data.supplierId) {
      return NextResponse.json({ error: 'Supplier is required for outgoing POs' }, { status: 400 })
    }
    if (poType === 'INCOMING' && !data.customerId) {
      return NextResponse.json({ error: 'Customer is required for incoming POs' }, { status: 400 })
    }

    const purchaseOrder = await prisma.$transaction(async (tx: any) => {
      // Create the purchase order
      const po = await tx.purchaseOrder.create({
        data: {
          id: `po_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
          poNumber,
          type: poType,
          supplierId: poType === 'OUTGOING' ? data.supplierId : null,
          customerId: poType === 'INCOMING' ? data.customerId : null,
          projectId: data.projectId,
          requesterId: session.user?.id,
          subtotal: data.subtotal || 0,
          taxAmount: data.taxAmount || 0,
          totalAmount: data.totalAmount || 0,
          currency: data.currency || 'SGD',
          status: data.status || 'DRAFT',
          issueDate: data.issueDate ? new Date(data.issueDate) : null,
          deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : null,
          deliveryAddress: data.deliveryAddress,
          terms: data.terms || getDefaultPOTerms(), // Use default terms if not provided
          notes: data.notes,
          documentPath: data.documentPath,
          createdById: session.user?.id,
          updatedAt: new Date()
        }
      })

      // Create purchase order items if provided
      if (data.items && data.items.length > 0) {
        await tx.purchaseOrderItem.createMany({
          data: data.items.map((item: any, index: number) => ({
            id: `${po.id}_item_${index + 1}`,
            purchaseOrderId: po.id,
            description: item.description,
            category: item.category || 'MATERIALS',
            quantity: item.quantity || 0,
            unitPrice: item.unitPrice || 0,
            discount: item.discount || 0,
            taxRate: item.taxRate || 0,
            subtotal: item.subtotal || 0,
            discountAmount: item.discountAmount || 0,
            taxAmount: item.taxAmount || 0,
            totalPrice: item.totalPrice || 0,
            unit: item.unit || 'pcs',
            notes: item.notes || '',
            order: item.order || index + 1
          }))
        })
      }

      // Log activity
      await tx.purchaseOrderActivity.create({
        data: {
          id: `${po.id}_activity_created`,
          purchaseOrderId: po.id,
          action: 'CREATED',
          description: `Purchase Order created by ${session.user?.firstName} ${session.user?.lastName}`,
          userId: session.user?.id || '',
          userEmail: session.user?.email || ''
        }
      })

      return po
    })

    // Generate PDF and Excel documents in the background (don't wait for it)
    // Fetch full PO data with relationships for PDF generation
    const fullPO = await prisma.purchaseOrder.findUnique({
      where: { id: purchaseOrder.id },
      include: {
        Supplier: {
          select: {
            name: true,
            email: true,
            phone: true,
            address: true,
            city: true,
            state: true,
            postalCode: true,
            country: true
          }
        },
        Customer: {
          select: {
            name: true,
            email: true,
            phone: true,
            address: true,
            city: true,
            state: true,
            postalCode: true,
            country: true
          }
        },
        Project: {
          select: {
            id: true,
            name: true,
            projectNumber: true
          }
        },
        PurchaseOrderItem: {
          orderBy: {
            order: 'asc'
          }
        }
      }
    })

    if (fullPO) {
      // Generate documents asynchronously (don't wait for completion)
      generateAndStorePOPDF({
        id: fullPO.id,
        poNumber: fullPO.poNumber,
        type: fullPO.type,
        subtotal: Number(fullPO.subtotal),
        taxAmount: fullPO.taxAmount ? Number(fullPO.taxAmount) : null,
        
        totalAmount: Number(fullPO.totalAmount),
        currency: fullPO.currency,
        issueDate: fullPO.issueDate || new Date(),
        deliveryDate: fullPO.deliveryDate,
        terms: fullPO.terms,
        notes: fullPO.notes,
        supplier: fullPO.Supplier || undefined,
        customer: fullPO.Customer || undefined,
        project: fullPO.Project || undefined,
        items: fullPO.PurchaseOrderItem.map((item: any) => ({
          serialNumber: item.serialNumber,
          description: item.description,
          category: item.category,
          quantity: Number(item.quantity),
          unit: item.unit,
          unitPrice: Number(item.unitPrice),
          discount: Number(item.discount || 0),
          taxRate: Number(item.taxRate || 0),
          totalPrice: Number(item.totalPrice)
        }))
      }, session.user?.id || '').catch(error => {
        console.error('❌ Error generating PO documents in background:', error)
      })
    }

    return NextResponse.json({
      id: purchaseOrder.id,
      poNumber: purchaseOrder.poNumber,
      status: purchaseOrder.status,
      totalAmount: Number(purchaseOrder.totalAmount),
      createdAt: purchaseOrder.createdAt.toISOString()
    })

  } catch (error) {
    console.error('Error creating purchase order:', error)
    
    // More detailed error logging
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
