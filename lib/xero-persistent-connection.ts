
/**
 * Xero Persistent Connection Manager
 * 
 * This service ensures "Ampere Engineering" stays permanently connected to Xero
 * without requiring manual re-authorization unless the refresh token expires.
 * 
 * Features:
 * - Automatic tenant selection (always uses "Ampere Engineering")
 * - Silent token refresh before expiry
 * - Background token maintenance
 * - Error recovery with user notification
 */

import { prisma } from './db'
import { XeroOAuthService } from './xero-oauth-service'
import { EnhancedXeroOAuthService } from './xero-oauth-service-fixed'
import { createSystemLog } from './logger'

export interface ConnectionStatus {
  isConnected: boolean
  tenantName?: string
  tenantId?: string
  expiresIn?: number // minutes
  lastSync?: Date
  needsReconnect: boolean
  statusMessage: string
}

/**
 * Get the permanent connection status for "Ampere Engineering"
 * This shows whether the app is currently connected without requiring user action
 */
export async function getPersistentConnectionStatus(): Promise<ConnectionStatus> {
  try {
    const integration = await prisma.xeroIntegration.findFirst({
      where: { isActive: true },
      orderBy: { connectedAt: 'desc' },
      select: {
        tenantId: true,
        tenantName: true,
        expiresAt: true,
        lastSyncAt: true,
        connectedAt: true
      }
    })

    if (!integration) {
      return {
        isConnected: false,
        needsReconnect: true,
        statusMessage: 'Not connected to Xero. Please authorize connection.'
      }
    }

    const now = new Date()
    const expiresAt = new Date(integration.expiresAt)
    const timeUntilExpiry = Math.round((expiresAt.getTime() - now.getTime()) / 1000 / 60)

    // Check if token is expired
    if (timeUntilExpiry <= 0) {
      console.warn('⚠️ Xero token expired. Attempting automatic refresh...')
      
      // Try to refresh automatically
      const refreshed = await attemptSilentRefresh(integration.tenantId)
      
      if (refreshed) {
        return {
          isConnected: true,
          tenantName: integration.tenantName || 'Ampere Engineering',
          tenantId: integration.tenantId,
          expiresIn: 30, // Refreshed tokens typically last 30 minutes
          lastSync: integration.lastSyncAt || undefined,
          needsReconnect: false,
          statusMessage: 'Connected (automatically refreshed)'
        }
      } else {
        return {
          isConnected: false,
          tenantName: integration.tenantName || undefined,
          tenantId: integration.tenantId,
          needsReconnect: true,
          statusMessage: 'Connection expired. Please re-authorize Ampere Engineering.'
        }
      }
    }

    // Connection is active and healthy
    return {
      isConnected: true,
      tenantName: integration.tenantName || 'Ampere Engineering',
      tenantId: integration.tenantId,
      expiresIn: timeUntilExpiry,
      lastSync: integration.lastSyncAt || undefined,
      needsReconnect: false,
      statusMessage: `Connected to ${integration.tenantName || 'Ampere Engineering'}`
    }

  } catch (error: any) {
    console.error('Error checking persistent connection:', error)
    return {
      isConnected: false,
      needsReconnect: true,
      statusMessage: `Error: ${error.message}`
    }
  }
}

/**
 * Attempt to silently refresh the token without user intervention
 * This is called automatically when tokens expire
 */
async function attemptSilentRefresh(tenantId: string): Promise<boolean> {
  try {
    const integration = await prisma.xeroIntegration.findFirst({
      where: { tenantId, isActive: true }
    })

    if (!integration || !integration.refreshToken) {
      return false
    }

    const oauthService = new XeroOAuthService()
    const newTokens = await oauthService.refreshAccessToken(
      integration.refreshToken,
      tenantId
    )

    if (newTokens) {
      console.log('✅ Silent token refresh successful')
      await createSystemLog({
        type: 'ACTIVITY',
        action: 'XERO_SILENT_REFRESH',
        message: 'Xero connection automatically refreshed for Ampere Engineering',
        module: 'XERO_PERSISTENT_CONNECTION',
        status: 'SUCCESS'
      })
      return true
    }

    return false
  } catch (error: any) {
    console.error('Silent refresh failed:', error.message)
    await createSystemLog({
      type: 'ERROR',
      action: 'XERO_SILENT_REFRESH',
      message: `Silent refresh failed: ${error.message}`,
      module: 'XERO_PERSISTENT_CONNECTION',
      status: 'FAILED'
    })
    return false
  }
}

