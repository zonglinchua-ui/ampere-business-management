
/**
 * Xero Enhanced Sync Endpoint
 * Performs data synchronization from Xero
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createXeroApiService } from '@/lib/xero-api-service'
import { prisma } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'
import { proactivelyRefreshXeroTokens } from '@/lib/xero-token-refresh-service'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // Increased to 5 minutes for large syncs

/**
 * GET handler for connection status
 * Returns connection status with permission information
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { 
          connected: false,
          hasPermission: false,
          error: 'Authentication required'
        },
        { status: 200 } // Return 200 so frontend can handle the state
      )
    }

    const user = session.user as any
    const userRole = user?.role || 'UNKNOWN'
    const allowedRoles = ['SUPERADMIN', 'FINANCE', 'PROJECT_MANAGER']
    const hasPermission = allowedRoles.includes(userRole)

    console.log('🔍 Xero status check:', { 
      userEmail: user?.email, 
      userRole, 
      hasPermission,
      allowedRoles 
    })

    // Check if connected to Xero
    const integration = await prisma.xeroIntegration.findFirst({
      where: { isActive: true },
      select: {
        connectedAt: true,
        lastSyncAt: true,
        tenantId: true,
        tenantName: true,
        expiresAt: true
      }
    })

    // Get sync statistics
    const stats = await prisma.xero_logs.groupBy({
      by: ['entity', 'status'],
      _count: {
        id: true
      },
      where: {
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      }
    })

    // Get recent logs
    const recentLogs = await prisma.xero_logs.findMany({
      take: 5,
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        id: true,
        entity: true,
        direction: true,
        status: true,
        recordsProcessed: true,
        recordsSucceeded: true,
        recordsFailed: true,
        message: true,
        errorMessage: true,
        details: true,
        createdAt: true
      }
    })

    return NextResponse.json({
      connected: !!integration,
      hasPermission,
      canApprove: allowedRoles.includes(userRole),
      organisation: integration ? {
        name: integration.tenantName || 'Unknown',
        shortCode: integration.tenantId || '',
        countryCode: 'SG'
      } : undefined,
      lastSync: integration?.lastSyncAt?.toISOString(),
      stats: {
        clients: { total: 0, synced: 0, percentage: 0 },
        vendors: { total: 0, synced: 0, percentage: 0 },
        invoices: { total: 0, synced: 0, percentage: 0 },
        payments: { total: 0, synced: 0, percentage: 0 }
      },
      recentLogs: recentLogs.map((log: any) => {
        let warnings: string[] = []
        let errors: string[] = []

        if (log.details) {
          try {
            const parsedDetails = JSON.parse(log.details)
            const resultDetails = parsedDetails?.result || parsedDetails || {}

            if (Array.isArray(resultDetails?.warnings)) {
              warnings = resultDetails.warnings.map((warning: any) => String(warning))
            }

            if (Array.isArray(resultDetails?.errors)) {
              errors = resultDetails.errors.map((error: any) => String(error))
            } else if (resultDetails?.errors) {
              errors = [String(resultDetails.errors)]
            }
          } catch (parseError) {
            console.warn('⚠️ Failed to parse log details for warnings/errors', parseError)
          }
        }

        return {
          id: log.id,
          entity: log.entity,
          entityId: '',
          syncType: log.direction,
          status: log.status as 'SUCCESS' | 'ERROR' | 'SKIPPED',
          xeroId: '',
          message: log.message,
          recordsProcessed: log.recordsProcessed,
          recordsSucceeded: log.recordsSucceeded,
          recordsFailed: log.recordsFailed,
          warnings,
          errors,
          errorMessage: log.errorMessage || undefined,
          createdAt: log.createdAt.toISOString()
        }
      })
    })

  } catch (error: any) {
    console.error('❌ Failed to fetch Xero status:', error)
    return NextResponse.json(
      {
        connected: false,
        hasPermission: false,
        error: 'Failed to check connection status'
      },
      { status: 200 }
    )
  }
}

/**
 * POST handler for enhanced sync operations
 * Performs data synchronization from Xero
 */
