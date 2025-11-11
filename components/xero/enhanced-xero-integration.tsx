
'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  ExternalLink, 
  Download, 
  Upload,
  Loader2,
  AlertTriangle,
  Building2,
  Users,
  FileText,
  DollarSign,
  Clock,
  BarChart3,
  Settings,
  ShieldCheck,
  TrendingUp,
  ArrowUpDown,
  Calendar,
  Eye,
  Activity,
  Zap
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { eventBus, XERO_SYNC_COMPLETED, XERO_SYNC_STARTED, XERO_SYNC_ERROR } from '@/lib/events'
import { useXeroConnectionStatus } from '@/hooks/use-xero-connection-status'

interface XeroStatus {
  connected: boolean
  organisation?: {
    name: string
    shortCode: string
    countryCode: string
  }
  lastSync?: string
  error?: string
  hasPermission?: boolean
  canApprove?: boolean
  stats?: {
    clients: { total: number, synced: number, percentage: number }
    vendors: { total: number, synced: number, percentage: number }
    invoices: { total: number, synced: number, percentage: number }
    payments: { total: number, synced: number, percentage: number }
  }
  recentLogs?: XeroSyncLog[]
}

interface XeroSyncLog {
  id: string
  entity: string
  entityId: string
  syncType: string
  status: 'SUCCESS' | 'ERROR' | 'SKIPPED'
  xeroId?: string
  errorMessage?: string
  createdAt: string
}

interface SyncResult {
  success: boolean
  message: string
  syncedCount?: number
  totalCount?: number
  errors?: string[]
  error?: string
  details?: any
}

interface BackgroundSyncStatus {
  schedules: Array<{
    id: string
    active: boolean
  }>
  totalActive: number
}

