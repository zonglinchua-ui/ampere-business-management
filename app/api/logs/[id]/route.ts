
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

/**
 * PATCH /api/logs/[id]
 * Mark a log as viewed
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only Super Admins can mark logs as viewed
    if (session.user.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Forbidden: Super Admin access required' }, { status: 403 })
    }

    const log = await prisma.system_logs.update({
      where: { id: params.id },
      data: { viewed: true },
    })

    return NextResponse.json(log)
  } catch (error: any) {
    console.error('[API] Failed to update log:', error)
    return NextResponse.json(
      { error: 'Failed to update log', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/logs/[id]/bulk
 * Mark multiple logs as viewed
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only Super Admins can mark logs as viewed
    if (session.user.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Forbidden: Super Admin access required' }, { status: 403 })
    }

    // Mark all as viewed for bulk action
    if (params.id === 'bulk') {
      const { ids } = await req.json()
      
      await prisma.system_logs.updateMany({
        where: { id: { in: ids } },
        data: { viewed: true },
      })

      return NextResponse.json({ message: `Marked ${ids.length} logs as viewed` })
    }

    return NextResponse.json({ error: 'Invalid endpoint' }, { status: 400 })
  } catch (error: any) {
    console.error('[API] Failed to update logs:', error)
    return NextResponse.json(
      { error: 'Failed to update logs', details: error.message },
      { status: 500 }
    )
  }
}

