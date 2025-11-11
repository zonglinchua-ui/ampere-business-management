
/**
 * Xero Token Refresh Service
 * Proactively refreshes Xero tokens to ensure seamless operation
 * This service can be called periodically to maintain fresh tokens
 */

import { prisma } from './db'
import { XeroOAuthService } from './xero-oauth-service'
import { createSystemLog } from './logger'

export interface TokenRefreshResult {
  success: boolean
  message: string
  tenantId?: string
  nextRefreshIn?: number // minutes until next refresh recommended
}

/**
 * Proactively refresh Xero tokens if they're expiring soon
 * This should be called periodically (e.g., every 5-10 minutes) to ensure tokens never expire
 */
export async function proactivelyRefreshXeroTokens(): Promise<TokenRefreshResult> {
  try {
    console.log('\n🔍 [Token Refresh Service] Checking Xero token status...')
    
    // Get active Xero integration
    const integration = await prisma.xeroIntegration.findFirst({
      where: { isActive: true },
      orderBy: { connectedAt: 'desc' }
    })

    if (!integration) {
      console.log('ℹ️ [Token Refresh Service] No active Xero integration found')
      return {
        success: true,
        message: 'No active Xero integration'
      }
    }

    const now = new Date()
    const expiresAt = new Date(integration.expiresAt)
    const timeUntilExpiry = Math.round((expiresAt.getTime() - now.getTime()) / 1000 / 60) // minutes

    console.log(`📊 [Token Refresh Service] Token expires in ${timeUntilExpiry} minutes`)
    console.log(`📊 [Token Refresh Service] Tenant: ${integration.tenantName || integration.tenantId}`)

    // Refresh if token expires within 20 minutes (proactive approach)
    // This ensures tokens are always fresh before they can cause issues
    const REFRESH_THRESHOLD_MINUTES = 20
    
    if (timeUntilExpiry <= REFRESH_THRESHOLD_MINUTES) {
      console.log(`🔄 [Token Refresh Service] Token expires within ${REFRESH_THRESHOLD_MINUTES} minutes, refreshing proactively...`)
      
      const oauthService = new XeroOAuthService()
      const newTokens = await oauthService.refreshAccessToken(
        integration.refreshToken,
        integration.tenantId
      )

      if (newTokens) {
        const newTimeUntilExpiry = Math.round((newTokens.expiresAt.getTime() - Date.now()) / 1000 / 60)
        console.log(`✅ [Token Refresh Service] Token refreshed successfully`)
        console.log(`📊 [Token Refresh Service] New expiry: ${newTimeUntilExpiry} minutes from now`)

        // Log the successful refresh
        await createSystemLog({
          type: 'ACTIVITY',
          action: 'XERO_TOKEN_REFRESH',
          message: `Xero token proactively refreshed. New expiry: ${newTimeUntilExpiry} minutes.`,
          module: 'XERO_TOKEN_SERVICE',
          status: 'SUCCESS'
        })

        return {
          success: true,
          message: `Token refreshed successfully. Valid for ${newTimeUntilExpiry} minutes.`,
          tenantId: integration.tenantId,
          nextRefreshIn: newTimeUntilExpiry - REFRESH_THRESHOLD_MINUTES // Refresh again before it expires
        }
      } else {
        console.error('❌ [Token Refresh Service] Token refresh failed')
        
        // Log the failure
        await createSystemLog({
          type: 'ERROR',
          action: 'XERO_TOKEN_REFRESH',
          message: 'Failed to refresh Xero token. Manual reconnection may be required.',
          module: 'XERO_TOKEN_SERVICE',
          status: 'FAILED'
        })

        return {
          success: false,
          message: 'Token refresh failed. Please reconnect to Xero.',
          tenantId: integration.tenantId
        }
      }
    } else {
      console.log(`✅ [Token Refresh Service] Token is still valid for ${timeUntilExpiry} minutes. No refresh needed.`)
      
      return {
        success: true,
        message: `Token valid for ${timeUntilExpiry} more minutes.`,
        tenantId: integration.tenantId,
        nextRefreshIn: timeUntilExpiry - REFRESH_THRESHOLD_MINUTES // When to check again
      }
    }

  } catch (error: any) {
    console.error('❌ [Token Refresh Service] Error:', error.message)
    
    // Log the error
    await createSystemLog({
      type: 'ERROR',
      action: 'XERO_TOKEN_REFRESH',
      message: `Token refresh service error: ${error.message}`,
      module: 'XERO_TOKEN_SERVICE',
      status: 'FAILED'
    })

    return {
      success: false,
      message: `Token refresh service error: ${error.message}`
    }
  }
}

