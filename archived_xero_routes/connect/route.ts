
/**
 * Legacy Connect Endpoint - Redirects to Enhanced Sync
 * This endpoint is deprecated and redirects to the enhanced integration
 */

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * Redirect to enhanced sync endpoint
 */
export async function GET() {
  return NextResponse.json(
    {
      success: false,
      error: 'This endpoint is deprecated. Please use /api/xero/enhanced-sync or the Advanced Integration tab.',
      redirectTo: '/finance?tab=integrations'
    },
    { status: 410 } // 410 Gone - indicates the resource is no longer available
  )
}

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: 'This endpoint is deprecated. Please use /api/xero/enhanced-sync or the Advanced Integration tab.',
      redirectTo: '/finance?tab=integrations'
    },
    { status: 410 }
  )
}
