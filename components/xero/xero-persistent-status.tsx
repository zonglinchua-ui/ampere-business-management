
/**
 * Xero Persistent Status Component
 * Displays the permanent connection status to "Ampere Engineering"
 * Shows users that they don't need to reconnect manually
 */

'use client'

import React, { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2, AlertCircle, RefreshCw, Building2 } from 'lucide-react'
import { toast } from 'sonner'

interface ConnectionStatus {
  isConnected: boolean
  tenantName?: string
  tenantId?: string
  expiresIn?: number
  lastSync?: Date
  needsReconnect: boolean
  statusMessage: string
}

interface ConnectionDetails {
  organizationName: string
  connectedSince: Date
  lastSync?: Date
  tokenStatus: 'healthy' | 'expiring_soon' | 'expired'
  timeUntilExpiry?: number
}

export function XeroPersistentStatus() {
  const [status, setStatus] = useState<ConnectionStatus | null>(null)
  const [details, setDetails] = useState<ConnectionDetails | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/xero/persistent-status')
      const data = await response.json()

      if (data.success) {
        setStatus(data.status)
        setDetails(data.details)
      } else {
        console.error('Failed to fetch status:', data.error)
      }
    } catch (error) {
      console.error('Error fetching status:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
    
    // Refresh status every 2 minutes
    const interval = setInterval(fetchStatus, 2 * 60 * 1000)
    
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Xero Connection
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span className="text-sm text-muted-foreground">Checking connection...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!status) {
    return null
  }

  const handleReconnect = async () => {
    try {
      const response = await fetch('/api/xero/authorize')
      const data = await response.json()
      
      if (data.success && data.authUrl) {
        window.location.href = data.authUrl
      } else {
        toast.error(data.error || 'Failed to start authorization')
      }
    } catch (error) {
      toast.error('Failed to connect to Xero')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Xero Connection
        </CardTitle>
        <CardDescription>
          Permanent connection to {status.tenantName || 'Ampere Engineering'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Connection Status Badge */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Status</span>
          <Badge 
            variant={status.isConnected ? 'default' : 'destructive'}
            className="flex items-center gap-1"
          >
            {status.isConnected ? (
              <>
                <CheckCircle2 className="h-3 w-3" />
                Connected
              </>
            ) : (
              <>
                <AlertCircle className="h-3 w-3" />
                Disconnected
              </>
            )}
          </Badge>
        </div>

        {/* Organization Name */}
        {status.tenantName && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Organization</span>
            <span className="text-sm text-muted-foreground">{status.tenantName}</span>
          </div>
        )}

        {/* Token Status */}
        {details && status.isConnected && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Token Status</span>
              <Badge 
                variant={
                  details.tokenStatus === 'healthy' ? 'default' :
                  details.tokenStatus === 'expiring_soon' ? 'secondary' :
                  'destructive'
                }
              >
                {details.tokenStatus === 'healthy' ? 'Healthy' :
                 details.tokenStatus === 'expiring_soon' ? 'Refreshing Soon' :
                 'Expired'}
              </Badge>
            </div>

            {details.timeUntilExpiry !== undefined && details.timeUntilExpiry > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Token Valid For</span>
                <span className="text-sm text-muted-foreground">
                  {details.timeUntilExpiry} minutes
                </span>
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Connected Since</span>
              <span className="text-sm text-muted-foreground">
                {new Date(details.connectedSince).toLocaleDateString()}
              </span>
            </div>

            {details.lastSync && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Last Sync</span>
                <span className="text-sm text-muted-foreground">
                  {new Date(details.lastSync).toLocaleString()}
                </span>
              </div>
            )}
          </>
        )}

        {/* Status Message */}
        <div className="rounded-md bg-muted p-3">
          <p className="text-sm text-muted-foreground">
            {status.statusMessage}
          </p>
        </div>

        {/* Reconnect Button (only shown if needed) */}
        {status.needsReconnect && (
          <Button 
            onClick={handleReconnect}
            className="w-full"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Reconnect to Ampere Engineering
          </Button>
        )}

        {/* Auto-refresh Notice */}
        {status.isConnected && (
          <p className="text-xs text-center text-muted-foreground">
            ✓ Connection automatically maintained in background
          </p>
        )}
      </CardContent>
    </Card>
  )
}

