

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { testNASConnection } from '@/lib/nas-storage'

export async function POST(request: NextRequest) {
  // Production guard: Disable test endpoints in production
  if (process.env.NODE_ENV === 'production' || process.env.DEPLOYMENT_MODE === 'production') {
    return NextResponse.json(
      { error: 'Test endpoints are disabled in production' },
      { status: 403 }
    )
  }

  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission to manage settings
    const userRole = session.user?.role
    if (!["SUPERADMIN"].includes(userRole || "")) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { nasPath, nasUsername, nasPassword } = await request.json()

    if (!nasPath) {
      return NextResponse.json({ error: 'NAS path is required' }, { status: 400 })
    }

    const nasSettings = {
      nasEnabled: true,
      nasPath,
      nasUsername: nasUsername || '',
      nasPassword: nasPassword || '',
      organizeFolders: true,
      namingConvention: '{quotationNumber}.{clientName}.{projectName}.{title}'
    }

    const result = await testNASConnection(nasSettings)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error testing NAS connection:', error)
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}

