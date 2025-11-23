
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCw, CheckCircle, XCircle, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'

interface XeroSyncStatusProps {
  isConnected: boolean
  lastSyncTime?: string
  onRefresh: () => Promise<void>
  className?: string
}

export function XeroSyncStatus({ 
  isConnected, 
  lastSyncTime, 
  onRefresh,
  className = '' 
}: XeroSyncStatusProps) {
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = async () => {
    setIsRefreshing(true)
    
    try {
      // Call the Xero sync endpoint in background
      const response = await fetch('/api/xero/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        toast.success('Xero data synced successfully', {
          description: 'Your financial data has been updated from Xero.'
        })
        
        // Refresh the data
        await onRefresh()
      } else {
        const error = await response.json()
        toast.warning('Sync in progress', {
          description: error.message || 'Xero is taking longer than expected — data will update shortly.'
        })
      }
    } catch (error) {
      console.error('Xero sync error:', error)
      toast.error('Sync failed', {
        description: 'Please check your connection or try again later.'
      })
    } finally {
      setIsRefreshing(false)
    }
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Connection Status Indicator */}
      <div className="flex items-center gap-2 text-sm">
        {isConnected ? (
          <>
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span className="text-muted-foreground">Xero Connected</span>
          </>
        ) : (
          <>
            <XCircle className="h-4 w-4 text-red-500" />
            <span className="text-muted-foreground">Xero Disconnected</span>
          </>
        )}
      </div>

      {/* Last Sync Time */}
      {isConnected && lastSyncTime && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>
            Last sync: {formatDistanceToNow(new Date(lastSyncTime), { addSuffix: true })}
          </span>
        </div>
      )}

      {/* Refresh Button */}
      {isConnected && (
        <Button
          size="sm"
          variant="outline"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Syncing...' : 'Refresh Xero Data'}
        </Button>
      )}
    </div>
  )
}