export async function POST(request: NextRequest) {
  let requestBody: any = {}
  
  try {
    // Check authentication and permissions
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required', message: 'You must be logged in to sync data' },
        { status: 401 }
      )
    }

    const user = session.user as any
    const userRole = user?.role || 'UNKNOWN'
    const allowedRoles = ['SUPERADMIN', 'FINANCE', 'PROJECT_MANAGER']

    console.log('📊 Xero sync request:', { 
      userEmail: user?.email, 
      userRole, 
      allowedRoles 
    })

    if (!allowedRoles.includes(userRole)) {
      console.log('❌ Insufficient permissions for sync:', { userRole, allowedRoles })
      return NextResponse.json(
        { 
          success: false, 
          error: 'Insufficient permissions',
          message: `You need Super Admin, Finance, or Project Manager role to sync data. Your current role: ${userRole}`
        },
        { status: 403 }
      )
    }

    // Parse request body
    try {
      requestBody = await request.json()
    } catch (jsonError) {
      console.error('❌ Failed to parse request body:', jsonError)
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid request body',
          message: 'Request body must be valid JSON'
        },
        { status: 400 }
      )
    }

    const { syncType, entityType, entity } = requestBody
    
    console.log('📊 Sync request details:', { syncType, entityType, entity, requestBody })

    // Validate Xero connection before sync operations (except test_connection)
    if (syncType !== 'test_connection') {
      const { validateOrThrow } = await import('@/lib/xero-connection-validator')
      try {
        await validateOrThrow()
        console.log('✅ [Enhanced Sync] Connection validated')
      } catch (validationError: any) {
        console.error('❌ [Enhanced Sync] Connection validation failed:', validationError.message)
        return NextResponse.json(
          { 
            success: false,
            error: 'Xero connection invalid',
            message: validationError.message
          },
          { status: 400 }
        )
      }
    }

    // Normalize entity type
    let normalizedEntity = entity || entityType || ''
    
    // Proactively refresh tokens before any sync operation to ensure seamless operation
    console.log('🔄 Proactively refreshing Xero tokens before sync...')
    await proactivelyRefreshXeroTokens()
    
    // Handle different sync types
    if (syncType === 'test_connection') {
      // Initialize Xero API service
      const xeroService = await createXeroApiService()

      if (!xeroService) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Not connected to Xero',
            message: 'Unable to connect to Xero. Please check your connection and try again.'
          },
          { status: 400 }
        )
      }

      // Test connection
      const testResult = await xeroService.testConnection()
      
      if (testResult.success) {
        return NextResponse.json({
          success: true,
          message: 'Connection test successful',
          organisation: testResult.organization
        })
      } else {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Connection test failed',
            message: testResult.error || 'Unable to connect to Xero'
          },
          { status: 400 }
        )
      }
    }

    // Validate entity type for sync operations
    if (!normalizedEntity || normalizedEntity === '') {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Entity type is required',
          message: 'Please specify which data type to sync (contacts, invoices, payments, etc.)'
        },
        { status: 400 }
      )
    }

    // Initialize Xero API service
    const xeroService = await createXeroApiService()

    if (!xeroService) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Not connected to Xero',
          message: 'Unable to connect to Xero. Please reconnect your Xero account.'
        },
        { status: 400 }
      )
    }

    console.log(`📊 Starting ${syncType || 'manual'} sync for ${normalizedEntity}...`)

    // Perform sync based on entity type and sync direction
    let result: any
    const isPush = syncType === 'push_to_xero'
    const isPull = syncType === 'pull_from_xero'
    const isBidirectional = syncType === 'bidirectional_sync' || syncType === 'full_sync'

    switch (normalizedEntity.toLowerCase()) {
      case 'contacts':
      case 'clients':
      case 'vendors':
        if (isPush) {
          // Push contacts to Xero (Phase D)
          try {
            const pushResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/xero/sync/contacts/push`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Cookie': request.headers.get('cookie') || ''
              },
              body: JSON.stringify({
                onlyUnsynced: true
              })
            })

            if (!pushResponse.ok) {
              const errorData = await pushResponse.json()
              throw new Error(errorData.error || 'Failed to push contacts')
            }

            result = await pushResponse.json()
          } catch (pushError: any) {
            console.error('❌ Push contacts failed:', pushError)
            return NextResponse.json(
              { 
                success: false, 
                error: 'Push operation failed',
                message: pushError.message || 'Failed to push contacts to Xero'
              },
              { status: 500 }
            )
          }
        } else if (isPull || isBidirectional) {
          // Pull contacts from Xero (Phase C)
          result = await xeroService.syncContacts()
          
          // If bidirectional, also push
          if (isBidirectional) {
            try {
              const pushResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/xero/sync/contacts/push`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Cookie': request.headers.get('cookie') || ''
                },
                body: JSON.stringify({
                  onlyUnsynced: true
                })
              })

              const pushResult = await pushResponse.json()
              
              // Combine results
              if (pushResult.success) {
                result.message = `${result.message}. Pushed ${pushResult.created + pushResult.updated} contacts to Xero.`
              }
            } catch (pushError: any) {
              console.error('❌ Push contacts failed during bidirectional sync:', pushError)
              result.message = `${result.message}. Warning: Failed to push contacts to Xero.`
            }
          }
        } else {
          // Default to pull
          result = await xeroService.syncContacts()
        }
        
        // Add filter message if needed
        if (normalizedEntity !== 'contacts') {
          result.message = `${result.message} (filtered for ${normalizedEntity})`
        }
        break

      case 'invoices':
        // PULL-ONLY MODE: Invoices can only be pulled from Xero, not pushed
        if (isPush) {
          return NextResponse.json(
            { 
              success: false, 
              error: 'Invoice push disabled',
              message: 'Xero operates in pull-only mode for invoices. Invoices must be created in Xero, then synced to Ampere.'
            },
            { status: 501 }
          )
        } else {
          // Pull invoices from Xero (default behavior)
          try {
            const pullResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/xero/sync/invoices/pull`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Cookie': request.headers.get('cookie') || ''
              },
              body: JSON.stringify({
                forceRefresh: false
              })
            })

            if (!pullResponse.ok) {
              const errorData = await pullResponse.json()
              throw new Error(errorData.error || 'Failed to pull invoices')
            }

            result = await pullResponse.json()
          } catch (pullError: any) {
            console.error('❌ Pull invoices failed:', pullError)
            return NextResponse.json(
              { 
                success: false, 
                error: 'Pull operation failed',
                message: pullError.message || 'Failed to pull invoices from Xero'
              },
              { status: 500 }
            )
          }
        }
        break

      case 'payments':
        // PULL-ONLY MODE: Payments can only be pulled from Xero, not pushed
        if (isPush) {
          return NextResponse.json(
            { 
              success: false, 
              error: 'Payment push disabled',
              message: 'Xero operates in pull-only mode for payments. Payments must be created in Xero, then synced to Ampere.'
            },
            { status: 501 }
          )
        } else {
          // Pull payments from Xero (default behavior)
          try {
            const pullResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/xero/sync/payments/pull`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Cookie': request.headers.get('cookie') || ''
              },
              body: JSON.stringify({
                forceRefresh: false
              })
            })

            if (!pullResponse.ok) {
              const errorData = await pullResponse.json()
              throw new Error(errorData.error || 'Failed to pull payments')
            }

            result = await pullResponse.json()
          } catch (pullError: any) {
            console.error('❌ Pull payments failed:', pullError)
            return NextResponse.json(
              { 
                success: false, 
                error: 'Pull operation failed',
                message: pullError.message || 'Failed to pull payments from Xero'
              },
              { status: 500 }
            )
          }
        }
        break

      case 'transactions':
        return NextResponse.json(
          { 
            success: false, 
            error: 'Not implemented',
            message: 'Transaction sync is coming soon. Currently only contact sync is available.'
          },
          { status: 501 }
        )

      default:
        console.warn(`⚠️ Unsupported entity type: ${normalizedEntity}`)
        return NextResponse.json(
          { 
            success: false, 
            error: 'Unsupported entity type',
            message: `Entity type '${normalizedEntity}' is not supported. Available: contacts, clients, vendors`
          },
          { status: 400 }
        )
    }

    // Ensure result has required fields
    if (!result) {
      throw new Error('Sync operation returned no result')
    }

    // Log sync operation
    try {
      const direction = isPush ? 'PUSH' : (isBidirectional ? 'BOTH' : 'PULL')
      const totalProcessed = (result.totalCount || 0) + (result.created || 0) + (result.updated || 0) + (result.skipped || 0)
      const totalSucceeded = (result.syncedCount || 0) + (result.created || 0) + (result.updated || 0)
      const totalFailed = (result.errors?.length || 0) + (result.errors || 0)
      
      await prisma.xero_logs.create({
        data: {
          id: uuidv4(),
          timestamp: new Date(),
          userId: user.id,
          direction,
          entity: normalizedEntity.toUpperCase(),
          status: result.success ? 'SUCCESS' : 'ERROR',
          recordsProcessed: totalProcessed,
          recordsSucceeded: totalSucceeded,
          recordsFailed: totalFailed,
          message: result.message || 'Sync completed',
          details: JSON.stringify({ syncType, entityType, result }),
          errorMessage: result.success ? null : (result.message || 'Unknown error'),
          updatedAt: new Date()
        }
      })
    } catch (logError: any) {
      console.error('⚠️ Failed to log sync operation:', logError.message)
      // Don't fail the request if logging fails
    }

    console.log(`✅ ${normalizedEntity} sync completed:`, result.message)

    // Ensure response has all required fields
    return NextResponse.json({
      success: result.success || false,
      message: result.message || 'Sync completed',
      syncedCount: result.syncedCount,
      totalCount: result.totalCount,
      errors: result.errors,
      details: result
    })

  } catch (error: any) {
    console.error('❌ Sync failed:', {
      error: error.message,
      stack: error.stack,
      requestBody
    })
    
    // Return detailed error information
    return NextResponse.json(
      {
        success: false,
        error: 'Sync operation failed',
        message: error.message || 'An unexpected error occurred during sync',
        details: {
          errorType: error.name,
          requestBody
        }
      },
      { status: 500 }
    )
  }
}
