
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

export async function GET() {
  // Disable in production for security
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Debug endpoints disabled in production' },
      { status: 403 }
    )
  }

  // In development, require authentication
  const session = await getServerSession()
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  return NextResponse.json({
    success: true,
    environment: {
      NEXTAUTH_URL: process.env.NEXTAUTH_URL,
      XERO_CLIENT_ID: process.env.XERO_CLIENT_ID?.substring(0, 10) + '...',
      XERO_CLIENT_SECRET: process.env.XERO_CLIENT_SECRET ? 'SET' : 'NOT SET',
      XERO_REDIRECT_URI: process.env.XERO_REDIRECT_URI,
      NODE_ENV: process.env.NODE_ENV,
      DEPLOYMENT_MODE: process.env.DEPLOYMENT_MODE,
      BASE_URL: process.env.BASE_URL,
      currentTime: new Date().toISOString()
    }
  })
}
