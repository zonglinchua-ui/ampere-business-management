
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

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
    
    // Only allow authenticated users to see config
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const config = {
      customerId: process.env.XERO_CLIENT_ID,
      hasClientSecret: !!process.env.XERO_CLIENT_SECRET,
      clientSecretLength: process.env.XERO_CLIENT_SECRET?.length || 0,
      redirectUri: process.env.XERO_REDIRECT_URI,
      scopes: process.env.XERO_SCOPES,
      nextAuthUrl: process.env.NEXTAUTH_URL,
      nodeEnv: process.env.NODE_ENV,
      
      // Validation checks
      checks: {
        customerIdPresent: !!process.env.XERO_CLIENT_ID,
        clientSecretPresent: !!process.env.XERO_CLIENT_SECRET,
        redirectUriPresent: !!process.env.XERO_REDIRECT_URI,
        redirectUriIsProduction: process.env.XERO_REDIRECT_URI === 'https://ampere.abacusai.app/api/xero/callback',
        nextAuthUrlIsProduction: process.env.NEXTAUTH_URL === 'https://ampere.abacusai.app',
        hasPreviewUrl: (process.env.XERO_REDIRECT_URI?.includes('preview') || process.env.NEXTAUTH_URL?.includes('preview')) || false
      },
      
      // Expected values
      expected: {
        redirectUri: 'https://ampere.abacusai.app/api/xero/callback',
        nextAuthUrl: 'https://ampere.abacusai.app',
        scopes: 'accounting.transactions accounting.contacts accounting.settings offline_access'
      },
      
      timestamp: new Date().toISOString()
    }

    return NextResponse.json(config, { status: 200 })
  } catch (error: any) {
    console.error('Config debug error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to get config',
        details: error?.message 
      },
      { status: 500 }
    )
  }
}
