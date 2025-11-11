
'use client'

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  BarChart3,
  FileText,
  TrendingUp,
  DollarSign,
  Users,
  FolderOpen,
  Download,
  Calendar as CalendarIcon,
  Play,
  Clock,
  CheckCircle,
  AlertCircle,
  PieChart,
  LineChart,
  Building2,
  Target,
  FileBarChart,
  Settings,
  RefreshCw,
  Eye
} from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { EnhancedReportCard } from "@/components/reports/enhanced-report-card"
import { ReportPDFPreview } from "@/components/reports/report-pdf-preview"

interface ReportStats {
  totalRevenue: number
  monthlyGrowth: number
  activeProjects: number
  newProjects: number
  pendingInvoices: number
  pendingValue: number
  activeClients: number
  clientGrowth: number
}

interface ReportData {
  id: string
  name: string
  description: string
  category: string
  type: 'financial' | 'project' | 'client' | 'operations'
  icon: any
  color: string
  fields: string[]
  lastGenerated?: string
  status: 'ready' | 'generating' | 'error'
}

const reportTemplates: ReportData[] = [
  // Financial Reports
  {
    id: 'revenue-analysis',
    name: 'Revenue Analysis',
    description: 'Comprehensive revenue breakdown by period, client, and project',
    category: 'Financial',
    type: 'financial',
    icon: DollarSign,
    color: 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400',
    fields: ['dateRange', 'clientFilter', 'projectFilter', 'currency'],
    status: 'ready'
  },
  {
    id: 'invoice-aging',
    name: 'Invoice Aging Report',
    description: 'Track outstanding invoices and payment delays',
    category: 'Financial',
    type: 'financial',
    icon: FileText,
    color: 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400',
    fields: ['dateRange', 'statusFilter', 'clientFilter'],
    status: 'ready'
  },
  {
    id: 'profit-loss',
    name: 'Profit & Loss Statement',
    description: 'Detailed P&L with revenue, expenses, and net profit',
    category: 'Financial',
    type: 'financial',
    icon: PieChart,
    color: 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400',
    fields: ['dateRange', 'includeProjectCosts', 'groupBy'],
    status: 'ready'
  },
  {
    id: 'cash-flow',
    name: 'Cash Flow Analysis',
    description: 'Track cash inflows and outflows over time',
    category: 'Financial',
    type: 'financial',
    icon: TrendingUp,
    color: 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400',
    fields: ['dateRange', 'includeProjections', 'groupBy'],
    status: 'ready'
  },

  // Project Reports
  {
    id: 'project-progress',
    name: 'Project Progress Summary',
    description: 'Overview of all project statuses, timelines, and milestones',
    category: 'Project',
    type: 'project',
    icon: Target,
    color: 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400',
    fields: ['projectStatus', 'managerFilter', 'clientFilter', 'projectType'],
    status: 'ready'
  },
  {
    id: 'budget-analysis',
    name: 'Budget vs Actual Analysis',
    description: 'Compare project budgets against actual costs and overruns',
    category: 'Project',
    type: 'project',
    icon: BarChart3,
    color: 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400',
    fields: ['dateRange', 'projectStatus', 'includeCompleted', 'threshold'],
    status: 'ready'
  },
  {
    id: 'project-timeline',
    name: 'Project Timeline Report',
    description: 'Timeline analysis with delays, milestones, and dependencies',
    category: 'Project',
    type: 'project',
    icon: Clock,
    color: 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400',
    fields: ['dateRange', 'includeDelayed', 'projectType', 'criticalPath'],
    status: 'ready'
  },
  {
    id: 'resource-utilization',
    name: 'Resource Utilization',
    description: 'Team member allocation and productivity across projects',
    category: 'Project',
    type: 'project',
    icon: Users,
    color: 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400',
    fields: ['dateRange', 'teamMember', 'projectFilter', 'utilizationMetric'],
    status: 'ready'
  },

  // Client Reports
  {
    id: 'client-revenue',
    name: 'Client Revenue Analysis',
    description: 'Revenue breakdown by client with trends and projections',
    category: 'Client',
    type: 'client',
    icon: Building2,
    color: 'bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-400',
    fields: ['dateRange', 'topN', 'includeInactive', 'sortBy'],
    status: 'ready'
  },
  {
    id: 'client-activity',
    name: 'Client Activity Summary',
    description: 'Client engagement, project count, and interaction history',
    category: 'Client',
    type: 'client',
    icon: Users,
    color: 'bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-400',
    fields: ['dateRange', 'activityType', 'clientType', 'engagementLevel'],
    status: 'ready'
  },
  {
    id: 'client-satisfaction',
    name: 'Client Satisfaction Report',
    description: 'Client feedback, ratings, and satisfaction metrics',
    category: 'Client',
    type: 'client',
    icon: TrendingUp,
    color: 'bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-400',
    fields: ['dateRange', 'feedbackType', 'projectFilter', 'ratingThreshold'],
    status: 'ready'
  },

  // Operations Reports
  {
    id: 'quotation-conversion',
    name: 'Quotation Conversion Report',
    description: 'Track quotation-to-project conversion rates and pipeline',
    category: 'Operations',
    type: 'operations',
    icon: FileBarChart,
    color: 'bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-400',
    fields: ['dateRange', 'conversionStatus', 'salesPerson', 'clientType'],
    status: 'ready'
  },
  {
    id: 'vendor-performance',
    name: 'Vendor Performance Report',
    description: 'Vendor delivery times, quality metrics, and cost analysis',
    category: 'Operations',
    type: 'operations',
    icon: Building2,
    color: 'bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-400',
    fields: ['dateRange', 'vendorFilter', 'performanceMetric', 'costThreshold'],
    status: 'ready'
  }
]

