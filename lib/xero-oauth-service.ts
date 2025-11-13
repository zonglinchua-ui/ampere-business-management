
/**
 * Xero OAuth Service - Complete Rewrite
 * Based on official xero-node SDK patterns
 * Simplified, production-ready implementation
 */

import { XeroClient, TokenSet } from 'xero-node'
import { prisma } from './db'

export interface XeroTokens {
  accessToken: string
  refreshToken: string
  expiresAt: Date
  tenantId: string
  tenantName?: string
}

export interface XeroAuthResult {
  success: boolean
  error?: string
  tenantName?: string
  tenantId?: string
}

/**
 * Xero OAuth Service - Handles authentication and token management
 * Follows official Xero SDK patterns
 */
export class XeroOAuthService {
  private xeroClient: XeroClient
  private userId?: string

  constructor(userId?: string) {
    // Initialize Xero client with credentials from environment
    this.xeroClient = new XeroClient({
      clientId: process.env.XERO_CLIENT_ID!,
      clientSecret: process.env.XERO_CLIENT_SECRET!,
      redirectUris: [process.env.XERO_REDIRECT_URI!],
      scopes: process.env.XERO_SCOPES!.split(' '),
    })
    this.userId = userId
  }

  /**
   * Generate authorization URL for OAuth flow
   * State parameter is automatically handled by xero-node SDK
   */
  async getAuthorizationUrl(): Promise<string> {
    try {
      const consentUrl = await this.xeroClient.buildConsentUrl()
      console.log('✅ Generated Xero authorization URL')
      return consentUrl
    } catch (error: any) {
      console.error('❌ Failed to generate authorization URL:', error.message)
      throw new Error(`Failed to generate authorization URL: ${error.message}`)
    }
  }

  /**
   * Handle OAuth callback and exchange authorization code for tokens
   * This is the critical method that performs token exchange
   */
  async handleCallback(code: string): Promise<XeroAuthResult> {
    try {
      console.log('\n=== Xero OAuth Callback ===')
      console.log('Authorization code received:', code.substring(0, 20) + '...')

      // Step 1: Exchange authorization code for tokens
      console.log('📤 Exchanging authorization code for access token...')
      const tokenSet: TokenSet = await this.xeroClient.apiCallback(
        `${process.env.XERO_REDIRECT_URI}?code=${code}`
      )

      // Validate token response
      if (!tokenSet.access_token || !tokenSet.refresh_token) {
        console.error('❌ Invalid token response:', tokenSet)
        return {
          success: false,
          error: 'Invalid token response from Xero - missing tokens'
        }
      }

      console.log('✅ Token exchange successful')
      console.log('Access token length:', tokenSet.access_token.length)
      console.log('Refresh token length:', tokenSet.refresh_token.length)
      console.log('Expires in:', tokenSet.expires_in, 'seconds')

      // Step 2: Get tenant information
      console.log('📤 Fetching tenant information...')
      await this.xeroClient.updateTenants()
      const tenants = this.xeroClient.tenants

      if (!tenants || tenants.length === 0) {
        console.error('❌ No tenants found')
        return {
          success: false,
          error: 'No Xero organizations found for this account'
        }
      }

      const tenant = tenants[0]
      console.log('✅ Connected to organization:', tenant.tenantName)
      console.log('Tenant ID:', tenant.tenantId)

      // Step 3: Save tokens to database
      const expiresAt = new Date(Date.now() + (tokenSet.expires_in || 1800) * 1000)
      
      await this.saveTokens({
        accessToken: tokenSet.access_token,
        refreshToken: tokenSet.refresh_token,
        expiresAt,
        tenantId: tenant.tenantId,
        tenantName: tenant.tenantName
      })

      console.log('✅ Tokens saved to database')
      console.log('=== OAuth flow complete ===\n')

      return {
        success: true,
        tenantName: tenant.tenantName,
        tenantId: tenant.tenantId
      }

    } catch (error: any) {
      console.error('❌ OAuth callback failed:', error.message)
      
      // Provide helpful error messages
      if (error.message?.includes('invalid_grant')) {
        return {
          success: false,
          error: 'Authorization code expired or already used. Please try connecting again.'
        }
      }
      
      if (error.message?.includes('unauthorized_client')) {
        return {
          success: false,
          error: 'OAuth configuration mismatch. Please verify redirect URI in Xero Developer Portal.'
        }
      }

      return {
        success: false,
        error: `Connection failed: ${error.message}`
      }
    }
  }

