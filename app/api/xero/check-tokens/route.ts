import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ensureXeroTokensFresh, checkIfTokensNeedRefresh } from '@/lib/xero-auto-refresh'
import { XeroOAuthService } from '@/lib/xero-oauth-service'

/**
 * GET /api/xero/check-tokens
 * Check Xero token status and automatically refresh if needed
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if tokens need refresh
    const status = await checkIfTokensNeedRefresh(20)

    if (!status.isConnected) {
      return NextResponse.json({
        connected: false,
        needsRefresh: true,
        message: 'No active Xero connection found. Please reconnect.'
      })
    }

    if (status.needsRefresh) {
      console.log(`🔄 Tokens need refresh (expires in ${status.timeUntilExpiry} minutes)`)
      
      // Attempt to refresh
      const refreshed = await ensureXeroTokensFresh(20)

      if (refreshed) {
        // Get updated status
        const newStatus = await checkIfTokensNeedRefresh(20)
        
        return NextResponse.json({
          connected: true,
          needsRefresh: false,
          refreshed: true,
          timeUntilExpiry: newStatus.timeUntilExpiry,
          message: `Tokens refreshed successfully. Valid for ${newStatus.timeUntilExpiry} more minutes.`
        })
      } else {
        return NextResponse.json({
          connected: false,
          needsRefresh: true,
          refreshed: false,
          message: 'Token refresh failed. Please reconnect to Xero.'
        })
      }
    }

    return NextResponse.json({
      connected: true,
      needsRefresh: false,
      timeUntilExpiry: status.timeUntilExpiry,
      message: `Tokens are valid for ${status.timeUntilExpiry} more minutes.`
    })

  } catch (error: any) {
    console.error('Error checking tokens:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/xero/check-tokens
 * Force refresh Xero tokens
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('🔄 Force refreshing Xero tokens...')

    // Get current tokens
    const tokens = await XeroOAuthService.getStoredTokens()

    if (!tokens) {
      return NextResponse.json({
        success: false,
        message: 'No active Xero connection found. Please reconnect.'
      }, { status: 404 })
    }

    // Force refresh
    const oauthService = new XeroOAuthService()
    const newTokens = await oauthService.refreshAccessToken(
      tokens.refreshToken,
      tokens.tenantId
    )

    if (newTokens) {
      const timeUntilExpiry = Math.round((newTokens.expiresAt.getTime() - Date.now()) / 1000 / 60)
      
      return NextResponse.json({
        success: true,
        message: `Tokens force refreshed successfully. Valid for ${timeUntilExpiry} minutes.`,
        timeUntilExpiry
      })
    } else {
      return NextResponse.json({
        success: false,
        message: 'Token refresh failed. Please reconnect to Xero.'
      }, { status: 500 })
    }

  } catch (error: any) {
    console.error('Error force refreshing tokens:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

