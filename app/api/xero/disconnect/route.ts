
/**
 * Xero Disconnect Endpoint
 * Disconnects the Xero integration
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { XeroOAuthService } from '@/lib/xero-oauth-service'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const user = session.user as any
    const userRole = user?.role || 'UNKNOWN'
    const allowedRoles = ['SUPERADMIN', 'FINANCE']

    console.log('🔌 Xero disconnect request:', { 
      userEmail: user?.email, 
      userRole, 
      allowedRoles 
    })

    if (!allowedRoles.includes(userRole)) {
      console.log('❌ Insufficient permissions for disconnect:', { userRole, allowedRoles })
      return NextResponse.json(
        { 
          error: 'Insufficient permissions',
          message: `You need Super Admin or Finance role to disconnect Xero. Your current role: ${userRole}` 
        },
        { status: 403 }
      )
    }

    // Disconnect Xero
    await XeroOAuthService.disconnect()

    console.log('✅ Xero disconnected by:', user.email)

    return NextResponse.json({
      success: true,
      message: 'Xero integration disconnected successfully'
    })

  } catch (error: any) {
    console.error('❌ Disconnect failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to disconnect Xero',
        details: error.message
      },
      { status: 500 }
    )
  }
}
