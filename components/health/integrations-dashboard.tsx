'use client'

import React, { useMemo, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { AlertTriangle, CheckCircle, Loader2, RefreshCw, ShieldAlert, Undo2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { IntegrationHealthSnapshot } from '@/lib/health/integrations'

interface IntegrationsDashboardProps {
  snapshot?: IntegrationHealthSnapshot
  loading?: boolean
  error?: Error | null
  onRetry?: (logId: string) => Promise<any>
  onResolveConflict?: (conflictId: string, resolution: string, notes?: string) => Promise<any>
  onRefresh?: () => void
}

function statusBadge(level: 'healthy' | 'warning' | 'critical') {
  switch (level) {
    case 'healthy':
      return <Badge className="bg-green-100 text-green-700">Healthy</Badge>
    case 'warning':
      return <Badge className="bg-amber-100 text-amber-800">Attention</Badge>
    default:
      return <Badge className="bg-red-100 text-red-700">Critical</Badge>
  }
}

export function IntegrationsDashboard({ snapshot, loading, error, onRetry, onResolveConflict, onRefresh }: IntegrationsDashboardProps) {
  const [resolutionNotes, setResolutionNotes] = useState<Record<string, string>>({})
  const [resolutionChoice, setResolutionChoice] = useState<Record<string, string>>({})

  const overall = useMemo(() => snapshot?.overallStatus ?? 'healthy', [snapshot])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {overall === 'healthy' ? (
            <CheckCircle className="h-6 w-6 text-green-600" />
          ) : overall === 'warning' ? (
            <AlertTriangle className="h-6 w-6 text-amber-500" />
          ) : (
            <ShieldAlert className="h-6 w-6 text-red-600" />
          )}
          <div>
            <p className="text-sm text-muted-foreground">Integration Health</p>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold">{overall === 'healthy' ? 'All systems nominal' : 'Issues detected'}</h2>
              {statusBadge(overall)}
            </div>
            {snapshot?.generatedAt && (
              <p className="text-xs text-muted-foreground">
                Updated {formatDistanceToNow(new Date(snapshot.generatedAt), { addSuffix: true })}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={onRefresh} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-sm font-medium">
              Database
              {statusBadge(snapshot?.checks.database.status ?? 'healthy')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-muted-foreground">{snapshot?.checks.database.details}</p>
            {snapshot?.checks.database.metrics && (
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded bg-muted p-2">
                  <p className="text-muted-foreground">Invoices</p>
                  <p className="font-semibold">{snapshot.checks.database.metrics.invoiceCount}</p>
                </div>
                <div className="rounded bg-muted p-2">
                  <p className="text-muted-foreground">Synced Invoices</p>
                  <p className="font-semibold">{snapshot.checks.database.metrics.xeroSyncedInvoices}</p>
                </div>
                <div className="rounded bg-muted p-2">
                  <p className="text-muted-foreground">Customers</p>
                  <p className="font-semibold">{snapshot.checks.database.metrics.customerCount}</p>
                </div>
                <div className="rounded bg-muted p-2">
                  <p className="text-muted-foreground">Synced Customers</p>
                  <p className="font-semibold">{snapshot.checks.database.metrics.xeroSyncedCustomers}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-sm font-medium">
              Xero Connection
              {statusBadge(snapshot?.checks.xeroConnection.status ?? 'healthy')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-muted-foreground">{snapshot?.checks.xeroConnection.details}</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded bg-muted p-2">
                <p className="text-muted-foreground">Tenant</p>
                <p className="font-semibold">{snapshot?.checks.xeroConnection.tenantName || 'Not connected'}</p>
              </div>
              <div className="rounded bg-muted p-2">
                <p className="text-muted-foreground">Expires In</p>
                <p className="font-semibold">
                  {snapshot?.checks.xeroConnection.expiresInMinutes != null
                    ? `${snapshot.checks.xeroConnection.expiresInMinutes} mins`
                    : 'Unknown'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-sm font-medium">
              Sync Activity
              {statusBadge(snapshot?.checks.syncActivity.status ?? 'healthy')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-muted-foreground">{snapshot?.checks.syncActivity.details}</p>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="rounded bg-muted p-2">
                <p className="text-muted-foreground">Failed</p>
                <p className="font-semibold">{snapshot?.checks.syncActivity.failedSyncs ?? 0}</p>
              </div>
              <div className="rounded bg-muted p-2">
                <p className="text-muted-foreground">Conflicts</p>
                <p className="font-semibold">{snapshot?.checks.syncActivity.pendingConflicts ?? 0}</p>
              </div>
              <div className="rounded bg-muted p-2">
                <p className="text-muted-foreground">Last Sync</p>
                <p className="font-semibold">
                  {snapshot?.checks.syncActivity.lastSync
                    ? formatDistanceToNow(new Date(snapshot.checks.syncActivity.lastSync), { addSuffix: true })
                    : 'No data'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Failures</CardTitle>
            {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
        </CardHeader>
        <CardContent>
          {snapshot?.recentFailures?.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Entity</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Records Failed</TableHead>
                  <TableHead>When</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {snapshot.recentFailures.map((failure) => (
                  <TableRow key={failure.id}>
                    <TableCell className="font-medium">{failure.entity}</TableCell>
                    <TableCell className="max-w-md text-sm text-muted-foreground">{failure.message}</TableCell>
                    <TableCell>{failure.recordsFailed}</TableCell>
                    <TableCell>
                      {formatDistanceToNow(new Date(failure.timestamp), { addSuffix: true })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onRetry?.(failure.id)}
                        disabled={!onRetry}
                      >
                        <Undo2 className="mr-2 h-4 w-4" />
                        Retry
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">No recent failures detected.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pending Conflicts</CardTitle>
        </CardHeader>
        <CardContent>
          {snapshot?.pendingConflicts?.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Entity</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Resolution</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {snapshot.pendingConflicts.map((conflict) => (
                  <TableRow key={conflict.id}>
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span>{conflict.entityName}</span>
                        <span className="text-xs text-muted-foreground">{conflict.entity}</span>
                      </div>
                    </TableCell>
                    <TableCell>{conflict.conflictType}</TableCell>
                    <TableCell>
                      {formatDistanceToNow(new Date(conflict.createdAt), { addSuffix: true })}
                    </TableCell>
                    <TableCell className="space-y-2 text-right">
                      <Select
                        value={resolutionChoice[conflict.id] ?? 'use_local'}
                        onValueChange={(value) =>
                          setResolutionChoice((prev) => ({ ...prev, [conflict.id]: value }))
                        }
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue placeholder="Choose action" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="use_local">Use Local</SelectItem>
                          <SelectItem value="use_xero">Use Xero</SelectItem>
                          <SelectItem value="manual">Manual Fix</SelectItem>
                        </SelectContent>
                      </Select>
                      <Textarea
                        placeholder="Notes"
                        className="min-h-[60px]"
                        value={resolutionNotes[conflict.id] || ''}
                        onChange={(event) =>
                          setResolutionNotes((prev) => ({ ...prev, [conflict.id]: event.target.value }))
                        }
                      />
                      <Button
                        size="sm"
                        onClick={() =>
                          onResolveConflict?.(
                            conflict.id,
                            resolutionChoice[conflict.id] || 'use_local',
                            resolutionNotes[conflict.id]
                          )
                        }
                        disabled={!onResolveConflict}
                      >
                        Resolve
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">No pending conflicts.</p>
          )}
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
          Failed to load health snapshot: {error.message}
        </div>
      )}
    </div>
  )
}
