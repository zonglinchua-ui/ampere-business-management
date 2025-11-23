
/**
 * Xero Invoice Enhanced Two-Way Sync API
 * 
 * POST /api/xero/sync/invoices/enhanced
 * 
 * Features:
 * - Two-way sync with conflict detection
 * - Dry-run mode for previewing changes
 * - Field ownership (Xero owns tax/totals, webapp owns notes/tags)
 * - Loop prevention with correlation IDs
 * - Comprehensive audit logging
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { XeroInvoiceSyncEnhanced } from '@/lib/xero-invoice-sync-enhanced'

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized - Please log in' },
        { status: 401 }
      )
    }

    // Check permissions - require SUPERADMIN, ADMIN, or MANAGER
    const allowedRoles = ['SUPERADMIN', 'ADMIN', 'MANAGER']
    if (!allowedRoles.includes((session.user as any).role)) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      )
    }

    // Parse request body
    const body = await request.json()
    const {
      dryRun = false,
      forceRefresh = false,
      modifiedSince,
      invoiceIds,
      direction = 'both'
    } = body

    console.log('🔄 Enhanced invoice sync requested:', {
      userId: (session.user as any).id,
      dryRun,
      direction,
      invoiceCount: invoiceIds?.length || 'all'
    })

    // Initialize sync service
    const syncService = new XeroInvoiceSyncEnhanced((session.user as any).id)
    const initialized = await syncService.initialize()

    if (!initialized) {
      return NextResponse.json(
        { 
          error: 'Xero connection not initialized',
          message: 'Please connect to Xero first via Finance > Xero Integration'
        },
        { status: 400 }
      )
    }

    // Run sync
    const result = await syncService.syncInvoices({
      dryRun,
      forceRefresh,
      modifiedSince: modifiedSince ? new Date(modifiedSince) : undefined,
      invoiceIds,
      direction
    })

    // Return results with appropriate status code
    const statusCode = result.success ? 200 : 
                      (result.conflicts.length > 0 ? 409 : 500)

    return NextResponse.json(result, { status: statusCode })

  } catch (error: any) {
    console.error('❌ Enhanced invoice sync failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Sync failed',
        message: error.message || 'Unknown error occurred'
      },
      { status: 500 }
    )
  }
}

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

    return NextResponse.json({
      message: 'Enhanced Invoice Sync API',
      description: 'Two-way invoice sync with conflict detection',
      usage: {
        method: 'POST',
        body: {
          dryRun: 'boolean (optional, default: false) - Preview changes without applying',
          forceRefresh: 'boolean (optional, default: false) - Force sync even if no changes detected',
          modifiedSince: 'string (optional) - ISO date to sync invoices modified after this date',
          invoiceIds: 'string[] (optional) - Specific invoice IDs to sync',
          direction: 'string (optional, default: "both") - "pull", "push", or "both"'
        },
        response: {
          success: 'boolean',
          message: 'string',
          dryRun: 'boolean',
          pull: 'object with created/updated/skipped/conflicts/errors counts',
          push: 'object with created/updated/skipped/conflicts/errors counts',
          conflicts: 'ConflictDetail[]',
          errors: 'ErrorDetail[]',
          logId: 'string'
        }
      },
      features: [
        'Two-way sync (pull from Xero, push to Xero)',
        'Conflict detection when both sides modified',
        'Field ownership (Xero owns tax/totals, webapp owns notes/tags)',
        'Dry-run mode for previewing changes',
        'Correlation IDs to prevent sync loops',
        'Comprehensive audit logging with before/after snapshots'
      ]
    })

  } catch (error: any) {
    console.error('❌ API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
