
/**
 * Xero Auto-Refresh Helper
 * Call this at the start of any Xero API operation to ensure tokens are fresh
 * Prevents the need for users to re-authenticate by keeping tokens proactively refreshed
 */

import { prisma } from './db'
import { XeroOAuthService } from './xero-oauth-service'
import { createSystemLog } from './logger'

/**
 * Ensures Xero tokens are fresh before any API operation
 * This should be called at the start of EVERY Xero API operation
 * 
 * @param minValidityMinutes - Minimum minutes the token should be valid for (default: 20)
 * @returns true if tokens are fresh, false if refresh failed
 */
export async function ensureXeroTokensFresh(minValidityMinutes: number = 20): Promise<boolean> {
  try {
    // Get active Xero integration
    const integration = await prisma.xeroIntegration.findFirst({
      where: { isActive: true },
      orderBy: { connectedAt: 'desc' }
    })

    if (!integration) {
      console.log('[Auto-Refresh] No active Xero integration found')
      return false
    }

    const now = new Date()
    const expiresAt = new Date(integration.expiresAt)
    const timeUntilExpiry = Math.round((expiresAt.getTime() - now.getTime()) / 1000 / 60) // minutes

    // If token is still valid for at least minValidityMinutes, no refresh needed
    if (timeUntilExpiry > minValidityMinutes) {
      console.log(`[Auto-Refresh] Token valid for ${timeUntilExpiry} minutes - no refresh needed`)
      return true
    }

    // Token is expiring soon or expired, refresh it
    console.log(`🔄 [Auto-Refresh] Token expires in ${timeUntilExpiry} minutes, refreshing...`)
    
    const oauthService = new XeroOAuthService()
    const newTokens = await oauthService.refreshAccessToken(
      integration.refreshToken,
      integration.tenantId
    )

    if (newTokens) {
      const newTimeUntilExpiry = Math.round((newTokens.expiresAt.getTime() - Date.now()) / 1000 / 60)
      console.log(`✅ [Auto-Refresh] Token refreshed - valid for ${newTimeUntilExpiry} minutes`)
      
      // Log successful refresh
      await createSystemLog({
        type: 'ACTIVITY',
        action: 'XERO_AUTO_REFRESH',
        message: `Xero token auto-refreshed. Valid for ${newTimeUntilExpiry} minutes.`,
        module: 'XERO_AUTO_REFRESH',
        status: 'SUCCESS'
      })
      
      return true
    } else {
      console.error('❌ [Auto-Refresh] Token refresh failed')
      
      // Log failure
      await createSystemLog({
        type: 'ERROR',
        action: 'XERO_AUTO_REFRESH',
        message: 'Xero token auto-refresh failed. User may need to reconnect.',
        module: 'XERO_AUTO_REFRESH',
        status: 'FAILED'
      })
      
      return false
    }

  } catch (error: any) {
    console.error('❌ [Auto-Refresh] Error:', error.message)
    
    // Log error
    try {
      await createSystemLog({
        type: 'ERROR',
        action: 'XERO_AUTO_REFRESH',
        message: `Auto-refresh error: ${error.message}`,
        module: 'XERO_AUTO_REFRESH',
        status: 'FAILED'
      })
    } catch (logError) {
      // Ignore logging errors
    }
    
    return false
  }
}

/**
 * Check if Xero tokens need refresh (without actually refreshing)
 * Useful for status checks and monitoring
 */
export async function checkIfTokensNeedRefresh(minValidityMinutes: number = 20): Promise<{
  needsRefresh: boolean
  timeUntilExpiry?: number // minutes
  isConnected: boolean
}> {
  try {
    const integration = await prisma.xeroIntegration.findFirst({
      where: { isActive: true },
      orderBy: { connectedAt: 'desc' }
    })

    if (!integration) {
      return { needsRefresh: true, isConnected: false }
    }

    const now = new Date()
    const expiresAt = new Date(integration.expiresAt)
    const timeUntilExpiry = Math.round((expiresAt.getTime() - now.getTime()) / 1000 / 60)

    return {
      needsRefresh: timeUntilExpiry <= minValidityMinutes,
      timeUntilExpiry,
      isConnected: timeUntilExpiry > 0
    }
  } catch (error) {
    return { needsRefresh: true, isConnected: false }
  }
}
