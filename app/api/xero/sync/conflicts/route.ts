
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

/**
 * GET /api/xero/sync/conflicts
 * Get all sync conflicts
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = (session.user as any).role
    if (!['SUPERADMIN', 'FINANCE'].includes(userRole)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const conflicts = await prisma.xero_sync_state.findMany({
      where: { status: 'CONFLICT' },
      orderBy: { updatedAt: 'desc' }
    })

    // Enrich with entity names
    const enrichedConflicts = await Promise.all(
      conflicts.map(async (conflict) => {
        let entityName = 'Unknown'
        
        if (conflict.entityType === 'CLIENT') {
          const customer = await prisma.customer.findUnique({
            where: { id: conflict.entityId },
            select: { name: true }
          })
          entityName = customer?.name || 'Unknown'
        } else if (conflict.entityType === 'SUPPLIER') {
          const supplier = await prisma.supplier.findUnique({
            where: { id: conflict.entityId },
            select: { name: true }
          })
          entityName = supplier?.name || 'Unknown'
        }

        return {
          ...conflict,
          entityName
        }
      })
    )

    return NextResponse.json({ conflicts: enrichedConflicts })

  } catch (error: any) {
    console.error('❌ Error fetching conflicts:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch conflicts' },
      { status: 500 }
    )
  }
}
