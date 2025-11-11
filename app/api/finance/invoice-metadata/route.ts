
/**
 * Invoice Metadata API
 * 
 * Manages Ampere-side metadata for Xero invoices (project linking, PO numbers, etc.)
 * without affecting Xero records
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'

export const dynamic = 'force-dynamic'

/**
 * GET /api/finance/invoice-metadata
 * Get metadata for invoices
 * Query params:
 *  - xeroInvoiceId: string (optional) - Get metadata for specific Xero invoice
 *  - projectId: string (optional) - Get all metadata for a project
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const xeroInvoiceId = searchParams.get('xeroInvoiceId')
    const projectId = searchParams.get('projectId')

    const where: any = {}
    if (xeroInvoiceId) where.xeroInvoiceId = xeroInvoiceId
    if (projectId) where.projectId = projectId

    const metadata = await prisma.invoiceMetadata.findMany({
      where,
      include: {
        Project: {
          select: {
            id: true,
            projectNumber: true,
            name: true
          }
        },
        BudgetCategory: {
          select: {
            id: true,
            code: true,
            name: true,
            color: true
          }
        },
        User: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json({ metadata })

  } catch (error: any) {
    console.error('❌ Invoice metadata fetch error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch invoice metadata' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/finance/invoice-metadata
 * Create or update invoice metadata
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const userRole = (session.user as any).role
    if (!['SUPERADMIN', 'FINANCE', 'PROJECT_MANAGER'].includes(userRole)) {
      return NextResponse.json(
        { error: 'Insufficient permissions. Only SUPERADMIN, FINANCE, and PROJECT_MANAGER can manage invoice metadata.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      xeroInvoiceId,
      projectId,
      budgetCategoryId,
      poNumber,
      vendorInvoiceUpload,
      notes,
      tags
    } = body

    // Check if metadata already exists for this Xero invoice
    let metadata
    if (xeroInvoiceId) {
      metadata = await prisma.invoiceMetadata.findUnique({
        where: { xeroInvoiceId }
      })
    }

    if (metadata) {
      // Update existing metadata
      metadata = await prisma.invoiceMetadata.update({
        where: { id: metadata.id },
        data: {
          projectId: projectId || null,
          budgetCategoryId: budgetCategoryId || null,
          poNumber: poNumber || null,
          vendorInvoiceUpload: vendorInvoiceUpload || null,
          notes: notes || null,
          tags: tags || []
        },
        include: {
          Project: {
            select: {
              id: true,
              projectNumber: true,
              name: true
            }
          },
          BudgetCategory: {
            select: {
              id: true,
              code: true,
              name: true,
              color: true
            }
          }
        }
      })
    } else {
      // Create new metadata
      metadata = await prisma.invoiceMetadata.create({
        data: {
          id: uuidv4(),
          xeroInvoiceId: xeroInvoiceId || null,
          projectId: projectId || null,
          budgetCategoryId: budgetCategoryId || null,
          poNumber: poNumber || null,
          vendorInvoiceUpload: vendorInvoiceUpload || null,
          notes: notes || null,
          tags: tags || [],
          createdById: session.user.id
        },
        include: {
          Project: {
            select: {
              id: true,
              projectNumber: true,
              name: true
            }
          },
          BudgetCategory: {
            select: {
              id: true,
              code: true,
              name: true,
              color: true
            }
          }
        }
      })
    }

    return NextResponse.json({
      success: true,
      message: metadata ? 'Invoice metadata updated successfully' : 'Invoice metadata created successfully',
      metadata
    })

  } catch (error: any) {
    console.error('❌ Invoice metadata save error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to save invoice metadata' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/finance/invoice-metadata
 * Delete invoice metadata
 * Query params:
 *  - id: string - Metadata ID to delete
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const userRole = (session.user as any).role
    if (!['SUPERADMIN', 'FINANCE'].includes(userRole)) {
      return NextResponse.json(
        { error: 'Insufficient permissions. Only SUPERADMIN and FINANCE can delete invoice metadata.' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Metadata ID is required' },
        { status: 400 }
      )
    }

    await prisma.invoiceMetadata.delete({
      where: { id }
    })

    return NextResponse.json({
      success: true,
      message: 'Invoice metadata deleted successfully'
    })

  } catch (error: any) {
    console.error('❌ Invoice metadata delete error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete invoice metadata' },
      { status: 500 }
    )
  }
}
