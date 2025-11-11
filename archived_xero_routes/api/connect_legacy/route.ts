
/**
 * Xero OAuth Connect Endpoint
 * Initiates the OAuth flow by generating the authorization URL
 */

import { NextRequest, NextResponse } from 'next/server'
import { XeroOAuthService } from '@/lib/xero-oauth-service'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// Roles that can manage Xero integration
const XERO_MANAGEMENT_ROLES = ['SUPERADMIN', 'FINANCE']

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const user = session.user as any
    const userRole = user?.role || 'UNKNOWN'

    console.log('🔗 Xero connect request from:', session.user.email, 'Role:', userRole)

    // Check permissions
    if (!XERO_MANAGEMENT_ROLES.includes(userRole)) {
      console.log('❌ Insufficient permissions:', { userRole, allowed: XERO_MANAGEMENT_ROLES })
      return NextResponse.json(
        { 
          success: false,
          error: 'Insufficient permissions',
          message: `You need Super Admin or Finance role to manage Xero integration. Your current role: ${userRole}`
        },
        { status: 403 }
      )
    }

    // Create OAuth service
    const oauthService = new XeroOAuthService(session.user.id)

    // Generate authorization URL
    const authUrl = await oauthService.getAuthorizationUrl()

    return NextResponse.json({
      success: true,
      authUrl,
      message: 'Redirect user to this URL to authorize Xero access'
    })

  } catch (error: any) {
    console.error('❌ Failed to generate authorization URL:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to initiate Xero connection',
        details: error.message
      },
      { status: 500 }
    )
  }
}
