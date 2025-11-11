
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// GET /api/projects/[id]/purchase-orders - Get project purchase orders
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const projectId = params.id

    // Check if user has access to this project
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { createdById: session.user.id },
          { managerId: session.user.id },
          { salespersonId: session.user.id },
          // Allow SUPERADMIN and FINANCE roles to view all projects
          session.user.role === 'SUPERADMIN' || session.user.role === 'FINANCE' ? {} : { id: 'never-match' }
        ]
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Fetch purchase orders for this project
    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where: {
        projectId: projectId
      },
      orderBy: {
        issueDate: 'desc'
      },
      select: {
        id: true,
        poNumber: true,
        totalAmount: true,
        status: true,
        issueDate: true,
        deliveryDate: true,
        Supplier: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    return NextResponse.json({ purchaseOrders })

  } catch (error) {
    console.error('Error fetching project purchase orders:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
