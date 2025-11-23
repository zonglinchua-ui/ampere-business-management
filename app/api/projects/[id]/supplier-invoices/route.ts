

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// GET /api/projects/[id]/supplier-invoices - Get supplier invoices for a project
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
      return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 })
    }

    // Fetch supplier invoices linked to this project
    const supplierInvoices = await prisma.supplierInvoice.findMany({
      where: {
        projectId: projectId
      },
      include: {
        Supplier: {
          select: {
            id: true,
            name: true
          }
        },
        SupplierInvoiceItem: {
          include: {
            BudgetCategory: {
              select: {
                id: true,
                name: true,
                code: true,
                color: true
              }
            }
          }
        }
      },
      orderBy: {
        invoiceDate: 'desc'
      }
    })

    return NextResponse.json({ supplierInvoices })

  } catch (error) {
    console.error('Error fetching project supplier invoices:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

