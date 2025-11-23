
/**
 * Resolve Invoice Sync Conflict
 * 
 * POST /api/xero/sync/invoices/conflicts/[id]/resolve
 * 
 * Body:
 * {
 *   "resolution": "use_local" | "use_xero" | "manual",
 *   "notes": "Optional resolution notes"
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { XeroInvoiceSyncEnhanced } from '@/lib/xero-invoice-sync-enhanced'
import crypto from 'crypto'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check permissions
    const allowedRoles = ['SUPERADMIN', 'ADMIN', 'MANAGER']
    if (!allowedRoles.includes((session.user as any).role)) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      )
    }

    const conflictId = params.id
    const body = await request.json()
    const { resolution, notes } = body

    if (!['use_local', 'use_xero', 'manual'].includes(resolution)) {
      return NextResponse.json(
        { error: 'Invalid resolution type' },
        { status: 400 }
      )
    }

    // Fetch conflict
    const conflict = await prisma.xero_sync_state.findUnique({
      where: { id: conflictId }
    })

    if (!conflict) {
      return NextResponse.json(
        { error: 'Conflict not found' },
        { status: 404 }
      )
    }

    if (conflict.status !== 'CONFLICT') {
      return NextResponse.json(
        { error: 'This conflict has already been resolved' },
        { status: 400 }
      )
    }

    console.log(`🔧 Resolving conflict ${conflictId} with strategy: ${resolution}`)

    // Apply resolution based on strategy
    if (resolution === 'use_local') {
      // Push local version to Xero (force update)
      const syncService = new XeroInvoiceSyncEnhanced((session.user as any).id)
      await syncService.initialize()
      
      const result = await syncService.syncInvoices({
        invoiceIds: [conflict.entityId],
        direction: 'push',
        forceRefresh: true
      })

      if (!result.success) {
        return NextResponse.json(
          {
            success: false,
            error: 'Failed to apply local version',
            details: result.errors
          },
          { status: 500 }
        )
      }

    } else if (resolution === 'use_xero') {
      // Pull Xero version to local (force update)
      const syncService = new XeroInvoiceSyncEnhanced((session.user as any).id)
      await syncService.initialize()
      
      const result = await syncService.syncInvoices({
        invoiceIds: [conflict.xeroId!],
        direction: 'pull',
        forceRefresh: true
      })

      if (!result.success) {
        return NextResponse.json(
          {
            success: false,
            error: 'Failed to apply Xero version',
            details: result.errors
          },
          { status: 500 }
        )
      }

    } else if (resolution === 'manual') {
      // Mark as resolved but don't auto-sync
      // User will manually edit the record
      console.log('Manual resolution - user will edit record manually')
    }

    // Update conflict status
    await prisma.xero_sync_state.update({
      where: { id: conflictId },
      data: {
        status: 'ACTIVE',
        metadata: {
          ...(conflict.metadata as any || {}),
          resolution: {
            type: resolution,
            notes: notes || null,
            resolvedBy: (session.user as any).id,
            resolvedAt: new Date().toISOString()
          }
        },
        updatedAt: new Date()
      }
    })

    // Log resolution
    await prisma.xero_sync_log.create({
      data: {
        id: crypto.randomUUID(),
        correlationId: conflict.correlationId || crypto.randomUUID(),
        entityType: 'CLIENT_INVOICE',
        entityId: conflict.entityId,
        xeroId: conflict.xeroId || undefined,
        operation: 'CONFLICT_RESOLVED',
        syncOrigin: resolution === 'use_local' ? 'local' : 'remote',
        beforeSnapshot: conflict.conflictData as any || undefined,
        afterSnapshot: {
          resolution,
          notes
        },
        changeHash: undefined,
        status: 'SUCCESS',
        errorMessage: undefined,
        userId: (session.user as any).id,
        timestamp: new Date()
      }
    })

    return NextResponse.json({
      success: true,
      message: `Conflict resolved using ${resolution} strategy`,
      conflictId,
      resolution
    })

  } catch (error: any) {
    console.error('❌ Failed to resolve conflict:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to resolve conflict',
        message: error.message
      },
      { status: 500 }
    )
  }
}
