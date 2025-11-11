
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

/**
 * PATCH /api/projects/notifications
 * Mark project notifications as read or dismissed
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { notificationIds, action } = await request.json()

    if (!notificationIds || !Array.isArray(notificationIds)) {
      return NextResponse.json({ error: 'Invalid notification IDs' }, { status: 400 })
    }

    const updateData: any = {}
    
    if (action === 'read') {
      updateData.isRead = true
    } else if (action === 'dismiss') {
      updateData.isDismissed = true
    } else if (action === 'unread') {
      updateData.isRead = false
    }

    await prisma.projectNotification.updateMany({
      where: {
        id: {
          in: notificationIds
        },
        userId: session.user.id
      },
      data: updateData
    })

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error updating project notifications:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
