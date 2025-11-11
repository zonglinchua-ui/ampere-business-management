

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ImprovedXeroService } from '@/lib/xero-service-improved'

// GET: List all active conflicts
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      console.error('[Conflicts GET] Unauthorized: No session user ID')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = session.user.role
    if (!['SUPERADMIN', 'FINANCE', 'PROJECT_MANAGER'].includes(userRole)) {
      console.error(`[Conflicts GET] Insufficient permissions for role: ${userRole}`)
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Get stored Xero tokens
    const tokens = await ImprovedXeroService.getStoredTokens()
    console.log('[Conflicts GET] Xero tokens found:', tokens ? 'Yes' : 'No')
    if (!tokens) {
      console.error('[Conflicts GET] No Xero connection found in database')
      return NextResponse.json({ 
        error: 'Xero connection not found. Please connect to Xero first.' 
      }, { status: 400 })
    }

    // Note: Conflict management not yet fully implemented in ImprovedXeroService
    // Return empty array for now
    const { prisma } = await import('@/lib/db')
    const conflicts = await prisma.xero_sync_conflicts.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({
      conflicts,
      total: conflicts.length
    })

  } catch (error: any) {
    console.error('Get conflicts error:', error)
    return NextResponse.json({ 
      error: error?.message || 'Internal server error' 
    }, { status: 500 })
  }
}

// POST: Resolve a conflict
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      console.error('[Conflicts POST] Unauthorized: No session user ID')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = session.user.role
    if (!['SUPERADMIN', 'FINANCE'].includes(userRole)) {
      console.error(`[Conflicts POST] Insufficient permissions for role: ${userRole}`)
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const { conflictId, resolution } = body
    console.log('[Conflicts POST] Request body:', JSON.stringify(body))

    if (!conflictId || !resolution) {
      console.error('[Conflicts POST] Missing required fields:', { conflictId, resolution })
      return NextResponse.json({ error: 'Conflict ID and resolution required' }, { status: 400 })
    }

    if (!['use_local', 'use_xero', 'manual'].includes(resolution)) {
      console.error('[Conflicts POST] Invalid resolution type:', resolution)
      return NextResponse.json({ error: 'Invalid resolution type' }, { status: 400 })
    }

    // Get stored Xero tokens
    const tokens = await ImprovedXeroService.getStoredTokens()
    console.log('[Conflicts POST] Xero tokens found:', tokens ? 'Yes' : 'No')
    if (!tokens) {
      console.error('[Conflicts POST] No Xero connection found in database')
      return NextResponse.json({ 
        error: 'Xero connection not found. Please connect to Xero first.' 
      }, { status: 400 })
    }

    // Note: Conflict resolution not yet implemented in ImprovedXeroService
    return NextResponse.json({ 
      success: false,
      error: 'Conflict resolution not yet implemented. Please use the main sync feature which handles conflicts automatically.',
      suggestion: 'Go to Finance → Xero Integration → Sync Manager'
    }, { status: 501 })

  } catch (error: any) {
    console.error('Resolve conflict error:', error)
    return NextResponse.json({ 
      error: error?.message || 'Internal server error' 
    }, { status: 500 })
  }
}

