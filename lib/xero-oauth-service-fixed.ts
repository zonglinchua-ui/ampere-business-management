
/**
 * Xero OAuth Service - Enhanced Version with Better Error Handling
 * Fixes OAuth redirect URI issues and improves error handling
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
 * Enhanced Xero OAuth Service with improved error handling
 */
export class EnhancedXeroOAuthService {
  private xeroClient: XeroClient
  private userId?: string

  constructor(userId?: string) {
    const redirectUri = this.getValidRedirectUri()
    
    // Initialize Xero client with validated credentials
    this.xeroClient = new XeroClient({
      clientId: process.env.XERO_CLIENT_ID!,
      clientSecret: process.env.XERO_CLIENT_SECRET!,
      redirectUris: [redirectUri],
      scopes: this.parseScopes(),
    })
    this.userId = userId

    console.log('🔧 Enhanced XeroClient initialized with:')
    console.log('   Redirect URI:', redirectUri)
    console.log('   Scopes:', this.parseScopes())
  }

  /**
   * Get valid redirect URI, ensuring it matches Xero Developer Console
   */
  private getValidRedirectUri(): string {
    const envRedirectUri = process.env.XERO_REDIRECT_URI
    const defaultRedirectUri = 'https://ampere.abacusai.app/api/xero/callback'

    // Always use production URL for OAuth
    if (!envRedirectUri || envRedirectUri.includes('preview')) {
      console.log('⚠️ Using production redirect URI (env not set or contains preview)')
      return defaultRedirectUri
    }

    return envRedirectUri
  }

  /**
   * Parse and validate scopes
   */
  private parseScopes(): string[] {
    const defaultScopes = ['accounting.transactions', 'accounting.contacts', 'accounting.settings', 'offline_access']
    
    if (!process.env.XERO_SCOPES) {
      return defaultScopes
    }

    return process.env.XERO_SCOPES.split(' ').filter(scope => scope.trim().length > 0)
  }

  /**
   * Generate authorization URL with proper error handling
   * @param returnUrl - Optional URL to return to after OAuth (defaults to /finance)
   */
  async getAuthorizationUrl(returnUrl?: string): Promise<string> {
    try {
      console.log('🔗 Generating Xero authorization URL...')
      console.log('   Return URL:', returnUrl || '/finance (default)')
      
      // Validate configuration before generating URL
      if (!process.env.XERO_CLIENT_ID || !process.env.XERO_CLIENT_SECRET) {
        throw new Error('Missing Xero client credentials')
      }

      // Build consent URL
      const consentUrl = await this.xeroClient.buildConsentUrl()
      console.log('✅ Generated Xero authorization URL successfully')
      console.log('   URL length:', consentUrl.length)
      
      return consentUrl
    } catch (error: any) {
      console.error('❌ Failed to generate authorization URL:', error.message)
      
      if (error.message?.includes('redirect_uri')) {
        throw new Error('Redirect URI mismatch. Please verify Xero Developer Console settings.')
      }
      
      throw new Error(`Failed to generate authorization URL: ${error.message}`)
    }
  }

