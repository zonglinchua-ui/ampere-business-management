
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { XeroLogger, XeroSyncDirection, XeroSyncStatus, XeroSyncEntity } from '@/lib/xero-logger'

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
        message: `You need Super Admin, Finance, or Project Manager role to view sync logs. Your current role: ${session.user.role}` 
      }, { status: 403 })
    }

    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '50')
    const status = url.searchParams.get('status') as XeroSyncStatus | undefined
    const entity = url.searchParams.get('entity') as XeroSyncEntity | undefined
    const direction = url.searchParams.get('direction') as XeroSyncDirection | undefined
    const dateFrom = url.searchParams.get('dateFrom')
    const dateTo = url.searchParams.get('dateTo')

    const options: any = {
      page,
      limit,
      ...(status && { status }),
      ...(entity && { entity }),
      ...(direction && { direction }),
      ...(dateFrom && { dateFrom: new Date(dateFrom) }),
      ...(dateTo && { dateTo: new Date(dateTo) })
    }

    const result = await XeroLogger.getSyncLogs(session.user.id, options)

    return NextResponse.json(result)

  } catch (error: any) {
    console.error('Error fetching sync logs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sync logs', details: error.message },
      { status: 500 }
    )
  }
}
