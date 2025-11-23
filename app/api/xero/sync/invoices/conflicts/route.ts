
/**
 * Xero Invoice Sync Conflicts API
 * 
 * GET /api/xero/sync/invoices/conflicts
 * Returns all unresolved invoice sync conflicts
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'CONFLICT'
    const limit = parseInt(searchParams.get('limit') || '50')

    // Fetch conflicts from sync state
    const conflicts = await prisma.xero_sync_state.findMany({
      where: {
        entityType: 'CLIENT_INVOICE',
        status: status
      },
      orderBy: {
        updatedAt: 'desc'
      },
      take: limit
    })

    // Enrich with invoice details
    const enrichedConflicts = await Promise.all(
      conflicts.map(async (conflict) => {
        const invoice = await prisma.customerInvoice.findUnique({
          where: { id: conflict.entityId },
          include: {
            Customer: {
              select: {
                id: true,
                name: true,
                xeroContactId: true
              }
            },
            CustomerInvoiceItem: true
          }
        })

        return {
          id: conflict.id,
          invoiceId: conflict.entityId,
          xeroInvoiceId: conflict.xeroId,
          invoiceNumber: invoice?.invoiceNumber,
          clientName: invoice?.Customer?.name,
          status: conflict.status,
          conflictData: conflict.conflictData,
          lastSyncedAt: conflict.lastSyncedAt,
          lastLocalModified: conflict.lastLocalModified,
          lastRemoteModified: conflict.lastRemoteModified,
          correlationId: conflict.correlationId,
          createdAt: conflict.createdAt,
          updatedAt: conflict.updatedAt
        }
      })
    )

    return NextResponse.json({
      success: true,
      conflicts: enrichedConflicts,
      total: enrichedConflicts.length
    })

  } catch (error: any) {
    console.error('❌ Failed to fetch conflicts:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch conflicts',
        message: error.message
      },
      { status: 500 }
    )
  }
}
