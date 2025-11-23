
/**
 * Xero Real-Time Connection Status Endpoint
 * Verifies active Xero connection by making a lightweight API call
 * Returns accurate connection state even after prolonged time or token expiry
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { XeroOAuthService } from '@/lib/xero-oauth-service'
import { createXeroApiService } from '@/lib/xero-api-service'
import { prisma } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'

export const dynamic = 'force-dynamic'

// Roles that can manage Xero integration
const XERO_MANAGEMENT_ROLES = ['SUPERADMIN', 'FINANCE']

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    if (!user) {
      return NextResponse.json(
        { connected: false, reason: 'Authentication required', checking: false },
        { status: 401 }
      )
    }

    const userRole = user?.role || 'UNKNOWN'
    const canManage = XERO_MANAGEMENT_ROLES.includes(userRole)

    console.log('🔍 [Xero Status Check] User:', {
      email: user?.email,
      role: userRole,
      canManage
    })

    // Step 1: Check if we have stored tokens in database
    const tokens = await XeroOAuthService.getStoredTokens()

    if (!tokens) {
      console.log('❌ [Xero Status] No tokens found in database')
      return NextResponse.json({
        connected: false,
        reason: 'Not connected to Xero. Please complete OAuth flow.',
        checking: false,
        user: { role: userRole, canManage }
      })
    }

    // Step 2: Check token expiry
    const now = new Date()
    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000)

    console.log('🔍 [Xero Status] Token expiry check:', {
      expiresAt: tokens.expiresAt.toISOString(),
      now: now.toISOString(),
      expired: tokens.expiresAt <= now,
      expiresSoon: tokens.expiresAt <= fiveMinutesFromNow
    })

    if (tokens.expiresAt <= now) {
      console.log('⚠️ [Xero Status] Token expired')
      
      // Log connection lost event
      await prisma.system_logs.create({
        data: {
          id: uuidv4(),
          type: 'ERROR',
          module: 'Xero Integration',
          action: 'Token Expired',
          message: 'Xero access token has expired. Please reconnect.',
          status: 'WARNING',
          userId: user.id
        }
      })

      return NextResponse.json({
        connected: false,
        reason: 'Token expired. Please reconnect to Xero.',
        checking: false,
        user: { role: userRole, canManage },
        tokenExpired: true
      })
    }

    // Step 3: Make lightweight Xero API call to validate connection
    try {
      const apiService = await createXeroApiService()

      if (!apiService) {
        console.log('❌ [Xero Status] Failed to initialize API service')
        return NextResponse.json({
          connected: false,
          reason: 'Failed to initialize Xero API service',
          checking: false,
          user: { role: userRole, canManage }
        })
      }

      // Test connection by fetching connections endpoint
      const testResult = await apiService.testConnection()

      if (!testResult.success) {
        console.log('❌ [Xero Status] Connection test failed:', testResult.error)
        
        // Log connection lost event
        await prisma.system_logs.create({
          data: {
            id: uuidv4(),
            type: 'ERROR',
            module: 'Xero Integration',
            action: 'Connection Test Failed',
            message: testResult.error || 'Xero connection validation failed',
            status: 'CRITICAL',
            userId: user.id
          }
        })

        return NextResponse.json({
          connected: false,
          reason: testResult.error || 'Connection validation failed',
          checking: false,
          user: { role: userRole, canManage }
        })
      }

      // Step 4: Get additional connection details
      const integration = await prisma.xeroIntegration.findFirst({
        where: { isActive: true },
        select: {
          connectedAt: true,
          lastSyncAt: true,
          tenantId: true,
          expiresAt: true
        }
      })

      console.log('✅ [Xero Status] Connection validated successfully')

      return NextResponse.json({
        connected: true,
        checking: false,
        tenantName: tokens.tenantName,
        tenantId: tokens.tenantId,
        organization: testResult.organization,
        connection: {
          connectedAt: integration?.connectedAt?.toISOString() || new Date().toISOString(),
          lastSyncAt: integration?.lastSyncAt?.toISOString(),
          tenantId: tokens.tenantId,
          expiresAt: tokens.expiresAt.toISOString()
        },
        user: {
          role: userRole,
          canManage
        }
      })

    } catch (apiError: any) {
      console.error('❌ [Xero Status] API validation error:', apiError)
      
      // Log connection error
      await prisma.system_logs.create({
        data: {
          id: uuidv4(),
          type: 'ERROR',
          module: 'Xero Integration',
          action: 'API Validation Error',
          message: apiError.message || 'Unexpected error validating Xero connection',
          status: 'CRITICAL',
          userId: user.id
        }
      })

      return NextResponse.json({
        connected: false,
        reason: apiError.message || 'API validation error',
        checking: false,
        user: { role: userRole, canManage }
      })
    }

  } catch (error: any) {
    console.error('❌ [Xero Status] Unexpected error:', error)
    
    return NextResponse.json(
      {
        connected: false,
        reason: 'Internal server error',
        error: error.message,
        checking: false
      },
      { status: 500 }
    )
  }
}
