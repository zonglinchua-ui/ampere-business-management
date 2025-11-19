
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // Disable in production for security
  if (process.env.NODE_ENV === 'production' || process.env.DEPLOYMENT_MODE === 'production') {
    return NextResponse.json(
      { error: 'Debug endpoints disabled in production' },
      { status: 403 }
    )
  }

  try {
    const session = await getServerSession(authOptions)
    
    console.log('=== Debug Xero Status ===')
    console.log('Session:', {
      hasSession: !!session,
      userId: session?.user?.id,
      userEmail: session?.user?.email,
      userRole: session?.user?.role
    })

    // Check XeroIntegration records
    const integrations = await prisma.xeroIntegration.findMany({
      select: {
        id: true,
        tenantId: true,
        tenantName: true,
        isActive: true,
        connectedAt: true,
        lastSyncAt: true,
        expiresAt: true,
        createdById: true
      },
      orderBy: { connectedAt: 'desc' }
    })

    console.log('Found integrations:', integrations.length)
    integrations.forEach((integration: any, index: any) => {
      console.log(`${index + 1}.`, {
        id: integration.id,
        tenantId: integration.tenantId.substring(0, 8) + '...',
        tenantName: integration.tenantName,
        isActive: integration.isActive,
        connectedAt: integration.connectedAt,
        expiresAt: integration.expiresAt,
        createdById: integration.createdById
      })
    })

    const activeIntegrations = integrations.filter((i: any) => i.isActive)
    const expiredIntegrations = integrations.filter((i: any) => new Date(i.expiresAt) < new Date())

    return NextResponse.json({
      session: session ? {
        userId: session.user.id,
        email: session.user.email,
        role: session.user.role
      } : null,
      integrations: {
        total: integrations.length,
        active: activeIntegrations.length,
        expired: expiredIntegrations.length,
        records: integrations
      },
      summary: {
        hasActiveConnection: activeIntegrations.length > 0,
        hasExpiredTokens: expiredIntegrations.length > 0,
        latestConnection: integrations[0] || null
      }
    })
  } catch (error: any) {
    console.error('Debug endpoint error:', error)
    return NextResponse.json(
      { 
        error: 'Debug failed',
        details: error?.message || 'Unknown error',
        stack: error?.stack
      },
      { status: 500 }
    )
  }
}
