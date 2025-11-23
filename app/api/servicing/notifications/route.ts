
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

/**
 * PATCH /api/servicing/notifications
 * Mark notifications as read or dismissed
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { notificationIds, action } = body

    if (!notificationIds || !Array.isArray(notificationIds)) {
      return NextResponse.json({ error: 'Invalid notification IDs' }, { status: 400 })
    }

    if (!action || !['read', 'dismiss'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Use "read" or "dismiss"' }, { status: 400 })
    }

    const updateData: any = {}
    
    if (action === 'read') {
      updateData.isRead = true
      updateData.readAt = new Date()
    } else if (action === 'dismiss') {
      updateData.isDismissed = true
      updateData.dismissedAt = new Date()
    }

    await prisma.serviceNotification.updateMany({
      where: {
        id: { in: notificationIds },
        userId: session.user.id
      },
      data: updateData
    })

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error updating service notifications:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
