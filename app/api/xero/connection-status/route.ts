
/**
 * Xero Connection Status Endpoint with Caching and Rate Limit Protection
 * Returns current connection status and organization info with smart caching
 * Prevents excessive API calls and handles Xero rate limits gracefully
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { XeroOAuthService } from '@/lib/xero-oauth-service'
import { createXeroApiService } from '@/lib/xero-api-service'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Roles that can manage Xero integration
const XERO_MANAGEMENT_ROLES = ['SUPERADMIN', 'FINANCE']

// In-memory cache for connection status (with TTL)
interface CachedStatus {
  data: any
  timestamp: number
  expires: number
}

let statusCache: CachedStatus | null = null
const CACHE_TTL = 120 * 1000 // 2 minutes cache TTL
const MIN_REQUEST_INTERVAL = 30 * 1000 // Minimum 30 seconds between Xero API calls

async function getCachedStatus(userRole: string, canManage: boolean) {
  const now = Date.now()
  
  // Return cached data if still valid AND it's a positive connection result
  // Don't cache negative results for too long
  if (statusCache && now < statusCache.expires) {
    // If cached data shows disconnected, only use it for a short time
    if (!statusCache.data.connected && (now - statusCache.timestamp) > 30000) {
      console.log(`[Xero Status] Cached 'disconnected' status is stale, fetching fresh data`)
      // Clear cache and fetch fresh
      statusCache = null
    } else {
      console.log(`[Xero Status] Returning cached data (age: ${now - statusCache.timestamp}ms)`)
      return {
        ...statusCache.data,
        user: { role: userRole, canManage },
        cached: true,
        cacheAge: now - statusCache.timestamp
      }
    }
  }

  // Rate limit protection - don't call Xero API too frequently
  // But only if the cached status is 'connected' - always recheck if disconnected
  if (statusCache && statusCache.data.connected && (now - statusCache.timestamp) < MIN_REQUEST_INTERVAL) {
    console.log(`[Xero Status] Rate limiting - returning stale cache`)
    return {
      ...statusCache.data,
      user: { role: userRole, canManage },
      cached: true,
      stale: true,
      cacheAge: now - statusCache.timestamp
    }
  }

  // Fetch fresh data from Xero
  console.log('[Xero Status] Cache miss or expired, fetching fresh data')
  
  try {
    // Check if we have stored tokens
    let tokens = await XeroOAuthService.getStoredTokens()

    if (!tokens) {
      const result = {
        connected: false,
        message: 'Not connected to Xero',
        reason: 'No OAuth tokens found'
      }
      
      // Cache negative result for shorter time (30 seconds)
      statusCache = {
        data: result,
        timestamp: now,
        expires: now + 30000
      }
      
      return { ...result, user: { role: userRole, canManage } }
    }

    // Check token expiry and auto-refresh if needed
    const tokenExpiryTime = tokens.expiresAt.getTime()
    const currentTime = Date.now()
    const timeUntilExpiry = tokenExpiryTime - currentTime
    const REFRESH_THRESHOLD = 20 * 60 * 1000 // 20 minutes

    // If token expired or expiring soon, try to refresh it
    if (timeUntilExpiry <= REFRESH_THRESHOLD) {
      console.log(`[Xero Status] Token expiring in ${Math.round(timeUntilExpiry / 60000)} minutes, attempting refresh...`)
      
      try {
        const oauthService = new XeroOAuthService()
        const refreshed = await oauthService.refreshAccessToken(tokens.refreshToken, tokens.tenantId)
        
        if (refreshed) {
          console.log('[Xero Status] ✅ Token refreshed successfully')
          // Update tokens reference with refreshed tokens
          tokens = refreshed
          // Continue with the refreshed token
        } else {
          console.log('[Xero Status] ❌ Token refresh failed')
          const result = {
            connected: false,
            message: 'Token expired and refresh failed',
            reason: 'Access token has expired and could not be refreshed. Please reconnect.',
            tokenExpired: true
          }
          
          statusCache = {
            data: result,
            timestamp: now,
            expires: now + 60000 // Cache for 1 minute
          }
          
          return { ...result, user: { role: userRole, canManage } }
        }
      } catch (refreshError: any) {
        console.error('[Xero Status] Token refresh error:', refreshError)
        const result = {
          connected: false,
          message: 'Token refresh failed',
          reason: refreshError.message || 'Could not refresh access token. Please reconnect.',
          tokenExpired: true
        }
        
        statusCache = {
          data: result,
          timestamp: now,
          expires: now + 60000
        }
        
        return { ...result, user: { role: userRole, canManage } }
      }
    }

    // Test connection with Xero API
    const apiService = await createXeroApiService()

    if (!apiService) {
      const result = {
        connected: false,
        message: 'Failed to initialize Xero API service',
        reason: 'Service initialization failed'
      }
      
      statusCache = {
        data: result,
        timestamp: now,
        expires: now + 30000
      }
      
      return { ...result, user: { role: userRole, canManage } }
    }

    const testResult = await apiService.testConnection()

    if (testResult.success) {
      // Get additional connection details from database
      const integration = await prisma.xeroIntegration.findFirst({
        where: { isActive: true },
        select: {
          connectedAt: true,
          lastSyncAt: true,
          tenantId: true,
          expiresAt: true
        }
      })

      const result = {
        connected: true,
        tenantName: tokens.tenantName,
        tenantId: tokens.tenantId,
        organization: testResult.organization,
        connection: {
          connectedAt: integration?.connectedAt?.toISOString() || new Date().toISOString(),
          lastSyncAt: integration?.lastSyncAt?.toISOString(),
          tenantId: tokens.tenantId,
          expiresAt: tokens.expiresAt.toISOString()
        }
      }

      // Cache successful result
      statusCache = {
        data: result,
        timestamp: now,
        expires: now + CACHE_TTL
      }

      console.log('[Xero Status] Fresh data cached successfully')
      return { ...result, user: { role: userRole, canManage } }
    }

    // Connection test failed
    const result = {
      connected: false,
      message: testResult.error || 'Connection test failed',
      reason: testResult.error
    }

    // Cache failed result for shorter time
    statusCache = {
      data: result,
      timestamp: now,
      expires: now + 60000 // Cache for 1 minute
    }

    return { ...result, user: { role: userRole, canManage } }

  } catch (error: any) {
    console.error('[Xero Status] Error fetching fresh data:', error)
    
    // If we have stale cache, return it on error
    if (statusCache) {
      console.log('[Xero Status] Returning stale cache due to error')
      return {
        ...statusCache.data,
        user: { role: userRole, canManage },
        cached: true,
        stale: true,
        error: error.message,
        cacheAge: now - statusCache.timestamp
      }
    }

    // No cache available, return error
    const result = {
      connected: false,
      message: 'Status check failed',
      reason: error.message,
      error: error.message
    }

    return { ...result, user: { role: userRole, canManage } }
  }
}

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    // Check authentication and get user role
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    if (!user) {
      return NextResponse.json(
        { 
          connected: false, 
          message: 'Authentication required',
          reason: 'No valid session found'
        },
        { status: 401 }
      )
    }

    const userRole = user?.role || 'UNKNOWN'
    const canManage = XERO_MANAGEMENT_ROLES.includes(userRole)

    console.log(`[Xero Status] Request from ${user?.email} (${userRole})`)

    // Check if force refresh is requested (bypass cache)
    const { searchParams } = new URL(request.url)
    const forceRefresh = searchParams.get('refresh') === 'true' || searchParams.get('t')
    
    if (forceRefresh) {
      console.log('[Xero Status] Force refresh requested - clearing cache')
      statusCache = null
    }

    // Get status (potentially from cache)
    const status = await getCachedStatus(userRole, canManage)
    const duration = Date.now() - startTime

    console.log(`[Xero Status] Response prepared in ${duration}ms`, {
      connected: status.connected,
      cached: status.cached,
      stale: status.stale
    })

    // Set appropriate cache headers for client
    const headers = new Headers()
    if (status.cached) {
      headers.set('X-Cache', status.stale ? 'STALE' : 'HIT')
      headers.set('X-Cache-Age', String(status.cacheAge || 0))
    } else {
      headers.set('X-Cache', 'MISS')
    }
    headers.set('X-Response-Time', `${duration}ms`)
    
    // Don't cache on client side - we handle caching server-side
    headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    headers.set('Pragma', 'no-cache')
    headers.set('Expires', '0')

    // Handle rate limiting responses
    if (status.error && status.error.includes('429')) {
      headers.set('Retry-After', '60') // Tell client to retry after 60 seconds
      return NextResponse.json(status, { status: 429, headers })
    }

    return NextResponse.json(status, { headers })

  } catch (error: any) {
    const duration = Date.now() - startTime
    console.error('[Xero Status] Unexpected error:', error)
    
    // Still try to return user info even on error
    try {
      const session = await getServerSession(authOptions)
      const user = session?.user as any
      const userRole = user?.role || 'UNKNOWN'
      const canManage = XERO_MANAGEMENT_ROLES.includes(userRole)

      const headers = new Headers()
      headers.set('X-Cache', 'ERROR')
      headers.set('X-Response-Time', `${duration}ms`)

      return NextResponse.json(
        {
          connected: false,
          message: 'Internal server error',
          reason: error.message,
          error: error.message,
          user: { role: userRole, canManage }
        },
        { status: 500, headers }
      )
    } catch {
      return NextResponse.json(
        {
          connected: false,
          message: 'Internal server error',
          reason: error.message,
          error: error.message
        },
        { status: 500 }
      )
    }
  }
}
