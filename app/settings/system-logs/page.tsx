'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
  AlertCircle,
  AlertTriangle,
  Activity,
  CheckCircle,
  Download,
  Trash2,
  Search,
  Filter,
  RefreshCw,
  Eye,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Database,
  BarChart3,
  Mail,
  Archive,
  Clock,
  Settings,
  FileText,
} from 'lucide-react'
import { useSystemLogs } from '@/hooks/use-system-logs'
import { formatDistanceToNow, format } from 'date-fns'
import { cn } from '@/lib/utils'
import { toast } from 'react-hot-toast'

export default function SystemLogsPage() {
  const { data: session } = useSession()
  const [selectedLog, setSelectedLog] = useState<any>(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [clearDialogOpen, setClearDialogOpen] = useState(false)
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false)
  const [stats, setStats] = useState<any>(null)
  const [archiveStats, setArchiveStats] = useState<any>(null)
  const [digestPreview, setDigestPreview] = useState<string | null>(null)
  
  // Digest preferences state
  const [digestPreferences, setDigestPreferences] = useState({
    digestEnabled: false,
    digestFrequency: 'WEEKLY',
    digestTime: '09:00',
    digestDays: ['Monday'],
  })
  const [loadingPreferences, setLoadingPreferences] = useState(true)

  const {
    logs,
    loading,
    error,
    pagination,
    unviewedCritical,
    filters,
    setFilters,
    fetchLogs,
    markAsViewed,
    clearLogs,
  } = useSystemLogs()

  // Fetch stats and preferences on mount
  useEffect(() => {
    fetchStats()
    fetchArchiveStats()
    fetchDigestPreferences()
  }, [])

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/logs/stats')
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err)
    }
  }

  const fetchArchiveStats = async () => {
    try {
      const response = await fetch('/api/logs/archive')
      if (response.ok) {
        const data = await response.json()
        setArchiveStats(data)
      }
    } catch (err) {
      console.error('Failed to fetch archive stats:', err)
    }
  }

  const fetchDigestPreferences = async () => {
    try {
      setLoadingPreferences(true)
      const response = await fetch('/api/logs/preferences')
      if (response.ok) {
        const data = await response.json()
        setDigestPreferences(data)
      }
    } catch (err) {
      console.error('Failed to fetch preferences:', err)
      toast.error('Failed to load digest preferences')
    } finally {
      setLoadingPreferences(false)
    }
  }

  const handleSavePreferences = async () => {
    try {
      const response = await fetch('/api/logs/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(digestPreferences),
      })

      if (!response.ok) {
        throw new Error('Failed to save preferences')
      }

      toast.success('Digest preferences saved successfully')
    } catch (err: any) {
      console.error('Failed to save preferences:', err)
      toast.error(`Failed to save preferences: ${err.message}`)
    }
  }

  const handlePreviewDigest = async () => {
    try {
      const response = await fetch('/api/logs/digest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frequency: digestPreferences.digestFrequency,
          format: 'html',
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate digest preview')
      }

      const data = await response.json()
      setDigestPreview(data.content)
    } catch (err: any) {
      console.error('Failed to preview digest:', err)
      toast.error(`Failed to generate preview: ${err.message}`)
    }
  }

  const handleExportLogs = async (criticalOnly: boolean = false) => {
    try {
      const params = new URLSearchParams()
      params.set('format', 'csv')
      params.set('criticalOnly', criticalOnly.toString())
      
      // Add filters
      if (filters.type) params.set('type', filters.type)
      if (filters.status) params.set('status', filters.status)
      if (filters.module) params.set('module', filters.module)
      if (filters.userId) params.set('userId', filters.userId)
      if (filters.keyword) params.set('keyword', filters.keyword)
      if (filters.startDate) params.set('startDate', filters.startDate)
      if (filters.endDate) params.set('endDate', filters.endDate)

      const response = await fetch(`/api/logs/export?${params.toString()}`)
      
      if (!response.ok) {
        throw new Error('Failed to export logs')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = response.headers.get('content-disposition')?.split('filename=')[1]?.replace(/"/g, '') || 'logs.csv'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success(`Exported ${criticalOnly ? 'critical errors' : 'logs'} successfully`)
    } catch (err: any) {
      console.error('Failed to export logs:', err)
      toast.error(`Failed to export: ${err.message}`)
    }
  }

  const handleArchiveLogs = async (daysOld: number) => {
    try {
      const response = await fetch('/api/logs/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ daysOld, dryRun: false }),
      })

      if (!response.ok) {
        throw new Error('Failed to archive logs')
      }

      const data = await response.json()
      toast.success(data.message)
      fetchArchiveStats()
      fetchLogs()
    } catch (err: any) {
      console.error('Failed to archive logs:', err)
      toast.error(`Failed to archive: ${err.message}`)
    }
  }

  const handleViewDetails = (log: any) => {
    setSelectedLog(log)
    setDetailDialogOpen(true)
    if (!log.viewed) {
      markAsViewed(log.id)
    }
  }

  const handleClearLogs = async () => {
    try {
      await clearLogs()
      setClearDialogOpen(false)
      fetchStats()
      toast.success('Logs cleared successfully')
    } catch (err: any) {
      toast.error(`Failed to clear logs: ${err.message}`)
    }
  }

  const handleCriticalFilter = () => {
    setFilters({ ...filters, status: 'CRITICAL' })
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'ERROR':
        return <AlertCircle className="h-4 w-4" />
      case 'ACTIVITY':
        return <Activity className="h-4 w-4" />
      case 'NOTIFICATION':
        return <CheckCircle className="h-4 w-4" />
      default:
        return <Activity className="h-4 w-4" />
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'FAILED':
        return <AlertCircle className="h-4 w-4 text-red-600" />
      case 'WARNING':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />
      case 'CRITICAL':
        return <AlertCircle className="h-4 w-4 text-red-700" />
      default:
        return <Activity className="h-4 w-4 text-gray-600" />
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'ERROR':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'ACTIVITY':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'NOTIFICATION':
        return 'bg-green-100 text-green-800 border-green-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return 'bg-green-100 text-green-800'
      case 'FAILED':
        return 'bg-red-100 text-red-800'
      case 'WARNING':
        return 'bg-yellow-100 text-yellow-800'
      case 'CRITICAL':
        return 'bg-red-200 text-red-900 font-bold'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (!session || session.user?.role !== 'SUPERADMIN') {
    return (
      <MainLayout>
        <div className="p-6">
          <Card>
            <CardContent className="flex items-center justify-center h-64">
              <div className="text-center">
                <AlertTriangle className="mx-auto h-12 w-12 text-yellow-600 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Access Denied</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Only Super Admins can access System Logs.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">System Logs</h1>
            <p className="text-muted-foreground mt-1">
              Monitor system activity, errors, and notifications
            </p>
          </div>
          {unviewedCritical > 0 && (
            <Badge variant="destructive" className="animate-pulse">
              {unviewedCritical} Critical Alerts
            </Badge>
          )}
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Logs</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total || 0}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Critical Errors</CardTitle>
                <AlertCircle className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{stats.critical || 0}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Failed Operations</CardTitle>
                <AlertTriangle className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{stats.failed || 0}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Successful Operations</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{stats.success || 0}</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Main Tabs */}
        <Tabs defaultValue="logs" className="space-y-4">
          <TabsList>
            <TabsTrigger value="logs">
              <FileText className="h-4 w-4 mr-2" />
              Logs
            </TabsTrigger>
            <TabsTrigger value="digest">
              <Mail className="h-4 w-4 mr-2" />
              Digest Settings
            </TabsTrigger>
            <TabsTrigger value="archive">
              <Archive className="h-4 w-4 mr-2" />
              Archive Management
            </TabsTrigger>
          </TabsList>

          {/* Logs Tab */}
          <TabsContent value="logs" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>System Logs</CardTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCriticalFilter}
                    >
                      <AlertCircle className="h-4 w-4 mr-2" />
                      Critical Only
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExportLogs(true)}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export Critical
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExportLogs(false)}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export All
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={fetchLogs}
                      disabled={loading}
                    >
                      <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
                      Refresh
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setClearDialogOpen(true)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Clear Logs
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Filters */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div>
                    <Label>Type</Label>
                    <Select
                      value={filters.type || 'all'}
                      onValueChange={(value) =>
                        setFilters({ ...filters, type: value === 'all' ? undefined : value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All Types" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="ERROR">Errors</SelectItem>
                        <SelectItem value="ACTIVITY">Activity</SelectItem>
                        <SelectItem value="NOTIFICATION">Notifications</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Status</Label>
                    <Select
                      value={filters.status || 'all'}
                      onValueChange={(value) =>
                        setFilters({ ...filters, status: value === 'all' ? undefined : value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All Statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="CRITICAL">Critical</SelectItem>
                        <SelectItem value="FAILED">Failed</SelectItem>
                        <SelectItem value="WARNING">Warning</SelectItem>
                        <SelectItem value="SUCCESS">Success</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Module</Label>
                    <Input
                      placeholder="Filter by module"
                      value={filters.module || ''}
                      onChange={(e) => setFilters({ ...filters, module: e.target.value || undefined })}
                    />
                  </div>

                  <div>
                    <Label>Search</Label>
                    <Input
                      placeholder="Search logs..."
                      value={filters.keyword || ''}
                      onChange={(e) => setFilters({ ...filters, keyword: e.target.value || undefined })}
                    />
                  </div>
                </div>

                {/* Logs Table */}
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Module</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8">
                            <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                            <p className="text-muted-foreground">Loading logs...</p>
                          </TableCell>
                        </TableRow>
                      )}

                      {!loading && logs.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8">
                            <Database className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                            <p className="text-muted-foreground">No logs found</p>
                          </TableCell>
                        </TableRow>
                      )}

                      {!loading &&
                        logs.map((log: any) => (
                          <TableRow
                            key={log.id}
                            className={cn(
                              'cursor-pointer hover:bg-muted/50',
                              !log.viewed && 'bg-blue-50 dark:bg-blue-950/20'
                            )}
                            onClick={() => handleViewDetails(log)}
                          >
                            <TableCell>
                              <Badge variant="outline" className={getTypeColor(log.type)}>
                                {getTypeIcon(log.type)}
                                <span className="ml-1">{log.type}</span>
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className={getStatusColor(log.status)}>
                                {getStatusIcon(log.status)}
                                <span className="ml-1">{log.status}</span>
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium">{log.module}</TableCell>
                            <TableCell className="max-w-xs truncate">{log.action}</TableCell>
                            <TableCell>{log.username || 'System'}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleViewDetails(log)
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {pagination && pagination.pages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <div className="text-sm text-muted-foreground">
                      Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                      {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} logs
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setFilters({ ...filters, page: pagination.page - 1 })}
                        disabled={pagination.page === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <div className="text-sm">
                        Page {pagination.page} of {pagination.pages}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setFilters({ ...filters, page: pagination.page + 1 })}
                        disabled={pagination.page === pagination.pages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Digest Settings Tab */}
          <TabsContent value="digest" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Email Digest Settings</CardTitle>
                <CardDescription>
                  Configure automated email summaries of system logs and critical errors
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {loadingPreferences ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <>
                    {/* Enable/Disable Toggle */}
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="digest-enabled" className="text-base font-semibold">
                          Enable Email Digest
                        </Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          Receive periodic summaries of system activity and errors
                        </p>
                      </div>
                      <Switch
                        id="digest-enabled"
                        checked={digestPreferences.digestEnabled}
                        onCheckedChange={(checked) =>
                          setDigestPreferences({ ...digestPreferences, digestEnabled: checked })
                        }
                      />
                    </div>

                    {digestPreferences.digestEnabled && (
                      <>
                        {/* Frequency */}
                        <div className="space-y-2">
                          <Label>Digest Frequency</Label>
                          <Select
                            value={digestPreferences.digestFrequency}
                            onValueChange={(value) =>
                              setDigestPreferences({ ...digestPreferences, digestFrequency: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="DAILY">Daily</SelectItem>
                              <SelectItem value="WEEKLY">Weekly</SelectItem>
                              <SelectItem value="MONTHLY">Monthly</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Time */}
                        <div className="space-y-2">
                          <Label>Delivery Time</Label>
                          <Input
                            type="time"
                            value={digestPreferences.digestTime}
                            onChange={(e) =>
                              setDigestPreferences({ ...digestPreferences, digestTime: e.target.value })
                            }
                          />
                          <p className="text-sm text-muted-foreground">
                            Time when you'd like to receive the digest
                          </p>
                        </div>

                        {/* Days (for weekly) */}
                        {digestPreferences.digestFrequency === 'WEEKLY' && (
                          <div className="space-y-2">
                            <Label>Delivery Days</Label>
                            <div className="flex flex-wrap gap-2">
                              {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(
                                (day) => (
                                  <Button
                                    key={day}
                                    variant={
                                      digestPreferences.digestDays.includes(day) ? 'default' : 'outline'
                                    }
                                    size="sm"
                                    onClick={() => {
                                      const days = digestPreferences.digestDays.includes(day)
                                        ? digestPreferences.digestDays.filter((d) => d !== day)
                                        : [...digestPreferences.digestDays, day]
                                      setDigestPreferences({ ...digestPreferences, digestDays: days })
                                    }}
                                  >
                                    {day}
                                  </Button>
                                )
                              )}
                            </div>
                          </div>
                        )}

                        {/* Preview */}
                        <div className="space-y-2">
                          <Button variant="outline" onClick={handlePreviewDigest}>
                            <Eye className="h-4 w-4 mr-2" />
                            Preview Digest
                          </Button>
                        </div>
                      </>
                    )}

                    {/* Save Button */}
                    <div className="flex justify-end gap-2">
                      <Button onClick={handleSavePreferences}>
                        <Settings className="h-4 w-4 mr-2" />
                        Save Preferences
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Digest Preview */}
            {digestPreview && (
              <Card>
                <CardHeader>
                  <CardTitle>Digest Preview</CardTitle>
                  <CardDescription>This is how your digest email will look</CardDescription>
                </CardHeader>
                <CardContent>
                  <pre className="border rounded-lg p-4 max-h-96 overflow-y-auto bg-white whitespace-pre-wrap font-sans text-sm">
                    {digestPreview}
                  </pre>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Archive Management Tab */}
          <TabsContent value="archive" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Archive Management</CardTitle>
                <CardDescription>
                  Automatically archive old logs to maintain system performance
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Archive Stats */}
                {archiveStats && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="border rounded-lg p-4">
                      <div className="text-sm text-muted-foreground">Total Logs</div>
                      <div className="text-2xl font-bold">{archiveStats.totalLogs}</div>
                    </div>
                    <div className="border rounded-lg p-4">
                      <div className="text-sm text-muted-foreground">Active Logs</div>
                      <div className="text-2xl font-bold text-green-600">{archiveStats.activeLogs}</div>
                    </div>
                    <div className="border rounded-lg p-4">
                      <div className="text-sm text-muted-foreground">Archived Logs</div>
                      <div className="text-2xl font-bold text-blue-600">{archiveStats.archivedLogs}</div>
                    </div>
                  </div>
                )}

                {/* Archive Actions */}
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Manual Archive</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      Archive logs older than a specified number of days. Critical errors are excluded by default.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => handleArchiveLogs(30)}
                      >
                        Archive 30+ Days
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleArchiveLogs(60)}
                      >
                        Archive 60+ Days
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleArchiveLogs(90)}
                      >
                        Archive 90+ Days
                      </Button>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h4 className="text-sm font-semibold mb-2">Automated Archive</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      Logs older than 90 days are automatically archived daily via a cron job.
                      Critical errors are excluded from automatic archiving.
                    </p>
                    <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                      <div className="flex items-start gap-2">
                        <Clock className="h-5 w-5 text-blue-600 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                            Auto-Archive Enabled
                          </p>
                          <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                            Runs daily at midnight. Archived logs are retained for 180 days before permanent deletion.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Log Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Log Details</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Type</Label>
                  <Badge variant="outline" className={cn("mt-1", getTypeColor(selectedLog.type))}>
                    {getTypeIcon(selectedLog.type)}
                    <span className="ml-1">{selectedLog.type}</span>
                  </Badge>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <Badge variant="secondary" className={cn("mt-1", getStatusColor(selectedLog.status))}>
                    {getStatusIcon(selectedLog.status)}
                    <span className="ml-1">{selectedLog.status}</span>
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Module</Label>
                  <div className="mt-1 font-medium">{selectedLog.module}</div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Action</Label>
                  <div className="mt-1 font-medium">{selectedLog.action}</div>
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Message</Label>
                <div className="mt-1 p-3 bg-muted rounded-lg">{selectedLog.message}</div>
              </div>

              {selectedLog.errorCode && (
                <div>
                  <Label className="text-xs text-muted-foreground">Error Code</Label>
                  <div className="mt-1 font-mono text-sm text-red-600">{selectedLog.errorCode}</div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">User</Label>
                  <div className="mt-1">{selectedLog.username || 'System'}</div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Role</Label>
                  <div className="mt-1">{selectedLog.role || '-'}</div>
                </div>
              </div>

              {selectedLog.endpoint && (
                <div>
                  <Label className="text-xs text-muted-foreground">Endpoint</Label>
                  <div className="mt-1 font-mono text-sm">{selectedLog.endpoint}</div>
                </div>
              )}

              {selectedLog.ipAddress && (
                <div>
                  <Label className="text-xs text-muted-foreground">IP Address</Label>
                  <div className="mt-1 font-mono text-sm">{selectedLog.ipAddress}</div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Created At</Label>
                  <div className="mt-1 text-sm">
                    {format(new Date(selectedLog.createdAt), 'PPpp')}
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Time Ago</Label>
                  <div className="mt-1 text-sm">
                    {formatDistanceToNow(new Date(selectedLog.createdAt), { addSuffix: true })}
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear Logs Dialog */}
      <Dialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear All Logs?</DialogTitle>
            <DialogDescription>
              This will permanently delete all system logs. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClearDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleClearLogs}>
              Clear All Logs
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  )
}
