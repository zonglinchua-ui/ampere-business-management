
/**
 * Enhanced Xero OAuth Callback Endpoint
 * Uses the enhanced OAuth service with better error handling
 */

import { NextRequest, NextResponse } from 'next/server'
import { EnhancedXeroOAuthService } from '@/lib/xero-oauth-service-fixed'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// Force dynamic rendering for OAuth callbacks
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const baseUrl = process.env.NEXTAUTH_URL || 'https://ampere.abacusai.app'

    // Get query parameters
    const { searchParams } = request.nextUrl
    const code = searchParams.get('code')
    const error = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')
    const state = searchParams.get('state')

    console.log('\n🔔 Enhanced Xero OAuth callback received')
    console.log('   Has code:', !!code)
    console.log('   Has error:', !!error)
    console.log('   Has state:', !!state)
    console.log('   User agent:', request.headers.get('user-agent')?.substring(0, 100))

    // Handle OAuth errors from Xero
    if (error) {
      console.error('❌ OAuth error from Xero:', {
        error,
        errorDescription,
        state
      })
      
      let userFriendlyMessage = 'Xero authorization failed'
      
      if (error === 'access_denied') {
        userFriendlyMessage = 'Authorization was cancelled. Please try again if you want to connect to Xero.'
      } else if (error === 'invalid_request') {
        userFriendlyMessage = 'Invalid request. Please check Xero app configuration.'
      } else if (error === 'unauthorized_client') {
        userFriendlyMessage = 'Client not authorized. Please verify Xero app settings.'
      }
      
      const message = encodeURIComponent(userFriendlyMessage)
      return NextResponse.redirect(`${baseUrl}/finance?xero=error&message=${message}`)
    }

    // Validate authorization code
    if (!code) {
      console.error('❌ No authorization code received')
      const message = encodeURIComponent('No authorization code received from Xero')
      return NextResponse.redirect(`${baseUrl}/finance?xero=error&message=${message}`)
    }

    if (code.length < 10) {
      console.error('❌ Invalid authorization code format')
      const message = encodeURIComponent('Invalid authorization code format')
      return NextResponse.redirect(`${baseUrl}/finance?xero=error&message=${message}`)
    }

    // Get session (optional - OAuth can complete without session)
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id

    if (!userId) {
      console.warn('⚠️ No session found during OAuth callback')
    } else {
      console.log('👤 User session found:', session.user?.email)
    }

    // Create enhanced OAuth service and handle callback
    const oauthService = new EnhancedXeroOAuthService(userId)
    const result = await oauthService.handleCallback(code)

    if (result.success) {
      console.log('✅ Enhanced OAuth callback successful')
      console.log('   Connected to:', result.tenantName)
      console.log('   Tenant ID:', result.tenantId)
      
      const message = encodeURIComponent(
        `Successfully connected to ${result.tenantName || 'Xero'}! You can now sync your financial data.`
      )
      return NextResponse.redirect(`${baseUrl}/finance?xero=success&message=${message}`)
    } else {
      console.error('❌ Enhanced OAuth callback failed:', result.error)
      const message = encodeURIComponent(result.error || 'Connection failed')
      return NextResponse.redirect(`${baseUrl}/finance?xero=error&message=${message}`)
    }

  } catch (error: any) {
    console.error('❌ Unexpected error in enhanced OAuth callback:', error)
    console.error('   Stack trace:', error.stack)
    
    const baseUrl = process.env.NEXTAUTH_URL || 'https://ampere.abacusai.app'
    let errorMessage = 'Connection failed: Please try again'
    
    // Provide specific error messages for debugging
    if (error.message?.includes('redirect_uri')) {
      errorMessage = 'Redirect URI mismatch - please verify Xero app configuration'
    } else if (error.message?.includes('client_id')) {
      errorMessage = 'Client configuration error - please check Xero credentials'
    } else if (error.message?.includes('expired')) {
      errorMessage = 'Authorization expired - please try connecting again'
    }
    
    const message = encodeURIComponent(errorMessage)
    return NextResponse.redirect(`${baseUrl}/finance?xero=error&message=${message}`)
  }
}
