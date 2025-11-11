
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const updateTransactionSchema = z.object({
  transactionType: z.enum(['INCOME', 'EXPENSE']).optional(),
  amount: z.number().min(0.01).optional(),
  description: z.string().min(1).optional(),
  notes: z.string().optional(),
  category: z.enum(['GENERAL', 'MATERIALS', 'LABOR', 'EQUIPMENT', 'SUBCONTRACTOR', 'PERMITS', 'TRANSPORTATION', 'OVERHEAD', 'CONTINGENCY', 'OTHER']).optional(),
  date: z.string().transform(str => new Date(str)).optional(),
  supplierId: z.string().optional(),
  customerId: z.string().optional(),
  reference: z.string().optional(),
  financeId: z.string().optional(),
})

// GET /api/projects/[id]/transactions/[transactionId] - Get single transaction
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; transactionId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const projectId = params.id
    const transactionId = params.transactionId

    // Check if user has access to this project transaction
    const transaction = await prisma.projectTransaction.findFirst({
      where: {
        id: transactionId,
        projectId,
        Project: {
          OR: [
            { createdById: session.user.id },
            { managerId: session.user.id },
            { salespersonId: session.user.id },
            session.user.role === 'SUPERADMIN' || session.user.role === 'FINANCE' ? {} : { id: 'never-match' }
          ]
        }
      },
      include: {
        Supplier: { select: { id: true, name: true } },
        Customer: { select: { id: true, name: true } },
        User: { select: { id: true, name: true, firstName: true, lastName: true } },
        Project: { select: { id: true, name: true, projectNumber: true } }
      }
    })

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    return NextResponse.json({ transaction })

  } catch (error) {
    console.error('Error fetching transaction:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/projects/[id]/transactions/[transactionId] - Update transaction
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; transactionId: string } }
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
    const transactionId = params.transactionId
    const body = await request.json()
    
    const validatedData = updateTransactionSchema.parse(body)

    // Get existing transaction and check access
    const existingTransaction = await prisma.projectTransaction.findFirst({
      where: {
        id: transactionId,
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

    if (!existingTransaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    // Verify vendor/client exist if provided
    if (validatedData.supplierId) {
      const vendor = await prisma.supplier.findUnique({
        where: { id: validatedData.supplierId }
      })
      if (!vendor) {
        return NextResponse.json({ error: 'Vendor not found' }, { status: 400 })
      }
    }

    if (validatedData.customerId) {
      const customer = await prisma.customer.findUnique({
        where: { id: validatedData.customerId }
      })
      if (!customer) {
        return NextResponse.json({ error: 'Customer not found' }, { status: 400 })
      }
    }

    // Update transaction
    const transaction = await prisma.projectTransaction.update({
      where: { id: transactionId },
      data: validatedData,
      include: {
        Supplier: { select: { name: true } },
        Customer: { select: { name: true } },
        User: { select: { name: true, firstName: true, lastName: true } }
      }
    })

    // Update budget actual amounts if category changed
    if (validatedData.category && validatedData.category !== existingTransaction.category) {
      // Remove from old category
      const oldBudget = await prisma.projectBudget.findFirst({
        where: { projectId, category: existingTransaction.category }
      })
      
      if (oldBudget) {
        const oldActual = parseFloat(oldBudget.actualAmount.toString())
        const oldAmount = parseFloat(existingTransaction.amount.toString())
        
        await prisma.projectBudget.update({
          where: { id: oldBudget.id },
          data: { actualAmount: Math.max(0, oldActual - oldAmount) }
        })
      }

      // Add to new category
      const newBudget = await prisma.projectBudget.findFirst({
        where: { projectId, category: validatedData.category }
      })
      
      if (newBudget) {
        const newActual = parseFloat(newBudget.actualAmount.toString())
        const transactionAmount = parseFloat((validatedData.amount || existingTransaction.amount).toString())
        
        await prisma.projectBudget.update({
          where: { id: newBudget.id },
          data: { actualAmount: newActual + transactionAmount }
        })
      }
    }

    return NextResponse.json({ transaction })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: error.errors }, { status: 400 })
    }
    
    console.error('Error updating transaction:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/projects/[id]/transactions/[transactionId] - Delete transaction
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; transactionId: string } }
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
    const transactionId = params.transactionId

    // Get existing transaction and check access
    const existingTransaction = await prisma.projectTransaction.findFirst({
      where: {
        id: transactionId,
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

    if (!existingTransaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    // Delete transaction
    await prisma.projectTransaction.delete({
      where: { id: transactionId }
    })

    // Update budget actual amounts
    const budget = await prisma.projectBudget.findFirst({
      where: { projectId, category: existingTransaction.category }
    })
    
    if (budget) {
      const currentActual = parseFloat(budget.actualAmount.toString())
      const transactionAmount = parseFloat(existingTransaction.amount.toString())
      
      await prisma.projectBudget.update({
        where: { id: budget.id },
        data: { actualAmount: Math.max(0, currentActual - transactionAmount) }
      })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error deleting transaction:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
