
'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  BarChart3, 
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  TrendingDown,
  Clock,
  DollarSign
} from 'lucide-react'
import { format } from 'date-fns'

interface BudgetOverviewProps {
  projectId: string
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
    budgetedAmount: number
    actualAmount: number
    description?: string
  }>
  recentTransactions: Array<{
    id: string
    transactionType: 'INCOME' | 'EXPENSE'
    amount: number
    description: string
    category: string
    date: string
    vendor?: { name: string }
    client?: { name: string }
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

export function BudgetOverview({ projectId, summary, budgets, recentTransactions }: BudgetOverviewProps) {
  const getCategoryLabel = (category: string) => {
    return CATEGORY_LABELS[category] || category
  }

  const getTransactionIcon = (type: string) => {
    return type === 'INCOME' ? (
      <ArrowDownRight className="w-4 h-4 text-green-600" />
    ) : (
      <ArrowUpRight className="w-4 h-4 text-red-600" />
    )
  }

  const getVarianceColor = (budgeted: number, actual: number) => {
    if (budgeted === 0) return 'text-gray-500'
    const variance = ((actual - budgeted) / budgeted) * 100
    if (variance > 10) return 'text-red-600'
    if (variance < -10) return 'text-green-600'
    return 'text-yellow-600'
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Budget vs Actual Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <BarChart3 className="mr-2 h-5 w-5" />
            Budget vs Actual by Category
          </CardTitle>
          <CardDescription>
            Compare planned budget with actual spending
          </CardDescription>
        </CardHeader>
        <CardContent>
          {budgets.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No budget categories defined</p>
              <p className="text-sm">Add budget categories to see comparison</p>
            </div>
          ) : (
            <div className="space-y-4">
              {budgets.map((budget) => {
                const percentage = budget.budgetedAmount > 0 
                  ? (budget.actualAmount / budget.budgetedAmount) * 100 
                  : 0
                const isOverBudget = budget.actualAmount > budget.budgetedAmount
                const variance = budget.budgetedAmount > 0 
                  ? ((budget.actualAmount - budget.budgetedAmount) / budget.budgetedAmount) * 100
                  : 0

                return (
                  <div key={budget.id} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">
                        {getCategoryLabel(budget.category)}
                      </span>
                      <div className="text-right">
                        <div className="text-sm">
                          ${budget.actualAmount.toLocaleString()} / ${budget.budgetedAmount.toLocaleString()}
                        </div>
                        <div className={`text-xs ${getVarianceColor(budget.budgetedAmount, budget.actualAmount)}`}>
                          {variance > 0 ? '+' : ''}{variance.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                    <Progress 
                      value={Math.min(percentage, 100)}
                      className={`h-2 ${isOverBudget ? '[&>div]:bg-red-500' : '[&>div]:bg-blue-500'}`}
                    />
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cash Flow Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <DollarSign className="mr-2 h-5 w-5" />
            Cash Flow Summary
          </CardTitle>
          <CardDescription>
            Income vs expenses breakdown
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
              <div className="flex items-center">
                <ArrowDownRight className="h-5 w-5 text-green-600 mr-2" />
                <span className="font-medium">Total Income</span>
              </div>
              <span className="text-lg font-semibold text-green-600">
                ${summary.totalIncome.toLocaleString()}
              </span>
            </div>
            
            <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
              <div className="flex items-center">
                <ArrowUpRight className="h-5 w-5 text-red-600 mr-2" />
                <span className="font-medium">Total Expenses</span>
              </div>
              <span className="text-lg font-semibold text-red-600">
                ${summary.totalExpenses.toLocaleString()}
              </span>
            </div>
            
            <div className={`flex justify-between items-center p-3 rounded-lg border-2 ${
              summary.netProfit >= 0 ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
            }`}>
              <div className="flex items-center">
                {summary.netProfit >= 0 ? (
                  <TrendingUp className="h-5 w-5 text-green-600 mr-2" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-red-600 mr-2" />
                )}
                <span className="font-medium">Net Profit</span>
              </div>
              <div className="text-right">
                <div className={`text-lg font-semibold ${
                  summary.netProfit >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  ${summary.netProfit.toLocaleString()}
                </div>
                <div className="text-sm text-gray-600">
                  {summary.profitMargin.toFixed(1)}% margin
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Transactions */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Clock className="mr-2 h-5 w-5" />
            Recent Transactions
          </CardTitle>
          <CardDescription>
            Latest financial activities for this project
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentTransactions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No transactions recorded</p>
              <p className="text-sm">Financial activities will appear here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentTransactions.map((transaction) => (
                <div 
                  key={transaction.id} 
                  className="flex items-center justify-between p-3 border rounded-lg hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-center space-x-3">
                    {getTransactionIcon(transaction.transactionType)}
                    <div>
                      <div className="font-medium text-sm">{transaction.description}</div>
                      <div className="text-xs text-gray-500">
                        {getCategoryLabel(transaction.category)} • {format(new Date(transaction.date), 'MMM dd, yyyy')}
                      </div>
                      {(transaction.vendor || transaction.client) && (
                        <div className="text-xs text-gray-400">
                          {transaction.vendor?.name || transaction.client?.name}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-medium ${
                      transaction.transactionType === 'INCOME' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {transaction.transactionType === 'INCOME' ? '+' : '-'}${transaction.amount.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500">
                      {transaction.User.name || 
                       `${transaction.User.firstName || ''} ${transaction.User.lastName || ''}`.trim() || 
                       'Unknown'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
