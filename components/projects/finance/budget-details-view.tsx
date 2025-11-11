
'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Plus,
  Edit,
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertCircle,
  CheckCircle,
  BarChart3,
  PieChart,
  Wallet,
  Receipt,
  Calculator,
  Target,
  Activity,
  Clock,
  Settings,
} from 'lucide-react'
import { toast } from 'sonner'
import { BudgetDialog } from './budget-dialog'
import { BudgetCategoryManager } from './budget-category-manager'
import { format } from 'date-fns'

interface BudgetDetailsViewProps {
  projectId: string
  project: {
    id: string
    name: string
    projectNumber: string
    contractValue?: number | null
    estimatedBudget?: number | null
  }
}

interface BudgetData {
  project: {
    id: string
    name: string
    projectNumber: string
    estimatedBudget: number | null
  }
  summary: {
    totalBudget: number
    totalIncome: number
    totalExpenses: number
    netProfit: number
    profitMargin: number
    categories: Record<string, {
      budgeted: number
      actual: number
      transactions: number
    }>
  }
  budgets: Array<{
    id: string
    category: string
    customCategoryId?: string | null
    budgetedAmount: number
    budgetedAmountBeforeTax?: number | null
    budgetedTaxAmount?: number | null
    actualAmount: number
    actualAmountBeforeTax?: number | null
    actualTaxAmount?: number | null
    description?: string
    BudgetCategory?: {
      id: string
      name: string
      code: string
      color?: string
    }
  }>
  recentTransactions: Array<{
    id: string
    transactionType: 'INCOME' | 'EXPENSE'
    amount: number
    description: string
    category: string
    date: string
    Supplier?: { name: string }
    Customer?: { name: string }
    User: { name?: string; firstName?: string; lastName?: string }
  }>
}

const CATEGORY_LABELS: Record<string, string> = {
  'GENERAL': 'General',
  'MATERIALS': 'Materials',
  'LABOR': 'Labor',
  'EQUIPMENT': 'Equipment',
  'SUBCONTRACTOR': 'Subcontractor',
  'PERMITS': 'Permits',
  'TRANSPORTATION': 'Transportation',
  'OVERHEAD': 'Overhead',
  'CONTINGENCY': 'Contingency',
  'OTHER': 'Other',
}

const CATEGORY_ICONS: Record<string, any> = {
  'GENERAL': Calculator,
  'MATERIALS': Receipt,
  'LABOR': Activity,
  'EQUIPMENT': Target,
  'SUBCONTRACTOR': Activity,
  'PERMITS': CheckCircle,
  'TRANSPORTATION': Activity,
  'OVERHEAD': DollarSign,
  'CONTINGENCY': AlertCircle,
  'OTHER': BarChart3,
}

