import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getIntegrationHealthSnapshot } from '@/lib/health/integrations'

export const dynamic = 'force-dynamic'

const ALLOWED_ROLES = ['SUPERADMIN', 'FINANCE', 'PROJECT_MANAGER', 'ADMIN']

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userRole = (session.user as any).role
  if (userRole && !ALLOWED_ROLES.includes(userRole)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  try {
    const snapshot = await getIntegrationHealthSnapshot()
    return NextResponse.json(snapshot)
  } catch (error) {
    console.error('Failed to build integration health snapshot', error)
    return NextResponse.json(
      {
        error: 'Failed to compile integration health checks',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
