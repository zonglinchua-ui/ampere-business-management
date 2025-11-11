
/**
 * Xero Token Auto-Refresh Cron Job
 * This endpoint should be called periodically (every 5-10 minutes) to keep Xero tokens fresh
 * Can be triggered by:
 * 1. External cron service (Vercel Cron, GitHub Actions, etc.)
 * 2. Frontend heartbeat when app is in use
 * 3. Any API call to Xero services
 */

import { NextRequest, NextResponse } from 'next/server'
import { proactivelyRefreshXeroTokens } from '@/lib/xero-token-refresh-service'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * POST/GET - Refresh Xero tokens if needed
 * No authentication required for cron jobs
 * Uses internal secret for security (optional)
 */
export async function POST(request: NextRequest) {
  return handleTokenRefresh(request)
}

export async function GET(request: NextRequest) {
  return handleTokenRefresh(request)
}

async function handleTokenRefresh(request: NextRequest) {
  try {
    // Optional: Verify cron secret for security
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.log('⚠️ [Cron] Unauthorized token refresh attempt')
      // Still allow the refresh for now (backward compatibility)
      // You can uncomment this to enforce security:
      // return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    console.log('🕐 [Cron] Executing automatic Xero token refresh...')
    
    const result = await proactivelyRefreshXeroTokens()
    
    if (result.success) {
      console.log(`✅ [Cron] ${result.message}`)
      return NextResponse.json({
        ...result,
        timestamp: new Date().toISOString()
      })
    } else {
      console.error(`❌ [Cron] ${result.message}`)
      return NextResponse.json({
        ...result,
        timestamp: new Date().toISOString()
      }, { status: 500 })
    }

  } catch (error: any) {
    console.error('❌ [Cron] Token refresh error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Token refresh failed',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
