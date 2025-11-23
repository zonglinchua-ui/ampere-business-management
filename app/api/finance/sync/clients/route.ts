
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { logActivity, getIpAddress } from '@/lib/logger'

/**
 * REDIRECT ENDPOINT - /api/finance/sync/clients → /api/finance/sync/customers
 * 
 * This endpoint permanently redirects to the new customers endpoint
 * to maintain backward compatibility and avoid 400 errors.
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  
  await logActivity({
    userId: session?.user?.id || 'system',
    username: session?.user?.name || undefined,
    action: 'Deprecated API Redirected',
    message: 'Called deprecated endpoint /api/finance/sync/clients - redirecting to /api/finance/sync/customers',
    module: 'Customers',
    endpoint: '/api/finance/sync/clients',
    ipAddress: getIpAddress(request),
    isWarning: true,
  })

  // Return permanent redirect with the correct location
  return NextResponse.redirect(
    new URL('/api/finance/sync/customers', request.url), 
    { status: 308 } // Permanent Redirect
  )
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  
  await logActivity({
    userId: session?.user?.id || 'system',
    username: session?.user?.name || undefined,
    action: 'Deprecated API Redirected',
    message: 'Called deprecated endpoint /api/finance/sync/clients - redirecting to /api/finance/sync/customers',
    module: 'Customers',
    endpoint: '/api/finance/sync/clients',
    ipAddress: getIpAddress(request),
    isWarning: true,
  })

  return NextResponse.redirect(
    new URL('/api/finance/sync/customers', request.url), 
    { status: 308 }
  )
}
