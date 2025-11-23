
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// GET /api/projects/[id]/invoices - Get project invoices (claims)
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

    // Fetch invoices for this project
    const invoices = await prisma.customerInvoice.findMany({
      where: {
        projectId: projectId
      },
      orderBy: {
        issueDate: 'desc'
      },
      select: {
        id: true,
        invoiceNumber: true,
        totalAmount: true,
        amountPaid: true,
        amountDue: true,
        status: true,
        issueDate: true,
        dueDate: true,
        paidDate: true,
        description: true,
        Customer: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    return NextResponse.json({ invoices })

  } catch (error) {
    console.error('Error fetching project invoices:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
