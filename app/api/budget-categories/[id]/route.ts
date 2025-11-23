
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, 'Color must be a valid hex color').optional(),
  icon: z.string().optional(),
  isActive: z.boolean().optional(),
})

// GET /api/budget-categories/[id] - Get single budget category
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const categoryId = params.id

    const category = await prisma.budgetCategory.findUnique({
      where: { id: categoryId },
      include: {
        User: {
          select: { name: true, firstName: true, lastName: true }
        },
        _count: {
          select: {
            ProjectBudget: true,
            ProjectTransaction: true
          }
        }
      }
    })

    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    return NextResponse.json({ category })

  } catch (error) {
    console.error('Error fetching budget category:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/budget-categories/[id] - Update budget category
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    const allowedRoles = ['FINANCE', 'SUPERADMIN']
    if (!allowedRoles.includes(session.user.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const categoryId = params.id
    const body = await request.json()
    
    const validatedData = updateCategorySchema.parse(body)

    // Check if category exists
    const existingCategory = await prisma.budgetCategory.findUnique({
      where: { id: categoryId }
    })

    if (!existingCategory) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    // Don't allow deactivating categories that are in use
    if (validatedData.isActive === false) {
      const usage = await prisma.budgetCategory.findUnique({
        where: { id: categoryId },
        include: {
          _count: {
            select: {
              ProjectBudget: true,
              ProjectTransaction: true
            }
          }
        }
      })

      if (usage && (usage._count.ProjectBudget > 0 || usage._count.ProjectTransaction > 0)) {
        return NextResponse.json({ 
          error: 'Cannot deactivate category that is in use' 
        }, { status: 400 })
      }
    }

    const category = await prisma.budgetCategory.update({
      where: { id: categoryId },
      data: validatedData,
      include: {
        User: {
          select: { name: true, firstName: true, lastName: true }
        },
        _count: {
          select: {
            ProjectBudget: true,
            ProjectTransaction: true
          }
        }
      }
    })

    return NextResponse.json({ category })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: error.errors }, { status: 400 })
    }
    
    console.error('Error updating budget category:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/budget-categories/[id] - Delete budget category
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    const allowedRoles = ['FINANCE', 'SUPERADMIN']
    if (!allowedRoles.includes(session.user.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const categoryId = params.id

    // Check if category exists and is in use
    const category = await prisma.budgetCategory.findUnique({
      where: { id: categoryId },
      include: {
        _count: {
          select: {
            ProjectBudget: true,
            ProjectTransaction: true
          }
        }
      }
    })

    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    if (category._count.ProjectBudget > 0 || category._count.ProjectTransaction > 0) {
      return NextResponse.json({ 
        error: 'Cannot delete category that is in use. Deactivate it instead.' 
      }, { status: 400 })
    }

    await prisma.budgetCategory.delete({
      where: { id: categoryId }
    })

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error deleting budget category:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
