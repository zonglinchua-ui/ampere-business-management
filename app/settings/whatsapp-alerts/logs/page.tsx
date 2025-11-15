'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, ArrowLeft, CheckCircle, XCircle, Clock, Filter, Download, Eye } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface NotificationLog {
  id: string
  alertType: string
  recipientPhone: string
  recipientName: string | null
  recipientRole: string | null
  message: string
  status: 'QUEUED' | 'SENT' | 'FAILED' | 'SKIPPED'
  errorMessage: string | null
  sentAt: string | null
  retryCount: number
  createdAt: string
}

interface Statistics {
  total: number
  sent: number
  failed: number
  queued: number
  skipped: number
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function NotificationLogsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [logs, setLogs] = useState<NotificationLog[]>([])
  const [statistics, setStatistics] = useState<Statistics | null>(null)
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0
  })
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [alertTypeFilter, setAlertTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [phoneFilter, setPhoneFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // View message dialog
  const [viewingLog, setViewingLog] = useState<NotificationLog | null>(null)

  useEffect(() => {
    fetchLogs()
  }, [pagination.page, alertTypeFilter, statusFilter, phoneFilter, startDate, endDate])

  const fetchLogs = async () => {
    try {
      setLoading(true)
      
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString()
      })
      
      if (alertTypeFilter) params.append('alertType', alertTypeFilter)
      if (statusFilter) params.append('status', statusFilter)
      if (phoneFilter) params.append('recipientPhone', phoneFilter)
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)

      const res = await fetch(`/api/admin/whatsapp-alerts/logs?${params}`)
      
      if (!res.ok) throw new Error('Failed to fetch logs')
      
      const data = await res.json()
      setLogs(data.logs || [])
      setStatistics(data.statistics)
      setPagination(data.pagination)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleExportCSV = () => {
    // Convert logs to CSV
    const headers = ['Date', 'Alert Type', 'Recipient', 'Phone', 'Status', 'Error']
    const rows = logs.map(log => [
      new Date(log.createdAt).toLocaleString(),
      log.alertType,
      log.recipientName || '-',
      log.recipientPhone,
      log.status,
      log.errorMessage || '-'
    ])

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    // Download CSV
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `whatsapp-logs-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SENT':
        return <Badge className="bg-green-600">Sent</Badge>
      case 'FAILED':
        return <Badge variant="destructive">Failed</Badge>
      case 'QUEUED':
        return <Badge className="bg-yellow-600">Queued</Badge>
      case 'SKIPPED':
        return <Badge variant="secondary">Skipped</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getAlertDisplayName = (alertType: string) => {
    return alertType
      .split('_')
      .map(word => word.charAt(0) + word.slice(1).toLowerCase())
      .join(' ')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Notification Logs</h1>
          <p className="text-muted-foreground">View and filter WhatsApp notification history</p>
        </div>
        <Button variant="outline" onClick={handleExportCSV} disabled={logs.length === 0}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Statistics Cards */}
      {statistics && (
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statistics.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sent</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{statistics.sent}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Failed</CardTitle>
              <XCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{statistics.failed}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Queued</CardTitle>
              <Clock className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{statistics.queued}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Skipped</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-muted-foreground">{statistics.skipped}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-5">
            <div>
              <Label htmlFor="statusFilter">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger id="statusFilter">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All statuses</SelectItem>
                  <SelectItem value="SENT">Sent</SelectItem>
                  <SelectItem value="FAILED">Failed</SelectItem>
                  <SelectItem value="QUEUED">Queued</SelectItem>
                  <SelectItem value="SKIPPED">Skipped</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="phoneFilter">Phone Number</Label>
              <Input
                id="phoneFilter"
                placeholder="Search phone..."
                value={phoneFilter}
                onChange={(e) => setPhoneFilter(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setAlertTypeFilter('')
                  setStatusFilter('')
                  setPhoneFilter('')
                  setStartDate('')
                  setEndDate('')
                }}
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-96">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-96">
              <p className="text-muted-foreground">No logs found</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date/Time</TableHead>
                    <TableHead>Alert Type</TableHead>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Retries</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-xs">
                        {new Date(log.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell>{getAlertDisplayName(log.alertType)}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{log.recipientName || 'Unknown'}</div>
                          {log.recipientRole && (
                            <div className="text-xs text-muted-foreground">{log.recipientRole}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{log.recipientPhone}</TableCell>
                      <TableCell>{getStatusBadge(log.status)}</TableCell>
                      <TableCell>{log.retryCount}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setViewingLog(log)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex items-center justify-between p-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} logs
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                    disabled={pagination.page === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                    disabled={pagination.page === pagination.totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* View Message Dialog */}
      <Dialog open={!!viewingLog} onOpenChange={() => setViewingLog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Notification Details</DialogTitle>
            <DialogDescription>
              {viewingLog && new Date(viewingLog.createdAt).toLocaleString()}
            </DialogDescription>
          </DialogHeader>
          {viewingLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Alert Type</Label>
                  <p className="text-sm">{getAlertDisplayName(viewingLog.alertType)}</p>
                </div>
                <div>
                  <Label>Status</Label>
                  <div className="mt-1">{getStatusBadge(viewingLog.status)}</div>
                </div>
                <div>
                  <Label>Recipient</Label>
                  <p className="text-sm">{viewingLog.recipientName || 'Unknown'}</p>
                </div>
                <div>
                  <Label>Phone</Label>
                  <p className="text-sm font-mono">{viewingLog.recipientPhone}</p>
                </div>
                {viewingLog.recipientRole && (
                  <div>
                    <Label>Role</Label>
                    <p className="text-sm">{viewingLog.recipientRole}</p>
                  </div>
                )}
                <div>
                  <Label>Retry Count</Label>
                  <p className="text-sm">{viewingLog.retryCount}</p>
                </div>
              </div>

              <div>
                <Label>Message</Label>
                <div className="mt-2 p-4 bg-muted rounded-lg whitespace-pre-wrap text-sm">
                  {viewingLog.message}
                </div>
              </div>

              {viewingLog.errorMessage && (
                <div>
                  <Label>Error Message</Label>
                  <div className="mt-2 p-4 bg-destructive/10 text-destructive rounded-lg text-sm">
                    {viewingLog.errorMessage}
                  </div>
                </div>
              )}

              {viewingLog.sentAt && (
                <div>
                  <Label>Sent At</Label>
                  <p className="text-sm font-mono">{new Date(viewingLog.sentAt).toLocaleString()}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
