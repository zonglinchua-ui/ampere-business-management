import { prisma } from '../db'
import { differenceInDays, format } from 'date-fns'
import { ProjectBudget, ProjectTransaction } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'

export interface CategoryForecast {
  category: string
  budgeted: number
  actual: number
  variance: number
}

export interface MonthlyActual {
  month: string
  actual: number
}

export interface BurnRateProjection {
  burnRatePerDay: number
  projectedAtCompletion: number
  varianceToBudget: number
  daysRemaining: number
}

export interface BudgetForecast {
  projectId: string
  projectName: string
  totalBudget: number
  totalActual: number
  remainingBudget: number
  burnRate: BurnRateProjection
  categories: CategoryForecast[]
  monthlyActuals: MonthlyActual[]
  startDate?: string
  endDate?: string
}

function toNumber(value: Decimal | number | null | undefined): number {
  if (value === null || value === undefined) return 0
  if (typeof value === 'number') return value
  return Number(value.toString())
}

export function computeBurnRateProjection(params: {
  totalBudget: number
  totalActual: number
  startDate?: Date | null
  endDate?: Date | null
  today?: Date
}): BurnRateProjection {
  const today = params.today ?? new Date()
  const startDate = params.startDate ?? today
  const endDate = params.endDate ?? new Date(today.getFullYear(), today.getMonth() + 3, today.getDate())

  const elapsedDays = Math.max(1, differenceInDays(today, startDate) || 1)
  const remainingDays = Math.max(0, differenceInDays(endDate, today))

  const burnRatePerDay = params.totalActual / elapsedDays
  const projectedAtCompletion = params.totalActual + burnRatePerDay * remainingDays
  const varianceToBudget = params.totalBudget - projectedAtCompletion

  return {
    burnRatePerDay,
    projectedAtCompletion,
    varianceToBudget,
    daysRemaining: remainingDays
  }
}

function aggregateMonthlyActuals(transactions: Pick<ProjectTransaction, 'amount' | 'date'>[]): MonthlyActual[] {
  const monthly = new Map<string, number>()

  for (const txn of transactions) {
    const monthKey = format(txn.date, 'yyyy-MM')
    const amount = toNumber(txn.amount as unknown as Decimal)
    monthly.set(monthKey, (monthly.get(monthKey) ?? 0) + amount)
  }

  return Array.from(monthly.entries())
    .map(([month, actual]) => ({ month, actual }))
    .sort((a, b) => a.month.localeCompare(b.month))
}

function buildCategoryBreakdown(budgets: ProjectBudget[], transactions: ProjectTransaction[]): CategoryForecast[] {
  const actualByCategory = new Map<string, number>()
  for (const txn of transactions) {
    const key = txn.customCategoryId || txn.category
    actualByCategory.set(key, (actualByCategory.get(key) ?? 0) + toNumber(txn.amount as unknown as Decimal))
  }

  return budgets.map((budget) => {
    const key = budget.customCategoryId || budget.category
    const actual = actualByCategory.get(key) ?? toNumber(budget.actualAmount as unknown as Decimal)
    const budgeted = toNumber(budget.budgetedAmount as unknown as Decimal)
    return {
      category: String(key),
      budgeted,
      actual,
      variance: budgeted - actual
    }
  })
}

function buildForecastForProject(params: {
  projectId: string
  projectName?: string
  startDate?: Date | null
  endDate?: Date | null
  budgets: ProjectBudget[]
  transactions: ProjectTransaction[]
}): BudgetForecast {
  const totalBudget = params.budgets.reduce((sum, budget) => sum + toNumber(budget.budgetedAmount as unknown as Decimal), 0)
  const hasTransactions = params.transactions.length > 0
  const transactionActual = params.transactions.reduce(
    (sum, txn) => sum + toNumber(txn.amount as unknown as Decimal),
    0
  )
  const budgetActual = params.budgets.reduce((sum, budget) => sum + toNumber(budget.actualAmount as unknown as Decimal), 0)
  const totalActual = hasTransactions ? transactionActual : budgetActual

  const burnRate = computeBurnRateProjection({
    totalBudget,
    totalActual,
    startDate: params.startDate,
    endDate: params.endDate
  })

  return {
    projectId: params.projectId,
    projectName: params.projectName ?? 'Unspecified project',
    totalBudget,
    totalActual,
    remainingBudget: totalBudget - totalActual,
    burnRate,
    categories: buildCategoryBreakdown(params.budgets, params.transactions),
    monthlyActuals: aggregateMonthlyActuals(params.transactions),
    startDate: params.startDate?.toISOString(),
    endDate: params.endDate?.toISOString()
  }
}

export async function getProjectForecast(projectId: string): Promise<BudgetForecast> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      startDate: true,
      endDate: true,
      ProjectBudget: true,
      ProjectTransaction: true
    }
  })

  if (!project) {
    throw new Error(`Project ${projectId} not found`)
  }

  return buildForecastForProject({
    projectId: project.id,
    projectName: project.name,
    startDate: project.startDate,
    endDate: project.endDate,
    budgets: project.ProjectBudget,
    transactions: project.ProjectTransaction
  })
}

export async function getPortfolioForecast(): Promise<BudgetForecast[]> {
  const projects = await prisma.project.findMany({
    select: {
      id: true,
      name: true,
      startDate: true,
      endDate: true,
      ProjectBudget: true,
      ProjectTransaction: true
    }
  })

  return projects.map((project) =>
    buildForecastForProject({
      projectId: project.id,
      projectName: project.name,
      startDate: project.startDate,
      endDate: project.endDate,
      budgets: project.ProjectBudget,
      transactions: project.ProjectTransaction
    })
  )
}

export function projectScenarioFromAdjustments(
  base: BudgetForecast,
  adjustments: {
    percentageChange?: number
    hiringHeadcount?: number
    purchaseOrderImpact?: number
    hiringCostPerHead?: number
  }
): BudgetForecast {
  const pct = (adjustments.percentageChange ?? 0) / 100
  const hiringCost = (adjustments.hiringHeadcount ?? 0) * (adjustments.hiringCostPerHead ?? 8000)
  const purchaseImpact = adjustments.purchaseOrderImpact ?? 0

  const adjustedBudget = base.totalBudget * (1 + pct) + purchaseImpact
  const adjustedActual = base.totalActual + hiringCost

  const burnRate = computeBurnRateProjection({
    totalBudget: adjustedBudget,
    totalActual: adjustedActual,
    startDate: base.startDate ? new Date(base.startDate) : undefined,
    endDate: base.endDate ? new Date(base.endDate) : undefined
  })

  return {
    ...base,
    totalBudget: adjustedBudget,
    totalActual: adjustedActual,
    remainingBudget: adjustedBudget - adjustedActual,
    burnRate
  }
}