/**
 * Get the saved tenant ID for "Ampere Engineering"
 * This is used automatically in all Xero API calls
 */
export async function getAmpereTenantId(): Promise<string | null> {
  try {
    const integration = await prisma.xeroIntegration.findFirst({
      where: { isActive: true },
      select: { tenantId: true },
      orderBy: { connectedAt: 'desc' }
    })

    return integration?.tenantId || null
  } catch (error) {
    console.error('Error getting Ampere tenant ID:', error)
    return null
  }
}

/**
 * Check if "Ampere Engineering" is connected and tokens are valid
 * Returns a simple boolean for quick checks
 */
export async function isAmpereConnected(): Promise<boolean> {
  const status = await getPersistentConnectionStatus()
  return status.isConnected
}

/**
 * Ensure connection is alive before making Xero API calls
 * This should be called at the start of any Xero operation
 * It will automatically refresh tokens if needed
 */
export async function ensureAmpereConnection(): Promise<{
  connected: boolean
  tenantId?: string
  error?: string
}> {
  try {
    const integration = await prisma.xeroIntegration.findFirst({
      where: { isActive: true },
      orderBy: { connectedAt: 'desc' }
    })

    if (!integration) {
      return {
        connected: false,
        error: 'No Xero connection found. Please connect Ampere Engineering.'
      }
    }

    const now = new Date()
    const expiresAt = new Date(integration.expiresAt)
    const timeUntilExpiry = Math.round((expiresAt.getTime() - now.getTime()) / 1000 / 60)

    // If token expires within 20 minutes, refresh it proactively
    if (timeUntilExpiry <= 20) {
      console.log(`🔄 Token expires in ${timeUntilExpiry} minutes, refreshing proactively...`)
      
      const oauthService = new XeroOAuthService()
      const newTokens = await oauthService.refreshAccessToken(
        integration.refreshToken,
        integration.tenantId
      )

      if (!newTokens) {
        return {
          connected: false,
          error: 'Token refresh failed. Please reconnect to Ampere Engineering.'
        }
      }

      console.log('✅ Token refreshed proactively')
    }

    return {
      connected: true,
      tenantId: integration.tenantId
    }

  } catch (error: any) {
    console.error('Error ensuring Ampere connection:', error)
    return {
      connected: false,
      error: error.message
    }
  }
}

/**
 * Get connection details for display in the UI
 */
export async function getConnectionDetails(): Promise<{
  organizationName: string
  connectedSince: Date
  lastSync?: Date
  tokenStatus: 'healthy' | 'expiring_soon' | 'expired'
  timeUntilExpiry?: number // minutes
} | null> {
  try {
    const integration = await prisma.xeroIntegration.findFirst({
      where: { isActive: true },
      orderBy: { connectedAt: 'desc' }
    })

    if (!integration) {
      return null
    }

    const now = new Date()
    const expiresAt = new Date(integration.expiresAt)
    const timeUntilExpiry = Math.round((expiresAt.getTime() - now.getTime()) / 1000 / 60)

    let tokenStatus: 'healthy' | 'expiring_soon' | 'expired' = 'healthy'
    if (timeUntilExpiry <= 0) {
      tokenStatus = 'expired'
    } else if (timeUntilExpiry <= 15) {
      tokenStatus = 'expiring_soon'
    }

    return {
      organizationName: integration.tenantName || 'Ampere Engineering',
      connectedSince: integration.connectedAt,
      lastSync: integration.lastSyncAt || undefined,
      tokenStatus,
      timeUntilExpiry: Math.max(0, timeUntilExpiry)
    }
  } catch (error) {
    console.error('Error getting connection details:', error)
    return null
  }
}

