
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { v4 as uuidv4 } from 'uuid'
import { generatePurchaseOrderHTML } from '@/lib/document-templates'


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
    const canExport = ["SUPERADMIN", "FINANCE"].includes(userRole || "")
    
    if (!canExport) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Fetch purchase order with all related data
    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id: params.id },
      include: {
        Supplier: true,
        Project: {
          select: {
            id: true,
            name: true,
            projectNumber: true
          }
        },
        User_PurchaseOrder_requesterIdToUser: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        },
        PurchaseOrderItem: {
          orderBy: {
            order: 'asc'
          }
        }
      }
    })

    if (!purchaseOrder) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
    }

    // Log export activity
    await prisma.purchaseOrderActivity.create({
      data: {
        id: uuidv4(),
        purchaseOrderId: params.id,
        action: 'EXPORTED',
        description: `Purchase Order exported by ${session.user?.firstName} ${session.user?.lastName}`,
        userId: session.user?.id || '',
        userEmail: session.user?.email || ''
      }
    })

    // Format data for template
    const formattedPO = {
      ...purchaseOrder,
      supplier: purchaseOrder.Supplier,
      project: purchaseOrder.Project,
      requester: purchaseOrder.User_PurchaseOrder_requesterIdToUser,
      items: purchaseOrder.PurchaseOrderItem
    }

    // Generate professional HTML document with letterhead
    const htmlContent = generatePurchaseOrderHTML(formattedPO)
    
    return new NextResponse(htmlContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/html',
        'Content-Disposition': `inline; filename="${purchaseOrder.poNumber}.html"`,
      },
    })

  } catch (error) {
    console.error('Error exporting purchase order:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
