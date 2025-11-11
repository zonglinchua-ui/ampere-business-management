import { v4 as uuidv4 } from 'uuid'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const createTransactionSchema = z.object({
  transactionType: z.enum(['INCOME', 'EXPENSE']),
  amount: z.number().min(0.01),
  description: z.string().min(1),
  notes: z.string().optional(),
  category: z.enum(['GENERAL', 'MATERIALS', 'LABOR', 'EQUIPMENT', 'SUBCONTRACTOR', 'PERMITS', 'TRANSPORTATION', 'OVERHEAD', 'CONTINGENCY', 'OTHER']),
  date: z.string().transform(str => new Date(str)),
  supplierId: z.string().optional(),
  customerId: z.string().optional(),
  reference: z.string().optional(),
  financeId: z.string().optional(),
})

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

// GET /api/projects/[id]/transactions - Get project transactions
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
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const type = searchParams.get('type') // 'INCOME' or 'EXPENSE'
    const category = searchParams.get('category')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // Check if user has access to this project
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { createdById: session.user.id },
          { managerId: session.user.id },
          { salespersonId: session.user.id },
          // Allow SUPERADMIN and FINANCE roles to view all projects
          session.user.role === 'SUPERADMIN' || session.user.role === 'FINANCE' ? {} : { id: 'never-match' }
        ]
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const skip = (page - 1) * limit

    const where: any = { projectId }
    
    if (type && ['INCOME', 'EXPENSE'].includes(type)) {
      where.transactionType = type
    }
    
    if (category) {
      where.category = category
    }
    
    if (startDate || endDate) {
      where.date = {}
      if (startDate) where.date.gte = new Date(startDate)
      if (endDate) where.date.lte = new Date(endDate)
    }

    const [transactions, total] = await Promise.all([
      prisma.projectTransaction.findMany({
        where,
        include: {
          Supplier: { select: { name: true } },
          Customer: { select: { name: true } },
          User: { select: { name: true, firstName: true, lastName: true } }
        },
        orderBy: { date: 'desc' },
        skip,
        take: limit
      }),
      prisma.projectTransaction.count({ where })
    ])

    // Calculate summary statistics
    const summary = await prisma.projectTransaction.groupBy({
      by: ['transactionType'],
      where: { projectId },
      _sum: { amount: true },
      _count: true
    })

    const summaryStats = {
      totalIncome: 0,
      totalExpenses: 0,
      incomeCount: 0,
      expenseCount: 0
    }

    summary.forEach((item: any) => {
      if (item.transactionType === 'INCOME') {
        summaryStats.totalIncome = parseFloat(item._sum.amount?.toString() || '0')
        summaryStats.incomeCount = item._count
      } else {
        summaryStats.totalExpenses = parseFloat(item._sum.amount?.toString() || '0')
        summaryStats.expenseCount = item._count
      }
    })

    return NextResponse.json({
      transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      summary: {
        ...summaryStats,
        netAmount: summaryStats.totalIncome - summaryStats.totalExpenses
      }
    })

  } catch (error) {
    console.error('Error fetching project transactions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/projects/[id]/transactions - Create new transaction
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
    
    const validatedData = createTransactionSchema.parse(body)

    // Check if user has access to this project
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { createdById: session.user.id },
          { managerId: session.user.id },
          session.user.role === 'SUPERADMIN' || session.user.role === 'FINANCE' ? {} : { id: 'never-match' }
        ]
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
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

    // Create transaction
    const transaction = await prisma.projectTransaction.create({
      data: {
        id: uuidv4(),
        projectId,
        transactionType: validatedData.transactionType,
        amount: validatedData.amount,
        description: validatedData.description,
        notes: validatedData.notes,
        category: validatedData.category,
        date: validatedData.date,
        supplierId: validatedData.supplierId,
        customerId: validatedData.customerId,
        reference: validatedData.reference,
        financeId: validatedData.financeId,
        createdById: session.user.id,
        updatedAt: new Date()
      },
      include: {
        Supplier: { select: { name: true } },
        Customer: { select: { name: true } },
        User: { select: { name: true, firstName: true, lastName: true } }
      }
    })

    // Update budget actual amounts if budget category exists
    const budget = await prisma.projectBudget.findFirst({
      where: {
        projectId,
        category: validatedData.category
      }
    })

    if (budget) {
      const currentActual = parseFloat(budget.actualAmount.toString())
      const transactionAmount = parseFloat(validatedData.amount.toString())
      
      await prisma.projectBudget.update({
        where: { id: budget.id },
        data: {
          actualAmount: validatedData.transactionType === 'INCOME' 
            ? currentActual + transactionAmount
            : currentActual + transactionAmount
        }
      })
    }

    return NextResponse.json({ transaction })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: error.errors }, { status: 400 })
    }
    
    console.error('Error creating project transaction:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
