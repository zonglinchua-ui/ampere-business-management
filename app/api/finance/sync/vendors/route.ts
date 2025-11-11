
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ImprovedXeroService } from '@/lib/xero-service-improved'
import { prisma } from '@/lib/db'
import { logActivity, logError, getIpAddress } from '@/lib/logger'

export async function POST(request: NextRequest) {
  let session: any = null
  try {
    session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      console.error('[Vendors Sync] Unauthorized: No session user ID')
      await logError({
        action: 'Sync Vendors from Xero',
        message: 'Unauthorized access attempt',
        module: 'Vendors',
        endpoint: '/api/finance/sync/vendors',
        ipAddress: getIpAddress(request),
      })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check user role - only Finance and SuperAdmin can sync
    const userRole = session.user.role
    if (!['SUPERADMIN', 'FINANCE', 'PROJECT_MANAGER'].includes(userRole)) {
      console.error(`[Vendors Sync] Insufficient permissions for role: ${userRole}`)
      await logError({
        userId: session.user.id,
        username: session.user.name || undefined,
        role: userRole,
        action: 'Sync Vendors from Xero',
        message: `Insufficient permissions for role: ${userRole}`,
        module: 'Vendors',
        endpoint: '/api/finance/sync/vendors',
        errorCode: '403',
        ipAddress: getIpAddress(request),
      })
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const { vendorId, bulkSync, forceSync } = body
    console.log('[Vendors Sync] Request body:', JSON.stringify({ vendorId, bulkSync, forceSync }))

    // Get active Xero integration
    const activeIntegration = await prisma.xeroIntegration.findFirst({
      where: { isActive: true },
      orderBy: { connectedAt: 'desc' }
    })

    console.log('[Vendors Sync] Active integration found:', activeIntegration ? 'Yes' : 'No')
    if (activeIntegration) {
      console.log('[Vendors Sync] Integration details:', {
        id: activeIntegration.id,
        tenantId: activeIntegration.tenantId,
        tenantName: activeIntegration.tenantName,
        hasAccessToken: !!activeIntegration.accessToken,
        hasRefreshToken: !!activeIntegration.refreshToken,
        expiresAt: activeIntegration.expiresAt,
        isExpired: activeIntegration.expiresAt < new Date()
      })
    }

    if (!activeIntegration || !activeIntegration.accessToken) {
      console.error('[Vendors Sync] No active Xero integration found')
      await logError({
        userId: session.user.id,
        username: session.user.name || undefined,
        role: userRole,
        action: 'Sync Vendors from Xero',
        message: 'No active Xero integration found',
        module: 'Vendors',
        endpoint: '/api/finance/sync/vendors',
        errorCode: 'XERO_NOT_CONNECTED',
        ipAddress: getIpAddress(request),
      })
      return NextResponse.json({
        error: 'Xero not connected',
        message: 'Please connect to Xero first from the Finance dashboard',
        code: 'XERO_NOT_CONNECTED'
      }, { status: 400 })
    }

    // Check if token is expired
    if (activeIntegration.expiresAt < new Date()) {
      console.error('[Vendors Sync] Xero token expired')
      await logError({
        userId: session.user.id,
        username: session.user.name || undefined,
        action: 'Sync Vendors from Xero',
        message: 'Xero token expired - requires reconnection',
        module: 'Vendors',
        endpoint: '/api/finance/sync/vendors',
        errorCode: 'XERO_TOKEN_EXPIRED',
        ipAddress: getIpAddress(request),
      })
      return NextResponse.json({
        error: 'Xero connection expired',
        message: 'Please reconnect to Xero from the Finance dashboard',
        code: 'XERO_TOKEN_EXPIRED'
      }, { status: 400 })
    }

    // Initialize Xero service
    const xeroService = new ImprovedXeroService(activeIntegration)

    let syncResult: any = null
    let syncMessage = 'Vendors synchronized successfully'

    try {
      // Use the generic contacts sync method which includes both clients and vendors
      console.log('[Vendors Sync] Starting contacts sync (includes vendors)')
      syncResult = await xeroService.syncContacts()
      
      const syncedVendors = syncResult?.details?.syncedContacts?.filter((contact: any) => 
        contact.type?.includes('Vendor')
      ) || []
      
      syncMessage = `${syncedVendors.length} vendors synchronized from ${syncResult?.syncedCount || 0} total contacts`

      console.log('[Vendors Sync] Sync completed successfully:', syncResult)

      // Log successful activity
      await logActivity({
        userId: session.user.id,
        username: session.user.name || undefined,
        action: 'Sync Vendors from Xero',
        message: syncMessage,
        module: 'Vendors',
        endpoint: '/api/finance/sync/vendors',
        ipAddress: getIpAddress(request)
      })

      const vendorsList = syncResult?.details?.syncedContacts?.filter((contact: any) => 
        contact.type?.includes('Vendor')
      ) || []

      return NextResponse.json({
        success: true,
        message: syncMessage,
        result: {
          totalSynced: vendorsList.length,
          totalContacts: syncResult?.syncedCount || 0,
          totalErrors: syncResult?.errors?.length || 0,
          syncType: 'contacts',
          timestamp: new Date().toISOString(),
          errors: syncResult?.errors || [],
          syncedVendors: vendorsList
        }
      }, { status: 200 })

    } catch (syncError: any) {
      console.error('[Vendors Sync] Sync operation failed:', syncError)
      
      // Log sync error
      await logError({
        userId: session.user.id,
        username: session.user.name || undefined,
        action: 'Sync Vendors from Xero',
        message: `Vendor sync failed: ${syncError.message}`,
        module: 'Vendors',
        endpoint: '/api/finance/sync/vendors',
        errorCode: syncError.code || 'SYNC_FAILED',
        ipAddress: getIpAddress(request)
      })

      // Handle specific sync errors
      if (syncError.message?.includes('401') || syncError.message?.includes('Unauthorized')) {
        return NextResponse.json({
          error: 'Xero authorization expired',
          message: 'Please reconnect to Xero from the Finance dashboard',
          code: 'XERO_AUTH_EXPIRED'
        }, { status: 401 })
      }

      if (syncError.message?.includes('403') || syncError.message?.includes('Forbidden')) {
        return NextResponse.json({
          error: 'Xero access denied',
          message: 'Insufficient permissions in Xero. Please check your Xero user permissions.',
          code: 'XERO_ACCESS_DENIED'
        }, { status: 403 })
      }

      if (syncError.message?.includes('rate limit')) {
        return NextResponse.json({
          error: 'Rate limit exceeded',
          message: 'Too many requests to Xero API. Please try again in a few minutes.',
          code: 'RATE_LIMIT_EXCEEDED'
        }, { status: 429 })
      }

      return NextResponse.json({
        error: 'Vendor sync failed',
        message: syncError.message || 'Unknown sync error occurred',
        code: syncError.code || 'SYNC_FAILED',
        details: process.env.NODE_ENV === 'development' ? syncError.stack : undefined
      }, { status: 500 })
    }

  } catch (error: any) {
    console.error('[Vendors Sync] Unexpected error:', error)
    
    // Log unexpected error
    if (session?.user?.id) {
      await logError({
        userId: session.user.id,
        username: session.user.name || undefined,
        action: 'Sync Vendors from Xero',
        message: `Unexpected error: ${error.message}`,
        module: 'Vendors',
        endpoint: '/api/finance/sync/vendors',
        errorCode: 'UNEXPECTED_ERROR',
        ipAddress: getIpAddress(request)
      })
    }

    return NextResponse.json({
      error: 'Internal server error',
      message: 'An unexpected error occurred during vendor sync',
      code: 'INTERNAL_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 })
  }
}

// GET endpoint to check sync status
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get active Xero integration
    const activeIntegration = await prisma.xeroIntegration.findFirst({
      where: { isActive: true },
      select: {
        tenantName: true,
        tenantId: true,
        isActive: true,
        expiresAt: true,
        lastSyncAt: true
      }
    })

    if (!activeIntegration) {
      return NextResponse.json({
        connected: false,
        message: 'Xero not connected'
      })
    }

    const isExpired = activeIntegration.expiresAt < new Date()
    
    return NextResponse.json({
      connected: !isExpired,
      tenantName: activeIntegration.tenantName,
      lastSync: activeIntegration.lastSyncAt,
      expiresAt: activeIntegration.expiresAt,
      status: isExpired ? 'expired' : 'active'
    })

  } catch (error: any) {
    console.error('[Vendors Sync Status] Error:', error)
    return NextResponse.json({
      error: 'Failed to get sync status',
      details: error.message
    }, { status: 500 })
  }
}