export function ReportsClient() {
  const [stats, setStats] = useState<ReportStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedReport, setSelectedReport] = useState<ReportData | null>(null)
  const [reportFilters, setReportFilters] = useState<Record<string, any>>({})
  const [generatingReports, setGeneratingReports] = useState<Set<string>>(new Set())
  const [dateRange, setDateRange] = useState<{from?: Date, to?: Date}>({})
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedFormat, setSelectedFormat] = useState<'excel' | 'pdf'>('excel')
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [previewReport, setPreviewReport] = useState<ReportData | null>(null)

  const fetchStats = async (showToast = false) => {
    try {
      if (showToast) {
        setRefreshing(true)
      }
      const response = await fetch('/api/reports/stats')
      if (response.ok) {
        const data = await response.json()
        setStats(data)
        if (showToast) {
          toast.success('Dashboard statistics refreshed successfully')
        }
      } else {
        throw new Error('Failed to fetch stats')
      }
    } catch (error) {
      console.error('Error fetching stats:', error)
      toast.error('Failed to load dashboard statistics')
    } finally {
      setLoading(false)
      if (showToast) {
        setRefreshing(false)
      }
    }
  }

  useEffect(() => {
    fetchStats()
  }, [])

  const handleGenerateReport = async (reportId: string, customFilters?: Record<string, any>, reportFormat?: 'excel' | 'pdf') => {
    setGeneratingReports(prev => new Set(prev).add(reportId))

    try {
      const filters = customFilters || reportFilters
      const outputFormat = reportFormat || selectedFormat
      const response = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reportId,
          format: outputFormat,
          filters: {
            ...filters,
            dateRange: dateRange.from && dateRange.to ? {
              from: dateRange.from.toISOString(),
              to: dateRange.to.toISOString()
            } : undefined
          }
        }),
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.style.display = 'none'
        a.href = url
        
        const reportName = reportTemplates.find(r => r.id === reportId)?.name || 'Report'
        const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm')
        const fileExtension = outputFormat === 'pdf' ? 'pdf' : 'xlsx'
        a.download = `${reportName.replace(/\s+/g, '_')}_${timestamp}.${fileExtension}`
        
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)

        toast.success(`${reportName} generated successfully!`)
        setIsDialogOpen(false)
        setSelectedReport(null)
        setReportFilters({})
      } else {
        throw new Error('Failed to generate report')
      }
    } catch (error) {
      console.error('Error generating report:', error)
      toast.error('Failed to generate report. Please try again.')
    } finally {
      setGeneratingReports(prev => {
        const newSet = new Set(prev)
        newSet.delete(reportId)
        return newSet
      })
    }
  }

  const handleQuickGenerate = (reportId: string, reportFormat: 'excel' | 'pdf' = 'excel') => {
    const defaultFilters = {
      dateRange: {
        from: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1),
        to: new Date()
      }
    }
    handleGenerateReport(reportId, defaultFilters, reportFormat)
  }

  const openReportDialog = (report: ReportData) => {
    setSelectedReport(report)
    setReportFilters({})
    setDateRange({
      from: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1),
      to: new Date()
    })
    setSelectedFormat('excel')
    setIsDialogOpen(true)
  }

  const handlePreview = (report: ReportData) => {
    setPreviewReport(report)
    setDateRange({
      from: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1),
      to: new Date()
    })
    setIsPreviewOpen(true)
  }

  const renderFilterField = (field: string) => {
    switch (field) {
      case 'dateRange':
        return (
          <div className="space-y-2">
            <Label>Date Range</Label>
            <div className="grid grid-cols-2 gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("justify-start text-left font-normal", !dateRange.from && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange.from ? format(dateRange.from, "PPP") : "From date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateRange.from}
                    onSelect={(date) => setDateRange(prev => ({ ...prev, from: date }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("justify-start text-left font-normal", !dateRange.to && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange.to ? format(dateRange.to, "PPP") : "To date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateRange.to}
                    onSelect={(date) => setDateRange(prev => ({ ...prev, to: date }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        )
      case 'clientFilter':
        return (
          <div className="space-y-2">
            <Label>Client Filter</Label>
            <Select onValueChange={(value) => setReportFilters(prev => ({ ...prev, clientFilter: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="All clients" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clients</SelectItem>
                <SelectItem value="active">Active Clients Only</SelectItem>
                <SelectItem value="enterprise">Enterprise Clients</SelectItem>
                <SelectItem value="government">Government Clients</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )
      case 'projectFilter':
        return (
          <div className="space-y-2">
            <Label>Project Filter</Label>
            <Select onValueChange={(value) => setReportFilters(prev => ({ ...prev, projectFilter: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="All projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                <SelectItem value="active">Active Projects</SelectItem>
                <SelectItem value="completed">Completed Projects</SelectItem>
                <SelectItem value="maintenance">Maintenance Projects</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )
      case 'statusFilter':
        return (
          <div className="space-y-2">
            <Label>Status Filter</Label>
            <Select onValueChange={(value) => setReportFilters(prev => ({ ...prev, statusFilter: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )
      case 'topN':
        return (
          <div className="space-y-2">
            <Label>Top N Results</Label>
            <Select onValueChange={(value) => setReportFilters(prev => ({ ...prev, topN: parseInt(value) }))}>
              <SelectTrigger>
                <SelectValue placeholder="Top 10" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">Top 5</SelectItem>
                <SelectItem value="10">Top 10</SelectItem>
                <SelectItem value="20">Top 20</SelectItem>
                <SelectItem value="50">Top 50</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )
      default:
        return (
          <div className="space-y-2">
            <Label className="capitalize">{field.replace(/([A-Z])/g, ' $1').trim()}</Label>
            <Input
              placeholder={`Enter ${field}`}
              onChange={(e) => setReportFilters(prev => ({ ...prev, [field]: e.target.value }))}
            />
          </div>
        )
    }
  }

  const groupedReports = reportTemplates.reduce((acc, report) => {
    if (!acc[report.category]) {
      acc[report.category] = []
    }
    acc[report.category].push(report)
    return acc
  }, {} as Record<string, ReportData[]>)

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-64 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="p-6 space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Reports & Analytics</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2">
            Generate comprehensive business intelligence reports
          </p>
        </div>
        <Button 
          onClick={() => fetchStats(true)} 
          variant="outline"
          disabled={refreshing}
        >
          <RefreshCw className={cn("mr-2 h-4 w-4", refreshing && "animate-spin")} />
          {refreshing ? 'Refreshing...' : 'Refresh Data'}
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats?.totalRevenue?.toLocaleString() || '0'}</div>
            <p className="text-xs text-muted-foreground">
              <span className={cn("font-medium", (stats?.monthlyGrowth || 0) >= 0 ? "text-green-600" : "text-red-600")}>
                {(stats?.monthlyGrowth || 0) >= 0 ? '+' : ''}{(stats?.monthlyGrowth || 0).toFixed(1)}%
              </span> from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.activeProjects || 0}</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-blue-600 font-medium">+{stats?.newProjects || 0}</span> new this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Invoices</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.pendingInvoices || 0}</div>
            <p className="text-xs text-muted-foreground">
              Total value: ${stats?.pendingValue?.toLocaleString() || '0'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Clients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.activeClients || 0}</div>
            <p className="text-xs text-muted-foreground">
              <span className={cn("font-medium", (stats?.clientGrowth || 0) >= 0 ? "text-green-600" : "text-red-600")}>
                {(stats?.clientGrowth || 0) >= 0 ? '+' : ''}{stats?.clientGrowth || 0}
              </span> this quarter
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Reports by Category */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="all">All Reports</TabsTrigger>
          <TabsTrigger value="financial">Financial</TabsTrigger>
          <TabsTrigger value="project">Project</TabsTrigger>
          <TabsTrigger value="client">Client</TabsTrigger>
          <TabsTrigger value="operations">Operations</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-6">
          {Object.entries(groupedReports).map(([category, reports]) => (
            <Card key={category}>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <span>{category} Reports</span>
                  <Badge variant="outline">{reports.length}</Badge>
                </CardTitle>
                <CardDescription>
                  {category === 'Financial' && 'Revenue, expenses, and profitability analysis'}
                  {category === 'Project' && 'Project performance and status overview'}
                  {category === 'Client' && 'Client engagement and business analysis'}
                  {category === 'Operations' && 'Operational efficiency and performance metrics'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {reports.map((report) => (
                    <EnhancedReportCard
                      key={report.id}
                      report={report}
                      isGenerating={generatingReports.has(report.id)}
                      onQuickGenerate={handleQuickGenerate}
                      onConfigure={openReportDialog}
                      onPreview={handlePreview}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {['financial', 'project', 'client', 'operations'].map((type) => (
          <TabsContent key={type} value={type} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {reportTemplates.filter(r => r.type === type).map((report) => (
                <EnhancedReportCard
                  key={report.id}
                  report={report}
                  isGenerating={generatingReports.has(report.id)}
                  onQuickGenerate={handleQuickGenerate}
                  onConfigure={openReportDialog}
                  onPreview={handlePreview}
                />
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* Report Configuration Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              {selectedReport && <selectedReport.icon className="h-5 w-5" />}
              <span>Configure {selectedReport?.name}</span>
            </DialogTitle>
            <DialogDescription>
              {selectedReport?.description}
            </DialogDescription>
          </DialogHeader>
          
          {selectedReport && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedReport.fields.map((field) => renderFilterField(field))}
                
                {/* Format Selection */}
                <div className="space-y-2 md:col-span-2">
                  <Label>Export Format</Label>
                  <Select value={selectedFormat} onValueChange={(value: 'excel' | 'pdf') => setSelectedFormat(value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select format" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="excel">Excel (.xlsx)</SelectItem>
                      <SelectItem value="pdf">PDF (.pdf)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="flex items-center justify-end space-x-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => handleGenerateReport(selectedReport.id)}
                  disabled={generatingReports.has(selectedReport.id)}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {generatingReports.has(selectedReport.id) ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      Generate {selectedFormat.toUpperCase()}
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* PDF Preview Dialog */}
      {previewReport && (
        <ReportPDFPreview
          isOpen={isPreviewOpen}
          onClose={() => {
            setIsPreviewOpen(false)
            setPreviewReport(null)
          }}
          reportId={previewReport.id}
          reportName={previewReport.name}
          filters={reportFilters}
          dateRange={dateRange}
        />
      )}
    </motion.div>
  )
}
