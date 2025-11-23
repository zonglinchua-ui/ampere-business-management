
/**
 * Xero Token Refresh Endpoint
 * Proactively refreshes Xero tokens to maintain seamless connection
 * Can be called by cron jobs, background tasks, or frontend for health checks
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { proactivelyRefreshXeroTokens, checkXeroConnectionHealth } from '@/lib/xero-token-refresh-service'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * POST - Manually trigger token refresh
 * Requires authentication (SUPERADMIN or PROJECT_MANAGER)
 */
export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Only allow SUPERADMIN and PROJECT_MANAGER to trigger manual refresh
    if (session.user.role !== 'SUPERADMIN' && session.user.role !== 'PROJECT_MANAGER') {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    console.log(`🔄 Manual token refresh triggered by ${session.user.name} (${session.user.role})`)

    const result = await proactivelyRefreshXeroTokens()

    return NextResponse.json(result, { status: result.success ? 200 : 500 })

  } catch (error: any) {
    console.error('❌ Token refresh endpoint error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to refresh token'
      },
      { status: 500 }
    )
  }
}

/**
 * GET - Check connection health and token status
 * Public endpoint (no auth required) for frontend health checks
 */
export async function GET(request: NextRequest) {
  try {
    const health = await checkXeroConnectionHealth()

    return NextResponse.json({
      success: true,
      ...health
    })

  } catch (error: any) {
    console.error('❌ Connection health check error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to check connection health'
      },
      { status: 500 }
    )
  }
}

