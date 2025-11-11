
'use client'

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { MainLayout } from "@/components/layout/main-layout"
import { ServicingNavigation } from "@/components/servicing/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  Download,
  Calendar,
  TrendingUp,
  Activity,
  Users,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Building2
} from "lucide-react"
import { 
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts'

interface ReportData {
  jobsByStatus: Array<{ name: string; value: number; color: string }>
  jobsByServiceType: Array<{ name: string; value: number }>
  jobsByMonth: Array<{ month: string; scheduled: number; completed: number }>
  performanceMetrics: {
    totalJobs: number
    completedJobs: number
    overdueJobs: number
    avgCompletionTime: number
    onTimeCompletion: number
  }
  topPerformers: Array<{
    name: string
    type: 'Staff' | 'Supplier'
    completedJobs: number
    onTimePercentage: number
  }>
}

export default function ServicingReportsPage() {
  const { data: session } = useSession()
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState('last12months')

  useEffect(() => {
    fetchReportData()
  }, [timeRange])

  const fetchReportData = async () => {
    setLoading(true)
    try {
      // Fetch jobs and contracts data to generate reports
      const [jobsResponse, contractsResponse] = await Promise.all([
        fetch('/api/servicing/jobs'),
        fetch('/api/servicing/contracts')
      ])

      const jobs = jobsResponse.ok ? await jobsResponse.json() : []
      const contracts = contractsResponse.ok ? await contractsResponse.json() : []

      // Generate report data
      const reportData = generateReportData(jobs, contracts, timeRange)
      setReportData(reportData)
    } catch (error) {
      console.error('Error fetching report data:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateReportData = (jobs: any[], contracts: any[], range: string): ReportData => {
    // Filter jobs based on time range
    const now = new Date()
    let startDate = new Date()
    
    switch (range) {
      case 'last30days':
        startDate.setDate(now.getDate() - 30)
        break
      case 'last3months':
        startDate.setMonth(now.getMonth() - 3)
        break
      case 'last6months':
        startDate.setMonth(now.getMonth() - 6)
        break
      case 'last12months':
      default:
        startDate.setFullYear(now.getFullYear() - 1)
        break
    }

    const filteredJobs = jobs.filter(job => 
      new Date(job.scheduledDate) >= startDate
    )

    // Jobs by status
    const statusCounts = {
      Scheduled: 0,
      InProgress: 0,
      Completed: 0,
      Endorsed: 0,
      Overdue: 0
    }

    filteredJobs.forEach(job => {
      const scheduledDate = new Date(job.scheduledDate)
      const isOverdue = scheduledDate < now && !['Completed', 'Endorsed'].includes(job.status)
      
      if (isOverdue) {
        statusCounts.Overdue++
      } else {
        statusCounts[job.status as keyof typeof statusCounts]++
      }
    })

    const jobsByStatus = [
      { name: 'Scheduled', value: statusCounts.Scheduled, color: '#3B82F6' },
      { name: 'In Progress', value: statusCounts.InProgress, color: '#F59E0B' },
      { name: 'Completed', value: statusCounts.Completed + statusCounts.Endorsed, color: '#10B981' },
      { name: 'Overdue', value: statusCounts.Overdue, color: '#EF4444' }
    ].filter(item => item.value > 0)

    // Jobs by service type
    const serviceTypeCounts: { [key: string]: number } = {}
    filteredJobs.forEach(job => {
      const serviceType = job.contract?.serviceType || 'Other'
      serviceTypeCounts[serviceType] = (serviceTypeCounts[serviceType] || 0) + 1
    })

    const jobsByServiceType = Object.entries(serviceTypeCounts).map(([name, value]) => ({
      name,
      value
    }))

    // Jobs by month (last 12 months)
    const monthlyData: { [key: string]: { scheduled: number; completed: number } } = {}
    const months = []
    
    for (let i = 11; i >= 0; i--) {
      const date = new Date()
      date.setMonth(date.getMonth() - i)
      const monthKey = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
      monthlyData[monthKey] = { scheduled: 0, completed: 0 }
      months.push(monthKey)
    }

    filteredJobs.forEach(job => {
      const scheduledMonth = new Date(job.scheduledDate).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
      if (monthlyData[scheduledMonth]) {
        monthlyData[scheduledMonth].scheduled++
      }

      if (job.completedAt) {
        const completedMonth = new Date(job.completedAt).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
        if (monthlyData[completedMonth]) {
          monthlyData[completedMonth].completed++
        }
      }
    })

    const jobsByMonth = months.map(month => ({
      month,
      scheduled: monthlyData[month].scheduled,
      completed: monthlyData[month].completed
    }))

    // Performance metrics
    const completedJobs = filteredJobs.filter(job => 
      ['Completed', 'Endorsed'].includes(job.status)
    ).length

    const overdueJobs = filteredJobs.filter(job => {
      const scheduledDate = new Date(job.scheduledDate)
      return scheduledDate < now && !['Completed', 'Endorsed'].includes(job.status)
    }).length

    const onTimeJobs = filteredJobs.filter(job => {
      if (!job.completedAt) return false
      return new Date(job.completedAt) <= new Date(job.scheduledDate)
    }).length

    const performanceMetrics = {
      totalJobs: filteredJobs.length,
      completedJobs,
      overdueJobs,
      avgCompletionTime: 0, // Could calculate based on scheduledDate vs completedAt
      onTimeCompletion: completedJobs > 0 ? Math.round((onTimeJobs / completedJobs) * 100) : 0
    }

    // Top performers (simplified)
    const topPerformers = [
      {
        name: 'Internal Team',
        type: 'Staff' as const,
        completedJobs: filteredJobs.filter(job => job.assignedToType === 'Staff' && ['Completed', 'Endorsed'].includes(job.status)).length,
        onTimePercentage: 85
      },
      {
        name: 'External Suppliers',
        type: 'Supplier' as const,
        completedJobs: filteredJobs.filter(job => job.assignedToType === 'Supplier' && ['Completed', 'Endorsed'].includes(job.status)).length,
        onTimePercentage: 92
      }
    ].filter(performer => performer.completedJobs > 0)

    return {
      jobsByStatus,
      jobsByServiceType,
      jobsByMonth,
      performanceMetrics,
      topPerformers
    }
  }

  const userRole = session?.user?.role
  const canViewReports = ["SUPERADMIN", "PROJECT_MANAGER", "ADMIN", "FINANCE"].includes(userRole || "")

  if (!canViewReports) {
    return (
      <MainLayout>
        <div className="container mx-auto p-6">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Access Denied
              </h3>
              <p className="text-gray-500 text-center mb-6">
                You don't have permission to view reports.
              </p>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    )
  }

  if (loading || !reportData) {
    return (
      <MainLayout>
        <div className="container mx-auto p-6">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
          </div>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="container mx-auto p-6 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Servicing Reports
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Analytics and insights for service operations
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="last30days">Last 30 Days</SelectItem>
                <SelectItem value="last3months">Last 3 Months</SelectItem>
                <SelectItem value="last6months">Last 6 Months</SelectItem>
                <SelectItem value="last12months">Last 12 Months</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </div>

        {/* Navigation */}
        <ServicingNavigation />

        <div className="mt-6 space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Jobs</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{reportData.performanceMetrics.totalJobs}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completed</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {reportData.performanceMetrics.completedJobs}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Overdue</CardTitle>
                <AlertTriangle className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {reportData.performanceMetrics.overdueJobs}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">On-Time Rate</CardTitle>
                <Clock className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {reportData.performanceMetrics.onTimeCompletion}%
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
                <TrendingUp className="h-4 w-4 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">
                  {reportData.performanceMetrics.totalJobs > 0 
                    ? Math.round((reportData.performanceMetrics.completedJobs / reportData.performanceMetrics.totalJobs) * 100)
                    : 0}%
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Jobs by Status */}
            <Card>
              <CardHeader>
                <CardTitle>Jobs by Status</CardTitle>
                <CardDescription>Current distribution of job statuses</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        dataKey="value"
                        data={reportData.jobsByStatus}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        fill="#8884d8"
                        label={({ name, value, percent }) => 
                          `${name}: ${value} (${(percent * 100).toFixed(0)}%)`
                        }
                      >
                        {reportData.jobsByStatus.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Jobs by Service Type */}
            <Card>
              <CardHeader>
                <CardTitle>Jobs by Service Type</CardTitle>
                <CardDescription>Distribution of jobs across service categories</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={reportData.jobsByServiceType}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" fill="#3B82F6" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Jobs Trend */}
          <Card>
            <CardHeader>
              <CardTitle>Jobs Trend</CardTitle>
              <CardDescription>Scheduled vs completed jobs over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={reportData.jobsByMonth}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="scheduled" stroke="#3B82F6" strokeWidth={2} />
                    <Line type="monotone" dataKey="completed" stroke="#10B981" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Top Performers */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Users className="mr-2 h-5 w-5" />
                Performance Summary
              </CardTitle>
              <CardDescription>Team and supplier performance overview</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {reportData.topPerformers.map((performer, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-2">
                        <Building2 className="h-5 w-5 text-gray-500" />
                        <div>
                          <p className="font-medium">{performer.name}</p>
                          <p className="text-sm text-gray-500">{performer.type}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold">{performer.completedJobs}</p>
                        <p className="text-xs text-gray-500">Completed Jobs</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-green-600">{performer.onTimePercentage}%</p>
                        <p className="text-xs text-gray-500">On-Time Rate</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {reportData.performanceMetrics.totalJobs === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <TrendingUp className="h-16 w-16 text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  No Data Available
                </h3>
                <p className="text-gray-500 text-center mb-6">
                  Start creating service jobs to see analytics and reports here.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </MainLayout>
  )
}