export function EnhancedXeroIntegration() {
  // OPTIMIZED: Use longer polling interval to reduce server load
  const connectionStatus = useXeroConnectionStatus({
    interval: 10 * 60 * 1000, // Poll every 10 minutes (reduced from 5)
    enabled: true,
    onConnectionLost: (reason) => {
      console.log('⚠️ [Enhanced Xero Integration] Connection lost:', reason)
      fetchXeroStatus() // Refresh full status
    },
    onConnectionRestored: () => {
      console.log('✅ [Enhanced Xero Integration] Connection restored')
      fetchXeroStatus() // Refresh full status
    }
  })

  const [status, setStatus] = useState<XeroStatus>({ connected: false })
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [authLoading, setAuthLoading] = useState(false)
  const [backgroundSyncStatus, setBackgroundSyncStatus] = useState<BackgroundSyncStatus | null>(null)
  
  // Sync settings
  const [autoSync, setAutoSync] = useState(false)
  const [syncFrequency, setSyncFrequency] = useState('daily')
  const [selectedTab, setSelectedTab] = useState('overview')

  // OPTIMIZED: Load status and background sync in parallel
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // Fetch both status and background sync in parallel
        const [statusResponse, backgroundResponse] = await Promise.allSettled([
          fetch('/api/xero/enhanced-sync'),
          fetch('/api/xero/background-sync')
        ])

        // Handle status response
        if (statusResponse.status === 'fulfilled' && statusResponse.value.ok) {
          const statusData = await statusResponse.value.json()
          setStatus(statusData)
        } else {
          setStatus({ 
            connected: false, 
            error: 'Unable to check connection status',
            hasPermission: false
          })
        }

        // Handle background sync response
        if (backgroundResponse.status === 'fulfilled' && backgroundResponse.value.ok) {
          const backgroundData = await backgroundResponse.value.json()
          setBackgroundSyncStatus(backgroundData)
        }
      } catch (error) {
        console.error('Failed to fetch initial data:', error)
        setStatus({ 
          connected: false, 
          error: 'Unable to check connection status',
          hasPermission: false
        })
      } finally {
        setLoading(false)
      }
    }

    loadInitialData()
    
    // Check URL params for auth callback
    const urlParams = new URLSearchParams(window.location.search)
    const xeroStatus = urlParams.get('xero')
    const message = urlParams.get('message')
    
    if (xeroStatus === 'success') {
      toast.success('Xero integration successful!')
      window.history.replaceState({}, document.title, window.location.pathname)
      loadInitialData() // Reload data after successful auth
      connectionStatus.refresh() // Also refresh polling status
    } else if (xeroStatus === 'error' && message) {
      toast.error(`Xero integration failed: ${decodeURIComponent(message)}`)
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [])

  const fetchXeroStatus = async () => {
    try {
      const response = await fetch('/api/xero/enhanced-sync')
      const data = await response.json()
      
      if (response.ok) {
        setStatus(data)
      } else {
        setStatus({ 
          connected: false, 
          error: data.error || 'Unable to check connection status',
          hasPermission: data.hasPermission || false
        })
      }
    } catch (error) {
      console.error('Failed to fetch Xero status:', error)
      setStatus({ 
        connected: false, 
        error: 'Unable to check connection status',
        hasPermission: false
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchBackgroundSyncStatus = async () => {
    try {
      const response = await fetch('/api/xero/background-sync')
      if (response.ok) {
        const data = await response.json()
        setBackgroundSyncStatus(data)
      }
    } catch (error) {
      console.error('Failed to fetch background sync status:', error)
    }
  }

  // OPTIMIZED: Add retry logic with exponential backoff for connection reliability
  const initiateConnection = async (retryCount = 0) => {
    const maxRetries = 3
    const baseDelay = 1000 // 1 second
    
    setAuthLoading(true)
    try {
      const response = await fetch('/api/xero/authorize', {
        headers: {
          'Cache-Control': 'no-cache'
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.authUrl) {
          toast.success('Redirecting to Xero for authorization...')
          // Add small delay to ensure toast is visible
          setTimeout(() => {
            window.location.href = data.authUrl
          }, 500)
        } else {
          throw new Error(data.error || 'Failed to generate authorization URL')
        }
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to start Xero authorization')
      }
    } catch (error: any) {
      console.error(`Failed to connect to Xero (attempt ${retryCount + 1}/${maxRetries + 1}):`, error)
      
      // Retry with exponential backoff if we haven't exceeded max retries
      if (retryCount < maxRetries) {
        const delay = baseDelay * Math.pow(2, retryCount)
        toast.info(`Connection issue - retrying in ${delay / 1000} seconds...`, {
          duration: delay
        })
        
        setTimeout(() => {
          initiateConnection(retryCount + 1)
        }, delay)
      } else {
        // Max retries exceeded
        toast.error('Connection failed after multiple attempts', {
          description: error.message || 'Please check your network and try again.',
          duration: 6000
        })
        setAuthLoading(false)
      }
    }
  }

  const handleConnect = async () => {
    await initiateConnection(0)
  }

  const handleEnhancedSync = async (syncType: string, entityType?: string) => {
    // Step 1: Check if connection is active before syncing
    if (!connectionStatus.connected) {
      toast.error('⚠️ Xero is disconnected', {
        description: connectionStatus.reason || 'Please reconnect to Xero before syncing.',
        duration: 5000
      })
      return
    }

    setSyncing(true)
    
    // Emit sync started event
    eventBus.emit(XERO_SYNC_STARTED, { syncType, entityType })
    
    // Show loading message
    const loadingToastId = toast.loading(`Syncing ${entityType || 'data'} with Xero...`)
    
    try {
      console.log('🔄 Starting sync:', { syncType, entityType })
      
      const response = await fetch('/api/xero/enhanced-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncType, entityType }),
      })

      // Dismiss loading toast
      toast.dismiss(loadingToastId)

      let data: SyncResult
      
      try {
        data = await response.json()
      } catch (jsonError) {
        console.error('❌ Failed to parse JSON response:', jsonError)
        toast.error('Invalid response from server. Please try again or contact support.')
        eventBus.emit(XERO_SYNC_ERROR, { syncType, entityType, error: 'Invalid response' })
        return
      }

      if (response.ok) {
        if (data.success) {
          toast.success(data.message || 'Sync completed successfully!')
          
          // Show details if available
          if (data.syncedCount !== undefined) {
            console.log(`✅ Synced ${data.syncedCount} of ${data.totalCount || data.syncedCount} records`)
          }
          
          if (data.errors && data.errors.length > 0) {
            console.warn('⚠️ Sync completed with errors:', data.errors)
            toast.warning(`Sync completed with ${data.errors.length} error(s). Check console for details.`)
          }
          
          // Emit sync completed event
          eventBus.emit(XERO_SYNC_COMPLETED, { 
            syncType, 
            entityType, 
            syncedCount: data.syncedCount, 
            totalCount: data.totalCount 
          })
          
          // Show refresh notification
          toast.success('✅ Data refreshed — latest Xero records synced.', {
            duration: 3000
          })
          
          // Refresh status after successful sync
          fetchXeroStatus()
        } else {
          toast.error(data.message || 'Sync operation failed. Please try again.')
          eventBus.emit(XERO_SYNC_ERROR, { syncType, entityType, error: data.message })
        }
      } else {
        // Handle HTTP error responses
        console.error('❌ Sync request failed:', { 
          status: response.status, 
          statusText: response.statusText,
          error: data.error,
          message: data.message 
        })
        
        // Show user-friendly error message
        if (response.status === 401) {
          toast.error('Authentication required. Please log in again.')
        } else if (response.status === 403) {
          toast.error(data.message || 'You do not have permission to perform this action.')
        } else if (response.status === 400) {
          toast.error(data.message || 'Invalid request. Please check your Xero connection.')
        } else if (response.status === 501) {
          toast.info(data.message || 'This feature is coming soon!')
        } else if (response.status >= 500) {
          toast.error('Server error. Please try again later or contact support.')
        } else {
          toast.error(data.message || `Sync failed with status ${response.status}`)
          eventBus.emit(XERO_SYNC_ERROR, { syncType, entityType, error: data.message || `HTTP ${response.status}` })
        }
      }
    } catch (error: any) {
      console.error('❌ Enhanced sync request failed:', error)
      toast.dismiss(loadingToastId)
      
      // Show user-friendly error based on error type
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        toast.error('Network error. Please check your internet connection.')
        eventBus.emit(XERO_SYNC_ERROR, { syncType, entityType, error: 'Network error' })
      } else {
        toast.error(error.message || 'Sync request failed. Please check your Xero connection and try again.')
        eventBus.emit(XERO_SYNC_ERROR, { syncType, entityType, error: error.message || 'Unknown error' })
      }
    } finally {
      setSyncing(false)
    }
  }

  const handleTestConnection = async () => {
    setLoading(true)
    
    const loadingToastId = toast.loading('Testing Xero connection...')
    
    try {
      const response = await fetch('/api/xero/enhanced-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncType: 'test_connection' }),
      })
      
      toast.dismiss(loadingToastId)
      
      let data
      try {
        data = await response.json()
      } catch (jsonError) {
        console.error('❌ Failed to parse JSON response:', jsonError)
        toast.error('Invalid response from server. Please try again.')
        return
      }
      
      if (response.ok) {
        if (data.success) {
          const orgName = data.organisation?.name || 'Xero'
          toast.success(`✅ Connection successful! Connected to ${orgName}`)
          fetchXeroStatus()
        } else {
          toast.error(data.message || 'Connection test failed')
        }
      } else {
        console.error('❌ Connection test failed:', { status: response.status, data })
        toast.error(data.message || 'Connection test failed. Please check your Xero connection.')
      }
    } catch (error: any) {
      console.error('❌ Connection test error:', error)
      toast.dismiss(loadingToastId)
      
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        toast.error('Network error. Please check your internet connection.')
      } else {
        toast.error('Connection test failed. Please check your network and try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleBackgroundSyncToggle = async (enabled: boolean) => {
    try {
      const response = await fetch('/api/xero/background-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: enabled ? 'initialize' : 'stop_all'
        }),
      })

      if (response.ok) {
        const data = await response.json()
        toast.success(data.message)
        setAutoSync(enabled)
        fetchBackgroundSyncStatus()
      } else {
        const errorData = await response.json()
        toast.error(errorData.message)
      }
    } catch (error) {
      toast.error('Failed to update background sync settings')
    }
  }

  // Permission checks
  if (!status.hasPermission) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Building2 className="mr-2 h-5 w-5" />
            Xero Integration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <ShieldCheck className="h-4 w-4" />
            <AlertDescription>
              You don't have permission to access Xero integration. Please contact your system administrator.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Building2 className="mr-2 h-5 w-5" />
            Enhanced Xero Integration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading Xero status...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Connection Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Building2 className="mr-2 h-5 w-5" />
              <div>
                <CardTitle>Enhanced Xero Integration</CardTitle>
                <CardDescription>
                  Comprehensive two-way sync between your business management system and Xero
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {/* Real-time connection status from polling hook */}
              {connectionStatus.checking ? (
                <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  Checking...
                </Badge>
              ) : connectionStatus.connected ? (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  <CheckCircle className="mr-1 h-3 w-3" />
                  Connected
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                  <XCircle className="mr-1 h-3 w-3" />
                  Disconnected
                </Badge>
              )}
              {connectionStatus.lastChecked && (
                <span className="text-xs text-muted-foreground">
                  Last checked: {format(connectionStatus.lastChecked, 'HH:mm:ss')}
                </span>
              )}
              {status.canApprove && (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  <ShieldCheck className="mr-1 h-3 w-3" />
                  Admin
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!connectionStatus.connected ? (
            <div className="space-y-4">
              {connectionStatus.tokenExpired ? (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Your Xero connection has expired. Please reconnect to continue syncing data.
                  </AlertDescription>
                </Alert>
              ) : connectionStatus.reason ? (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    {connectionStatus.reason}
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Connect your Xero account to enable automatic two-way sync of clients, vendors, invoices, payments, and project transactions.
                  </AlertDescription>
                </Alert>
              )}
              <Button 
                onClick={handleConnect}
                disabled={authLoading}
                className="w-full"
                size="lg"
              >
                {authLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Connect to Xero
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {status.organisation && (
                <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                  <div>
                    <h4 className="font-medium text-green-900">Connected Organisation</h4>
                    <p className="text-sm text-green-700">
                      {status.organisation.name} ({status.organisation.countryCode})
                    </p>
                    {status.lastSync && (
                      <p className="text-xs text-green-600">
                        Last sync: {format(new Date(status.lastSync), 'MMM dd, yyyy HH:mm')}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleTestConnection}
                    disabled={loading}
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              )}

              {status.error && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>{status.error}</AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Integration Tabs */}
      {status.connected && (
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="sync">Data Sync</TabsTrigger>
            <TabsTrigger value="automation">Automation</TabsTrigger>
            <TabsTrigger value="logs">Sync Logs</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            {/* Sync Statistics */}
            {status.stats && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <BarChart3 className="mr-2 h-5 w-5" />
                    Sync Statistics
                  </CardTitle>
                  <CardDescription>
                    Data synchronization status across all entity types
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <Users className="h-4 w-4 text-blue-600 mr-1" />
                          <span className="text-sm font-medium">Clients</span>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {status.stats.clients.synced}/{status.stats.clients.total}
                        </span>
                      </div>
                      <Progress value={status.stats.clients.percentage} className="h-2" />
                      <p className="text-xs text-muted-foreground">
                        {status.stats.clients.percentage}% synced
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <Building2 className="h-4 w-4 text-green-600 mr-1" />
                          <span className="text-sm font-medium">Vendors</span>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {status.stats.vendors.synced}/{status.stats.vendors.total}
                        </span>
                      </div>
                      <Progress value={status.stats.vendors.percentage} className="h-2" />
                      <p className="text-xs text-muted-foreground">
                        {status.stats.vendors.percentage}% synced
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <FileText className="h-4 w-4 text-purple-600 mr-1" />
                          <span className="text-sm font-medium">Invoices</span>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {status.stats.invoices.synced}/{status.stats.invoices.total}
                        </span>
                      </div>
                      <Progress value={status.stats.invoices.percentage} className="h-2" />
                      <p className="text-xs text-muted-foreground">
                        {status.stats.invoices.percentage}% synced
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <DollarSign className="h-4 w-4 text-orange-600 mr-1" />
                          <span className="text-sm font-medium">Payments</span>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {status.stats.payments.synced}/{status.stats.payments.total}
                        </span>
                      </div>
                      <Progress value={status.stats.payments.percentage} className="h-2" />
                      <p className="text-xs text-muted-foreground">
                        {status.stats.payments.percentage}% synced
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>
                  Common sync operations and maintenance tasks
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <Button
                    variant="outline"
                    onClick={() => handleEnhancedSync('full_sync')}
                    disabled={syncing}
                    className="flex items-center justify-center h-16"
                  >
                    {syncing ? (
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-5 w-5" />
                    )}
                    <div className="text-left">
                      <div className="font-medium">Full Sync</div>
                      <div className="text-xs text-muted-foreground">Sync all data types</div>
                    </div>
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => handleEnhancedSync('bidirectional_sync', 'contacts')}
                    disabled={syncing}
                    className="flex items-center justify-center h-16"
                  >
                    {syncing ? (
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    ) : (
                      <ArrowUpDown className="mr-2 h-5 w-5" />
                    )}
                    <div className="text-left">
                      <div className="font-medium">Sync Contacts</div>
                      <div className="text-xs text-muted-foreground">Clients & vendors</div>
                    </div>
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => handleEnhancedSync('push_to_xero', 'transactions')}
                    disabled={syncing}
                    className="flex items-center justify-center h-16"
                  >
                    {syncing ? (
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    ) : (
                      <TrendingUp className="mr-2 h-5 w-5" />
                    )}
                    <div className="text-left">
                      <div className="font-medium">Push Transactions</div>
                      <div className="text-xs text-muted-foreground">Project finance to Xero</div>
                    </div>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sync" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Manual Data Synchronization</CardTitle>
                <CardDescription>
                  Control data flow between your app and Xero with precision
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Push to Xero */}
                <div className="space-y-4">
                  <h4 className="font-medium flex items-center">
                    <Upload className="mr-2 h-4 w-4 text-blue-600" />
                    Push to Xero (App → Xero)
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { key: 'clients', label: 'Clients', icon: Users },
                      { key: 'invoices', label: 'Invoices', icon: FileText },
                      { key: 'payments', label: 'Payments', icon: DollarSign },
                      { key: 'transactions', label: 'Project Transactions', icon: TrendingUp }
                    ].map((item) => (
                      <Button
                        key={item.key}
                        variant="outline"
                        onClick={() => handleEnhancedSync('push_to_xero', item.key)}
                        disabled={syncing}
                        className="flex items-center justify-start"
                      >
                        {syncing ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <item.icon className="mr-2 h-4 w-4" />
                        )}
                        Export {item.label}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Pull from Xero */}
                <div className="space-y-4">
                  <h4 className="font-medium flex items-center">
                    <Download className="mr-2 h-4 w-4 text-green-600" />
                    Pull from Xero (Xero → App)
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { key: 'contacts', label: 'Contacts', icon: Users },
                      { key: 'invoices', label: 'Invoices', icon: FileText },
                      { key: 'payments', label: 'Payments', icon: DollarSign }
                    ].map((item) => (
                      <Button
                        key={item.key}
                        variant="outline"
                        onClick={() => handleEnhancedSync('pull_from_xero', item.key)}
                        disabled={syncing}
                        className="flex items-center justify-start"
                      >
                        {syncing ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <item.icon className="mr-2 h-4 w-4" />
                        )}
                        Import {item.label}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Bidirectional Sync */}
                <div className="space-y-4">
                  <h4 className="font-medium flex items-center">
                    <ArrowUpDown className="mr-2 h-4 w-4 text-purple-600" />
                    Two-Way Sync (App ↔ Xero)
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { key: 'contacts', label: 'Contacts', icon: Users },
                      { key: 'invoices', label: 'Invoices', icon: FileText },
                      { key: 'payments', label: 'Payments', icon: DollarSign }
                    ].map((item) => (
                      <Button
                        key={item.key}
                        variant="outline"
                        onClick={() => handleEnhancedSync('bidirectional_sync', item.key)}
                        disabled={syncing}
                        className="flex items-center justify-start"
                      >
                        {syncing ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <item.icon className="mr-2 h-4 w-4" />
                        )}
                        Sync {item.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="automation" className="space-y-4">
            {status.canApprove ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Zap className="mr-2 h-5 w-5" />
                    Automated Background Sync
                  </CardTitle>
                  <CardDescription>
                    Configure automatic data synchronization schedules
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="auto-sync">Enable Background Sync</Label>
                      <p className="text-sm text-muted-foreground">
                        Automatically sync data at regular intervals
                      </p>
                    </div>
                    <Switch
                      id="auto-sync"
                      checked={autoSync}
                      onCheckedChange={handleBackgroundSyncToggle}
                    />
                  </div>

                  {autoSync && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Default Sync Frequency</Label>
                        <Select value={syncFrequency} onValueChange={setSyncFrequency}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="hourly">Every Hour</SelectItem>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {backgroundSyncStatus && (
                        <div className="p-4 bg-blue-50 rounded-lg">
                          <h5 className="font-medium text-blue-900 mb-2">Background Sync Status</h5>
                          <p className="text-sm text-blue-700">
                            {backgroundSyncStatus.totalActive} active schedules running
                          </p>
                          <div className="mt-2 space-y-1">
                            {backgroundSyncStatus.schedules.map((schedule) => (
                              <div key={schedule.id} className="flex items-center text-xs">
                                <div className={`w-2 h-2 rounded-full mr-2 ${
                                  schedule.active ? 'bg-green-500' : 'bg-gray-300'
                                }`} />
                                <span>{schedule.id}</span>
                                {schedule.active && <Badge variant="outline" className="ml-2">Active</Badge>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="flex items-center justify-center h-32">
                  <div className="text-center">
                    <ShieldCheck className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Background sync management requires admin privileges
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="logs" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Activity className="mr-2 h-5 w-5" />
                  Sync Activity Log
                </CardTitle>
                <CardDescription>
                  Recent synchronization activities and their status
                </CardDescription>
              </CardHeader>
              <CardContent>
                {status.recentLogs && status.recentLogs.length > 0 ? (
                  <div className="space-y-3">
                    {status.recentLogs.map((log) => (
                      <div 
                        key={log.id} 
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex items-center space-x-3">
                          {log.status === 'SUCCESS' ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : log.status === 'ERROR' ? (
                            <XCircle className="h-4 w-4 text-red-600" />
                          ) : (
                            <Clock className="h-4 w-4 text-yellow-600" />
                          )}
                          <div>
                            <div className="text-sm font-medium">
                              {log.entity} {log.syncType}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {log.errorMessage || 'Sync completed successfully'}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(log.createdAt), 'MMM dd, HH:mm')}
                          </div>
                          <Badge 
                            variant="outline" 
                            className={
                              log.status === 'SUCCESS' 
                                ? 'border-green-200 text-green-700' 
                                : log.status === 'ERROR'
                                ? 'border-red-200 text-red-700'
                                : 'border-yellow-200 text-yellow-700'
                            }
                          >
                            {log.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Activity className="mx-auto h-8 w-8 mb-2 opacity-50" />
                    <p>No sync activity yet</p>
                    <p className="text-sm">Sync logs will appear here after your first sync operation</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Settings className="mr-2 h-5 w-5" />
                  Integration Settings
                </CardTitle>
                <CardDescription>
                  Configure sync preferences and manage your connection
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h5 className="font-medium">Connection Test</h5>
                    <p className="text-sm text-muted-foreground">
                      Verify your connection to Xero and check organisation details
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={handleTestConnection}
                    disabled={loading}
                  >
                    {loading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    Test Connection
                  </Button>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h5 className="font-medium">View Sync Statistics</h5>
                    <p className="text-sm text-muted-foreground">
                      Get detailed statistics about your data synchronization
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => handleEnhancedSync('get_sync_stats')}
                  >
                    <BarChart3 className="mr-2 h-4 w-4" />
                    View Stats
                  </Button>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h5 className="font-medium">Sync History</h5>
                    <p className="text-sm text-muted-foreground">
                      View detailed logs of all sync operations
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => handleEnhancedSync('get_sync_logs')}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    View Logs
                  </Button>
                </div>

                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Data Safety:</strong> All sync operations maintain data integrity and include error handling. 
                    Original data is never lost during synchronization.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
