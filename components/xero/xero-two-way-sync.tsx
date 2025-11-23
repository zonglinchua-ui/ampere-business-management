
'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AlertCircle, ArrowDownToLine, ArrowUpFromLine, RefreshCw, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'

interface SyncResult {
  success: boolean
  message: string
  correlationId: string
  stats: {
    pulled: number
    pushed: number
    created: number
    updated: number
    skipped: number
    conflicts: number
    errors: number
  }
  conflicts: ConflictInfo[]
  errors: string[]
  dryRun: boolean
}

interface ConflictInfo {
  entityId: string
  entityName: string
  localData: any
  xeroData: any
  conflictFields: string[]
}

interface Conflict {
  id: string
  entityType: string
  entityId: string
  entityName: string
  xeroId: string | null
  status: string
  conflictData: any
  updatedAt: string
}

export default function XeroTwoWaySync() {
  const { toast } = useToast()
  const [syncing, setSyncing] = useState(false)
  const [conflicts, setConflicts] = useState<Conflict[]>([])
  const [loadingConflicts, setLoadingConflicts] = useState(false)
  const [selectedConflict, setSelectedConflict] = useState<Conflict | null>(null)
  const [resolvingConflict, setResolvingConflict] = useState(false)
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null)
  const [reconciliationReport, setReconciliationReport] = useState<any>(null)
  const [loadingReconciliation, setLoadingReconciliation] = useState(false)

  // Load conflicts on mount
  useEffect(() => {
    loadConflicts()
  }, [])

  const loadConflicts = async () => {
    setLoadingConflicts(true)
    try {
      const response = await fetch('/api/xero/sync/conflicts')
      if (!response.ok) throw new Error('Failed to load conflicts')
      
      const data = await response.json()
      setConflicts(data.conflicts || [])
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      })
    } finally {
      setLoadingConflicts(false)
    }
  }

  const handlePullContacts = async (dryRun = false) => {
    setSyncing(true)
    try {
      const response = await fetch(`/api/xero/sync/contacts?dryRun=${dryRun}`)
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Sync failed')
      }

      const result: SyncResult = await response.json()
      setLastSyncResult(result)

      if (result.success) {
        toast({
          title: dryRun ? 'Dry Run Complete' : 'Sync Complete',
          description: result.message
        })
      } else {
        toast({
          title: 'Sync Issues',
          description: result.message,
          variant: 'destructive'
        })
      }

      // Reload conflicts if any were detected
      if (result.stats.conflicts > 0) {
        loadConflicts()
      }
    } catch (error: any) {
      toast({
        title: 'Sync Failed',
        description: error.message,
        variant: 'destructive'
      })
    } finally {
      setSyncing(false)
    }
  }

  const handleReconciliation = async () => {
    setLoadingReconciliation(true)
    try {
      const response = await fetch('/api/xero/sync/reconcile')
      if (!response.ok) throw new Error('Failed to generate reconciliation report')
      
      const data = await response.json()
      setReconciliationReport(data.reconciliation)
      
      toast({
        title: 'Reconciliation Report Generated',
        description: 'Review the report to see what would change'
      })
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      })
    } finally {
      setLoadingReconciliation(false)
    }
  }

  const handleResolveConflict = async (conflictId: string, resolution: 'use_local' | 'use_remote') => {
    setResolvingConflict(true)
    try {
      const response = await fetch(`/api/xero/sync/conflicts/${conflictId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolution })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to resolve conflict')
      }

      toast({
        title: 'Conflict Resolved',
        description: `Applied ${resolution === 'use_local' ? 'local' : 'Xero'} version`
      })

      setSelectedConflict(null)
      loadConflicts()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      })
    } finally {
      setResolvingConflict(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Sync Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Two-Way Contact Sync</CardTitle>
          <CardDescription>
            Safely sync contacts between your app and Xero with automatic conflict detection
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              onClick={() => handlePullContacts(false)}
              disabled={syncing}
              className="w-full"
            >
              {syncing ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ArrowDownToLine className="mr-2 h-4 w-4" />
              )}
              Pull from Xero
            </Button>

            <Button
              onClick={() => handlePullContacts(true)}
              disabled={syncing}
              variant="outline"
              className="w-full"
            >
              <ArrowDownToLine className="mr-2 h-4 w-4" />
              Dry Run (Pull)
            </Button>

            <Button
              onClick={handleReconciliation}
              disabled={loadingReconciliation}
              variant="outline"
              className="w-full"
            >
              {loadingReconciliation ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <AlertCircle className="mr-2 h-4 w-4" />
              )}
              Reconciliation Report
            </Button>
          </div>

          {/* Last Sync Result */}
          {lastSyncResult && (
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <h4 className="font-semibold mb-2">Last Sync Result</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Created:</span>{' '}
                  <span className="font-medium">{lastSyncResult.stats.created}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Updated:</span>{' '}
                  <span className="font-medium">{lastSyncResult.stats.updated}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Skipped:</span>{' '}
                  <span className="font-medium">{lastSyncResult.stats.skipped}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Conflicts:</span>{' '}
                  <span className="font-medium text-destructive">{lastSyncResult.stats.conflicts}</span>
                </div>
              </div>
              {lastSyncResult.errors.length > 0 && (
                <div className="mt-2">
                  <span className="text-destructive text-sm">Errors: {lastSyncResult.errors.length}</span>
                </div>
              )}
            </div>
          )}

          {/* Reconciliation Report */}
          {reconciliationReport && (
            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <h4 className="font-semibold mb-2 flex items-center">
                <AlertCircle className="mr-2 h-4 w-4" />
                Reconciliation Report (Dry Run)
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Would Create:</span>{' '}
                  <span className="font-medium">{reconciliationReport.pull.wouldCreate}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Would Update:</span>{' '}
                  <span className="font-medium">{reconciliationReport.pull.wouldUpdate}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Conflicts:</span>{' '}
                  <span className="font-medium text-destructive">{reconciliationReport.pull.conflicts}</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Conflicts Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Sync Conflicts</CardTitle>
              <CardDescription>
                Resolve conflicts when both systems have been modified
              </CardDescription>
            </div>
            <Button
              onClick={loadConflicts}
              disabled={loadingConflicts}
              size="sm"
              variant="outline"
            >
              {loadingConflicts ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {conflicts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="mx-auto h-12 w-12 mb-2 text-green-500" />
              <p>No conflicts detected</p>
            </div>
          ) : (
            <div className="space-y-2">
              {conflicts.map((conflict) => (
                <div
                  key={conflict.id}
                  className="p-4 border rounded-lg hover:bg-muted/50 cursor-pointer"
                  onClick={() => setSelectedConflict(conflict)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                      <div>
                        <p className="font-medium">{conflict.entityName}</p>
                        <p className="text-sm text-muted-foreground">
                          {conflict.entityType} • {conflict.conflictData?.conflictFields?.length || 0} field(s) in conflict
                        </p>
                      </div>
                    </div>
                    <Badge variant="destructive">
                      <Clock className="mr-1 h-3 w-3" />
                      Needs Resolution
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Conflict Resolution Dialog */}
      <Dialog open={selectedConflict !== null} onOpenChange={() => setSelectedConflict(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Resolve Sync Conflict</DialogTitle>
            <DialogDescription>
              Choose which version to keep for {selectedConflict?.entityName}
            </DialogDescription>
          </DialogHeader>

          {selectedConflict && (
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {/* Local Version */}
                  <div className="border rounded-lg p-4">
                    <h4 className="font-semibold mb-2 flex items-center">
                      <ArrowUpFromLine className="mr-2 h-4 w-4" />
                      Local Version
                    </h4>
                    <div className="space-y-2 text-sm">
                      {selectedConflict.conflictData?.localData && 
                        Object.entries(selectedConflict.conflictData.localData).map(([key, value]) => (
                          <div key={key} className="flex justify-between">
                            <span className="text-muted-foreground">{key}:</span>
                            <span className="font-medium">{String(value)}</span>
                          </div>
                        ))
                      }
                    </div>
                  </div>

                  {/* Xero Version */}
                  <div className="border rounded-lg p-4">
                    <h4 className="font-semibold mb-2 flex items-center">
                      <ArrowDownToLine className="mr-2 h-4 w-4" />
                      Xero Version
                    </h4>
                    <div className="space-y-2 text-sm">
                      {selectedConflict.conflictData?.xeroData && 
                        Object.entries(selectedConflict.conflictData.xeroData).map(([key, value]) => (
                          <div key={key} className="flex justify-between">
                            <span className="text-muted-foreground">{key}:</span>
                            <span className="font-medium">{String(value)}</span>
                          </div>
                        ))
                      }
                    </div>
                  </div>
                </div>

                {/* Conflicting Fields */}
                {selectedConflict.conflictData?.conflictFields && (
                  <div className="p-3 bg-destructive/10 rounded-lg">
                    <p className="text-sm font-medium mb-1">Conflicting Fields:</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedConflict.conflictData.conflictFields.map((field: string) => (
                        <Badge key={field} variant="outline" className="text-destructive border-destructive">
                          {field}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSelectedConflict(null)}
              disabled={resolvingConflict}
            >
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={() => selectedConflict && handleResolveConflict(selectedConflict.id, 'use_remote')}
              disabled={resolvingConflict}
            >
              <ArrowDownToLine className="mr-2 h-4 w-4" />
              Use Xero Version
            </Button>
            <Button
              onClick={() => selectedConflict && handleResolveConflict(selectedConflict.id, 'use_local')}
              disabled={resolvingConflict}
            >
              <ArrowUpFromLine className="mr-2 h-4 w-4" />
              Use Local Version
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Field Ownership Legend */}
      <Card>
        <CardHeader>
          <CardTitle>Field Ownership Rules</CardTitle>
          <CardDescription>
            Understand which system owns which fields
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Xero Owns:</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Tax Numbers & Rates</li>
                <li>• Default Currency</li>
                <li>• Accounts Receivable/Payable Tax Types</li>
                <li>• Bank Account Details</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Web App Owns:</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Internal Notes</li>
                <li>• Client/Supplier Type</li>
                <li>• Active Status</li>
                <li>• Internal Numbering</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
