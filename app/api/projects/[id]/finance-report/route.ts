
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// GET /api/projects/[id]/finance-report - Generate finance report for project
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
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const format = searchParams.get('format') // 'json', 'csv', 'excel'

    // Check if user has access to this project
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { createdById: session.user.id },
          { managerId: session.user.id },
          { salespersonId: session.user.id },
          session.user.role === 'SUPERADMIN' || session.user.role === 'FINANCE' ? {} : { id: 'never-match' }
        ]
      },
      include: {
        Customer: { select: { name: true, contactPerson: true } },
        User_Project_managerIdToUser: { select: { name: true, firstName: true, lastName: true } },
        ProjectBudget: true,
        ProjectTransaction: {
          where: startDate || endDate ? {
            date: {
              ...(startDate && { gte: new Date(startDate) }),
              ...(endDate && { lte: new Date(endDate) })
            }
          } : {},
          include: {
            Supplier: { select: { name: true } },
            Customer: { select: { name: true } },
            User: { select: { name: true, firstName: true, lastName: true } }
          },
          orderBy: { date: 'desc' }
        }
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Calculate financial metrics
    const metrics = {
      totalBudget: parseFloat(project.estimatedBudget?.toString() || '0'),
      totalIncome: 0,
      totalExpenses: 0,
      netProfit: 0,
      profitMargin: 0,
      budgetVariance: 0,
      categoryBreakdown: {} as Record<string, {
        budgeted: number;
        actual: number;
        variance: number;
        transactions: number;
        income: number;
        expenses: number;
      }>
    }

    // Initialize category breakdown from budgets
    project.ProjectBudget.forEach((budget: any) => {
      metrics.categoryBreakdown[budget.category] = {
        budgeted: parseFloat(budget.budgetedAmount.toString()),
        actual: parseFloat(budget.actualAmount.toString()),
        variance: 0,
        transactions: 0,
        income: 0,
        expenses: 0
      }
    })

    // Process transactions
    const transactionsByCategory: Record<string, any[]> = {}
    project.ProjectTransaction.forEach((transaction: any) => {
      const amount = parseFloat(transaction.amount.toString())
      const category = transaction.category

      if (transaction.transactionType === 'INCOME') {
        metrics.totalIncome += amount
        if (metrics.categoryBreakdown[category]) {
          metrics.categoryBreakdown[category].income += amount
        }
      } else {
        metrics.totalExpenses += amount
        if (metrics.categoryBreakdown[category]) {
          metrics.categoryBreakdown[category].expenses += amount
        }
      }

      // Group transactions by category
      if (!transactionsByCategory[category]) {
        transactionsByCategory[category] = []
      }
      transactionsByCategory[category].push(transaction)

      // Update category transaction count
      if (metrics.categoryBreakdown[category]) {
        metrics.categoryBreakdown[category].transactions += 1
      }
    })

    // Calculate final metrics
    metrics.netProfit = metrics.totalIncome - metrics.totalExpenses
    metrics.profitMargin = metrics.totalIncome > 0 ? (metrics.netProfit / metrics.totalIncome) * 100 : 0
    metrics.budgetVariance = metrics.totalBudget > 0 ? ((metrics.totalExpenses - metrics.totalBudget) / metrics.totalBudget) * 100 : 0

    // Calculate variance for each category
    Object.keys(metrics.categoryBreakdown).forEach((category: any) => {
      const breakdown = metrics.categoryBreakdown[category]
      breakdown.variance = breakdown.budgeted > 0 ? 
        ((breakdown.expenses - breakdown.budgeted) / breakdown.budgeted) * 100 : 
        (breakdown.expenses > 0 ? 100 : 0)
    })

    // Build report data
    const reportData = {
      project: {
        id: project.id,
        name: project.name,
        projectNumber: project.projectNumber,
        status: project.status,
        client: project.Customer?.name || 'Unknown',
        manager: project.User_Project_managerIdToUser?.name || 
                `${project.User_Project_managerIdToUser?.firstName || ''} ${project.User_Project_managerIdToUser?.lastName || ''}`.trim() || 
                'Not assigned',
        startDate: project.startDate,
        endDate: project.endDate,
        estimatedBudget: project.estimatedBudget
      },
      reportPeriod: {
        startDate: startDate || 'Project start',
        endDate: endDate || 'Current date',
        generatedAt: new Date().toISOString(),
        generatedBy: session.user.name || session.user.email
      },
      financialSummary: metrics,
      budgetComparison: project.ProjectBudget.map((budget: any) => ({
        category: budget.category,
        budgeted: parseFloat(budget.budgetedAmount.toString()),
        actual: parseFloat(budget.actualAmount.toString()),
        variance: parseFloat(budget.budgetedAmount.toString()) > 0 ? 
          ((parseFloat(budget.actualAmount.toString()) - parseFloat(budget.budgetedAmount.toString())) / parseFloat(budget.budgetedAmount.toString())) * 100 : 
          (parseFloat(budget.actualAmount.toString()) > 0 ? 100 : 0),
        description: budget.description
      })),
      transactions: project.ProjectTransaction.map((transaction: any) => ({
        id: transaction.id,
        date: transaction.date,
        type: transaction.transactionType,
        category: transaction.category,
        description: transaction.description,
        amount: parseFloat(transaction.amount.toString()),
        supplier: transaction.supplier?.name || null,
        client: transaction.client?.name || null,
        reference: transaction.reference,
        notes: transaction.notes,
        User_ProjectDocument_createdByIdToUser: transaction.User?.name || 
                  `${transaction.User?.firstName || ''} ${transaction.User?.lastName || ''}`.trim() || 
                  'Unknown'
      })),
      transactionsByCategory
    }

    // Handle different export formats
    if (format === 'csv') {
      // Generate CSV content
      const csvRows = [
        // Header
        'Date,Type,Category,Description,Amount,Vendor/Client,Reference,Notes,Created By'
      ]

      // Add transaction rows
      reportData.transactions.forEach((transaction: any) => {
        csvRows.push([
          transaction.date.toISOString().split('T')[0],
          transaction.type,
          transaction.category,
          `"${transaction.description.replace(/"/g, '""')}"`,
          transaction.amount,
          transaction.vendor || transaction.client || '',
          transaction.reference || '',
          `"${(transaction.notes || '').replace(/"/g, '""')}"`,
          transaction.createdBy
        ].join(','))
      })

      const csvContent = csvRows.join('\n')
      
      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="project-${project.projectNumber}-finance-report.csv"`
        }
      })
    }

    // Default JSON response
    return NextResponse.json(reportData)

  } catch (error) {
    console.error('Error generating finance report:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
