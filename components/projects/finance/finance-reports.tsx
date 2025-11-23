
'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Calendar } from '@/components/ui/calendar'
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { 
  BarChart3,
  PieChart,
  Download,
  FileText,
  Calendar as CalendarIcon,
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertTriangle
} from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface FinanceReportsProps {
  projectId: string
  project: {
    id: string
    name: string
    projectNumber: string
    estimatedBudget?: number | null
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
}

export function FinanceReports({ projectId, project, summary }: FinanceReportsProps) {
  const [dateRange, setDateRange] = useState<{
    from: Date | undefined
    to: Date | undefined
  }>({
    from: undefined,
    to: undefined
  })
  const [loading, setLoading] = useState(false)

  const handleGenerateReport = async (format: 'json' | 'csv') => {
    try {
      setLoading(true)

      const params = new URLSearchParams()
      if (dateRange.from) {
        params.append('startDate', dateRange.from.toISOString())
      }
      if (dateRange.to) {
        params.append('endDate', dateRange.to.toISOString())
      }
      params.append('format', format)

      const response = await fetch(`/api/projects/${projectId}/finance-report?${params}`)
      
      if (!response.ok) {
        throw new Error('Failed to generate report')
      }

      if (format === 'csv') {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.style.display = 'none'
        a.href = url
        a.download = `project-${project.projectNumber}-finance-report.csv`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        const data = await response.json()
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.style.display = 'none'
        a.href = url
        a.download = `project-${project.projectNumber}-finance-report.json`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }

      toast.success('Report generated successfully')
    } catch (error) {
      console.error('Error generating report:', error)
      toast.error('Failed to generate report')
    } finally {
      setLoading(false)
    }
  }

  const budgetUtilization = summary.totalBudget > 0 
    ? (summary.totalExpenses / summary.totalBudget) * 100 
    : 0

  const isOverBudget = summary.totalExpenses > summary.totalBudget
  const budgetVariance = summary.totalBudget > 0 
    ? ((summary.totalExpenses - summary.totalBudget) / summary.totalBudget) * 100
    : 0

  return (
    <div className="space-y-6">
      {/* Report Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <FileText className="mr-2 h-5 w-5" />
            Generate Finance Report
          </CardTitle>
          <CardDescription>
            Create detailed financial reports for this project
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Report Period (Optional)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateRange.from && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, "LLL dd, y")} -{" "}
                          {format(dateRange.to, "LLL dd, y")}
                        </>
                      ) : (
                        format(dateRange.from, "LLL dd, y")
                      )
                    ) : (
                      <span>Pick a date range</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange.from}
                    selected={dateRange}
                    onSelect={(range) => {
                      if (range) {
                        setDateRange({
                          from: range.from,
                          to: range.to
                        })
                      }
                    }}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
              <p className="text-xs text-gray-500">
                Leave empty to include all transactions
              </p>
            </div>

            <div className="space-y-2">
              <Label>Export Format</Label>
              <div className="flex gap-2">
                <Button 
                  onClick={() => handleGenerateReport('csv')}
                  disabled={loading}
                  className="flex-1"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
                <Button 
                  onClick={() => handleGenerateReport('json')}
                  disabled={loading}
                  variant="outline"
                  className="flex-1"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export JSON
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Financial Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Budget Analysis */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart3 className="mr-2 h-5 w-5" />
              Budget Analysis
            </CardTitle>
            <CardDescription>
              How well are you sticking to your budget?
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Budget Utilization</span>
                <span className={`text-sm font-semibold ${
                  isOverBudget ? 'text-red-600' : 'text-blue-600'
                }`}>
                  {budgetUtilization.toFixed(1)}%
                </span>
              </div>
              <Progress 
                value={Math.min(budgetUtilization, 100)}
                className={`h-3 ${isOverBudget ? '[&>div]:bg-red-500' : '[&>div]:bg-blue-500'}`}
              />
              <div className="text-xs text-gray-500">
                ${summary.totalExpenses.toLocaleString()} of ${summary.totalBudget.toLocaleString()} budgeted
              </div>
            </div>

            <div className="pt-4 border-t">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-gray-500">Total Budget</div>
                  <div className="font-semibold">${summary.totalBudget.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-gray-500">Remaining</div>
                  <div className={`font-semibold ${
                    summary.totalBudget - summary.totalExpenses >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    ${(summary.totalBudget - summary.totalExpenses).toLocaleString()}
                  </div>
                </div>
              </div>

              {isOverBudget && (
                <div className="mt-3 p-3 bg-red-50 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5" />
                    <div>
                      <div className="text-sm font-medium text-red-800">Over Budget</div>
                      <div className="text-xs text-red-600">
                        You are {Math.abs(budgetVariance).toFixed(1)}% over your planned budget
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Profitability Analysis */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <DollarSign className="mr-2 h-5 w-5" />
              Profitability Analysis
            </CardTitle>
            <CardDescription>
              Project income and profit margins
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-sm text-green-600 font-medium">Total Income</div>
                <div className="text-lg font-bold text-green-700">
                  ${summary.totalIncome.toLocaleString()}
                </div>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <div className="text-sm text-red-600 font-medium">Total Expenses</div>
                <div className="text-lg font-bold text-red-700">
                  ${summary.totalExpenses.toLocaleString()}
                </div>
              </div>
            </div>

            <div className={`p-4 rounded-lg border-2 ${
              summary.netProfit >= 0 ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {summary.netProfit >= 0 ? (
                    <TrendingUp className="h-5 w-5 text-green-600" />
                  ) : (
                    <TrendingDown className="h-5 w-5 text-red-600" />
                  )}
                  <span className="font-medium">Net Profit</span>
                </div>
                <div className="text-right">
                  <div className={`text-xl font-bold ${
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

            <div className="pt-2 text-xs text-gray-500">
              <div className="flex justify-between">
                <span>Revenue Recognition Rate:</span>
                <span>
                  {summary.totalBudget > 0 ? ((summary.totalIncome / summary.totalBudget) * 100).toFixed(1) : 0}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Category Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <PieChart className="mr-2 h-5 w-5" />
            Category Breakdown
          </CardTitle>
          <CardDescription>
            Budget vs actual spending by category
          </CardDescription>
        </CardHeader>
        <CardContent>
          {Object.keys(summary.categories).length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <PieChart className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No budget categories defined</p>
              <p className="text-sm">Add budget categories to see breakdown</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(summary.categories).map(([category, data]) => {
                const variance = data.budgeted > 0 
                  ? ((data.actual - data.budgeted) / data.budgeted) * 100
                  : (data.actual > 0 ? 100 : 0)
                
                return (
                  <div key={category} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium">{category}</span>
                        <div className="text-sm text-gray-500">
                          {data.transactions} transaction{data.transactions !== 1 ? 's' : ''}
                        </div>
                      </div>
                      <div className="flex justify-between text-sm text-gray-600 mb-2">
                        <span>Budgeted: ${data.budgeted.toLocaleString()}</span>
                        <span>Actual: ${data.actual.toLocaleString()}</span>
                      </div>
                      <Progress 
                        value={data.budgeted > 0 ? Math.min((data.actual / data.budgeted) * 100, 100) : 0}
                        className={`h-2 ${data.actual > data.budgeted ? '[&>div]:bg-red-500' : '[&>div]:bg-blue-500'}`}
                      />
                    </div>
                    <div className="ml-4 text-right">
                      <Badge variant={variance > 10 ? 'destructive' : variance < -10 ? 'default' : 'secondary'}>
                        {variance > 0 ? '+' : ''}{variance.toFixed(1)}%
                      </Badge>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
