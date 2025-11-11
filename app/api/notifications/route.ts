
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'


export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const notifications = await prisma.taskNotification.findMany({
      where: {
        userId: session.user?.id
      },
      include: {
        Task: {
          select: {
            id: true,
            title: true,
            status: true,
            priority: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 20
    })

    const formattedNotifications = notifications.map((notification: any) => ({
      id: notification.id,
      type: notification.type,
      message: notification.message,
      isRead: notification.isRead,
      sentAt: notification.sentAt?.toISOString() || null,
      createdAt: notification.createdAt.toISOString(),
      task: notification.Task
    }))

    return NextResponse.json(formattedNotifications)

  } catch (error) {
    console.error('Error fetching notifications:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { notificationIds, markAsRead } = await request.json()

    // Mark notifications as read/unread
    await prisma.taskNotification.updateMany({
      where: {
        id: {
          in: notificationIds
        },
        userId: session.user?.id
      },
      data: {
        isRead: markAsRead !== false // Default to true
      }
    })

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error updating notifications:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
