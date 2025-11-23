
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'

const createBudgetSchema = z.object({
  category: z.enum(['GENERAL', 'MATERIALS', 'LABOR', 'EQUIPMENT', 'SUBCONTRACTOR', 'PERMITS', 'TRANSPORTATION', 'OVERHEAD', 'CONTINGENCY', 'OTHER']).optional(),
  customCategoryId: z.string().optional(),
  budgetedAmount: z.number().min(0),
  budgetedAmountBeforeTax: z.number().min(0).optional(),
  budgetedTaxAmount: z.number().min(0).optional(),
  description: z.string().optional(),
}).refine(data => data.category || data.customCategoryId, {
  message: "Either category or customCategoryId is required"
})

const updateBudgetSchema = z.object({
  budgetedAmount: z.number().min(0).optional(),
  budgetedAmountBeforeTax: z.number().min(0).optional(),
  budgetedTaxAmount: z.number().min(0).optional(),
  description: z.string().optional(),
})

// GET /api/projects/[id]/budget - Get project budget overview
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const projectId = params.id

    // First, check if the project exists
    const projectExists = await prisma.project.findUnique({
      where: { id: projectId },
      select: { 
        id: true, 
        createdById: true, 
        managerId: true, 
        salespersonId: true 
      }
    })

    if (!projectExists) {
      console.error(`[Budget API] Project not found: ${projectId}`)
      return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 })
    }

    // Check if user has access based on role
    const hasAccess = 
      session.user.role === 'SUPERADMIN' ||
      session.user.role === 'FINANCE' ||
      projectExists.createdById === session.user.id ||
      projectExists.managerId === session.user.id ||
      projectExists.salespersonId === session.user.id

    if (!hasAccess) {
      console.error(`[Budget API] Access denied for user ${session.user.id} to project ${projectId}`)
      return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 })
    }

    // Fetch the project with all details
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        ProjectBudget: {
          include: {
            BudgetCategory: {
              select: {
                id: true,
                name: true,
                code: true,
                color: true
              }
            }
          }
        },
        ProjectTransaction: {
          include: {
            Supplier: { select: { name: true } },
            Customer: { select: { name: true } },
            BudgetCategory: {
              select: {
                id: true,
                name: true,
                code: true,
                color: true
              }
            },
            User: { select: { name: true, firstName: true, lastName: true } }
          },
          orderBy: { date: 'desc' }
        }
      }
    })

    if (!project) {
      console.error(`[Budget API] Project data fetch failed: ${projectId}`)
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Calculate budget summary
    const budgetSummary = {
      totalBudget: project.estimatedBudget || 0,
      totalIncome: 0,
      totalExpenses: 0,
      categories: {} as Record<string, { budgeted: number; actual: number; transactions: number }>
    }

    // Process budget categories
    project.ProjectBudget.forEach((budget: any) => {
      budgetSummary.categories[budget.category] = {
        budgeted: parseFloat(budget.budgetedAmount.toString()),
        actual: parseFloat(budget.actualAmount.toString()),
        transactions: 0
      }
    })

    // Process transactions
    project.ProjectTransaction.forEach((transaction: any) => {
      const amount = parseFloat(transaction.amount.toString())
      if (transaction.transactionType === 'INCOME') {
        budgetSummary.totalIncome += amount
      } else {
        budgetSummary.totalExpenses += amount
      }

      // Update category transaction count
      if (budgetSummary.categories[transaction.category]) {
        budgetSummary.categories[transaction.category].transactions += 1
      }
    })

    const netProfit = budgetSummary.totalIncome - budgetSummary.totalExpenses
    const profitMargin = budgetSummary.totalIncome > 0 ? (netProfit / budgetSummary.totalIncome) * 100 : 0

    return NextResponse.json({
      project: {
        id: project.id,
        name: project.name,
        projectNumber: project.projectNumber,
        estimatedBudget: project.estimatedBudget
      },
      summary: {
        ...budgetSummary,
        netProfit,
        profitMargin
      },
      budgets: project.ProjectBudget,
      recentTransactions: project.ProjectTransaction.slice(0, 10)
    })

  } catch (error) {
    console.error('Error fetching project budget:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/projects/[id]/budget - Create budget category
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions - only PROJECT_MANAGER, FINANCE, and SUPERADMIN can modify budgets
    const allowedRoles = ['PROJECT_MANAGER', 'FINANCE', 'SUPERADMIN']
    if (!allowedRoles.includes(session.user.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const projectId = params.id
    const body = await request.json()
    
    const validatedData = createBudgetSchema.parse(body)

    // Check if project exists and user has access
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { 
        id: true, 
        createdById: true, 
        managerId: true 
      }
    })

    if (!project) {
      console.error(`[Budget API POST] Project not found: ${projectId}`)
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Check if user has access based on role
    const hasAccess = 
      session.user.role === 'SUPERADMIN' ||
      session.user.role === 'FINANCE' ||
      project.createdById === session.user.id ||
      project.managerId === session.user.id

    if (!hasAccess) {
      console.error(`[Budget API POST] Access denied for user ${session.user.id} to project ${projectId}`)
      return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 })
    }

    // If using custom category, verify it exists
    if (validatedData.customCategoryId) {
      const customCategory = await prisma.budgetCategory.findFirst({
        where: {
          id: validatedData.customCategoryId,
          isActive: true
        }
      })
      
      if (!customCategory) {
        return NextResponse.json({ error: 'Custom category not found' }, { status: 400 })
      }
    }

    // Create budget category
    const budget = await prisma.projectBudget.create({
      data: {
        id: uuidv4(),
        projectId,
        category: validatedData.category || 'OTHER',
        customCategoryId: validatedData.customCategoryId,
        budgetedAmount: validatedData.budgetedAmount,
        budgetedAmountBeforeTax: validatedData.budgetedAmountBeforeTax,
        budgetedTaxAmount: validatedData.budgetedTaxAmount,
        description: validatedData.description,
        createdById: session.user.id,
        updatedAt: new Date()
      },
      include: {
        BudgetCategory: {
          select: {
            id: true,
            name: true,
            code: true,
            color: true
          }
        }
      }
    })

    return NextResponse.json({ budget })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: error.errors }, { status: 400 })
    }
    
    if ((error as any)?.code === 'P2002') {
      return NextResponse.json({ error: 'Budget category already exists for this project' }, { status: 400 })
    }
    
    console.error('Error creating project budget:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/projects/[id]/budget - Update project estimated budget
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
    const allowedRoles = ['PROJECT_MANAGER', 'FINANCE', 'SUPERADMIN']
    if (!allowedRoles.includes(session.user.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const projectId = params.id
    const body = await request.json()
    
    const { estimatedBudget } = body

    // Check if project exists and user has access
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { 
        id: true, 
        createdById: true, 
        managerId: true 
      }
    })

    if (!project) {
      console.error(`[Budget API PUT] Project not found: ${projectId}`)
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Check if user has access based on role
    const hasAccess = 
      session.user.role === 'SUPERADMIN' ||
      session.user.role === 'FINANCE' ||
      project.createdById === session.user.id ||
      project.managerId === session.user.id

    if (!hasAccess) {
      console.error(`[Budget API PUT] Access denied for user ${session.user.id} to project ${projectId}`)
      return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 })
    }

    // Update project estimated budget
    const updatedProject = await prisma.project.update({
      where: { id: projectId },
      data: { estimatedBudget: estimatedBudget || null },
      select: { id: true, estimatedBudget: true }
    })

    return NextResponse.json({ project: updatedProject })

  } catch (error) {
    console.error('Error updating project budget:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
