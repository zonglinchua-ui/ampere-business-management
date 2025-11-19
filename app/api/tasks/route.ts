
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'
import { Prisma } from '@prisma/client'
import { createSuccessResponse, ensureArray } from '@/lib/api-response'

// Transaction timeout protection
const TX_TIMEOUT = 10000 // 10 seconds
const TX_MAX_WAIT = 5000  // 5 seconds max wait

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const tasks = await prisma.$transaction(async (tx: any) => {
      return await tx.task.findMany({
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
        },
        TaskComment: {
          select: {
            id: true
          }
        },
        TaskAttachment: {
          select: {
            id: true
          }
        }
      },
      where: {
        isArchived: false
      },
      orderBy: {
        createdAt: 'desc'
      }
      })
    }, { 
      timeout: TX_TIMEOUT,
      maxWait: TX_MAX_WAIT 
    })

    const formattedTasks = tasks.map((task: any) => {
      const now = new Date()
      const dueDate = task.dueDate ? new Date(task.dueDate) : null
      const isOverdue = dueDate && task.status !== 'COMPLETED' && task.status !== 'CANCELLED' && 
                       now > dueDate
      const daysPastDue = isOverdue && dueDate ? 
        Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)) : 0

      return {
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
        commentsCount: task.TaskComment.length,
        attachmentsCount: task.TaskAttachment.length,
        isOverdue: Boolean(isOverdue),
        daysPastDue: daysPastDue > 0 ? daysPastDue : undefined,
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString()
      }
    })

    // Return tasks as array (backward compatible format)
    return NextResponse.json(ensureArray(formattedTasks))

  } catch (error: any) {
    console.error('Error fetching tasks:', error)
    
    // Return empty array to prevent .map() errors
    // Handle specific Prisma errors
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.error('Database error:', error.message)
      return NextResponse.json([]) // Return empty array instead of error
    }
    
    if (error.code === 'P2024') {
      console.error('Database connection timeout')
      return NextResponse.json([]) // Return empty array instead of error
    }

    console.error('Failed to fetch tasks:', error.message)
    return NextResponse.json([]) // Return empty array instead of error
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = session?.user?.role
    const canCreateTask = ["SUPERADMIN", "PROJECT_MANAGER"].includes(userRole || "")
    
    if (!canCreateTask) {
      return NextResponse.json({ 
        error: 'Insufficient permissions. Only Super Admins and Project Managers can create tasks.' 
      }, { status: 403 })
    }

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

    // Validate required fields
    if (!data.title || !data.title.trim()) {
      return NextResponse.json(
        { error: 'Task title is required' },
        { status: 400 }
      )
    }

    if (!data.assigneeId) {
      return NextResponse.json(
        { error: 'Assignee is required' },
        { status: 400 }
      )
    }

    const result = await prisma.$transaction(async (tx: any) => {
      const task = await tx.task.create({
      data: {
        id: uuidv4(),
        title: data.title,
        description: data.description,
        priority: data.priority || 'MEDIUM',
        status: 'TODO',
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        assignerId: session.user?.id || '',
        assigneeId: data.assigneeId,
        projectId: data.projectId || null,
        customerId: data.customerId || null,
        updatedAt: new Date()
      },
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

      // Create notification for assignee within the same transaction
      await tx.taskNotification.create({
        data: {
          id: uuidv4(),
          taskId: task.id,
          userId: task.assigneeId,
          type: 'TASK_ASSIGNED',
          message: `New task assigned: ${task.title}`
        }
      })

      return task
    }, { 
      timeout: TX_TIMEOUT,
      maxWait: TX_MAX_WAIT 
    })

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
      commentsCount: 0,
      attachmentsCount: 0,
      isOverdue: false,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString()
    }

    return NextResponse.json(formattedTask, { status: 201 })

  } catch (error: any) {
    console.error('Error creating task:', error)
    
    // Handle specific Prisma errors
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // Foreign key constraint failed (invalid assigneeId, projectId, or customerId)
      if (error.code === 'P2003') {
        return NextResponse.json(
          { error: 'Invalid assignee, project, or client ID provided' },
          { status: 400 }
        )
      }
      
      // Unique constraint violation
      if (error.code === 'P2002') {
        return NextResponse.json(
          { error: 'A task with this identifier already exists' },
          { status: 409 }
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
      { error: error.message || 'Failed to create task' },
      { status: 500 }
    )
  }
}
