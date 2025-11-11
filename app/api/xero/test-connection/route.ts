
/**
 * Xero Test Connection Endpoint
 * Tests the current Xero connection status
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { XeroOAuthService } from '@/lib/xero-oauth-service'
import { createXeroApiService } from '@/lib/xero-api-service'

export const dynamic = 'force-dynamic'

// Roles that can manage Xero integration
const XERO_MANAGEMENT_ROLES = ['SUPERADMIN', 'FINANCE']

export async function POST(request: NextRequest) {
  // Disable in production for security
  if (process.env.NODE_ENV === 'production' || process.env.DEPLOYMENT_MODE === 'production') {
    return NextResponse.json(
      { error: 'Test endpoints disabled in production' },
      { status: 403 }
    )
  }

  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { 
          connected: false,
          error: 'Authentication required',
          message: 'You must be logged in to test Xero connection'
        },
        { status: 401 }
      )
    }

    const user = session.user as any
    const userRole = user?.role || 'UNKNOWN'

    console.log('🧪 Xero test connection request from:', session.user.email, 'Role:', userRole)

    // Check permissions
    if (!XERO_MANAGEMENT_ROLES.includes(userRole)) {
      console.log('❌ Insufficient permissions for test:', { userRole, allowed: XERO_MANAGEMENT_ROLES })
      return NextResponse.json(
        { 
          connected: false,
          error: 'Insufficient permissions',
          message: `You need Super Admin or Finance role to test Xero connection. Your current role: ${userRole}`
        },
        { status: 403 }
      )
    }

    // Check if we have stored tokens
    const tokens = await XeroOAuthService.getStoredTokens()

    if (!tokens) {
      console.log('⚠️ No Xero tokens found')
      return NextResponse.json({
        connected: false,
        message: 'Not connected to Xero. Please connect first.',
        error: 'No tokens found'
      })
    }

    // Test the connection
    const apiService = await createXeroApiService()

    if (!apiService) {
      console.log('❌ Failed to initialize Xero API service')
      return NextResponse.json({
        connected: false,
        message: 'Failed to initialize Xero connection',
        error: 'API service initialization failed'
      }, { status: 500 })
    }

    console.log('🔍 Testing Xero connection...')
    const testResult = await apiService.testConnection()

    if (testResult.success) {
      console.log('✅ Xero connection test successful:', {
        tenantId: tokens.tenantId,
        tenantName: tokens.tenantName,
        organizationName: testResult.organization?.Name
      })

      return NextResponse.json({
        connected: true,
        message: 'Xero connection test successful',
        details: {
          tenantName: tokens.tenantName,
          tenantId: tokens.tenantId,
          organizationName: testResult.organization?.Name,
          expiresAt: tokens.expiresAt
        }
      })
    }

    console.log('❌ Xero connection test failed:', testResult.error)
    return NextResponse.json({
      connected: false,
      message: 'Connection test failed',
      error: testResult.error || 'Unknown error'
    }, { status: 500 })

  } catch (error: any) {
    console.error('❌ Test connection error:', error)
    return NextResponse.json(
      {
        connected: false,
        message: 'Failed to test Xero connection',
        error: error.message || 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Also support GET method for convenience
export async function GET(request: NextRequest) {
  return POST(request)
}
