

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ImprovedXeroService } from '@/lib/xero-service-improved'
import { prisma } from '@/lib/db'

// GET: Get sync status and statistics
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

    // Get sync statistics
    const [
      totalClients,
      syncedClients,
      totalVendors,
      syncedVendors,
      totalInvoices,
      syncedInvoices,
      totalPayments,
      syncedPayments,
      pendingConflicts
    ] = await Promise.all([
      prisma.customer.count({ where: { isActive: true } }),
      prisma.customer.count({ where: { isActive: true, isXeroSynced: true } }),
      prisma.supplier.count({ where: { isActive: true } }),
      prisma.supplier.count({ where: { isActive: true, isXeroSynced: true } }),
      prisma.customerInvoice.count(),
      prisma.customerInvoice.count({ where: { isXeroSynced: true } }),
      prisma.payment.count(),
      prisma.payment.count({ where: { isXeroSynced: true } }),
      prisma.xero_sync_conflicts.count({ where: { status: 'PENDING' } })
    ])

    const clientsPercentage = totalClients > 0 ? Math.round((syncedClients / totalClients) * 100) : 100
    const vendorsPercentage = totalVendors > 0 ? Math.round((syncedVendors / totalVendors) * 100) : 100
    const invoicesPercentage = totalInvoices > 0 ? Math.round((syncedInvoices / totalInvoices) * 100) : 100
    const paymentsPercentage = totalPayments > 0 ? Math.round((syncedPayments / totalPayments) * 100) : 100

    return NextResponse.json({
      clients: {
        total: totalClients,
        synced: syncedClients,
        unsynced: totalClients - syncedClients,
        syncPercentage: clientsPercentage
      },
      vendors: {
        total: totalVendors,
        synced: syncedVendors,
        unsynced: totalVendors - syncedVendors,
        syncPercentage: vendorsPercentage
      },
      invoices: {
        total: totalInvoices,
        synced: syncedInvoices,
        unsynced: totalInvoices - syncedInvoices,
        syncPercentage: invoicesPercentage
      },
      payments: {
        total: totalPayments,
        synced: syncedPayments,
        unsynced: totalPayments - syncedPayments,
        syncPercentage: paymentsPercentage
      },
      conflicts: {
        total: pendingConflicts
      }
    })

  } catch (error: any) {
    console.error('Bulk sync status error:', error)
    return NextResponse.json({ 
      error: error?.message || 'Internal server error' 
    }, { status: 500 })
  }
}

// POST: Execute bulk bidirectional sync
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = session.user.role
    if (!['SUPERADMIN', 'FINANCE'].includes(userRole)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const { 
      types = ['clients', 'vendors', 'invoices', 'bills', 'payments'], 
      direction = 'bidirectional',
      resolveConflicts = false 
    } = body
    
    console.log('[Bulk Sync] Request params:', { types, direction, resolveConflicts })

    // Get active Xero integration
    const activeIntegration = await prisma.xeroIntegration.findFirst({
      where: { isActive: true },
      orderBy: { connectedAt: 'desc' }
    })

    console.log('[Bulk Sync] Active integration found:', activeIntegration ? 'Yes' : 'No')
    if (activeIntegration) {
      console.log('[Bulk Sync] Integration details:', {
        id: activeIntegration.id,
        tenantId: activeIntegration.tenantId,
        hasAccessToken: !!activeIntegration.accessToken,
        hasRefreshToken: !!activeIntegration.refreshToken,
        expiresAt: activeIntegration.expiresAt
      })
    }

    if (!activeIntegration) {
      console.error('[Bulk Sync] No active Xero integration found in database')
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
    const results: any = {}
    let totalSynced = 0
    let totalConflicts = 0
    const errors: string[] = []

    // Execute sync operations based on requested types and direction
    for (const type of types) {
      console.log(`Starting ${direction} sync for ${type}...`)
      
      try {
        let result
        
        switch (type) {
          case 'clients':
          case 'vendors':
          case 'contacts':
            // Use the available syncContacts method for both clients and vendors
            result = await xeroService.syncContacts()
            break

          case 'invoices':
            result = {
              success: false,
              message: 'Invoice sync not yet implemented in ImprovedXeroService',
              syncedCount: 0,
              errors: ['Invoice sync functionality is being developed']
            }
            break

          case 'bills':
            result = {
              success: false,
              message: 'Bills sync not yet implemented in ImprovedXeroService',
              syncedCount: 0,
              errors: ['Bills sync functionality is being developed']
            }
            break

          case 'payments':
            result = {
              success: false,
              message: 'Payments sync not yet implemented in ImprovedXeroService',
              syncedCount: 0,
              errors: ['Payments sync functionality is being developed']
            }
            break

          default:
            errors.push(`Unknown sync type: ${type}`)
            continue
        }

        if (result) {
          results[type] = {
            success: result.success,
            message: result.message,
            syncedCount: result.syncedCount || 0,
            errors: result.errors
          }

          if (result.success) {
            totalSynced += result.syncedCount || 0
          } else {
            errors.push(`${type}: ${result.message}`)
          }

          // Count conflicts if mentioned in the message
          if (result.message?.includes('conflicts flagged')) {
            const conflictMatch = result.message.match(/(\d+) conflicts flagged/)
            if (conflictMatch) {
              totalConflicts += parseInt(conflictMatch[1])
            }
          }
        }

      } catch (error: any) {
        console.error(`Bulk sync error for ${type}:`, error)
        errors.push(`${type}: ${error?.message || 'Unknown error'}`)
        results[type] = {
          success: false,
          message: error?.message || 'Unknown error',
          syncedCount: 0
        }
      }
    }

    // Get updated conflict count from database directly
    const activeConflicts = await prisma.xero_sync_conflicts.findMany({
      where: { status: 'PENDING' },
      take: 10,
      select: { id: true, entity: true, entityId: true, conflictType: true }
    })
    totalConflicts = Math.max(totalConflicts, activeConflicts.length)

    const overallSuccess = errors.length === 0
    const message = overallSuccess 
      ? `Bulk sync completed: ${totalSynced} records synced${totalConflicts > 0 ? `, ${totalConflicts} conflicts detected` : ''}`
      : `Bulk sync completed with errors: ${totalSynced} records synced, ${errors.length} errors`

    return NextResponse.json({
      success: overallSuccess,
      message,
      totalSynced,
      totalConflicts,
      results,
      errors: errors.length > 0 ? errors : undefined,
      conflicts: totalConflicts > 0 ? activeConflicts : undefined // Show first 10 conflicts
    })

  } catch (error: any) {
    console.error('Bulk sync error:', error)
    return NextResponse.json({ 
      error: error?.message || 'Internal server error' 
    }, { status: 500 })
  }
}

