
/**
 * Xero Invoice Push Endpoint - DISABLED (Pull-Only Mode)
 * 
 * The Xero integration now operates in pull-only mode for financial data.
 * Invoices are created and managed in Xero, then pulled into Ampere.
 * To create invoices in Xero, use the "Request Invoice in Xero" feature.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * POST /api/xero/sync/invoices/push
 * DISABLED - This endpoint no longer pushes invoices to Xero
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
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
          error: 'Insufficient permissions',
          message: `You need Super Admin, Finance, or Project Manager role. Your current role: ${userRole}`
        },
        { status: 403 }
      )
    }

    console.log('⚠️ Invoice push to Xero attempted - feature disabled (pull-only mode)', {
      user: user.email
    })

    return NextResponse.json(
      {
        success: false,
        error: 'Invoice push disabled',
        message: 'Xero operates in pull-only mode for financial data. Invoices must be created directly in Xero, then synced to Ampere. Use the "Request Invoice in Xero" feature to create invoices in Xero.',
        suggestion: 'Create invoices in Xero first, then sync to Ampere using the pull sync feature.'
      },
      { status: 501 } // 501 Not Implemented
    )

  } catch (error: any) {
    console.error('❌ Invoice push endpoint error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Request failed',
        message: error.message || 'An unexpected error occurred'
      },
      { status: 500 }
    )
  }
}
