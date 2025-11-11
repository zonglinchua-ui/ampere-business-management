
/**
 * Xero Connection Validator
 * Ensures Xero is connected before performing sync operations
 * Prevents sync attempts when token has expired or been revoked
 */

import { prisma } from './db'
import { XeroOAuthService } from './xero-oauth-service'
import { v4 as uuidv4 } from 'uuid'

export interface ValidationResult {
  valid: boolean
  reason?: string
  tokenExpired?: boolean
  requiresReauth?: boolean
}

/**
 * Validates Xero connection before sync operations
 * Throws error if connection is invalid
 */
export async function ensureXeroConnected(): Promise<ValidationResult> {
  try {
    console.log('🔍 [Connection Validator] Checking Xero connection...')

    // Step 1: Check if tokens exist
    const tokens = await XeroOAuthService.getStoredTokens()

    if (!tokens) {
      console.log('❌ [Connection Validator] No tokens found')
      
      await prisma.system_logs.create({
        data: {
          id: uuidv4(),
          type: 'ERROR',
          module: 'Xero Sync',
          action: 'Validation Failed',
          message: 'Xero not connected. No tokens found.',
          status: 'WARNING'
        }
      })

      return {
        valid: false,
        reason: 'Xero is not connected. Please complete OAuth flow.',
        requiresReauth: true
      }
    }

    // Step 2: Check token expiry
    const now = new Date()
    if (tokens.expiresAt <= now) {
      console.log('❌ [Connection Validator] Token expired')
      
      await prisma.system_logs.create({
        data: {
          id: uuidv4(),
          type: 'ERROR',
          module: 'Xero Sync',
          action: 'Token Expired',
          message: 'Xero access token has expired during sync validation.',
          status: 'WARNING'
        }
      })

      return {
        valid: false,
        reason: 'Xero token has expired. Please reconnect.',
        tokenExpired: true,
        requiresReauth: true
      }
    }

    // Step 3: Check if token expires in the next 5 minutes
    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000)
    if (tokens.expiresAt <= fiveMinutesFromNow) {
      console.log('⚠️ [Connection Validator] Token expires soon, refreshing...')
      
      try {
        const oauthService = new XeroOAuthService()
        await oauthService.refreshAccessToken(tokens.refreshToken, tokens.tenantId)
        console.log('✅ [Connection Validator] Token refreshed successfully')
        
        await prisma.system_logs.create({
          data: {
            id: uuidv4(),
            type: 'ACTIVITY',
            module: 'Xero Sync',
            action: 'Token Refreshed',
            message: 'Xero access token refreshed automatically before sync.',
            status: 'SUCCESS'
          }
        })
      } catch (refreshError: any) {
        console.error('❌ [Connection Validator] Token refresh failed:', refreshError)
        
        await prisma.system_logs.create({
          data: {
            id: uuidv4(),
            type: 'ERROR',
            module: 'Xero Sync',
            action: 'Token Refresh Failed',
            message: `Failed to refresh Xero token: ${refreshError.message}`,
            status: 'CRITICAL'
          }
        })

        return {
          valid: false,
          reason: 'Failed to refresh Xero token. Please reconnect.',
          requiresReauth: true
        }
      }
    }

    console.log('✅ [Connection Validator] Connection valid')
    return { valid: true }

  } catch (error: any) {
    console.error('❌ [Connection Validator] Unexpected error:', error)
    
    await prisma.system_logs.create({
      data: {
        id: uuidv4(),
        type: 'ERROR',
        module: 'Xero Sync',
        action: 'Validation Error',
        message: `Unexpected error during connection validation: ${error.message}`,
        status: 'CRITICAL'
      }
    })

    return {
      valid: false,
      reason: 'Unexpected error validating Xero connection',
      requiresReauth: false
    }
  }
}

/**
 * Validates connection and throws error if invalid
 * Use this before sync operations to ensure connection is active
 */
export async function validateOrThrow(): Promise<void> {
  const result = await ensureXeroConnected()
  
  if (!result.valid) {
    throw new Error(result.reason || 'Xero connection is not valid')
  }
}
