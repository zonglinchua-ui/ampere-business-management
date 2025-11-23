

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import * as fs from 'fs'
import * as path from 'path'

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
    
    // Only allow SUPERADMIN to view debug logs
    if (!session?.user?.role || session.user.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const logFilePath = path.join(process.cwd(), '../xero_oauth_debug.log')
    
    if (!fs.existsSync(logFilePath)) {
      return NextResponse.json({
        exists: false,
        message: 'No debug log file found. Try connecting to Xero first.'
      })
    }

    const logContents = fs.readFileSync(logFilePath, 'utf-8')
    const lines = logContents.split('\n')
    
    // Return last 200 lines
    const recentLines = lines.slice(-200).join('\n')
    
    return new NextResponse(recentLines, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
      },
    })
  } catch (error: any) {
    return NextResponse.json({
      error: 'Failed to read debug logs',
      details: error?.message || 'Unknown error'
    }, { status: 500 })
  }
}

// DELETE endpoint to clear the log file
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    // Only allow SUPERADMIN to clear debug logs
    if (!session?.user?.role || session.user.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const logFilePath = path.join(process.cwd(), '../xero_oauth_debug.log')
    
    if (fs.existsSync(logFilePath)) {
      fs.unlinkSync(logFilePath)
    }

    return NextResponse.json({
      success: true,
      message: 'Debug log cleared'
    })
  } catch (error: any) {
    return NextResponse.json({
      error: 'Failed to clear debug logs',
      details: error?.message || 'Unknown error'
    }, { status: 500 })
  }
}
