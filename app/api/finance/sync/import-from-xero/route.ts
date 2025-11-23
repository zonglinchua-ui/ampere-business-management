

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ImprovedXeroService } from '@/lib/xero-service-improved'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check user role - only Finance and SuperAdmin can import
    const userRole = session.user.role
    if (!['SUPERADMIN', 'FINANCE'].includes(userRole)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const { entity, detectConflicts = true } = body

    if (!entity) {
      return NextResponse.json({ error: 'Entity type required' }, { status: 400 })
    }

    // Get stored Xero tokens
    const tokens = await ImprovedXeroService.getStoredTokens()
    if (!tokens) {
      return NextResponse.json({ 
        error: 'Xero connection not found. Please connect to Xero first.' 
      }, { status: 400 })
    }

    const xeroService = new ImprovedXeroService(tokens, session.user.id)

    let result
    switch (entity) {
      case 'contacts':
        result = await xeroService.syncContacts()
        break
      case 'invoices':
      case 'bills':
      case 'payments':
        // These are not yet implemented in ImprovedXeroService
        return NextResponse.json({ 
          success: false,
          error: `${entity} import not yet implemented. Please use the bulk sync feature in the Xero Integration tab.`,
          suggestion: 'Go to Finance → Xero Integration → Sync Manager to sync data'
        }, { status: 501 })
      default:
        return NextResponse.json({ error: `Unsupported entity type: ${entity}` }, { status: 400 })
    }

    // Note: Conflict detection is handled within syncContacts()
    let conflicts: any[] = []

    if (result.success) {
      return NextResponse.json({ 
        message: result.message,
        syncedCount: result.syncedCount,
        conflicts: conflicts.length > 0 ? conflicts : undefined,
        errors: result.errors
      })
    } else {
      return NextResponse.json({ error: result.message }, { status: 500 })
    }

  } catch (error: any) {
    console.error('Import from Xero error:', error)
    return NextResponse.json({ 
      error: error?.message || 'Internal server error' 
    }, { status: 500 })
  }
}

