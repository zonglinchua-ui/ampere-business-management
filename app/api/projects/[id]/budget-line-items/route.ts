import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'
import { Decimal } from '@prisma/client/runtime/library'

const createLineItemSchema = z.object({
  itemName: z.string().min(1, 'Item name is required'),
  itemType: z.enum(['TRADE', 'SUPPLIER', 'MATERIAL', 'LABOR', 'EQUIPMENT', 'SUBCONTRACTOR', 'CONTINGENCY', 'OTHER']).default('TRADE'),
  description: z.string().optional(),
  budgetedAmount: z.number().min(0),
  budgetedAmountBeforeTax: z.number().min(0).optional(),
  budgetedTaxAmount: z.number().min(0).optional(),
  supplierId: z.string().optional(),
  category: z.enum(['GENERAL', 'MATERIALS', 'LABOR', 'EQUIPMENT', 'SUBCONTRACTOR', 'PERMITS', 'TRANSPORTATION', 'OVERHEAD', 'CONTINGENCY', 'OTHER']).optional(),
  customCategoryId: z.string().optional(),
  quotationReference: z.string().optional(),
  quotationDate: z.string().optional(),
  notes: z.string().optional(),
})

const updateLineItemSchema = z.object({
  itemName: z.string().min(1).optional(),
  itemType: z.enum(['TRADE', 'SUPPLIER', 'MATERIAL', 'LABOR', 'EQUIPMENT', 'SUBCONTRACTOR', 'CONTINGENCY', 'OTHER']).optional(),
  description: z.string().optional(),
  budgetedAmount: z.number().min(0).optional(),
  budgetedAmountBeforeTax: z.number().min(0).optional(),
  budgetedTaxAmount: z.number().min(0).optional(),
  actualAmount: z.number().min(0).optional(),
  actualAmountBeforeTax: z.number().min(0).optional(),
  actualTaxAmount: z.number().min(0).optional(),
  supplierId: z.string().nullable().optional(),
  category: z.enum(['GENERAL', 'MATERIALS', 'LABOR', 'EQUIPMENT', 'SUBCONTRACTOR', 'PERMITS', 'TRANSPORTATION', 'OVERHEAD', 'CONTINGENCY', 'OTHER']).optional(),
  customCategoryId: z.string().nullable().optional(),
  status: z.enum(['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'ON_HOLD', 'COMPLETED', 'CANCELLED']).optional(),
  isApproved: z.boolean().optional(),
  notes: z.string().optional(),
})

// Calculate variance
function calculateVariance(budgeted: number, actual: number) {
  const variance = budgeted - actual
  const variancePercentage = budgeted > 0 ? (variance / budgeted) * 100 : 0
  return { variance, variancePercentage }
}

// GET /api/projects/[id]/budget-line-items - Get all line items for a project
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

    // Check project access
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { 
        id: true, 
        name: true,
        projectNumber: true,
        mainBudget: true,
        mainBudgetWarningThreshold: true,
        createdById: true, 
        managerId: true, 
        salespersonId: true 
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const hasAccess = 
      session.user.role === 'SUPERADMIN' ||
      session.user.role === 'FINANCE' ||
      session.user.role === 'PROJECT_MANAGER' ||
      project.createdById === session.user.id ||
      project.managerId === session.user.id ||
      project.salespersonId === session.user.id

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Fetch all line items
    const lineItems = await prisma.projectBudgetLineItem.findMany({
      where: { projectId },
      include: {
        Supplier: {
          select: { id: true, name: true, companyName: true }
        },
        BudgetCategory: {
          select: { id: true, name: true, code: true, color: true }
        },
        CreatedBy: {
          select: { id: true, name: true, email: true }
        },
        ApprovedBy: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Calculate totals
    const totalBudgeted = lineItems.reduce((sum, item) => 
      sum + parseFloat(item.budgetedAmount.toString()), 0
    )
    const totalActual = lineItems.reduce((sum, item) => 
      sum + parseFloat(item.actualAmount.toString()), 0
    )
    const totalVariance = totalBudgeted - totalActual

    // Calculate main budget utilization
    const mainBudget = project.mainBudget ? parseFloat(project.mainBudget.toString()) : null
    const budgetUtilization = mainBudget && mainBudget > 0 
      ? (totalBudgeted / mainBudget) * 100 
      : null
    const spendingUtilization = mainBudget && mainBudget > 0 
      ? (totalActual / mainBudget) * 100 
      : null

    // Check for warnings
    const warningThreshold = project.mainBudgetWarningThreshold 
      ? parseFloat(project.mainBudgetWarningThreshold.toString()) 
      : 90

    const warnings = []
    if (mainBudget && budgetUtilization) {
      if (budgetUtilization > 100) {
        warnings.push({
          type: 'MAIN_BUDGET_EXCEEDED',
          severity: 'CRITICAL',
          message: `Total allocated budget (${totalBudgeted.toFixed(2)}) exceeds main budget (${mainBudget.toFixed(2)}) by ${(budgetUtilization - 100).toFixed(1)}%`
        })
      } else if (budgetUtilization >= warningThreshold) {
        warnings.push({
          type: 'MAIN_BUDGET_WARNING',
          severity: 'WARNING',
          message: `Total allocated budget is at ${budgetUtilization.toFixed(1)}% of main budget`
        })
      }

      if (spendingUtilization && spendingUtilization > 100) {
        warnings.push({
          type: 'TOTAL_SPENT_EXCEEDED',
          severity: 'CRITICAL',
          message: `Total spending (${totalActual.toFixed(2)}) exceeds main budget (${mainBudget.toFixed(2)})`
        })
      } else if (spendingUtilization && spendingUtilization >= warningThreshold) {
        warnings.push({
          type: 'TOTAL_SPENT_WARNING',
          severity: 'WARNING',
          message: `Total spending is at ${spendingUtilization.toFixed(1)}% of main budget`
        })
      }
    }

    // Group by type
    const byType = lineItems.reduce((acc, item) => {
      const type = item.itemType
      if (!acc[type]) {
        acc[type] = {
          count: 0,
          totalBudgeted: 0,
          totalActual: 0,
          items: []
        }
      }
      acc[type].count++
      acc[type].totalBudgeted += parseFloat(item.budgetedAmount.toString())
      acc[type].totalActual += parseFloat(item.actualAmount.toString())
      acc[type].items.push(item)
      return acc
    }, {} as Record<string, any>)

    // Group by status
    const byStatus = lineItems.reduce((acc, item) => {
      const status = item.status
      acc[status] = (acc[status] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return NextResponse.json({
      project: {
        id: project.id,
        name: project.name,
        projectNumber: project.projectNumber,
        mainBudget,
        warningThreshold
      },
      summary: {
        totalLineItems: lineItems.length,
        totalBudgeted,
        totalActual,
        totalVariance,
        budgetUtilization,
        spendingUtilization,
        byType,
        byStatus
      },
      lineItems,
      warnings
    })

  } catch (error) {
    console.error('Error fetching budget line items:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/projects/[id]/budget-line-items - Create new line item
export async function POST(
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
    
    const validatedData = createLineItemSchema.parse(body)

    // Check project access
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { 
        id: true, 
        mainBudget: true,
        createdById: true, 
        managerId: true 
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const hasAccess = 
      session.user.role === 'SUPERADMIN' ||
      session.user.role === 'FINANCE' ||
      session.user.role === 'PROJECT_MANAGER' ||
      project.createdById === session.user.id ||
      project.managerId === session.user.id

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Create line item
    const lineItem = await prisma.projectBudgetLineItem.create({
      data: {
        id: uuidv4(),
        projectId,
        itemName: validatedData.itemName,
        itemType: validatedData.itemType,
        description: validatedData.description,
        budgetedAmount: validatedData.budgetedAmount,
        budgetedAmountBeforeTax: validatedData.budgetedAmountBeforeTax,
        budgetedTaxAmount: validatedData.budgetedTaxAmount,
        supplierId: validatedData.supplierId,
        category: validatedData.category || 'GENERAL',
        customCategoryId: validatedData.customCategoryId,
        quotationReference: validatedData.quotationReference,
        quotationDate: validatedData.quotationDate ? new Date(validatedData.quotationDate) : null,
        notes: validatedData.notes,
        createdById: session.user.id,
      },
      include: {
        Supplier: {
          select: { id: true, name: true, companyName: true }
        },
        BudgetCategory: {
          select: { id: true, name: true, code: true, color: true }
        },
        CreatedBy: {
          select: { id: true, name: true, email: true }
        }
      }
    })

    // Check if this causes budget warnings
    const totalBudgeted = await prisma.projectBudgetLineItem.aggregate({
      where: { projectId },
      _sum: { budgetedAmount: true }
    })

    const mainBudget = project.mainBudget ? parseFloat(project.mainBudget.toString()) : null
    const totalBudgetedAmount = totalBudgeted._sum.budgetedAmount 
      ? parseFloat(totalBudgeted._sum.budgetedAmount.toString()) 
      : 0

    const warnings = []
    if (mainBudget && totalBudgetedAmount > mainBudget) {
      const utilization = (totalBudgetedAmount / mainBudget) * 100
      warnings.push({
        type: 'MAIN_BUDGET_EXCEEDED',
        severity: 'CRITICAL',
        message: `Total allocated budget now exceeds main budget by ${(utilization - 100).toFixed(1)}%`
      })
    }

    return NextResponse.json({ 
      lineItem,
      warnings
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: error.errors }, { status: 400 })
    }
    
    console.error('Error creating budget line item:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/projects/[id]/budget-line-items - Update main budget
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
    
    const { mainBudget, mainBudgetWarningThreshold } = body

    // Update project main budget
    const updatedProject = await prisma.project.update({
      where: { id: projectId },
      data: { 
        mainBudget: mainBudget !== undefined ? mainBudget : undefined,
        mainBudgetWarningThreshold: mainBudgetWarningThreshold !== undefined ? mainBudgetWarningThreshold : undefined,
      },
      select: { 
        id: true, 
        mainBudget: true, 
        mainBudgetWarningThreshold: true 
      }
    })

    return NextResponse.json({ project: updatedProject })

  } catch (error) {
    console.error('Error updating main budget:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
