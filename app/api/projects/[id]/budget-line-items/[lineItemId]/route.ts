import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'

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

// GET /api/projects/[id]/budget-line-items/[lineItemId] - Get single line item
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; lineItemId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId, lineItemId } = params

    // Fetch line item with project access check
    const lineItem = await prisma.projectBudgetLineItem.findFirst({
      where: { 
        id: lineItemId,
        projectId 
      },
      include: {
        Project: {
          select: {
            id: true,
            name: true,
            projectNumber: true,
            mainBudget: true,
            createdById: true,
            managerId: true,
            salespersonId: true
          }
        },
        Supplier: {
          select: { id: true, name: true, companyName: true, email: true, phone: true }
        },
        BudgetCategory: {
          select: { id: true, name: true, code: true, color: true }
        },
        Quotation: {
          select: { id: true, quotationNumber: true, totalAmount: true, status: true }
        },
        CreatedBy: {
          select: { id: true, name: true, email: true }
        },
        ApprovedBy: {
          select: { id: true, name: true, email: true }
        }
      }
    })

    if (!lineItem) {
      return NextResponse.json({ error: 'Line item not found' }, { status: 404 })
    }

    // Check access
    const hasAccess = 
      session.user.role === 'SUPERADMIN' ||
      session.user.role === 'FINANCE' ||
      session.user.role === 'PROJECT_MANAGER' ||
      lineItem.Project.createdById === session.user.id ||
      lineItem.Project.managerId === session.user.id ||
      lineItem.Project.salespersonId === session.user.id

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    return NextResponse.json({ lineItem })

  } catch (error) {
    console.error('Error fetching budget line item:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/projects/[id]/budget-line-items/[lineItemId] - Update line item
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; lineItemId: string } }
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

    const { id: projectId, lineItemId } = params
    const body = await request.json()
    
    const validatedData = updateLineItemSchema.parse(body)

    // Check line item exists and user has access
    const existingLineItem = await prisma.projectBudgetLineItem.findFirst({
      where: { 
        id: lineItemId,
        projectId 
      },
      include: {
        Project: {
          select: {
            id: true,
            createdById: true,
            managerId: true
          }
        }
      }
    })

    if (!existingLineItem) {
      return NextResponse.json({ error: 'Line item not found' }, { status: 404 })
    }

    const hasAccess = 
      session.user.role === 'SUPERADMIN' ||
      session.user.role === 'FINANCE' ||
      session.user.role === 'PROJECT_MANAGER' ||
      existingLineItem.Project.createdById === session.user.id ||
      existingLineItem.Project.managerId === session.user.id

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Calculate variance if amounts are being updated
    let variance = existingLineItem.variance
    let variancePercentage = existingLineItem.variancePercentage

    const budgeted = validatedData.budgetedAmount !== undefined 
      ? validatedData.budgetedAmount 
      : parseFloat(existingLineItem.budgetedAmount.toString())
    
    const actual = validatedData.actualAmount !== undefined 
      ? validatedData.actualAmount 
      : parseFloat(existingLineItem.actualAmount.toString())

    if (validatedData.budgetedAmount !== undefined || validatedData.actualAmount !== undefined) {
      const calc = calculateVariance(budgeted, actual)
      variance = calc.variance
      variancePercentage = calc.variancePercentage
    }

    // Handle approval
    let approvalData = {}
    if (validatedData.isApproved === true && !existingLineItem.isApproved) {
      approvalData = {
        isApproved: true,
        approvedById: session.user.id,
        approvedAt: new Date(),
        status: 'APPROVED'
      }
    } else if (validatedData.isApproved === false && existingLineItem.isApproved) {
      approvalData = {
        isApproved: false,
        approvedById: null,
        approvedAt: null
      }
    }

    // Update line item
    const updatedLineItem = await prisma.projectBudgetLineItem.update({
      where: { id: lineItemId },
      data: {
        ...validatedData,
        ...approvalData,
        variance,
        variancePercentage,
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
        },
        ApprovedBy: {
          select: { id: true, name: true, email: true }
        }
      }
    })

    // Check for budget warnings
    const warnings = []
    
    // Check if line item exceeds its budget
    const lineItemActual = parseFloat(updatedLineItem.actualAmount.toString())
    const lineItemBudgeted = parseFloat(updatedLineItem.budgetedAmount.toString())
    
    if (lineItemActual > lineItemBudgeted) {
      const overrun = ((lineItemActual - lineItemBudgeted) / lineItemBudgeted) * 100
      warnings.push({
        type: 'LINE_ITEM_EXCEEDED',
        severity: 'CRITICAL',
        message: `Line item "${updatedLineItem.itemName}" is over budget by ${overrun.toFixed(1)}%`
      })
    } else if (lineItemActual >= lineItemBudgeted * 0.9) {
      const utilization = (lineItemActual / lineItemBudgeted) * 100
      warnings.push({
        type: 'LINE_ITEM_WARNING',
        severity: 'WARNING',
        message: `Line item "${updatedLineItem.itemName}" is at ${utilization.toFixed(1)}% of budget`
      })
    }

    return NextResponse.json({ 
      lineItem: updatedLineItem,
      warnings
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: error.errors }, { status: 400 })
    }
    
    console.error('Error updating budget line item:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/projects/[id]/budget-line-items/[lineItemId] - Delete line item
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; lineItemId: string } }
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

    const { id: projectId, lineItemId } = params

    // Check line item exists and user has access
    const existingLineItem = await prisma.projectBudgetLineItem.findFirst({
      where: { 
        id: lineItemId,
        projectId 
      },
      include: {
        Project: {
          select: {
            id: true,
            createdById: true,
            managerId: true
          }
        }
      }
    })

    if (!existingLineItem) {
      return NextResponse.json({ error: 'Line item not found' }, { status: 404 })
    }

    const hasAccess = 
      session.user.role === 'SUPERADMIN' ||
      session.user.role === 'FINANCE' ||
      existingLineItem.Project.createdById === session.user.id ||
      existingLineItem.Project.managerId === session.user.id

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Delete line item
    await prisma.projectBudgetLineItem.delete({
      where: { id: lineItemId }
    })

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error deleting budget line item:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
