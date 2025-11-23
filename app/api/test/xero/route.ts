
import { NextRequest, NextResponse } from 'next/server'
import { xeroConfig, debugXeroConfig } from '@/lib/xero-config'

export async function GET() {
  // Disable in production for security
  if (process.env.NODE_ENV === 'production' || process.env.DEPLOYMENT_MODE === 'production') {
    return NextResponse.json(
      { error: 'Test endpoints disabled in production' },
      { status: 403 }
    )
  }

  try {
    console.log('=== Xero Configuration Test ===')
    
    // Debug configuration (doesn't require auth)
    debugXeroConfig()
    
    return NextResponse.json({
      success: true,
      message: 'Xero configuration is valid',
      config: {
        hasClientId: !!process.env.XERO_CLIENT_ID,
        hasClientSecret: !!process.env.XERO_CLIENT_SECRET,
        redirectUri: xeroConfig.redirectUris[0],
        scopes: xeroConfig.scopes
      }
    })
  } catch (error: any) {
    console.error('Xero configuration test error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Configuration test failed'
    }, { status: 500 })
  }
}
