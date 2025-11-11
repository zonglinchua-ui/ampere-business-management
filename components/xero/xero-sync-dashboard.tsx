
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from '@/components/ui/sheet'
import { 
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Activity,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Download,
  Upload,
  Eye,
  FileText,
  Users,
  CreditCard,
  Building2,
  Loader2,
  Filter,
  Search,
  Calendar,
  BarChart3,
  TrendingUp,
  AlertCircle,
  PlayCircle,
  Trash2,
  X
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { SyncProgressBar } from './sync-progress-bar'
import { SyncSummaryReport } from './sync-summary-report'

interface SyncSummary {
  total: number
  success: number
  error: number
  warning: number
  inProgress: number
  pendingConflicts: number
  skipped: number
  lastSync: {
    timestamp: string
    status: string
  } | null
  successRate: string
}

interface EntityBreakdown {
  [key: string]: {
    success: number
    error: number
    warning: number
    total: number
  }
}

interface SyncLog {
  id: string
  timestamp: string
  userId: string
  direction: string
  entity: string
  status: string
  recordsProcessed: number
  recordsSucceeded: number
  recordsFailed: number
  message: string
  details?: string
  errorMessage?: string
  duration?: number
  User: {
    id: string
    name: string | null
    email: string | null
  }
  XeroSyncConflict: Conflict[]
}

interface Conflict {
  id: string
  syncLogId: string
  entity: string
  entityId: string
  entityName: string
  conflictType: string
  localData: string
  xeroData: string
  status: string
  resolution?: string
  resolvedById?: string
  resolvedAt?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

export function XeroSyncDashboard() {
  const { data: session } = useSession() || {}
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [summary, setSummary] = useState<SyncSummary | null>(null)
  const [entityBreakdown, setEntityBreakdown] = useState<EntityBreakdown>({})
  const [logs, setLogs] = useState<SyncLog[]>([])
  const [conflicts, setConflicts] = useState<Conflict[]>([])
  const [selectedLog, setSelectedLog] = useState<SyncLog | null>(null)
  const [selectedConflict, setSelectedConflict] = useState<Conflict | null>(null)
  
  // Filters
  const [viewMode, setViewMode] = useState<'all' | 'conflicts' | 'errors'>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [entityFilter, setEntityFilter] = useState<string>('all')
  const [directionFilter, setDirectionFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  
  // Filter panel state
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [limit] = useState(50)

  // Sync Settings
  const [syncSettings, setSyncSettings] = useState({ includeGeneralContacts: false })
  const [savingSettings, setSavingSettings] = useState(false)

  // Sync Summary Report State
  const [showSummaryReport, setShowSummaryReport] = useState(false)
  const [summaryReportData, setSummaryReportData] = useState<any>(null)

  const userRole = session?.user?.role
  
  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== searchQuery) {
        setSearchQuery(searchInput)
        setCurrentPage(1)
      }
    }, 500)
    
    return () => clearTimeout(timer)
  }, [searchInput])
  
  // Count active filters
  const activeFilterCount = [
    statusFilter !== 'all',
    entityFilter !== 'all',
    directionFilter !== 'all',
    dateFrom,
    dateTo,
    searchQuery
  ].filter(Boolean).length

  // Fetch sync settings
  const fetchSyncSettings = async () => {
    try {
      const response = await fetch('/api/xero/sync-settings')
      if (response.ok) {
        const data = await response.json()
        setSyncSettings(data.settings)
      }
    } catch (error) {
      console.error('Error loading sync settings:', error)
    }
  }

  // Save sync settings
  const saveSyncSettings = async (newSettings: { includeGeneralContacts: boolean }) => {
    try {
      setSavingSettings(true)
      const response = await fetch('/api/xero/sync-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings)
      })

      if (response.ok) {
        const data = await response.json()
        setSyncSettings(data.settings)
        toast.success('Sync settings updated', {
          description: 'Contact sync preferences have been saved successfully.'
        })
      } else {
        throw new Error('Failed to save settings')
      }
    } catch (error: any) {
      console.error('Error saving sync settings:', error)
      toast.error('Failed to save settings', {
        description: error.message
      })
    } finally {
      setSavingSettings(false)
    }
  }

  // OPTIMIZED: Fetch summary first, then details
  const fetchDashboardData = async (summaryOnly = false) => {
    try {
      setRefreshing(true)
      
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: limit.toString(),
        view: viewMode,
        summaryOnly: summaryOnly.toString(),
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(entityFilter !== 'all' && { entity: entityFilter }),
        ...(directionFilter !== 'all' && { direction: directionFilter }),
        ...(searchQuery && { search: searchQuery }),
        ...(dateFrom && { dateFrom }),
        ...(dateTo && { dateTo })
      })

      const response = await fetch(`/api/xero/sync-dashboard?${params}`, {
        headers: {
          'Cache-Control': 'no-cache'
        }
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch dashboard data')
      }

      const data = await response.json()
      
      // Log performance metrics
      const cacheStatus = response.headers.get('X-Cache')
      const responseTime = response.headers.get('X-Response-Time')
      console.log(`[Sync Dashboard] Loaded ${summaryOnly ? 'summary' : 'full data'} - ${cacheStatus || 'MISS'} - ${responseTime || '0ms'}`)
      
      setSummary(data.summary)
      setEntityBreakdown(data.entityBreakdown || {})
      
      // Only update logs and conflicts if we got them (not summary-only)
      if (!data.summaryOnly) {
        setLogs(data.logs || [])
        setConflicts(data.conflicts || [])
        setTotalPages(data.pagination.totalPages)
      }

    } catch (error: any) {
      console.error('Error fetching dashboard data:', error)
      toast.error('Failed to load sync dashboard', {
        description: error.message
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // OPTIMIZED: Load summary first on mount, then fetch details
  useEffect(() => {
    const loadData = async () => {
      // Load sync settings first
      if (['SUPERADMIN', 'FINANCE'].includes(userRole || '')) {
        await fetchSyncSettings()
      }
      
      // First, fetch summary only (fast)
      await fetchDashboardData(true)
      
      // Then fetch full details after a brief delay (allows UI to render)
      setTimeout(() => {
        fetchDashboardData(false)
      }, 100)
    }
    
    loadData()
  }, [currentPage, viewMode, statusFilter, entityFilter, directionFilter, dateFrom, dateTo, userRole])

  const handleSearch = () => {
    setCurrentPage(1)
    fetchDashboardData()
  }
  
  const handleApplyFilters = () => {
    setCurrentPage(1)
    setIsFilterOpen(false)
    fetchDashboardData()
  }
  
  const handleClearFilters = () => {
    setStatusFilter('all')
    setEntityFilter('all')
    setDirectionFilter('all')
    setDateFrom('')
    setDateTo('')
    setSearchQuery('')
    setSearchInput('')
    setCurrentPage(1)
  }
  
  const removeFilter = (filterType: string) => {
    switch (filterType) {
      case 'status':
        setStatusFilter('all')
        break
      case 'entity':
        setEntityFilter('all')
        break
      case 'direction':
        setDirectionFilter('all')
        break
      case 'dateFrom':
        setDateFrom('')
        break
      case 'dateTo':
        setDateTo('')
        break
      case 'search':
        setSearchQuery('')
        setSearchInput('')
        break
    }
    setCurrentPage(1)
  }

  const handleManualSync = async (entity: string, direction: string) => {
    try {
      toast.info(`Initiating ${entity} sync...`)
      setShowSummaryReport(false)
      
      const response = await fetch('/api/xero/sync-dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'manual-sync',
          entity,
          direction
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error)
      }

      const result = await response.json()
      
      // Show summary report if result contains sync details
      if (result.syncResult) {
        setSummaryReportData({
          entities: [{
            entity: entity,
            synced: result.syncResult.created || 0,
            updated: result.syncResult.updated || 0,
            skipped: result.syncResult.skipped || 0,
            failed: result.syncResult.errors || 0,
            skippedReasons: result.syncResult.skippedReasons || []
          }],
          timestamp: new Date().toISOString(),
          duration: result.syncResult.duration || 0
        })
        setShowSummaryReport(true)
      }
      
      toast.success('Sync completed successfully', {
        description: result.message || 'Check the summary report for details.'
      })
      
      // Refresh dashboard after a short delay
      setTimeout(() => fetchDashboardData(), 2000)

    } catch (error: any) {
      toast.error('Failed to initiate manual sync', {
        description: error.message
      })
    }
  }

  const handleResolveConflict = async (conflictId: string, resolution: 'use_local' | 'use_xero' | 'skip') => {
    try {
      const response = await fetch(`/api/xero/sync/conflicts/${conflictId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolution })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error)
      }

      toast.success('Conflict resolved successfully')
      fetchDashboardData()
      setSelectedConflict(null)

    } catch (error: any) {
      toast.error('Failed to resolve conflict', {
        description: error.message
      })
    }
  }

  const handleClearOldLogs = async () => {
    if (!confirm('Are you sure you want to delete logs older than 90 days? This action cannot be undone.')) {
      return
    }

    try {
      const response = await fetch('/api/xero/sync-dashboard?days=90', {
        method: 'DELETE'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error)
      }

      const result = await response.json()
      toast.success('Old logs cleared', {
        description: result.message
      })
      
      fetchDashboardData()

    } catch (error: any) {
      toast.error('Failed to clear old logs', {
        description: error.message
      })
    }
  }

  const handleExportLogs = async () => {
    try {
      toast.info('Preparing export...')
      
      // Create CSV content
      const csvHeaders = ['Timestamp', 'Entity', 'Direction', 'Status', 'Records Processed', 'Succeeded', 'Failed', 'User', 'Message']
      const csvRows = logs.map(log => [
        format(new Date(log.timestamp), 'yyyy-MM-dd HH:mm:ss'),
        log.entity,
        log.direction,
        log.status,
        log.recordsProcessed,
        log.recordsSucceeded,
        log.recordsFailed,
        log.User.name || log.User.email || 'Unknown',
        log.message.replace(/,/g, ';')
      ])
      
      const csv = [csvHeaders, ...csvRows].map(row => row.join(',')).join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `xero-sync-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`
      a.click()
      
      toast.success('Export completed')

    } catch (error: any) {
      toast.error('Failed to export logs', {
        description: error.message
      })
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'ERROR':
        return <XCircle className="h-4 w-4 text-red-600" />
      case 'WARNING':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />
      case 'IN_PROGRESS':
        return <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
      default:
        return <Clock className="h-4 w-4 text-gray-600" />
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      SUCCESS: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      ERROR: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      WARNING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      IN_PROGRESS: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    }
    
    return (
      <Badge variant="outline" className={variants[status] || 'bg-gray-100 text-gray-800'}>
        {status}
      </Badge>
    )
  }

  const getEntityIcon = (entity: string) => {
    switch (entity) {
      case 'CONTACTS':
      case 'CLIENTS':
        return <Users className="h-4 w-4" />
      case 'SUPPLIERS':
        return <Building2 className="h-4 w-4" />
      case 'INVOICES':
        return <FileText className="h-4 w-4" />
      case 'PAYMENTS':
        return <CreditCard className="h-4 w-4" />
      default:
        return <Activity className="h-4 w-4" />
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Syncs</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              Success rate: {summary?.successRate || 0}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Successful</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{summary?.success || 0}</div>
            <p className="text-xs text-muted-foreground">
              Completed without issues
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Errors</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{summary?.error || 0}</div>
            <p className="text-xs text-muted-foreground">
              Failed sync operations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Conflicts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{summary?.pendingConflicts || 0}</div>
            <p className="text-xs text-muted-foreground">
              Require manual resolution
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Last Sync Info */}
      {summary?.lastSync && (
        <Alert>
          <Clock className="h-4 w-4" />
          <AlertDescription>
            Last sync: {format(new Date(summary.lastSync.timestamp), 'PPpp')} - Status: {summary.lastSync.status}
          </AlertDescription>
        </Alert>
      )}

      {/* Real-Time Sync Progress Bar */}
      <SyncProgressBar autoHide={true} />

      {/* Sync Summary Report */}
      {summaryReportData && (
        <SyncSummaryReport
          summaryData={summaryReportData.entities}
          timestamp={new Date(summaryReportData.timestamp)}
          duration={summaryReportData.duration}
          onExport={() => {
            // Export logic handled by component
          }}
        />
      )}

      {/* Main Dashboard */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)} className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList className="grid w-fit grid-cols-4">
            <TabsTrigger value="all">Overview</TabsTrigger>
            <TabsTrigger value="all">All Logs</TabsTrigger>
            <TabsTrigger value="conflicts">
              Conflicts
              {summary?.pendingConflicts ? (
                <Badge variant="destructive" className="ml-2 px-1.5 py-0 text-xs">
                  {summary.pendingConflicts}
                </Badge>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="errors">Errors Only</TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchDashboardData()}
              disabled={refreshing}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportLogs}
            >
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            {userRole === 'SUPERADMIN' && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearOldLogs}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Clear Old
              </Button>
            )}
          </div>
        </div>

        {/* Search Bar and Filter Button */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex-1 min-w-[200px] max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search entity name, reference, or error message..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          
          <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" className="relative">
                <Filter className="mr-2 h-4 w-4" />
                Filters
                {activeFilterCount > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="ml-2 px-1.5 py-0 text-xs min-w-[20px] h-5 flex items-center justify-center"
                  >
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Filter Sync Logs</SheetTitle>
                <SheetDescription>
                  Apply filters to narrow down your sync log results
                </SheetDescription>
              </SheetHeader>
              
              <div className="space-y-6 py-6">
                <div className="space-y-2">
                  <Label htmlFor="filter-status">Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger id="filter-status">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="SUCCESS">Success</SelectItem>
                      <SelectItem value="ERROR">Error</SelectItem>
                      <SelectItem value="WARNING">Warning</SelectItem>
                      <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="filter-entity">Entity / Module</Label>
                  <Select value={entityFilter} onValueChange={setEntityFilter}>
                    <SelectTrigger id="filter-entity">
                      <SelectValue placeholder="Select entity" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Entities</SelectItem>
                      <SelectItem value="CONTACTS">Contacts</SelectItem>
                      <SelectItem value="CLIENTS">Clients</SelectItem>
                      <SelectItem value="SUPPLIERS">Suppliers</SelectItem>
                      <SelectItem value="INVOICES">Invoices</SelectItem>
                      <SelectItem value="PAYMENTS">Payments</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="filter-direction">Direction</Label>
                  <Select value={directionFilter} onValueChange={setDirectionFilter}>
                    <SelectTrigger id="filter-direction">
                      <SelectValue placeholder="Select direction" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Directions</SelectItem>
                      <SelectItem value="PULL">Pull (Xero → App)</SelectItem>
                      <SelectItem value="PUSH">Push (App → Xero)</SelectItem>
                      <SelectItem value="BOTH">Both</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="filter-date-from">Date Range</Label>
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <Label htmlFor="filter-date-from" className="text-xs text-muted-foreground">From</Label>
                      <Input
                        id="filter-date-from"
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="filter-date-to" className="text-xs text-muted-foreground">To</Label>
                      <Input
                        id="filter-date-to"
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <SheetFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={handleClearFilters}
                  className="flex-1"
                >
                  Clear Filters
                </Button>
                <Button
                  onClick={handleApplyFilters}
                  className="flex-1"
                >
                  Apply Filters
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>
        
        {/* Active Filter Chips */}
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm text-muted-foreground">Active filters:</span>
            {statusFilter !== 'all' && (
              <Badge variant="secondary" className="gap-1">
                Status: {statusFilter}
                <X 
                  className="h-3 w-3 cursor-pointer hover:text-destructive" 
                  onClick={() => removeFilter('status')}
                />
              </Badge>
            )}
            {entityFilter !== 'all' && (
              <Badge variant="secondary" className="gap-1">
                Entity: {entityFilter}
                <X 
                  className="h-3 w-3 cursor-pointer hover:text-destructive" 
                  onClick={() => removeFilter('entity')}
                />
              </Badge>
            )}
            {directionFilter !== 'all' && (
              <Badge variant="secondary" className="gap-1">
                Direction: {directionFilter}
                <X 
                  className="h-3 w-3 cursor-pointer hover:text-destructive" 
                  onClick={() => removeFilter('direction')}
                />
              </Badge>
            )}
            {dateFrom && (
              <Badge variant="secondary" className="gap-1">
                From: {format(new Date(dateFrom), 'MMM dd, yyyy')}
                <X 
                  className="h-3 w-3 cursor-pointer hover:text-destructive" 
                  onClick={() => removeFilter('dateFrom')}
                />
              </Badge>
            )}
            {dateTo && (
              <Badge variant="secondary" className="gap-1">
                To: {format(new Date(dateTo), 'MMM dd, yyyy')}
                <X 
                  className="h-3 w-3 cursor-pointer hover:text-destructive" 
                  onClick={() => removeFilter('dateTo')}
                />
              </Badge>
            )}
            {searchQuery && (
              <Badge variant="secondary" className="gap-1">
                Search: "{searchQuery}"
                <X 
                  className="h-3 w-3 cursor-pointer hover:text-destructive" 
                  onClick={() => removeFilter('search')}
                />
              </Badge>
            )}
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleClearFilters}
              className="h-6 px-2 text-xs"
            >
              Clear All
            </Button>
          </div>
        )}

        {/* Tab Contents */}
        <TabsContent value="all" className="space-y-4">
          {/* Entity Breakdown */}
          {Object.keys(entityBreakdown).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BarChart3 className="mr-2 h-5 w-5" />
                  Sync Statistics by Entity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {Object.entries(entityBreakdown).map(([entity, stats]) => (
                    <div key={entity} className="border rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        {getEntityIcon(entity)}
                        <span className="font-medium">{entity}</span>
                      </div>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Total:</span>
                          <span className="font-medium">{stats.total}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-green-600">Success:</span>
                          <span className="font-medium">{stats.success}</span>
                        </div>
                        {stats.error > 0 && (
                          <div className="flex justify-between">
                            <span className="text-red-600">Errors:</span>
                            <span className="font-medium">{stats.error}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Manual Sync Actions */}
          {['SUPERADMIN', 'FINANCE'].includes(userRole || '') && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <PlayCircle className="mr-2 h-5 w-5" />
                  Manual Sync Actions
                </CardTitle>
                <CardDescription>
                  Trigger manual sync operations for specific entities
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Button
                    variant="outline"
                    onClick={() => handleManualSync('CONTACTS', 'PULL')}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Pull Contacts
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleManualSync('CONTACTS', 'PUSH')}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Push Contacts
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleManualSync('INVOICES', 'PULL')}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Pull Invoices
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleManualSync('INVOICES', 'PUSH')}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Push Invoices
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Sync Settings */}
          {['SUPERADMIN', 'FINANCE'].includes(userRole || '') && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <AlertCircle className="mr-2 h-5 w-5" />
                  Sync Settings
                </CardTitle>
                <CardDescription>
                  Configure Xero contact sync preferences
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="include-general-contacts">
                        Include General Contacts (non-customer/supplier)
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Enable this to import all contacts from Xero, even those not marked as customer or supplier.
                      </p>
                    </div>
                    <Switch
                      id="include-general-contacts"
                      checked={syncSettings.includeGeneralContacts}
                      onCheckedChange={(checked) => {
                        if (!savingSettings) {
                          saveSyncSettings({ includeGeneralContacts: checked })
                        }
                      }}
                      disabled={savingSettings}
                    />
                  </div>
                  {savingSettings && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving settings...
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Sync Logs Table */}
          <Card>
            <CardHeader>
              <CardTitle>Sync Logs</CardTitle>
              <CardDescription>
                Detailed history of all sync operations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead>Direction</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Records</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Message</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                          No sync logs found
                        </TableCell>
                      </TableRow>
                    ) : (
                      logs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="whitespace-nowrap">
                            {format(new Date(log.timestamp), 'MMM dd, HH:mm:ss')}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getEntityIcon(log.entity)}
                              {log.entity}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {log.direction === 'PULL' && <Download className="mr-1 h-3 w-3" />}
                              {log.direction === 'PUSH' && <Upload className="mr-1 h-3 w-3" />}
                              {log.direction}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getStatusIcon(log.status)}
                              {getStatusBadge(log.status)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div className="text-green-600">{log.recordsSucceeded} ✓</div>
                              {log.recordsFailed > 0 && (
                                <div className="text-red-600">{log.recordsFailed} ✗</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {log.User.name || log.User.email || 'System'}
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {log.message}
                          </TableCell>
                          <TableCell>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setSelectedLog(log)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                                <DialogHeader>
                                  <DialogTitle>Sync Log Details</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <Label>Timestamp</Label>
                                      <p className="text-sm">{format(new Date(log.timestamp), 'PPpp')}</p>
                                    </div>
                                    <div>
                                      <Label>Status</Label>
                                      <div className="mt-1">{getStatusBadge(log.status)}</div>
                                    </div>
                                    <div>
                                      <Label>Entity</Label>
                                      <p className="text-sm">{log.entity}</p>
                                    </div>
                                    <div>
                                      <Label>Direction</Label>
                                      <p className="text-sm">{log.direction}</p>
                                    </div>
                                    <div>
                                      <Label>Records Processed</Label>
                                      <p className="text-sm">{log.recordsProcessed}</p>
                                    </div>
                                    <div>
                                      <Label>Success / Failed</Label>
                                      <p className="text-sm">
                                        <span className="text-green-600">{log.recordsSucceeded}</span> / 
                                        <span className="text-red-600 ml-1">{log.recordsFailed}</span>
                                      </p>
                                    </div>
                                    {log.duration && (
                                      <div>
                                        <Label>Duration</Label>
                                        <p className="text-sm">{(log.duration / 1000).toFixed(2)}s</p>
                                      </div>
                                    )}
                                    <div>
                                      <Label>User</Label>
                                      <p className="text-sm">{log.User.name || log.User.email}</p>
                                    </div>
                                  </div>

                                  <div>
                                    <Label>Message</Label>
                                    <p className="text-sm mt-1">{log.message}</p>
                                  </div>

                                  {log.errorMessage && (
                                    <div>
                                      <Label className="text-red-600">Error Message</Label>
                                      <pre className="text-xs bg-red-50 dark:bg-red-950 p-3 rounded mt-1 overflow-x-auto">
                                        {log.errorMessage}
                                      </pre>
                                    </div>
                                  )}

                                  {log.details && (
                                    <div>
                                      <Label>Details</Label>
                                      <pre className="text-xs bg-muted p-3 rounded mt-1 overflow-x-auto">
                                        {JSON.stringify(JSON.parse(log.details), null, 2)}
                                      </pre>
                                    </div>
                                  )}

                                  {log.XeroSyncConflict && log.XeroSyncConflict.length > 0 && (
                                    <div>
                                      <Label>Conflicts ({log.XeroSyncConflict.length})</Label>
                                      <div className="mt-2 space-y-2">
                                        {log.XeroSyncConflict.map((conflict) => (
                                          <div key={conflict.id} className="border rounded p-3">
                                            <div className="font-medium">{conflict.entityName}</div>
                                            <div className="text-sm text-muted-foreground">
                                              {conflict.entity} - {conflict.conflictType}
                                            </div>
                                            <Badge variant="outline" className="mt-1">
                                              {conflict.status}
                                            </Badge>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </DialogContent>
                            </Dialog>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="conflicts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pending Conflicts</CardTitle>
              <CardDescription>
                Sync conflicts requiring manual resolution
              </CardDescription>
            </CardHeader>
            <CardContent>
              {conflicts.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Pending Conflicts</h3>
                  <p className="text-muted-foreground">
                    All sync conflicts have been resolved
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {conflicts.map((conflict) => (
                    <div key={conflict.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle className="h-5 w-5 text-yellow-600" />
                            <span className="font-medium">{conflict.entityName}</span>
                            <Badge variant="outline">{conflict.entity}</Badge>
                            <Badge variant="outline">{conflict.conflictType}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            Created: {format(new Date(conflict.createdAt), 'PPpp')}
                          </p>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <Label>Local Data</Label>
                              <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-x-auto">
                                {JSON.stringify(JSON.parse(conflict.localData), null, 2)}
                              </pre>
                            </div>
                            <div>
                              <Label>Xero Data</Label>
                              <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-x-auto">
                                {JSON.stringify(JSON.parse(conflict.xeroData), null, 2)}
                              </pre>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 mt-4">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm" onClick={() => setSelectedConflict(conflict)}>
                              Resolve Conflict
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Resolve Conflict: {conflict.entityName}</DialogTitle>
                              <DialogDescription>
                                Choose which version of the data to keep
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <Button
                                className="w-full"
                                variant="outline"
                                onClick={() => handleResolveConflict(conflict.id, 'use_local')}
                              >
                                Use Local Version
                              </Button>
                              <Button
                                className="w-full"
                                variant="outline"
                                onClick={() => handleResolveConflict(conflict.id, 'use_xero')}
                              >
                                Use Xero Version
                              </Button>
                              <Button
                                className="w-full"
                                variant="outline"
                                onClick={() => handleResolveConflict(conflict.id, 'skip')}
                              >
                                Skip (Resolve Later)
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="errors" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Error Logs</CardTitle>
              <CardDescription>
                Sync operations that failed with errors
              </CardDescription>
            </CardHeader>
            <CardContent>
              {logs.filter(log => log.status === 'ERROR').length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Error Logs</h3>
                  <p className="text-muted-foreground">
                    All recent sync operations completed successfully
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {logs.filter(log => log.status === 'ERROR').map((log) => (
                    <div key={log.id} className="border border-red-200 dark:border-red-900 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-medium">{log.entity}</span>
                            <Badge variant="outline">{log.direction}</Badge>
                            <span className="text-sm text-muted-foreground">
                              {format(new Date(log.timestamp), 'PPpp')}
                            </span>
                          </div>
                          <p className="text-sm mb-2">{log.message}</p>
                          {log.errorMessage && (
                            <pre className="text-xs bg-red-50 dark:bg-red-950 p-3 rounded overflow-x-auto">
                              {log.errorMessage}
                            </pre>
                          )}
                          <div className="text-sm text-muted-foreground mt-2">
                            User: {log.User.name || log.User.email}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
