
'use client'

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  RefreshCw, 
  Zap, 
  Users, 
  Building2, 
  FileText, 
  CreditCard,
  CheckCircle,
  AlertTriangle,
  Clock,
  XCircle,
  Download,
  Upload,
  Loader2,
  ArrowLeftRight,
  ArrowDown,
  ArrowUp,
  AlertCircle
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface SyncStatus {
  clients: {
    total: number
    synced: number
    unsynced: number
    syncPercentage: number
  }
  vendors: {
    total: number
    synced: number
    unsynced: number
    syncPercentage: number
  }
  invoices: {
    total: number
    synced: number
    unsynced: number
    syncPercentage: number
  }
  payments: {
    total: number
    synced: number
    unsynced: number
    syncPercentage: number
  }
  conflicts?: {
    total: number
  }
}

export function XeroSyncManager() {
  const { toast } = useToast()
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState<Record<string, boolean>>({})
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)
  const [syncDirection, setSyncDirection] = useState<'to_xero' | 'from_xero' | 'bidirectional'>('to_xero')

  // Fetch sync status
  const fetchSyncStatus = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/finance/sync/bulk')
      
      if (!response.ok) {
        throw new Error('Failed to fetch sync status')
      }

      const data = await response.json()
      setSyncStatus(data)
      setLastSyncTime(new Date())
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to fetch sync status",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // Sync specific entity type
  const syncEntity = async (entityType: string, bulkSync: boolean = true, direction?: string) => {
    try {
      setSyncing(prev => ({ ...prev, [entityType]: true }))
      
      let endpoint = ''
      let payload: any = { bulkSync, direction: direction || syncDirection }
      
      switch (entityType) {
        case 'clients':
          endpoint = '/api/finance/sync/clients'
          break
        case 'vendors':
          endpoint = '/api/finance/sync/vendors'
          break
        case 'invoices':
          endpoint = '/api/finance/sync/invoices'
          payload.type = 'client' // Default to client invoices
          break
        case 'payments':
          // Payment sync only supports importing from Xero for now
          if (direction === 'to_xero' || syncDirection === 'to_xero') {
            toast({
              title: "Info",
              description: "Payment sync to Xero is available per-payment only",
              variant: "default",
            })
            return
          }
          endpoint = '/api/finance/sync/import-from-xero'
          payload = { entity: 'payments' }
          break
        default:
          throw new Error('Invalid entity type')
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Sync failed')
      }

      const result = await response.json()
      
      // Show different messages based on conflicts
      let title = "Sync Successful"
      let variant: "default" | "destructive" = "default"
      let description = result.message

      if (result.conflicts && result.conflicts.length > 0) {
        title = "Sync Completed with Conflicts"
        description = `${result.message}. ${result.conflicts.length} conflicts require review.`
        variant = "default"
      }

      toast({
        title,
        description,
        variant,
      })

      // Refresh status after sync
      await fetchSyncStatus()
    } catch (error: any) {
      toast({
        title: "Sync Failed",
        description: error.message || "An error occurred during sync",
        variant: "destructive",
      })
    } finally {
      setSyncing(prev => ({ ...prev, [entityType]: false }))
    }
  }

  // Bulk sync all entities
  const syncAll = async () => {
    try {
      setSyncing({ all: true })
      
      const types = syncDirection === 'from_xero' 
        ? ['contacts', 'invoices', 'bills', 'payments']
        : ['clients', 'vendors', 'invoices']

      const response = await fetch('/api/finance/sync/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          types,
          direction: syncDirection
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Bulk sync failed')
      }

      const result = await response.json()
      
      let title = result.success ? "Bulk Sync Successful" : "Partial Sync Completed"
      let description = result.message
      
      // Handle conflicts in bulk sync
      if (result.totalConflicts && result.totalConflicts > 0) {
        title = "Bulk Sync Completed with Conflicts"
        description = `${result.message}. Review conflicts in the Conflicts tab.`
      }
      
      toast({
        title,
        description,
        variant: result.success ? "default" : "destructive",
      })

      // Show detailed results if there were issues
      if (!result.success && result.results) {
        console.log('Sync results:', result.results)
      }

      // Refresh status after sync
      await fetchSyncStatus()
    } catch (error: any) {
      toast({
        title: "Bulk Sync Failed",
        description: error.message || "An error occurred during bulk sync",
        variant: "destructive",
      })
    } finally {
      setSyncing({ all: false })
    }
  }

  // Import bills from Xero (only available in from_xero direction)
  const importBills = async () => {
    try {
      setSyncing(prev => ({ ...prev, bills: true }))
      
      const response = await fetch('/api/finance/sync/import-from-xero', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ entity: 'bills' }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Import failed')
      }

      const result = await response.json()
      
      let title = "Bills Import Successful"
      let description = result.message

      if (result.conflicts && result.conflicts.length > 0) {
        title = "Bills Import Completed with Conflicts"
        description = `${result.message}. ${result.conflicts.length} conflicts require review.`
      }

      toast({
        title,
        description,
        variant: "default",
      })

      await fetchSyncStatus()
    } catch (error: any) {
      toast({
        title: "Import Failed",
        description: error.message || "Failed to import bills from Xero",
        variant: "destructive",
      })
    } finally {
      setSyncing(prev => ({ ...prev, bills: false }))
    }
  }

  // Initial load
  useEffect(() => {
    fetchSyncStatus()
  }, [])

  if (loading && !syncStatus) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="flex items-center space-x-2">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>Loading sync status...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  const getSyncStatusColor = (percentage: number) => {
    if (percentage === 100) return 'text-green-600'
    if (percentage >= 50) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getSyncStatusIcon = (percentage: number) => {
    if (percentage === 100) return <CheckCircle className="h-5 w-5 text-green-600" />
    if (percentage >= 50) return <Clock className="h-5 w-5 text-yellow-600" />
    return <AlertTriangle className="h-5 w-5 text-red-600" />
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center">
                <Zap className="mr-2 h-5 w-5" />
                Xero Sync Manager
              </CardTitle>
              <CardDescription>
                Bidirectional data synchronization between Finance module and Xero with conflict detection
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              {lastSyncTime && (
                <span className="text-sm text-gray-500">
                  Last updated: {lastSyncTime.toLocaleTimeString()}
                </span>
              )}
              <Button 
                variant="outline" 
                onClick={fetchSyncStatus}
                disabled={loading}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Sync Direction Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Sync Direction</CardTitle>
          <CardDescription>
            Choose the data flow direction for synchronization operations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <Button
              variant={syncDirection === 'to_xero' ? 'default' : 'outline'}
              onClick={() => setSyncDirection('to_xero')}
              className="flex-1"
            >
              <ArrowUp className="mr-2 h-4 w-4" />
              Finance → Xero
            </Button>
            <Button
              variant={syncDirection === 'from_xero' ? 'default' : 'outline'}
              onClick={() => setSyncDirection('from_xero')}
              className="flex-1"
            >
              <ArrowDown className="mr-2 h-4 w-4" />
              Finance ← Xero
            </Button>
            <Button
              variant={syncDirection === 'bidirectional' ? 'default' : 'outline'}
              onClick={() => setSyncDirection('bidirectional')}
              className="flex-1"
            >
              <ArrowLeftRight className="mr-2 h-4 w-4" />
              Bidirectional
            </Button>
          </div>
          <p className="text-sm text-gray-600 mt-3">
            {syncDirection === 'to_xero' && 'Push unsynced Finance data to Xero (one-way)'}
            {syncDirection === 'from_xero' && 'Import data from Xero to Finance (one-way, with conflict detection)'}
            {syncDirection === 'bidirectional' && 'Two-way sync with automatic conflict detection and resolution options'}
          </p>
        </CardContent>
      </Card>

      {/* Conflicts Alert */}
      {syncStatus?.conflicts && syncStatus.conflicts.total > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Attention:</strong> {syncStatus.conflicts.total} sync conflicts require review. 
            Check the "Conflicts" tab to resolve them.
          </AlertDescription>
        </Alert>
      )}

      {syncStatus && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Clients Sync Status */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Clients</CardTitle>
              <Building2 className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-2">
                <div className="text-2xl font-bold">{syncStatus.clients.synced}</div>
                {getSyncStatusIcon(syncStatus.clients.syncPercentage)}
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                of {syncStatus.clients.total} synced
              </p>
              <Progress 
                value={syncStatus.clients.syncPercentage} 
                className="h-2 mb-3" 
              />
              <Button 
                size="sm" 
                className="w-full"
                onClick={() => syncEntity('clients')}
                disabled={syncing.clients || syncing.all}
              >
                {syncing.clients ? (
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                ) : syncDirection === 'from_xero' ? (
                  <Download className="mr-2 h-3 w-3" />
                ) : syncDirection === 'bidirectional' ? (
                  <ArrowLeftRight className="mr-2 h-3 w-3" />
                ) : (
                  <Upload className="mr-2 h-3 w-3" />
                )}
                {syncDirection === 'from_xero' ? 'Import' : 'Sync'} Clients
              </Button>
            </CardContent>
          </Card>

          {/* Vendors Sync Status */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Vendors</CardTitle>
              <Users className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-2">
                <div className="text-2xl font-bold">{syncStatus.vendors.synced}</div>
                {getSyncStatusIcon(syncStatus.vendors.syncPercentage)}
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                of {syncStatus.vendors.total} synced
              </p>
              <Progress 
                value={syncStatus.vendors.syncPercentage} 
                className="h-2 mb-3" 
              />
              <Button 
                size="sm" 
                className="w-full"
                onClick={() => syncEntity('vendors')}
                disabled={syncing.vendors || syncing.all}
              >
                {syncing.vendors ? (
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                ) : syncDirection === 'from_xero' ? (
                  <Download className="mr-2 h-3 w-3" />
                ) : syncDirection === 'bidirectional' ? (
                  <ArrowLeftRight className="mr-2 h-3 w-3" />
                ) : (
                  <Upload className="mr-2 h-3 w-3" />
                )}
                {syncDirection === 'from_xero' ? 'Import' : 'Sync'} Vendors
              </Button>
            </CardContent>
          </Card>

          {/* Invoices Sync Status */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Invoices</CardTitle>
              <FileText className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-2">
                <div className="text-2xl font-bold">{syncStatus.invoices.synced}</div>
                {getSyncStatusIcon(syncStatus.invoices.syncPercentage)}
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                of {syncStatus.invoices.total} synced
              </p>
              <Progress 
                value={syncStatus.invoices.syncPercentage} 
                className="h-2 mb-3" 
              />
              <Button 
                size="sm" 
                className="w-full"
                onClick={() => syncEntity('invoices')}
                disabled={syncing.invoices || syncing.all}
              >
                {syncing.invoices ? (
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                ) : syncDirection === 'from_xero' ? (
                  <Download className="mr-2 h-3 w-3" />
                ) : syncDirection === 'bidirectional' ? (
                  <ArrowLeftRight className="mr-2 h-3 w-3" />
                ) : (
                  <Upload className="mr-2 h-3 w-3" />
                )}
                {syncDirection === 'from_xero' ? 'Import' : 'Sync'} Invoices
              </Button>
            </CardContent>
          </Card>

          {/* Payments Sync Status */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Payments</CardTitle>
              <CreditCard className="h-4 w-4 text-indigo-600" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-2">
                <div className="text-2xl font-bold">{syncStatus.payments.synced}</div>
                {getSyncStatusIcon(syncStatus.payments.syncPercentage)}
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                of {syncStatus.payments.total} synced
              </p>
              <Progress 
                value={syncStatus.payments.syncPercentage} 
                className="h-2 mb-3" 
              />
              <Button 
                size="sm" 
                className="w-full"
                onClick={() => syncEntity('payments')}
                disabled={syncing.payments || syncing.all || syncDirection === 'to_xero'}
                variant={syncDirection === 'to_xero' ? 'outline' : 'default'}
              >
                {syncing.payments ? (
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                ) : syncDirection === 'to_xero' ? (
                  <CreditCard className="mr-2 h-3 w-3" />
                ) : (
                  <Download className="mr-2 h-3 w-3" />
                )}
                {syncDirection === 'to_xero' ? 'Per Payment' : 'Import Payments'}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Bills Import (only show when importing from Xero) */}
      {(syncDirection === 'from_xero' || syncDirection === 'bidirectional') && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileText className="mr-2 h-5 w-5 text-orange-600" />
              Import Bills from Xero
            </CardTitle>
            <CardDescription>
              Import purchase invoices (bills) from Xero to Finance module
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h4 className="text-sm font-medium">Vendor Bills (Purchase Invoices)</h4>
                <p className="text-sm text-muted-foreground">
                  Import vendor bills from Xero and create corresponding vendor invoices in Finance
                </p>
              </div>
              <Button 
                onClick={importBills}
                disabled={syncing.bills}
                className="ml-4"
              >
                {syncing.bills ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Import Bills
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bulk Sync Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Bulk Sync Operations</CardTitle>
          <CardDescription>
            {syncDirection === 'to_xero' && 'Push all unsynced Finance data to Xero in the correct order'}
            {syncDirection === 'from_xero' && 'Import all data from Xero to Finance with conflict detection'}
            {syncDirection === 'bidirectional' && 'Perform two-way synchronization with automatic conflict detection'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h4 className="text-sm font-medium">
                {syncDirection === 'to_xero' && 'Export All Finance Data'}
                {syncDirection === 'from_xero' && 'Import All Xero Data'}
                {syncDirection === 'bidirectional' && 'Bidirectional Sync All'}
              </h4>
              <p className="text-sm text-muted-foreground">
                {syncDirection === 'to_xero' && 'Push clients, vendors, and invoices to Xero to ensure proper dependencies'}
                {syncDirection === 'from_xero' && 'Import contacts, invoices, bills, and payments from Xero with conflict detection'}
                {syncDirection === 'bidirectional' && 'Synchronize all data in both directions with intelligent conflict resolution'}
              </p>
            </div>
            <Button 
              onClick={syncAll}
              disabled={syncing.all}
              className="ml-4"
            >
              {syncing.all ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : syncDirection === 'from_xero' ? (
                <Download className="mr-2 h-4 w-4" />
              ) : syncDirection === 'bidirectional' ? (
                <ArrowLeftRight className="mr-2 h-4 w-4" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              {syncDirection === 'from_xero' ? 'Import All' : syncDirection === 'bidirectional' ? 'Sync All' : 'Export All'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sync Guidelines */}
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <strong>Phase 4 - Bidirectional Sync:</strong>
          {syncDirection === 'to_xero' && ' Data flows one-way from Finance to Xero. Make updates in Finance module to maintain consistency.'}
          {syncDirection === 'from_xero' && ' Data flows one-way from Xero to Finance. Conflicts are automatically detected and flagged for review.'}
          {syncDirection === 'bidirectional' && ' Two-way sync with conflict detection. When the same record is updated in both systems, conflicts are flagged for manual resolution.'}
        </AlertDescription>
      </Alert>
    </div>
  )
}
