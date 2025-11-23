
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { v4 as uuidv4 } from 'uuid'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = session.user.role
    const userId = session.user.id
    const userEmail = session.user.email || ''

    // Only SUPERADMIN can approve purchase orders
    if (userRole !== 'SUPERADMIN') {
      return NextResponse.json(
        { error: 'Only Super Admins can approve purchase orders' },
        { status: 403 }
      )
    }

    const poId = params.id

    // Fetch PO with items and project
    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id: poId },
      include: {
        PurchaseOrderItem: true,
        Project: {
          select: {
            id: true,
            name: true,
            projectNumber: true,
            contractValue: true
          }
        },
        Supplier: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    if (!purchaseOrder) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
    }

    // Check if PO is in a state that can be approved
    if (purchaseOrder.status === 'APPROVED') {
      return NextResponse.json(
        { error: 'Purchase order is already approved' },
        { status: 400 }
      )
    }

    if (purchaseOrder.status === 'CANCELLED') {
      return NextResponse.json(
        { error: 'Cannot approve a cancelled purchase order' },
        { status: 400 }
      )
    }

    const now = new Date()

    // Update PO status to APPROVED
    const updatedPO = await prisma.purchaseOrder.update({
      where: { id: poId },
      data: {
        status: 'APPROVED',
        approvedById: userId,
        approvedAt: now,
        updatedAt: now
      },
      include: {
        Supplier: {
          select: {
            name: true
          }
        },
        Project: {
          select: {
            name: true,
            projectNumber: true,
            contractValue: true
          }
        }
      }
    })

    // Auto-update project contract value when INCOMING PO is approved
    if (updatedPO.type === 'INCOMING' && updatedPO.projectId && updatedPO.Project) {
      const currentContractValue = parseFloat(updatedPO.Project.contractValue?.toString() || '0')
      const poAmount = parseFloat(updatedPO.totalAmount.toString())
      const newContractValue = currentContractValue + poAmount

      await prisma.project.update({
        where: { id: updatedPO.projectId },
        data: {
          contractValue: newContractValue,
          updatedAt: now
        }
      })

      console.log(`[PO Approve] Approved INCOMING PO ${updatedPO.poNumber}, updated project contract value: ${currentContractValue} -> ${newContractValue}`)
    }

    // Log activity
    await prisma.purchaseOrderActivity.create({
      data: {
        id: uuidv4(),
        purchaseOrderId: poId,
        action: 'APPROVED',
        description: `Purchase order approved by Super Admin`,
        oldValue: purchaseOrder.status,
        newValue: 'APPROVED',
        userId: userId,
        userEmail: userEmail,
        createdAt: now
      }
    })

    // TODO: Budget transaction creation will be implemented once custom budget categories are properly mapped
    // If linked to a project, create budget transaction records
    // if (purchaseOrder.projectId && purchaseOrder.PurchaseOrderItem.length > 0) {
    //   const transactions = purchaseOrder.PurchaseOrderItem.map((item: any) => {
    //     return {
    //       id: uuidv4(),
    //       projectId: purchaseOrder.projectId!,
    //       category: mapItemCategoryToBudgetCategory(item.category),
    //       amount: Number(item.totalPrice),
    //       transactionType: 'EXPENSE' as const,
    //       description: `PO ${purchaseOrder.poNumber}: ${item.description}`,
    //       date: now,
    //       createdById: userId,
    //       createdAt: now,
    //       updatedAt: now
    //     }
    //   })
    //   await prisma.projectTransaction.createMany({ data: transactions })
    //   console.log(`Created ${transactions.length} budget transactions for PO ${purchaseOrder.poNumber}`)
    // }

    return NextResponse.json({
      success: true,
      purchaseOrder: {
        id: updatedPO.id,
        poNumber: updatedPO.poNumber,
        status: updatedPO.status,
        approvedAt: updatedPO.approvedAt?.toISOString(),
        supplier: updatedPO.Supplier?.name,
        project: updatedPO.Project,
        totalAmount: Number(updatedPO.totalAmount)
      },
      message: `Purchase order ${updatedPO.poNumber} approved successfully`
    })
  } catch (error) {
    console.error('[PO Approve] Error:', error)
    return NextResponse.json(
      { error: 'Failed to approve purchase order' },
      { status: 500 }
    )
  }
}

// Helper function to map ItemCategory to budget category
function mapItemCategoryToBudgetCategory(itemCategory: string): string {
  const categoryMap: Record<string, string> = {
    'MATERIALS': 'MATERIALS',
    'LABOR': 'LABOR',
    'EQUIPMENT': 'EQUIPMENT',
    'SUBCONTRACTOR': 'SUBCONTRACTOR',
    'SERVICES': 'GENERAL',
    'OTHER': 'OTHER'
  }
  
  return categoryMap[itemCategory] || 'GENERAL'
}

export const dynamic = 'force-dynamic'
