

'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  ExternalLink, 
  Loader2,
  AlertTriangle,
  Building2,
  Shield,
  Clock,
  Unlink,
  Link,
  Settings
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'

interface XeroConnectionStatus {
  connected: boolean
  organisation?: {
    name: string
    shortCode: string
    countryCode: string
    baseCurrency: string
  }
  connection?: {
    connectedAt: string
    lastSyncAt?: string
    tenantId: string
    expiresAt: string
  }
  user?: {
    canManage: boolean
    role: string
  }
  error?: string
}

export function XeroConnectionManager() {
  const { data: session } = useSession()
  const [status, setStatus] = useState<XeroConnectionStatus>({ connected: false })
  const [loading, setLoading] = useState(true)
  const [authLoading, setAuthLoading] = useState(false)
  const [disconnectLoading, setDisconnectLoading] = useState(false)
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false)

  useEffect(() => {
    fetchConnectionStatus()
    
    // Check URL params for auth callback status
    const urlParams = new URLSearchParams(window.location.search)
    const xeroStatus = urlParams.get('xero')
    const message = urlParams.get('message')
    
    if (xeroStatus === 'success') {
      toast.success('Xero connection established successfully!')
      window.history.replaceState({}, document.title, window.location.pathname)
      fetchConnectionStatus()
    } else if (xeroStatus === 'error' && message) {
      const decodedMessage = decodeURIComponent(message)
      
      // Provide clearer, more actionable error messages
      let errorMessage = decodedMessage
      
      // Check for specific error types and provide actionable guidance
      if (decodedMessage.includes('token') || decodedMessage.includes('access_token')) {
        errorMessage = 'Xero connection failed – please check credentials and redirect URI. ' +
          'Ensure the redirect URI in Xero Developer Portal exactly matches: https://ampere.abacusai.app/api/xero/callback'
      } else if (decodedMessage.includes('redirect') || decodedMessage.includes('URI')) {
        errorMessage = 'Redirect URI mismatch – please verify that your Xero Developer Portal ' +
          'has the exact redirect URI: https://ampere.abacusai.app/api/xero/callback (no trailing slash)'
      } else if (decodedMessage.includes('credentials') || decodedMessage.includes('Client')) {
        errorMessage = 'Xero credentials error – please verify your Client ID and Client Secret in settings'
      } else if (decodedMessage.includes('Missing auth code') || decodedMessage.includes('authorization')) {
        errorMessage = 'OAuth authorization incomplete – please try connecting again and complete the Xero login flow'
      }
      
      toast.error(errorMessage, { duration: 8000 })
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [])

  const fetchConnectionStatus = async () => {
    try {
      const response = await fetch('/api/xero/connection-status')
      
      if (response.ok) {
        const data = await response.json()
        setStatus(data)
      } else {
        const errorData = await response.json()
        setStatus({ 
          connected: false, 
          error: errorData.error || 'Unable to check connection status',
          user: errorData.user
        })
      }
    } catch (error) {
      console.error('Failed to fetch Xero connection status:', error)
      setStatus({ 
        connected: false, 
        error: 'Network error - unable to check connection status'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleConnect = async () => {
    if (!status.user?.canManage) {
      toast.error('You do not have permission to manage Xero integration')
      return
    }

    setAuthLoading(true)
    try {
      const response = await fetch('/api/xero/connect')
      
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.authUrl) {
          toast.success('Redirecting to Xero for authorization...')
          window.location.href = data.authUrl
        } else {
          toast.error(data.error || 'Failed to generate authorization URL')
        }
      } else {
        const errorData = await response.json()
        toast.error(errorData.error || 'Failed to start Xero authorization')
      }
    } catch (error) {
      console.error('Failed to connect to Xero:', error)
      toast.error('Connection failed - please try again')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleDisconnect = async () => {
    if (!status.user?.canManage) {
      toast.error('You do not have permission to manage Xero integration')
      return
    }

    setDisconnectLoading(true)
    try {
      const response = await fetch('/api/xero/disconnect', {
        method: 'POST'
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          toast.success(data.message || 'Successfully disconnected from Xero')
          setShowDisconnectDialog(false)
          fetchConnectionStatus()
        } else {
          toast.error(data.error || data.message || 'Failed to disconnect')
        }
      } else {
        const errorData = await response.json()
        toast.error(errorData.error || 'Failed to disconnect from Xero')
      }
    } catch (error) {
      console.error('Failed to disconnect from Xero:', error)
      toast.error('Disconnect failed - please try again')
    } finally {
      setDisconnectLoading(false)
    }
  }

  const handleTestConnection = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/xero/test-connection', {
        method: 'POST'
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          toast.success(`Connection test successful! Connected to ${data.organisation?.name || 'Xero'}`)
          fetchConnectionStatus()
        } else {
          toast.error(data.message || 'Connection test failed')
        }
      } else {
        const errorData = await response.json()
        toast.error(errorData.message || 'Connection test failed')
      }
    } catch (error) {
      console.error('Connection test failed:', error)
      toast.error('Connection test failed - please check your network')
    } finally {
      setLoading(false)
    }
  }

  const getTokenStatus = () => {
    if (!status.connection?.expiresAt) return null
    
    const expiresAt = new Date(status.connection.expiresAt)
    const now = new Date()
    const hoursUntilExpiry = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60))
    
    if (hoursUntilExpiry < 0) {
      return { status: 'expired', message: 'Token expired', color: 'text-red-600' }
    } else if (hoursUntilExpiry < 24) {
      return { status: 'expiring', message: `Expires in ${hoursUntilExpiry}h`, color: 'text-yellow-600' }
    } else {
      return { status: 'valid', message: `Valid for ${Math.floor(hoursUntilExpiry / 24)}d`, color: 'text-green-600' }
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Building2 className="mr-2 h-5 w-5" />
            Xero Connection
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span>Checking Xero connection status...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  const tokenStatus = getTokenStatus()

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Building2 className="mr-2 h-5 w-5" />
            <div>
              <CardTitle>Xero Connection</CardTitle>
              <CardDescription>
                Manage your Xero accounting system integration
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {status.connected ? (
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
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Permission Check */}
        {!status.user?.canManage && (
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              You need Super Admin or Finance role to manage Xero integration. Your current role: {status.user?.role || 'Unknown'}
            </AlertDescription>
          </Alert>
        )}

        {/* Connection Status */}
        {!status.connected ? (
          <div className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Connect your Xero account to automatically sync clients, vendors, invoices, and payments between systems.
              </AlertDescription>
            </Alert>
            
            {status.error && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>{status.error}</AlertDescription>
              </Alert>
            )}

            <Button 
              onClick={handleConnect}
              disabled={authLoading || !status.user?.canManage}
              className="w-full"
              size="lg"
            >
              {authLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting to Xero...
                </>
              ) : (
                <>
                  <Link className="mr-2 h-4 w-4" />
                  Connect to Xero
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Connected Organisation Info */}
            {status.organisation && (
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-semibold text-green-900 flex items-center">
                      <Building2 className="mr-2 h-4 w-4" />
                      {status.organisation.name}
                    </h4>
                    <p className="text-sm text-green-700 mt-1">
                      Country: {status.organisation.countryCode} • 
                      Currency: {status.organisation.baseCurrency || 'N/A'} • 
                      Code: {status.organisation.shortCode || 'N/A'}
                    </p>
                    {status.connection && (
                      <div className="text-xs text-green-600 mt-2 space-y-1">
                        <p className="flex items-center">
                          <Clock className="mr-1 h-3 w-3" />
                          Connected: {format(new Date(status.connection.connectedAt), 'PPpp')}
                        </p>
                        {status.connection.lastSyncAt && (
                          <p>Last sync: {format(new Date(status.connection.lastSyncAt), 'PPpp')}</p>
                        )}
                        {tokenStatus && (
                          <p className={tokenStatus.color}>
                            Token: {tokenStatus.message}
                          </p>
                        )}
                      </div>
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
              </div>
            )}

            {/* Error Status */}
            {status.error && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>{status.error}</AlertDescription>
              </Alert>
            )}

            {/* Connection Controls */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleTestConnection}
                disabled={loading}
                className="flex-1"
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Test Connection
              </Button>

              <Dialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    disabled={!status.user?.canManage}
                    className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                  >
                    <Unlink className="mr-2 h-4 w-4" />
                    Disconnect
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Disconnect from Xero?</DialogTitle>
                    <DialogDescription>
                      This will disconnect your Xero integration and stop all automatic syncing. 
                      You can reconnect at any time, but you'll need to re-authorize the connection.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setShowDisconnectDialog(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleDisconnect}
                      disabled={disconnectLoading}
                    >
                      {disconnectLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Disconnecting...
                        </>
                      ) : (
                        <>
                          <Unlink className="mr-2 h-4 w-4" />
                          Disconnect
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