  /**
   * Enhanced OAuth callback handler with better error handling
   */
  async handleCallback(code: string): Promise<XeroAuthResult> {
    try {
      console.log('\n=== Enhanced Xero OAuth Callback ===')
      console.log('Authorization code received (first 20 chars):', code.substring(0, 20) + '...')

      // Validate inputs
      if (!code || code.length < 10) {
        return {
          success: false,
          error: 'Invalid authorization code received from Xero'
        }
      }

      // Prepare callback URL - important for Xero validation
      const callbackUrl = `${this.getValidRedirectUri()}?code=${code}`
      console.log('📤 Callback URL:', callbackUrl.substring(0, 60) + '...')

      // Step 1: Exchange authorization code for tokens
      console.log('📤 Exchanging authorization code for access token...')
      const tokenSet: TokenSet = await this.xeroClient.apiCallback(callbackUrl)

      // Validate token response
      if (!tokenSet.access_token || !tokenSet.refresh_token) {
        console.error('❌ Invalid token response:', {
          hasAccessToken: !!tokenSet.access_token,
          hasRefreshToken: !!tokenSet.refresh_token,
          expiresIn: tokenSet.expires_in
        })
        return {
          success: false,
          error: 'Invalid token response from Xero - missing required tokens'
        }
      }

      console.log('✅ Token exchange successful')
      console.log('   Access token length:', tokenSet.access_token.length)
      console.log('   Refresh token length:', tokenSet.refresh_token.length)
      console.log('   Expires in:', tokenSet.expires_in, 'seconds')

      // Step 2: Get tenant information with retry logic
      console.log('📤 Fetching tenant information...')
      await this.xeroClient.updateTenants()
      const tenants = this.xeroClient.tenants

      if (!tenants || tenants.length === 0) {
        console.error('❌ No tenants found after successful token exchange')
        return {
          success: false,
          error: 'No Xero organizations found. Please ensure you have access to at least one Xero organization.'
        }
      }

      const tenant = tenants[0]
      console.log('✅ Connected to organization:', tenant.tenantName)
      console.log('   Tenant ID:', tenant.tenantId)
      console.log('   Tenant Type:', tenant.tenantType || 'Not specified')

      // Step 3: Save tokens to database with better error handling
      const expiresAt = new Date(Date.now() + (tokenSet.expires_in || 1800) * 1000)
      
      const tokens: XeroTokens = {
        accessToken: tokenSet.access_token,
        refreshToken: tokenSet.refresh_token,
        expiresAt,
        tenantId: tenant.tenantId,
        tenantName: tenant.tenantName
      }

      await this.saveTokensWithRetry(tokens)

      console.log('✅ Tokens saved to database successfully')
      console.log('=== OAuth flow complete ===\n')

      return {
        success: true,
        tenantName: tenant.tenantName,
        tenantId: tenant.tenantId
      }

    } catch (error: any) {
      console.error('❌ OAuth callback failed:', error.message)
      console.error('   Stack trace:', error.stack)
      
      // Provide specific error messages for common issues
      if (error.message?.includes('invalid_grant')) {
        return {
          success: false,
          error: 'Authorization code has expired or was already used. Please try connecting again.'
        }
      }
      
      if (error.message?.includes('unauthorized_client')) {
        return {
          success: false,
          error: 'Client authentication failed. Please verify your Xero app configuration and redirect URI.'
        }
      }

      if (error.message?.includes('redirect_uri')) {
        return {
          success: false,
          error: 'Redirect URI mismatch. The URI must match exactly what is configured in your Xero Developer Console.'
        }
      }

      if (error.message?.includes('invalid_client')) {
        return {
          success: false,
          error: 'Invalid client credentials. Please check your Xero Client ID and Secret.'
        }
      }

      return {
        success: false,
        error: `Connection failed: ${error.message}`
      }
    }
  }

  /**
   * Save tokens with retry logic and better error handling
   */
  private async saveTokensWithRetry(tokens: XeroTokens, maxRetries: number = 3): Promise<void> {
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.saveTokens(tokens)
        return // Success
      } catch (error: any) {
        lastError = error
        console.error(`❌ Failed to save tokens (attempt ${attempt}/${maxRetries}):`, error.message)
        
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt)) // Exponential backoff
        }
      }
    }

    throw new Error(`Failed to save tokens after ${maxRetries} attempts: ${lastError?.message}`)
  }

  /**
   * Enhanced token saving with better user handling
   */
  private async saveTokens(tokens: XeroTokens): Promise<void> {
    let createdById = this.userId

    if (!createdById) {
      // Find system user or create fallback
      const systemUser = await prisma.user.findFirst({
        where: {
          OR: [
            { role: 'SUPERADMIN' },
            { email: 'system@ampere.com' },
            { role: 'PROJECT_MANAGER' }
          ]
        },
        orderBy: [
          { role: 'asc' }, // SUPERADMIN first
          { createdAt: 'asc' }
        ]
      })

      createdById = systemUser?.id || 'system'
    }

    // Upsert integration record with enhanced data
    await prisma.xeroIntegration.upsert({
      where: { tenantId: tokens.tenantId },
      create: {
        id: `xero-${tokens.tenantId.replace(/-/g, '').substring(0, 12)}`,
        tenantId: tokens.tenantId,
        tenantName: tokens.tenantName,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        scopes: this.parseScopes(),
        isActive: true,
        connectedAt: new Date(),
        lastSyncAt: null,
        createdById
      },
      update: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        tenantName: tokens.tenantName,
        scopes: this.parseScopes(),
        isActive: true,
        connectedAt: new Date()
      }
    })

    console.log('✅ Xero integration record saved/updated successfully')
  }

  /**
   * Enhanced connection status check
   */
  static async checkConnectionStatus(): Promise<{
    isConnected: boolean
    tenantName?: string
    expiresAt?: Date
    timeToExpiry?: number
  }> {
    try {
      const integration = await prisma.xeroIntegration.findFirst({
        where: { isActive: true },
        orderBy: { connectedAt: 'desc' },
        select: {
          tenantName: true,
          expiresAt: true,
          accessToken: true,
          refreshToken: true
        }
      })

      if (!integration || !integration.accessToken || !integration.refreshToken) {
        return { isConnected: false }
      }

      const now = new Date()
      const timeToExpiry = integration.expiresAt.getTime() - now.getTime()

      return {
        isConnected: timeToExpiry > 0,
        tenantName: integration.tenantName || undefined,
        expiresAt: integration.expiresAt,
        timeToExpiry: Math.max(0, timeToExpiry)
      }
    } catch (error) {
      console.error('Failed to check connection status:', error)
      return { isConnected: false }
    }
  }
}
