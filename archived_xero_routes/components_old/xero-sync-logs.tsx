
'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
} from '@/components/ui/dialog'
import { 
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { 
  Activity,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Download,
  Upload,
  ArrowUpDown,
  Eye,
  Filter,
  Calendar,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Loader2,
  AlertCircle
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'

export interface XeroLogEntry {
  id: string
  timestamp: Date
  userId: string
  direction: 'PULL' | 'PUSH' | 'BOTH'
  entity: 'CONTACTS' | 'INVOICES' | 'BILLS' | 'PAYMENTS' | 'ALL'
  status: 'SUCCESS' | 'WARNING' | 'ERROR' | 'IN_PROGRESS'
  recordsProcessed: number
  recordsSucceeded: number
  recordsFailed: number
  message: string
  details?: any
  errorMessage?: string
  errorStack?: string
  duration?: number
  createdAt: Date
  updatedAt: Date
}

export interface XeroSyncStats {
  totalSyncs: number
  successfulSyncs: number
  failedSyncs: number
  averageDuration: number
  lastSync: Date | null
  entityStats: Record<string, number>
}

export function XeroSyncLogs() {
  const { data: session, status: sessionStatus } = useSession() || {}
  const [logs, setLogs] = useState<XeroLogEntry[]>([])
  const [stats, setStats] = useState<XeroSyncStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0
  })
  
  // Filters
  const [filters, setFilters] = useState({
    status: 'all',
    entity: 'all',
    direction: 'all',
    dateFrom: '',
    dateTo: ''
  })

  const [selectedLog, setSelectedLog] = useState<XeroLogEntry | null>(null)

  // Prevent hydration issues
  useEffect(() => {
    setMounted(true)
  }, [])

  // Check if user has permission to view sync logs
  const hasPermission = session?.user?.role === 'SUPERADMIN' || 
                       session?.user?.role === 'FINANCE' || 
                       session?.user?.role === 'PROJECT_MANAGER'

  useEffect(() => {
    if (sessionStatus === 'loading') return
    if (hasPermission) {
      loadSyncLogs()
      loadSyncStats()
    } else {
      setLoading(false)
    }
  }, [hasPermission, sessionStatus, pagination.page, JSON.stringify(filters)])

  const loadSyncLogs = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(filters.status && filters.status !== 'all' && { status: filters.status }),
        ...(filters.entity && filters.entity !== 'all' && { entity: filters.entity }),
        ...(filters.direction && filters.direction !== 'all' && { direction: filters.direction }),
        ...(filters.dateFrom && { dateFrom: filters.dateFrom }),
        ...(filters.dateTo && { dateTo: filters.dateTo })
      })

      const response = await fetch(`/api/xero/sync-logs?${params}`)
      if (!response.ok) throw new Error('Failed to load sync logs')

      const data = await response.json()
      setLogs(data.logs || [])
      setPagination(prev => ({ ...prev, total: data.total || 0 }))
    } catch (error) {
      console.error('Error loading sync logs:', error)
      toast.error('Failed to load sync logs')
    } finally {
      setLoading(false)
    }
  }

  const loadSyncStats = async () => {
    try {
      const response = await fetch('/api/xero/sync-stats')
      if (!response.ok) throw new Error('Failed to load sync stats')

      const data = await response.json()
      setStats(data)
    } catch (error) {
      console.error('Error loading sync stats:', error)
    }
  }

  const getStatusBadge = (status: string) => {
    const variants = {
      SUCCESS: { variant: 'default' as const, icon: CheckCircle, color: 'text-green-600' },
      WARNING: { variant: 'secondary' as const, icon: AlertTriangle, color: 'text-yellow-600' },
      ERROR: { variant: 'destructive' as const, icon: XCircle, color: 'text-red-600' },
      IN_PROGRESS: { variant: 'outline' as const, icon: Loader2, color: 'text-blue-600' }
    }
    
    const config = variants[status as keyof typeof variants] || variants.ERROR
    const Icon = config.icon
    
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className={`h-3 w-3 ${config.color} ${status === 'IN_PROGRESS' ? 'animate-spin' : ''}`} />
        {status}
      </Badge>
    )
  }

  const getDirectionIcon = (direction: string) => {
    const icons = {
      PULL: { icon: Download, color: 'text-blue-600', label: 'From Xero' },
      PUSH: { icon: Upload, color: 'text-green-600', label: 'To Xero' },
      BOTH: { icon: ArrowUpDown, color: 'text-purple-600', label: 'Two-way sync' }
    }
    
    const config = icons[direction as keyof typeof icons] || icons.BOTH
    const Icon = config.icon
    
    return (
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${config.color}`} />
        <span className="text-sm">{config.label}</span>
      </div>
    )
  }

  const formatDuration = (ms?: number) => {
    if (!ms) return 'N/A'
    const seconds = Math.floor(ms / 1000)
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}m ${remainingSeconds}s`
  }

  const safeFormatDate = (date: any, formatStr: string) => {
    try {
      if (!date) return 'N/A'
      return format(new Date(date), formatStr)
    } catch (error) {
      console.error('Date formatting error:', error)
      return 'Invalid date'
    }
  }

  const safeFormatDistanceToNow = (date: any) => {
    try {
      if (!date) return 'Never'
      return formatDistanceToNow(new Date(date), { addSuffix: true })
    } catch (error) {
      console.error('Date formatting error:', error)
      return 'Invalid date'
    }
  }

  const clearFilters = () => {
    setFilters({
      status: 'all',
      entity: 'all',
      direction: 'all',
      dateFrom: '',
      dateTo: ''
    })
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  if (!mounted || sessionStatus === 'loading') {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    )
  }

  if (!hasPermission) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            Access Restricted
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            You need Finance Admin or Admin privileges to view sync logs.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Syncs</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalSyncs}</div>
              <p className="text-xs text-muted-foreground">
                Last 30 days
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {stats.totalSyncs > 0 ? Math.round((stats.successfulSyncs / stats.totalSyncs) * 100) : 0}%
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.successfulSyncs}/{stats.totalSyncs} successful
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.averageDuration}s</div>
              <p className="text-xs text-muted-foreground">
                Per sync operation
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Last Sync</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {safeFormatDistanceToNow(stats?.lastSync)}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats?.lastSync ? safeFormatDate(stats.lastSync, 'MMM dd, HH:mm') : 'No sync yet'}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Xero Sync Logs
          </CardTitle>
          <CardDescription>
            View detailed logs of all Xero synchronization operations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="logs" className="space-y-4">
            <TabsList>
              <TabsTrigger value="logs">Sync Logs</TabsTrigger>
              <TabsTrigger value="stats">Statistics</TabsTrigger>
            </TabsList>

            <TabsContent value="logs" className="space-y-4">
              {/* Filters */}
              <Card>
                <CardContent className="pt-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select value={filters.status} onValueChange={(value) => setFilters({...filters, status: value})}>
                        <SelectTrigger>
                          <SelectValue placeholder="All statuses" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All statuses</SelectItem>
                          <SelectItem value="SUCCESS">Success</SelectItem>
                          <SelectItem value="ERROR">Error</SelectItem>
                          <SelectItem value="WARNING">Warning</SelectItem>
                          <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Entity</Label>
                      <Select value={filters.entity} onValueChange={(value) => setFilters({...filters, entity: value})}>
                        <SelectTrigger>
                          <SelectValue placeholder="All entities" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All entities</SelectItem>
                          <SelectItem value="CONTACTS">Contacts</SelectItem>
                          <SelectItem value="INVOICES">Invoices</SelectItem>
                          <SelectItem value="BILLS">Bills</SelectItem>
                          <SelectItem value="PAYMENTS">Payments</SelectItem>
                          <SelectItem value="ALL">All</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Direction</Label>
                      <Select value={filters.direction} onValueChange={(value) => setFilters({...filters, direction: value})}>
                        <SelectTrigger>
                          <SelectValue placeholder="All directions" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All directions</SelectItem>
                          <SelectItem value="PULL">From Xero</SelectItem>
                          <SelectItem value="PUSH">To Xero</SelectItem>
                          <SelectItem value="BOTH">Two-way sync</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>From Date</Label>
                      <Input
                        type="date"
                        value={filters.dateFrom}
                        onChange={(e) => setFilters({...filters, dateFrom: e.target.value})}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>To Date</Label>
                      <Input
                        type="date"
                        value={filters.dateTo}
                        onChange={(e) => setFilters({...filters, dateTo: e.target.value})}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-transparent">Actions</Label>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={clearFilters}>
                          <Filter className="h-4 w-4 mr-1" />
                          Clear
                        </Button>
                        <Button variant="outline" size="sm" onClick={loadSyncLogs}>
                          <RefreshCw className="h-4 w-4 mr-1" />
                          Refresh
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Logs Table */}
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Direction</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead>Records</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Message</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                          <p className="mt-2 text-muted-foreground">Loading sync logs...</p>
                        </TableCell>
                      </TableRow>
                    ) : logs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8">
                          <Activity className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                          <p className="text-muted-foreground">No sync logs found</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      logs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="font-medium">
                                {safeFormatDate(log.timestamp, 'MMM dd, yyyy')}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {safeFormatDate(log.timestamp, 'HH:mm:ss')}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(log.status)}</TableCell>
                          <TableCell>{getDirectionIcon(log.direction)}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{log.entity}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="text-sm font-medium">
                                {log.recordsProcessed} total
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {log.recordsSucceeded} ✓ · {log.recordsFailed} ✗
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatDuration(log.duration)}
                          </TableCell>
                          <TableCell className="max-w-xs">
                            <div className="truncate" title={log.message}>
                              {log.message}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="sm" onClick={() => setSelectedLog(log)}>
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
                                <DialogHeader>
                                  <DialogTitle>Sync Log Details</DialogTitle>
                                  <DialogDescription>
                                    {safeFormatDate(log.timestamp, 'MMMM dd, yyyy \'at\' HH:mm:ss')}
                                  </DialogDescription>
                                </DialogHeader>
                                {selectedLog && (
                                  <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <Label className="text-sm font-semibold">Status</Label>
                                        <div className="mt-1">{getStatusBadge(selectedLog.status)}</div>
                                      </div>
                                      <div>
                                        <Label className="text-sm font-semibold">Direction</Label>
                                        <div className="mt-1">{getDirectionIcon(selectedLog.direction)}</div>
                                      </div>
                                      <div>
                                        <Label className="text-sm font-semibold">Entity</Label>
                                        <div className="mt-1">
                                          <Badge variant="outline">{selectedLog.entity}</Badge>
                                        </div>
                                      </div>
                                      <div>
                                        <Label className="text-sm font-semibold">Duration</Label>
                                        <div className="mt-1 text-sm">{formatDuration(selectedLog.duration)}</div>
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-4">
                                      <div>
                                        <Label className="text-sm font-semibold">Processed</Label>
                                        <div className="mt-1 text-2xl font-bold">{selectedLog.recordsProcessed}</div>
                                      </div>
                                      <div>
                                        <Label className="text-sm font-semibold">Succeeded</Label>
                                        <div className="mt-1 text-2xl font-bold text-green-600">{selectedLog.recordsSucceeded}</div>
                                      </div>
                                      <div>
                                        <Label className="text-sm font-semibold">Failed</Label>
                                        <div className="mt-1 text-2xl font-bold text-red-600">{selectedLog.recordsFailed}</div>
                                      </div>
                                    </div>

                                    <div>
                                      <Label className="text-sm font-semibold">Message</Label>
                                      <div className="mt-1 p-3 bg-muted rounded text-sm">{selectedLog.message}</div>
                                    </div>

                                    {selectedLog.errorMessage && (
                                      <div>
                                        <Label className="text-sm font-semibold text-red-600">Error Message</Label>
                                        <div className="mt-1 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                                          {selectedLog.errorMessage}
                                        </div>
                                      </div>
                                    )}

                                    {selectedLog.details && (
                                      <div>
                                        <Label className="text-sm font-semibold">Details</Label>
                                        <div className="mt-1 p-3 bg-muted rounded text-sm font-mono text-xs overflow-auto max-h-40">
                                          <pre>{JSON.stringify(selectedLog.details, null, 2)}</pre>
                                        </div>
                                      </div>
                                    )}

                                    {selectedLog.errorStack && (
                                      <div>
                                        <Label className="text-sm font-semibold text-red-600">Error Stack</Label>
                                        <div className="mt-1 p-3 bg-red-50 border border-red-200 rounded text-xs font-mono text-red-800 overflow-auto max-h-40">
                                          <pre>{selectedLog.errorStack}</pre>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
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
              {pagination.total > 0 && (
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} results
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pagination.page === 1}
                      onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pagination.page * pagination.limit >= pagination.total}
                      onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="stats" className="space-y-4">
              {stats && (
                <div className="grid gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5" />
                        Entity Statistics
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        {Object.entries(stats.entityStats).map(([entity, count]) => (
                          <div key={entity} className="text-center">
                            <div className="text-2xl font-bold">{count}</div>
                            <div className="text-sm text-muted-foreground">{entity}</div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>Success vs Failures</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="text-green-600 flex items-center gap-2">
                              <CheckCircle className="h-4 w-4" />
                              Successful
                            </span>
                            <span className="font-semibold">{stats.successfulSyncs}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-red-600 flex items-center gap-2">
                              <XCircle className="h-4 w-4" />
                              Failed
                            </span>
                            <span className="font-semibold">{stats.failedSyncs}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Performance</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <span>Average Duration</span>
                            <span className="font-semibold">{stats.averageDuration}s</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Total Operations</span>
                            <span className="font-semibold">{stats.totalSyncs}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
