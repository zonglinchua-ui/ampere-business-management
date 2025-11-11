
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
      console.error('[Customers Sync] Unauthorized: No session user ID')
      await logError({
        action: 'Sync Customers from Xero',
        message: 'Unauthorized access attempt',
        module: 'Customers',
        endpoint: '/api/finance/sync/customers',
        ipAddress: getIpAddress(request),
      })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check user role - only Finance and SuperAdmin can sync
    const userRole = session.user.role
    if (!['SUPERADMIN', 'FINANCE', 'PROJECT_MANAGER'].includes(userRole)) {
      console.error(`[Customers Sync] Insufficient permissions for role: ${userRole}`)
      await logError({
        userId: session.user.id,
        username: session.user.name || undefined,
        role: userRole,
        action: 'Sync Customers from Xero',
        message: `Insufficient permissions for role: ${userRole}`,
        module: 'Customers',
        endpoint: '/api/finance/sync/customers',
        errorCode: '403',
        ipAddress: getIpAddress(request),
      })
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const { customerId, bulkSync } = body
    console.log('[Customers Sync] Request body:', JSON.stringify(body))

    // Get active Xero integration
    const activeIntegration = await prisma.xeroIntegration.findFirst({
      where: { isActive: true },
      orderBy: { connectedAt: 'desc' }
    })

    console.log('[Customers Sync] Active integration found:', activeIntegration ? 'Yes' : 'No')
    if (activeIntegration) {
      console.log('[Customers Sync] Integration details:', {
        id: activeIntegration.id,
        tenantId: activeIntegration.tenantId,
        hasAccessToken: !!activeIntegration.accessToken,
        hasRefreshToken: !!activeIntegration.refreshToken,
        expiresAt: activeIntegration.expiresAt
      })
    }

    if (!activeIntegration) {
      console.error('[Customers Sync] No active Xero integration found in database')
      await logError({
        userId: session.user.id,
        username: session.user.name || undefined,
        role: userRole,
        action: 'Sync Customers from Xero',
        message: 'No active Xero integration found',
        module: 'Customers',
        endpoint: '/api/finance/sync/customers',
        errorCode: '400',
        ipAddress: getIpAddress(request),
      })
      return NextResponse.json({ 
        error: 'No Xero integration found. Please connect to Xero first.' 
      }, { status: 400 })
    }

    const tokens = {
      accessToken: activeIntegration.accessToken,
      refreshToken: activeIntegration.refreshToken,
      expiresAt: activeIntegration.expiresAt,
      tenantId: activeIntegration.tenantId,
    }

    const xeroService = new ImprovedXeroService(tokens, session.user.id)

    let result
    if (bulkSync) {
      // Use the available syncContacts method which handles both clients and vendors
      result = await xeroService.syncContacts()
    } else if (customerId) {
      // Individual client sync not yet implemented in ImprovedXeroService
      result = {
        success: false,
        message: 'Individual client sync not yet implemented. Please use bulk sync.',
        syncedCount: 0,
        errors: ['Individual client sync functionality is being developed']
      }
    } else {
      return NextResponse.json({ error: 'customerId or bulkSync flag required' }, { status: 400 })
    }

    if (result.success) {
      const message = 'message' in result ? result.message : 'Customer synced successfully'
      const syncedCount = 'syncedCount' in result ? result.syncedCount : 1
      const errors = 'errors' in result ? result.errors : undefined
      
      // Log successful sync
      await logActivity({
        userId: session.user.id,
        username: session.user.name || undefined,
        role: userRole,
        action: 'Sync Customers from Xero',
        message: `Successfully synced ${syncedCount} customer(s) from Xero`,
        module: 'Customers',
        endpoint: '/api/finance/sync/customers',
        ipAddress: getIpAddress(request),
      })
      
      return NextResponse.json({ 
        message,
        syncedCount,
        errors
      })
    } else {
      const errorMessage = result.message || 'Sync failed'
      
      // Log sync failure
      await logError({
        userId: session.user.id,
        username: session.user.name || undefined,
        role: userRole,
        action: 'Sync Customers from Xero',
        message: errorMessage,
        module: 'Customers',
        endpoint: '/api/finance/sync/customers',
        errorCode: '500',
        ipAddress: getIpAddress(request),
      })
      
      return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
  } catch (error: any) {
    console.error('Customer sync error:', error)
    
    // Log critical error
    await logError({
      userId: session?.user?.id,
      username: session?.user?.name || undefined,
      role: session?.user?.role,
      action: 'Sync Customers from Xero',
      message: error?.message || 'Internal server error during sync',
      module: 'Customers',
      endpoint: '/api/finance/sync/customers',
      errorCode: '500',
      ipAddress: getIpAddress(request),
      isCritical: true,
    })
    
    return NextResponse.json({ 
      error: error?.message || 'Internal server error' 
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

    const userRole = session.user.role
    if (!['SUPERADMIN', 'FINANCE', 'PROJECT_MANAGER'].includes(userRole)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const customerId = searchParams.get('customerId')

    if (!customerId) {
      return NextResponse.json({ error: 'customerId required' }, { status: 400 })
    }

    const { prisma } = await import('@/lib/db')
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        name: true,
        xeroContactId: true,
        isXeroSynced: true,
        lastXeroSync: true,
      }
    })

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    return NextResponse.json({
      customerId: customer.id,
      customerName: customer.name,
      isSynced: !!customer.xeroContactId,
      xeroContactId: customer.xeroContactId,
      lastSyncDate: customer.lastXeroSync,
      syncStatus: customer.isXeroSynced ? 'synced' : 'not_synced'
    })
  } catch (error: any) {
    console.error('Customer sync status error:', error)
    return NextResponse.json({ 
      error: error?.message || 'Internal server error' 
    }, { status: 500 })
  }
}
