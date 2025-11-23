
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { XeroLogger } from '@/lib/xero-logger'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission to view sync logs
    const hasPermission = session.user.role === 'SUPERADMIN' || 
                         session.user.role === 'FINANCE' || 
                         session.user.role === 'PROJECT_MANAGER'

    if (!hasPermission) {
      return NextResponse.json({ 
        error: 'Insufficient permissions',
        message: `You need Super Admin, Finance, or Project Manager role to view sync stats. Your current role: ${session.user.role}` 
      }, { status: 403 })
    }

    const url = new URL(request.url)
    const days = parseInt(url.searchParams.get('days') || '30')

    const stats = await XeroLogger.getSyncStats(session.user.id, days)

    return NextResponse.json(stats)

  } catch (error: any) {
    console.error('Error fetching sync stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sync stats', details: error.message },
      { status: 500 }
    )
  }
}
