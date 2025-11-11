
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'
import { Prisma } from '@prisma/client'

// Transaction timeout protection
const TX_TIMEOUT = 10000 // 10 seconds
const TX_MAX_WAIT = 5000  // 5 seconds max wait

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const taskId = params.id

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        User_Task_assignerIdToUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        User_Task_assigneeIdToUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        Project: {
          select: {
            id: true,
            name: true,
            projectNumber: true,
            status: true
          }
        },
        Customer: {
          select: {
            id: true,
            name: true
          }
        },
        TaskComment: {
          include: {
            User: {
              select: {
                id: true,
                firstName: true,
                lastName: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        },
        TaskAttachment: {
          include: {
            User: {
              select: {
                id: true,
                firstName: true,
                lastName: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        },
        TaskNotification: {
          where: {
            userId: session.user?.id
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    })

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    const now = new Date()
    const dueDate = task.dueDate ? new Date(task.dueDate) : null
    const isOverdue = dueDate && task.status !== 'COMPLETED' && task.status !== 'CANCELLED' && 
                     now > dueDate
    const daysPastDue = isOverdue && dueDate ? 
      Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)) : 0

    const formattedTask = {
      id: task.id,
      title: task.title,
      description: task.description,
      priority: task.priority,
      status: task.status,
      dueDate: task.dueDate?.toISOString() || null,
      completedAt: task.completedAt?.toISOString() || null,
      assigner: task.User_Task_assignerIdToUser,
      assignee: task.User_Task_assigneeIdToUser,
      project: task.Project,
      client: task.Customer,
      comments: task.TaskComment.map(comment => ({
        id: comment.id,
        comment: comment.comment,
        isInternal: comment.isInternal,
        user: comment.User,
        createdAt: comment.createdAt.toISOString(),
        updatedAt: comment.updatedAt.toISOString()
      })),
      attachments: task.TaskAttachment.map(attachment => ({
        id: attachment.id,
        filename: attachment.filename,
        originalName: attachment.originalName,
        mimetype: attachment.mimetype,
        size: attachment.size,
        cloudStoragePath: attachment.cloudStoragePath,
        uploadedBy: attachment.User,
        createdAt: attachment.createdAt.toISOString()
      })),
      notifications: task.TaskNotification,
      isOverdue: Boolean(isOverdue),
      daysPastDue: daysPastDue > 0 ? daysPastDue : undefined,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString()
    }

    return NextResponse.json(formattedTask)

  } catch (error: any) {
    console.error('Error fetching task:', error)
    
    // Handle specific Prisma errors
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2024') {
        return NextResponse.json(
          { error: 'Database connection timed out. Please try again.' },
          { status: 503 }
        )
      }
      return NextResponse.json(
        { error: `Database error: ${error.message}` },
        { status: 500 }
      )
    }
    
    return NextResponse.json(
      { error: error.message || 'Failed to fetch task details' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const taskId = params.id
    
    // Validate request body
    let data: any
    try {
      data = await request.json()
    } catch (e) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    const result = await prisma.$transaction(async (tx) => {
      // Check if task exists and user has permission to update
      const existingTask = await tx.task.findUnique({
        where: { id: taskId }
      })

      if (!existingTask) {
        throw new Error('Task not found')
      }

      const userRole = session?.user?.role
      const canUpdate = ["SUPERADMIN", "PROJECT_MANAGER"].includes(userRole || "") ||
                       existingTask.assigneeId === session.user?.id ||
                       existingTask.assignerId === session.user?.id

      if (!canUpdate) {
        throw new Error('Insufficient permissions')
      }

      const updateData: any = {
        updatedAt: new Date()
      }

      // Only allow certain fields to be updated
      if (data.status !== undefined) {
        updateData.status = data.status
        if (data.status === 'COMPLETED') {
          updateData.completedAt = new Date()
        }
      }

      if (data.title !== undefined) updateData.title = data.title
      if (data.description !== undefined) updateData.description = data.description
      if (data.priority !== undefined) updateData.priority = data.priority
      if (data.dueDate !== undefined) {
        updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null
      }

      const updatedTask = await tx.task.update({
        where: { id: taskId },
        data: updateData,
        include: {
          User_Task_assignerIdToUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          },
          User_Task_assigneeIdToUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          },
          Project: {
            select: {
              id: true,
              name: true,
              projectNumber: true
            }
          },
          Customer: {
            select: {
              id: true,
              name: true
            }
          }
        }
      })

      // Create notification for status changes within the same transaction
      if (data.status && data.status !== existingTask.status) {
        let notificationMessage = ''
        let notificationUserId = ''

        if (data.status === 'COMPLETED') {
          notificationMessage = `Task completed: ${updatedTask.title}`
          notificationUserId = updatedTask.assignerId
        } else {
          notificationMessage = `Task status changed to ${data.status}: ${updatedTask.title}`
          notificationUserId = updatedTask.assignerId
        }

        if (notificationUserId && notificationUserId !== session.user?.id) {
          await tx.taskNotification.create({
            data: {
              id: uuidv4(),
              taskId: updatedTask.id,
              userId: notificationUserId,
              type: data.status === 'COMPLETED' ? 'TASK_COMPLETED' : 'TASK_STATUS_CHANGED',
              message: notificationMessage
            }
          })
        }
      }

      return updatedTask
    }, { 
      timeout: TX_TIMEOUT,
      maxWait: TX_MAX_WAIT 
    })

    const now = new Date()
    const dueDate = result.dueDate ? new Date(result.dueDate) : null
    const isOverdue = dueDate && result.status !== 'COMPLETED' && result.status !== 'CANCELLED' && 
                     now > dueDate
    const daysPastDue = isOverdue && dueDate ? 
      Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)) : 0

    const formattedTask = {
      id: result.id,
      title: result.title,
      description: result.description,
      priority: result.priority,
      status: result.status,
      dueDate: result.dueDate?.toISOString() || null,
      completedAt: result.completedAt?.toISOString() || null,
      assigner: result.User_Task_assignerIdToUser,
      assignee: result.User_Task_assigneeIdToUser,
      project: result.Project,
      client: result.Customer,
      commentsCount: 0, // Will be calculated in full fetch
      attachmentsCount: 0, // Will be calculated in full fetch
      isOverdue: Boolean(isOverdue),
      daysPastDue: daysPastDue > 0 ? daysPastDue : undefined,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString()
    }

    return NextResponse.json(formattedTask)

  } catch (error: any) {
    console.error('Error updating task:', error)
    
    // Handle custom error messages from transaction
    if (error.message === 'Task not found') {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }
    
    if (error.message === 'Insufficient permissions') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }
    
    // Handle specific Prisma errors
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // Record not found
      if (error.code === 'P2025') {
        return NextResponse.json(
          { error: 'Task not found' },
          { status: 404 }
        )
      }
      
      // Timed out fetching a new connection from the pool
      if (error.code === 'P2024') {
        return NextResponse.json(
          { error: 'Database connection timed out. Please try again.' },
          { status: 503 }
        )
      }

      return NextResponse.json(
        { error: `Database error: ${error.message}` },
        { status: 500 }
      )
    }
    
    return NextResponse.json(
      { error: error.message || 'Failed to update task' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const taskId = params.id
    const userRole = session?.user?.role
    const isSuperAdmin = userRole === "SUPERADMIN"

    if (!isSuperAdmin) {
      return NextResponse.json({ error: 'Only SUPERADMIN can delete tasks' }, { status: 403 })
    }

    // Check if task exists
    const existingTask = await prisma.task.findUnique({
      where: { id: taskId }
    })

    if (!existingTask) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Hard delete the task and related records
    await prisma.$transaction(async (tx) => {
      // Delete task comments first
      await tx.taskComment.deleteMany({
        where: { taskId: taskId }
      })
      
      // Delete the task
      await tx.task.delete({
        where: { id: taskId }
      })
    })

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error('Error deleting task:', error)
    
    // Handle specific Prisma errors
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // Record not found
      if (error.code === 'P2025') {
        return NextResponse.json(
          { error: 'Task not found' },
          { status: 404 }
        )
      }
      
      // Timed out fetching a new connection from the pool
      if (error.code === 'P2024') {
        return NextResponse.json(
          { error: 'Database connection timed out. Please try again.' },
          { status: 503 }
        )
      }

      return NextResponse.json(
        { error: `Database error: ${error.message}` },
        { status: 500 }
      )
    }
    
    return NextResponse.json(
      { error: error.message || 'Failed to delete task' },
      { status: 500 }
    )
  }
}
