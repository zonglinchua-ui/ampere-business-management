
/**
 * Enhanced Xero OAuth Authorization Endpoint
 * Uses the enhanced OAuth service with better error handling
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { EnhancedXeroOAuthService } from '@/lib/xero-oauth-service-fixed'

export const dynamic = 'force-dynamic'

/**
 * GET handler - Generates Xero authorization URL with enhanced error handling
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Authentication required'
        },
        { status: 401 }
      )
    }

    const user = session.user as any
    const userRole = user?.role || 'UNKNOWN'
    const allowedRoles = ['SUPERADMIN', 'FINANCE', 'PROJECT_MANAGER']
    
    if (!allowedRoles.includes(userRole)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Insufficient permissions. Xero integration requires SUPERADMIN, FINANCE, or PROJECT_MANAGER role.'
        },
        { status: 403 }
      )
    }

    console.log('🔐 Generating Xero authorization URL for user:', user.email)
    console.log('   User role:', userRole)

    // Validate environment configuration
    if (!process.env.XERO_CLIENT_ID) {
      console.error('❌ XERO_CLIENT_ID not configured')
      return NextResponse.json(
        {
          success: false,
          error: 'Xero integration not properly configured (missing client ID)'
        },
        { status: 500 }
      )
    }

    if (!process.env.XERO_CLIENT_SECRET) {
      console.error('❌ XERO_CLIENT_SECRET not configured')
      return NextResponse.json(
        {
          success: false,
          error: 'Xero integration not properly configured (missing client secret)'
        },
        { status: 500 }
      )
    }

    // Create enhanced OAuth service and generate authorization URL
    const oauthService = new EnhancedXeroOAuthService(user.id)
    const authUrl = await oauthService.getAuthorizationUrl()

    console.log('✅ Authorization URL generated successfully')
    console.log('   URL domain:', new URL(authUrl).hostname)

    return NextResponse.json({
      success: true,
      authUrl,
      message: 'Authorization URL generated. Redirecting to Xero...',
      debug: {
        clientId: process.env.XERO_CLIENT_ID?.substring(0, 8) + '...',
        redirectUri: process.env.XERO_REDIRECT_URI,
        hasSecret: !!process.env.XERO_CLIENT_SECRET
      }
    })

  } catch (error: any) {
    console.error('❌ Failed to generate authorization URL:', error)
    
    // Provide specific error messages
    let errorMessage = error.message || 'Failed to generate authorization URL'
    
    if (error.message?.includes('redirect_uri')) {
      errorMessage = 'Redirect URI configuration error. Please verify Xero Developer Console settings.'
    } else if (error.message?.includes('client_id')) {
      errorMessage = 'Invalid client configuration. Please check Xero credentials.'
    }
    
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}
