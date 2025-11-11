
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // Basic health check
    const healthCheck = {
      uptime: process.uptime(),
      status: 'OK',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      version: '1.0.0'
    }
    
    return NextResponse.json(healthCheck, { status: 200 })
  } catch (error) {
    const healthCheck = {
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    }
    
    return NextResponse.json(healthCheck, { status: 503 })
  }
}
