
'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ComposedChart } from 'recharts'
import { formatCurrency } from '@/lib/utils'
import { TrendingUp, TrendingDown, DollarSign, BarChart3, Calendar } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { useState, useEffect } from 'react'

interface YearlyData {
  year: string
  revenue: number
  expenses: number
  netProfit: number
  growthRate: number | null
}

interface YearlyRevenueExpensesChartProps {
  onRangeChange?: (startYear: number | null, endYear: number | null) => void
}

export function YearlyRevenueExpensesChart({ onRangeChange }: YearlyRevenueExpensesChartProps) {
  const [data, setData] = useState<YearlyData[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [earliestYear, setEarliestYear] = useState<number>(new Date().getFullYear())
  const [selectedStartYear, setSelectedStartYear] = useState<string>('all')
  const [selectedEndYear, setSelectedEndYear] = useState<string>('current')
  
  const currentYear = new Date().getFullYear()

  // Fetch data
  const fetchYearlySummary = async (startYear?: number, endYear?: number) => {
    try {
      setLoading(true)
      
      const params = new URLSearchParams()
      if (startYear) params.append('startYear', startYear.toString())
      if (endYear) params.append('endYear', endYear.toString())
      
      const response = await fetch(`/api/finance/yearly-summary?${params.toString()}`)
      
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setData(result.chartData || [])
          setSummary(result.summary || null)
          setEarliestYear(result.earliestYear || currentYear)
          console.log('[Y-o-Y Chart] Loaded yearly summary:', result.chartData?.length || 0, 'years')
        }
      }
    } catch (error) {
      console.error('[Y-o-Y Chart] Error fetching yearly summary:', error)
    } finally {
      setLoading(false)
    }
  }

  // Initial load - fetch all data
  useEffect(() => {
    fetchYearlySummary()
  }, [])

  // Handle range change
  const handleRangeChange = () => {
    const startYear = selectedStartYear === 'all' ? undefined : parseInt(selectedStartYear)
    const endYear = selectedEndYear === 'current' ? currentYear : parseInt(selectedEndYear)
    
    fetchYearlySummary(startYear, endYear)
    
    if (onRangeChange) {
      onRangeChange(startYear || null, endYear || null)
    }
  }

  // Generate year options
  const yearOptions = []
  for (let year = earliestYear; year <= currentYear; year++) {
    yearOptions.push(year)
  }

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          <p className="font-semibold text-gray-900 dark:text-white mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {formatCurrency(entry.value, 'SGD')}
            </p>
          ))}
          {data.growthRate !== null && data.growthRate !== undefined && (
            <p className="text-sm text-muted-foreground mt-2">
              Y-o-Y Growth: <span className={data.growthRate >= 0 ? 'text-green-600' : 'text-red-600'}>
                {data.growthRate >= 0 ? '+' : ''}{data.growthRate.toFixed(2)}%
              </span>
            </p>
          )}
        </div>
      )
    }
    return null
  }

  // Ensure data is an array
  const safeData = Array.isArray(data) ? data : []

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Year-over-Year Analysis</CardTitle>
          <CardDescription>Loading yearly data...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-96 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Date Range Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Year-over-Year Analysis
              </CardTitle>
              <CardDescription>
                Compare revenue and expenses across years
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">From:</span>
                <Select value={selectedStartYear} onValueChange={setSelectedStartYear}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Earliest</SelectItem>
                    {yearOptions.map(year => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">To:</span>
                <Select value={selectedEndYear} onValueChange={setSelectedEndYear}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map(year => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                    <SelectItem value="current">Current</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <Button onClick={handleRangeChange} size="sm">
                Apply
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Summary Statistics */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(summary.totalRevenue, 'SGD')}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {summary.yearCount} {summary.yearCount === 1 ? 'year' : 'years'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {formatCurrency(summary.totalExpenses, 'SGD')}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {summary.yearCount} {summary.yearCount === 1 ? 'year' : 'years'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
              <DollarSign className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${summary.totalNetProfit >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                {formatCurrency(summary.totalNetProfit, 'SGD')}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {summary.totalNetProfit >= 0 ? 'Profit' : 'Loss'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg. Yearly Revenue</CardTitle>
              <BarChart3 className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {formatCurrency(summary.averageYearlyRevenue, 'SGD')}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Per year average
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Bar Chart - Revenue vs Expenses by Year */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue vs Expenses by Year</CardTitle>
          <CardDescription>
            Year-over-year comparison of financial performance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={safeData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
              <XAxis 
                dataKey="year" 
                className="text-sm"
                tick={{ fill: 'currentColor' }}
              />
              <YAxis 
                className="text-sm"
                tick={{ fill: 'currentColor' }}
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar 
                dataKey="revenue" 
                name="Revenue" 
                fill="#10b981" 
                radius={[8, 8, 0, 0]}
              />
              <Bar 
                dataKey="expenses" 
                name="Expenses" 
                fill="#ef4444" 
                radius={[8, 8, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Line Chart - Net Profit Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Net Profit Trend</CardTitle>
          <CardDescription>
            Year-over-year profit/loss trend
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={safeData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
              <XAxis 
                dataKey="year" 
                className="text-sm"
                tick={{ fill: 'currentColor' }}
              />
              <YAxis 
                className="text-sm"
                tick={{ fill: 'currentColor' }}
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="netProfit" 
                name="Net Profit" 
                stroke="#3b82f6" 
                strokeWidth={3}
                dot={{ fill: '#3b82f6', r: 6 }}
                activeDot={{ r: 8 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Growth Rate Chart */}
      {safeData.some(d => d.growthRate !== null) && (
        <Card>
          <CardHeader>
            <CardTitle>Year-over-Year Growth Rate</CardTitle>
            <CardDescription>
              Revenue growth rate compared to previous year
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={safeData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                <XAxis 
                  dataKey="year" 
                  className="text-sm"
                  tick={{ fill: 'currentColor' }}
                />
                <YAxis 
                  className="text-sm"
                  tick={{ fill: 'currentColor' }}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip 
                  formatter={(value: any) => `${value}%`}
                  labelFormatter={(label) => `Year: ${label}`}
                />
                <Legend />
                <Bar 
                  dataKey="growthRate" 
                  name="Growth Rate (%)" 
                  fill="#8b5cf6"
                  radius={[8, 8, 0, 0]}
                />
                <Line 
                  type="monotone" 
                  dataKey="growthRate" 
                  stroke="#8b5cf6" 
                  strokeWidth={2}
                  dot={{ fill: '#8b5cf6', r: 4 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
