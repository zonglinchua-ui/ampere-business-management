
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const updateBudgetSchema = z.object({
  budgetedAmount: z.number().min(0).optional(),
  budgetedAmountBeforeTax: z.number().min(0).optional(),
  budgetedTaxAmount: z.number().min(0).optional(),
  description: z.string().optional(),
})

// PUT /api/projects/[id]/budget/[categoryId] - Update budget category
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; categoryId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    const allowedRoles = ['PROJECT_MANAGER', 'FINANCE', 'SUPERADMIN']
    if (!allowedRoles.includes(session.user.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const projectId = params.id
    const categoryId = params.categoryId
    const body = await request.json()
    
    const validatedData = updateBudgetSchema.parse(body)

    // Check if user has access to this project and budget exists
    const budget = await prisma.projectBudget.findFirst({
      where: {
        id: categoryId,
        projectId,
        Project: {
          OR: [
            { createdById: session.user.id },
            { managerId: session.user.id },
            session.user.role === 'SUPERADMIN' || session.user.role === 'FINANCE' ? {} : { id: 'never-match' }
          ]
        }
      }
    })

    if (!budget) {
      return NextResponse.json({ error: 'Budget category not found' }, { status: 404 })
    }

    // Update budget category
    const updatedBudget = await prisma.projectBudget.update({
      where: { id: categoryId },
      data: validatedData
    })

    return NextResponse.json({ budget: updatedBudget })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: error.errors }, { status: 400 })
    }
    
    console.error('Error updating budget category:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/projects/[id]/budget/[categoryId] - Delete budget category
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; categoryId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    const allowedRoles = ['PROJECT_MANAGER', 'FINANCE', 'SUPERADMIN']
    if (!allowedRoles.includes(session.user.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const projectId = params.id
    const categoryId = params.categoryId

    // Check if user has access to this project and budget exists
    const budget = await prisma.projectBudget.findFirst({
      where: {
        id: categoryId,
        projectId,
        Project: {
          OR: [
            { createdById: session.user.id },
            { managerId: session.user.id },
            session.user.role === 'SUPERADMIN' || session.user.role === 'FINANCE' ? {} : { id: 'never-match' }
          ]
        }
      }
    })

    if (!budget) {
      return NextResponse.json({ error: 'Budget category not found' }, { status: 404 })
    }

    // Delete budget category
    await prisma.projectBudget.delete({
      where: { id: categoryId }
    })

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error deleting budget category:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
