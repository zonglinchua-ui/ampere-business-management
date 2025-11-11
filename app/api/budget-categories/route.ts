
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().min(1).max(50).regex(/^[A-Z0-9_]+$/, 'Code must be uppercase letters, numbers and underscores only'),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, 'Color must be a valid hex color').optional(),
  icon: z.string().optional(),
})

const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, 'Color must be a valid hex color').optional(),
  icon: z.string().optional(),
  isActive: z.boolean().optional(),
})

// GET /api/budget-categories - Get all budget categories
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const includeInactive = url.searchParams.get('includeInactive') === 'true'

    const categories = await prisma.budgetCategory.findMany({
      where: includeInactive ? {} : { isActive: true },
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
      },
      orderBy: [
        { isDefault: 'desc' },
        { name: 'asc' }
      ]
    })

    // Get system default categories
    const systemCategories = [
      { value: 'GENERAL', label: 'General', description: 'General expenses and miscellaneous costs' },
      { value: 'MATERIALS', label: 'Materials', description: 'Raw materials and supplies' },
      { value: 'LABOR', label: 'Labor', description: 'Labor costs and wages' },
      { value: 'EQUIPMENT', label: 'Equipment', description: 'Equipment purchase and rental' },
      { value: 'SUBCONTRACTOR', label: 'Subcontractor', description: 'Subcontractor services' },
      { value: 'PERMITS', label: 'Permits', description: 'Permits and regulatory costs' },
      { value: 'TRANSPORTATION', label: 'Transportation', description: 'Transportation and logistics' },
      { value: 'OVERHEAD', label: 'Overhead', description: 'Overhead and administrative costs' },
      { value: 'CONTINGENCY', label: 'Contingency', description: 'Contingency and risk mitigation' },
      { value: 'OTHER', label: 'Other', description: 'Other uncategorized expenses' },
    ]

    return NextResponse.json({
      systemCategories,
      customCategories: categories
    })

  } catch (error) {
    console.error('Error fetching budget categories:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/budget-categories - Create budget category
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions - only FINANCE and SUPERADMIN can manage categories
    const allowedRoles = ['FINANCE', 'SUPERADMIN']
    if (!allowedRoles.includes(session.user.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = createCategorySchema.parse(body)

    // Check if code already exists
    const existingCategory = await prisma.budgetCategory.findUnique({
      where: { code: validatedData.code }
    })

    if (existingCategory) {
      return NextResponse.json({ error: 'Category code already exists' }, { status: 400 })
    }

    const category = await prisma.budgetCategory.create({
      data: {
        name: validatedData.name,
        code: validatedData.code,
        description: validatedData.description || undefined,
        color: validatedData.color || undefined,
        icon: validatedData.icon || undefined,
        createdById: session.user.id
      } as any,
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
    
    console.error('Error creating budget category:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
