
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { v4 as uuidv4 } from 'uuid'


export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const taskId = params.id
    const data = await request.json()

    // Check if task exists
    const task = await prisma.task.findUnique({
      where: { id: taskId }
    })

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Create comment
    const comment = await prisma.taskComment.create({
      data: {
        id: uuidv4(),
        taskId: taskId,
        userId: session.user?.id || '',
        comment: data.comment,
        isInternal: data.isInternal !== false, // Default to true if not specified
        updatedAt: new Date()
      },
      include: {
        User: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    })

    // Create notification for task participants (assignee and assigner)
    const notificationUsers = [task.assigneeId, task.assignerId].filter(
      userId => userId !== session.user?.id // Don't notify the comment author
    )

    for (const userId of notificationUsers) {
      await prisma.taskNotification.create({
        data: {
          id: uuidv4(),
          taskId: taskId,
          userId: userId,
          type: 'TASK_COMMENTED',
          message: `${session.user?.firstName} ${session.user?.lastName} commented on task: ${task.title}`
        }
      })
    }

    const formattedComment = {
      id: comment.id,
      comment: comment.comment,
      isInternal: comment.isInternal,
      user: comment.User,
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt.toISOString()
    }

    return NextResponse.json(formattedComment)

  } catch (error) {
    console.error('Error creating comment:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
