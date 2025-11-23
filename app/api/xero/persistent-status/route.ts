
/**
 * Xero Persistent Connection Status API
 * Returns the current status of the permanent Xero connection to "Ampere Engineering"
 * This endpoint is called by the frontend to display connection status
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getPersistentConnectionStatus, getConnectionDetails } from '@/lib/xero-persistent-connection'

export const dynamic = 'force-dynamic'

/**
 * GET - Get persistent connection status
 * Shows whether "Ampere Engineering" is currently connected
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

    // Get connection status
    const status = await getPersistentConnectionStatus()
    const details = await getConnectionDetails()

    return NextResponse.json({
      success: true,
      status,
      details,
      message: status.isConnected 
        ? `Permanently connected to ${status.tenantName || 'Ampere Engineering'}` 
        : 'Not connected. Authorization required.'
    })

  } catch (error: any) {
    console.error('Error getting persistent status:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to get connection status'
      },
      { status: 500 }
    )
  }
}