/**
 * Check connection health and token validity
 * Returns detailed information about the current connection state
 */
export async function checkXeroConnectionHealth(): Promise<{
  isConnected: boolean
  tokenExpiresIn?: number // minutes
  tenantId?: string
  tenantName?: string
  needsRefresh: boolean
  needsReconnect: boolean
}> {
  try {
    const integration = await prisma.xeroIntegration.findFirst({
      where: { isActive: true },
      orderBy: { connectedAt: 'desc' }
    })

    if (!integration) {
      return {
        isConnected: false,
        needsRefresh: false,
        needsReconnect: true
      }
    }

    const now = new Date()
    const expiresAt = new Date(integration.expiresAt)
    const timeUntilExpiry = Math.round((expiresAt.getTime() - now.getTime()) / 1000 / 60)

    // Token expired
    if (timeUntilExpiry <= 0) {
      return {
        isConnected: false,
        tokenExpiresIn: timeUntilExpiry,
        tenantId: integration.tenantId,
        tenantName: integration.tenantName || undefined,
        needsRefresh: false,
        needsReconnect: true // Expired tokens may not be refreshable
      }
    }

    // Token expiring soon
    if (timeUntilExpiry <= 15) {
      return {
        isConnected: true,
        tokenExpiresIn: timeUntilExpiry,
        tenantId: integration.tenantId,
        tenantName: integration.tenantName || undefined,
        needsRefresh: true,
        needsReconnect: false
      }
    }

    // Token is healthy
    return {
      isConnected: true,
      tokenExpiresIn: timeUntilExpiry,
      tenantId: integration.tenantId,
      tenantName: integration.tenantName || undefined,
      needsRefresh: false,
      needsReconnect: false
    }

  } catch (error: any) {
    console.error('Error checking connection health:', error)
    return {
      isConnected: false,
      needsRefresh: false,
      needsReconnect: true
    }
  }
}

/**
 * Get cached tenant ID without making API calls
 * This is useful for quickly getting tenant ID without waiting for token validation
 */
export async function getCachedTenantId(): Promise<string | null> {
  try {
    const integration = await prisma.xeroIntegration.findFirst({
      where: { isActive: true },
      select: { tenantId: true },
      orderBy: { connectedAt: 'desc' }
    })

    return integration?.tenantId || null
  } catch (error) {
    console.error('Error getting cached tenant ID:', error)
    return null
  }
}

/**
 * Get cached tenant information without making API calls
 */
export async function getCachedTenantInfo(): Promise<{
  tenantId: string
  tenantName?: string
  connectedAt: Date
  lastSyncAt?: Date
} | null> {
  try {
    const integration = await prisma.xeroIntegration.findFirst({
      where: { isActive: true },
      select: {
        tenantId: true,
        tenantName: true,
        connectedAt: true,
        lastSyncAt: true
      },
      orderBy: { connectedAt: 'desc' }
    })

    if (!integration) {
      return null
    }

    return {
      tenantId: integration.tenantId,
      tenantName: integration.tenantName || undefined,
      connectedAt: integration.connectedAt,
      lastSyncAt: integration.lastSyncAt || undefined
    }
  } catch (error) {
    console.error('Error getting cached tenant info:', error)
    return null
  }
}