  /**
   * Save tokens to database
   */
  private async saveTokens(tokens: XeroTokens): Promise<void> {
    // Get user ID for createdBy field
    let createdById = this.userId

    if (!createdById) {
      // Find or create system user
      let systemUser = await prisma.user.findFirst({
        where: {
          OR: [
            { role: 'SUPERADMIN' },
            { email: 'system@ampere.com' }
          ]
        }
      })

      if (!systemUser) {
        // Get any project manager user as fallback
        systemUser = await prisma.user.findFirst({
          where: { role: 'PROJECT_MANAGER' }
        })
      }

      createdById = systemUser?.id || 'system'
    }

    // Upsert integration record
    await prisma.xeroIntegration.upsert({
      where: { tenantId: tokens.tenantId },
      create: {
        id: `xero-${tokens.tenantId.replace(/-/g, '').substring(0, 12)}`,
        tenantId: tokens.tenantId,
        tenantName: tokens.tenantName,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        scopes: process.env.XERO_SCOPES?.split(' ') || [],
        isActive: true,
        createdById
      },
      update: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        tenantName: tokens.tenantName,
        isActive: true
      }
    })
  }

  /**
   * Get stored tokens from database
   */
  static async getStoredTokens(): Promise<XeroTokens | null> {
    try {
      const integration = await prisma.xeroIntegration.findFirst({
        where: { isActive: true },
        orderBy: { connectedAt: 'desc' }
      })

      if (!integration || !integration.accessToken || !integration.refreshToken) {
        return null
      }

      return {
        accessToken: integration.accessToken,
        refreshToken: integration.refreshToken,
        expiresAt: integration.expiresAt,
        tenantId: integration.tenantId,
        tenantName: integration.tenantName || undefined
      }
    } catch (error) {
      console.error('Failed to get stored tokens:', error)
      return null
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string, tenantId: string): Promise<XeroTokens | null> {
    try {
      console.log('🔄 Refreshing Xero access token...')
      
      // Set the refresh token in the client
      this.xeroClient.setTokenSet({
        refresh_token: refreshToken
      })

      // Request new tokens
      const newTokenSet: TokenSet = await this.xeroClient.refreshToken()

      if (!newTokenSet.access_token || !newTokenSet.refresh_token) {
        console.error('❌ Token refresh failed - invalid response')
        return null
      }

      const expiresAt = new Date(Date.now() + (newTokenSet.expires_in || 1800) * 1000)
      
      const tokens: XeroTokens = {
        accessToken: newTokenSet.access_token,
        refreshToken: newTokenSet.refresh_token,
        expiresAt,
        tenantId
      }

      // Save refreshed tokens
      await this.saveTokens(tokens)

      console.log('✅ Token refresh successful')
      return tokens

    } catch (error: any) {
      console.error('❌ Token refresh failed:', error.message)
      
      // Only mark as inactive if it's a permanent error (not temporary network issues)
      const isPermanentError = 
        error.message?.includes('invalid_grant') ||
        error.message?.includes('unauthorized_client') ||
        error.message?.includes('invalid_client')
      
      if (isPermanentError) {
        console.error('❌ Permanent OAuth error detected, marking integration as inactive')
        await prisma.xeroIntegration.updateMany({
          where: { tenantId },
          data: { isActive: false }
        })
      } else {
        console.warn('⚠️ Temporary refresh error, keeping integration active for retry')
        // Don't deactivate - let it retry on next attempt
      }

      return null
    }
  }

  /**
   * Check connection status
   */
  static async checkConnection(): Promise<boolean> {
    const tokens = await this.getStoredTokens()
    return !!tokens && tokens.expiresAt > new Date()
  }

  /**
   * Disconnect Xero integration
   */
  static async disconnect(): Promise<void> {
    await prisma.xeroIntegration.updateMany({
      where: { isActive: true },
      data: { isActive: false }
    })
  }
}