export function BudgetDetailsView({ projectId, project }: BudgetDetailsViewProps) {
  const { data: session } = useSession()
  const [loading, setLoading] = useState(true)
  const [budgetData, setBudgetData] = useState<BudgetData | null>(null)
  const [showBudgetDialog, setShowBudgetDialog] = useState(false)
  const [selectedBudget, setSelectedBudget] = useState<any>(null)

  const fetchBudgetData = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/projects/${projectId}/budget`)
      if (!response.ok) {
        throw new Error('Failed to fetch budget data')
      }
      const data = await response.json()
      setBudgetData(data)
    } catch (error) {
      console.error('Error fetching budget data:', error)
      toast.error('Failed to load budget data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBudgetData()
  }, [projectId])

  const getCategoryLabel = (category: string, budgetCategory?: any) => {
    if (budgetCategory) {
      return budgetCategory.name
    }
    return CATEGORY_LABELS[category] || category
  }

  const getCategoryIcon = (category: string) => {
    const Icon = CATEGORY_ICONS[category] || BarChart3
    return <Icon className="h-4 w-4" />
  }

  const getStatusColor = (budgeted: number, actual: number) => {
    if (budgeted === 0) return 'text-gray-500'
    const percentage = (actual / budgeted) * 100
    if (percentage > 100) return 'text-red-600'
    if (percentage > 80) return 'text-yellow-600'
    return 'text-green-600'
  }

  const getStatusBadge = (budgeted: number, actual: number) => {
    if (budgeted === 0) return <Badge variant="secondary">No Budget</Badge>
    const percentage = (actual / budgeted) * 100
    if (percentage > 100) return <Badge variant="destructive">Over Budget</Badge>
    if (percentage > 80) return <Badge variant="default" className="bg-yellow-600">At Risk</Badge>
    return <Badge variant="default" className="bg-green-600">On Track</Badge>
  }

  const handleEditBudget = (budget: any) => {
    setSelectedBudget(budget)
    setShowBudgetDialog(true)
  }

  const handleCreateBudget = () => {
    setSelectedBudget(null)
    setShowBudgetDialog(true)
  }

  const handleBudgetSaved = () => {
    setShowBudgetDialog(false)
    setSelectedBudget(null)
    fetchBudgetData()
    toast.success('Budget updated successfully')
  }

  const canManageBudget = 
    session?.user?.role === 'SUPERADMIN' ||
    session?.user?.role === 'FINANCE' ||
    session?.user?.role === 'PROJECT_MANAGER'

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (!budgetData) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Failed to Load Budget</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Unable to fetch budget data
          </p>
          <Button onClick={fetchBudgetData}>Retry</Button>
        </CardContent>
      </Card>
    )
  }

  const totalBudgeted = budgetData.budgets.reduce(
    (sum, b) => sum + parseFloat(b.budgetedAmount.toString()),
    0
  )
  const totalActual = budgetData.budgets.reduce(
    (sum, b) => sum + parseFloat(b.actualAmount.toString()),
    0
  )
  const remaining = totalBudgeted - totalActual
  const overallPercentage = totalBudgeted > 0 ? (totalActual / totalBudgeted) * 100 : 0

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Budget Management</h2>
          <p className="text-sm text-muted-foreground">
            Track and manage project budget allocations, spending, and categories
          </p>
        </div>
        {canManageBudget && (
          <div className="flex gap-2">
            <BudgetCategoryManager 
              trigger={
                <Button variant="outline">
                  <Settings className="h-4 w-4 mr-2" />
                  Manage Categories
                </Button>
              }
            />
            <Button onClick={handleCreateBudget}>
              <Plus className="h-4 w-4 mr-2" />
              Add Budget
            </Button>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Budget</p>
                <p className="text-2xl font-bold">${totalBudgeted.toLocaleString()}</p>
              </div>
              <Wallet className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Spent</p>
                <p className="text-2xl font-bold text-red-600">${totalActual.toLocaleString()}</p>
              </div>
              <Receipt className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Remaining</p>
                <p className={`text-2xl font-bold ${remaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${remaining.toLocaleString()}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Utilization</p>
                <p className="text-2xl font-bold">{overallPercentage.toFixed(1)}%</p>
              </div>
              <BarChart3 className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Overall Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Overall Budget Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Budget Utilization</span>
              <span className="font-medium">
                ${totalActual.toLocaleString()} / ${totalBudgeted.toLocaleString()}
              </span>
            </div>
            <Progress 
              value={Math.min(overallPercentage, 100)}
              className={`h-3 ${overallPercentage > 100 ? '[&>div]:bg-red-500' : '[&>div]:bg-blue-500'}`}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{overallPercentage.toFixed(1)}% used</span>
              <span>{remaining >= 0 ? `$${remaining.toLocaleString()} remaining` : `$${Math.abs(remaining).toLocaleString()} over`}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Budget Categories */}
      {budgetData.budgets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Budget Categories</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Start by adding budget categories to track project expenses
            </p>
            {canManageBudget && (
              <Button onClick={handleCreateBudget}>
                <Plus className="h-4 w-4 mr-2" />
                Add Budget Category
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Budget Categories</CardTitle>
            <CardDescription>
              Detailed breakdown of budget by category
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {budgetData.budgets.map((budget) => {
                const budgeted = parseFloat(budget.budgetedAmount.toString())
                const actual = parseFloat(budget.actualAmount.toString())
                const remaining = budgeted - actual
                const percentage = budgeted > 0 ? (actual / budgeted) * 100 : 0
                const isOverBudget = actual > budgeted

                return (
                  <div key={budget.id} className="space-y-3 pb-6 border-b last:border-0">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          {getCategoryIcon(budget.category)}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <h4 className="font-semibold">
                              {getCategoryLabel(budget.category, budget.BudgetCategory)}
                            </h4>
                            {getStatusBadge(budgeted, actual)}
                          </div>
                          {budget.description && (
                            <p className="text-sm text-muted-foreground">{budget.description}</p>
                          )}
                        </div>
                      </div>
                      {canManageBudget && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditBudget(budget)}
                        >
                          <Edit className="h-3 w-3 mr-1" />
                          Edit
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Budgeted</p>
                        <p className="font-semibold">${budgeted.toLocaleString()}</p>
                        {budget.budgetedAmountBeforeTax && (
                          <p className="text-xs text-muted-foreground">
                            Before Tax: ${parseFloat(budget.budgetedAmountBeforeTax.toString()).toLocaleString()}
                          </p>
                        )}
                        {budget.budgetedTaxAmount && (
                          <p className="text-xs text-muted-foreground">
                            Tax: ${parseFloat(budget.budgetedTaxAmount.toString()).toLocaleString()}
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-muted-foreground">Spent</p>
                        <p className={`font-semibold ${getStatusColor(budgeted, actual)}`}>
                          ${actual.toLocaleString()}
                        </p>
                        {budget.actualAmountBeforeTax && (
                          <p className="text-xs text-muted-foreground">
                            Before Tax: ${parseFloat(budget.actualAmountBeforeTax.toString()).toLocaleString()}
                          </p>
                        )}
                        {budget.actualTaxAmount && (
                          <p className="text-xs text-muted-foreground">
                            Tax: ${parseFloat(budget.actualTaxAmount.toString()).toLocaleString()}
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-muted-foreground">Remaining</p>
                        <p className={`font-semibold ${remaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          ${remaining.toLocaleString()}
                        </p>
                        {budget.budgetedAmountBeforeTax && budget.actualAmountBeforeTax && (
                          <p className="text-xs text-muted-foreground">
                            Before Tax: ${(parseFloat(budget.budgetedAmountBeforeTax.toString()) - parseFloat(budget.actualAmountBeforeTax.toString())).toLocaleString()}
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-muted-foreground">Profit After Tax</p>
                        <p className={`font-semibold ${remaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          ${remaining.toLocaleString()}
                        </p>
                        {budget.budgetedTaxAmount && budget.actualTaxAmount && (
                          <p className="text-xs text-muted-foreground">
                            Tax Saved: ${(parseFloat(budget.budgetedTaxAmount.toString()) - parseFloat(budget.actualTaxAmount.toString())).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Progress 
                        value={Math.min(percentage, 100)}
                        className={`h-2 ${isOverBudget ? '[&>div]:bg-red-500' : '[&>div]:bg-blue-500'}`}
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{percentage.toFixed(1)}% utilized</span>
                        {isOverBudget && (
                          <span className="text-red-600 font-medium">
                            {((actual - budgeted) / budgeted * 100).toFixed(1)}% over budget
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center">
            <Clock className="h-4 w-4 mr-2" />
            Recent Budget Transactions
          </CardTitle>
          <CardDescription>
            Latest financial activities affecting budget categories
          </CardDescription>
        </CardHeader>
        <CardContent>
          {budgetData.recentTransactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No transactions recorded</p>
            </div>
          ) : (
            <div className="space-y-3">
              {budgetData.recentTransactions.slice(0, 10).map((transaction) => (
                <div 
                  key={transaction.id} 
                  className="flex items-center justify-between p-3 border rounded-lg hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg ${
                      transaction.transactionType === 'INCOME' ? 'bg-green-100' : 'bg-red-100'
                    }`}>
                      {transaction.transactionType === 'INCOME' ? (
                        <TrendingDown className="h-4 w-4 text-green-600" />
                      ) : (
                        <TrendingUp className="h-4 w-4 text-red-600" />
                      )}
                    </div>
                    <div>
                      <div className="font-medium text-sm">{transaction.description}</div>
                      <div className="text-xs text-muted-foreground">
                        {getCategoryLabel(transaction.category)} • {format(new Date(transaction.date), 'MMM dd, yyyy')}
                      </div>
                      {(transaction.Supplier || transaction.Customer) && (
                        <div className="text-xs text-muted-foreground">
                          {transaction.Supplier?.name || transaction.Customer?.name}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-medium ${
                      transaction.transactionType === 'INCOME' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {transaction.transactionType === 'INCOME' ? '+' : '-'}${parseFloat(transaction.amount.toString()).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Budget Dialog */}
      {showBudgetDialog && (
        <BudgetDialog
          projectId={projectId}
          budget={selectedBudget}
          onSaved={handleBudgetSaved}
          onCancel={() => {
            setShowBudgetDialog(false)
            setSelectedBudget(null)
          }}
        />
      )}
    </div>
  )
}
