
'use client'

import { useState, useEffect, useRef } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Clock,
  ChevronDown,
  Loader2
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'

interface SyncProgress {
  entity: string
  status: 'idle' | 'syncing' | 'completed' | 'error'
  current: number
  total: number
  percentage: number
  message?: string
  error?: string
  lastSyncAt?: string
}

export function SyncProgressIndicator() {
  const [isOpen, setIsOpen] = useState(false)
  const [progress, setProgress] = useState<SyncProgress[]>([])
  const [overallStatus, setOverallStatus] = useState<'idle' | 'syncing' | 'completed' | 'error'>('idle')
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    // Connect to SSE endpoint
    const connectSSE = () => {
      try {
        const eventSource = new EventSource('/api/sync/status')
        eventSourceRef.current = eventSource

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)

            if (data.type === 'connected') {
              console.log('✅ Connected to sync status stream')
            } else if (data.type === 'initial') {
              // Initial progress data
              setProgress(data.progress || [])
              updateOverallStatus(data.progress || [])
            } else if (data.type === 'progress') {
              // Update progress for specific entity
              setProgress(prev => {
                const updated = prev.filter(p => p.entity !== data.progress.entity)
                return [...updated, data.progress]
              })
              updateOverallStatus([...progress.filter(p => p.entity !== data.progress.entity), data.progress])
            } else if (data.type === 'heartbeat') {
              // Keep connection alive
              console.log('💓 SSE heartbeat')
            }
          } catch (error) {
            console.error('Error parsing SSE data:', error)
          }
        }

        eventSource.onerror = (error) => {
          console.error('SSE connection error:', error)
          eventSource.close()
          
          // Reconnect after 5 seconds
          setTimeout(() => {
            console.log('🔄 Reconnecting to SSE...')
            connectSSE()
          }, 5000)
        }
      } catch (error) {
        console.error('Error connecting to SSE:', error)
      }
    }

    connectSSE()

    // Clean up on unmount
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
    }
  }, [])

  const updateOverallStatus = (progressData: SyncProgress[]) => {
    const syncing = progressData.some(p => p.status === 'syncing')
    const hasError = progressData.some(p => p.status === 'error')
    
    if (syncing) {
      setOverallStatus('syncing')
    } else if (hasError) {
      setOverallStatus('error')
    } else {
      setOverallStatus('idle')
    }

    // Update last sync time
    const lastSync = progressData
      .map(p => p.lastSyncAt)
      .filter(Boolean)
      .sort((a, b) => new Date(b!).getTime() - new Date(a!).getTime())[0]

    if (lastSync) {
      setLastSyncAt(new Date(lastSync))
    }
  }

  const getStatusIcon = () => {
    switch (overallStatus) {
      case 'syncing':
        return <Loader2 className="h-3 w-3 animate-spin" />
      case 'completed':
        return <CheckCircle2 className="h-3 w-3" />
      case 'error':
        return <XCircle className="h-3 w-3" />
      default:
        return lastSyncAt ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />
    }
  }

  const getStatusColor = () => {
    switch (overallStatus) {
      case 'syncing':
        return 'bg-yellow-500 dark:bg-yellow-600'
      case 'error':
        return 'bg-red-500 dark:bg-red-600'
      default:
        return 'bg-green-500 dark:bg-green-600'
    }
  }

  const getStatusText = () => {
    if (overallStatus === 'syncing') {
      const syncing = progress.filter(p => p.status === 'syncing')
      const totalCurrent = syncing.reduce((sum, p) => sum + p.current, 0)
      const totalOverall = syncing.reduce((sum, p) => sum + p.total, 0)
      return `Syncing (${totalCurrent}/${totalOverall})`
    }

    if (overallStatus === 'error') {
      return 'Sync Failed'
    }

    if (lastSyncAt) {
      return `Synced ${formatDistanceToNow(lastSyncAt, { addSuffix: true })}`
    }

    return 'Not synced'
  }

  const handleRetry = (entity: string) => {
    toast.info(`Retrying sync for ${entity}...`)
    // Trigger resync via event bus or API call
    window.location.href = `/finance?sync=${entity}`
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-8 gap-2 px-2",
            overallStatus === 'syncing' && "text-yellow-600 dark:text-yellow-400",
            overallStatus === 'error' && "text-red-600 dark:text-red-400"
          )}
        >
          <div className={cn("h-2 w-2 rounded-full", getStatusColor())} />
          {getStatusIcon()}
          <span className="text-xs font-medium">{getStatusText()}</span>
          <ChevronDown className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium leading-none">Xero Sync Status</h4>
            <p className="text-sm text-muted-foreground">
              Realtime synchronization progress
            </p>
          </div>

          <div className="space-y-3">
            {progress.length === 0 ? (
              <div className="text-center py-4 text-sm text-muted-foreground">
                No sync activity
              </div>
            ) : (
              progress.map((item) => (
                <div key={item.entity} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {item.status === 'syncing' && (
                        <Loader2 className="h-4 w-4 animate-spin text-yellow-600" />
                      )}
                      {item.status === 'completed' && (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      )}
                      {item.status === 'error' && (
                        <XCircle className="h-4 w-4 text-red-600" />
                      )}
                      {item.status === 'idle' && item.lastSyncAt && (
                        <CheckCircle2 className="h-4 w-4 text-gray-400" />
                      )}
                      <span className="text-sm font-medium capitalize">
                        {item.entity}
                      </span>
                    </div>
                    <Badge
                      variant={
                        item.status === 'syncing' ? 'default' :
                        item.status === 'error' ? 'destructive' :
                        'outline'
                      }
                      className="text-xs"
                    >
                      {item.status === 'syncing' && `${item.percentage}%`}
                      {item.status === 'completed' && 'Done'}
                      {item.status === 'error' && 'Failed'}
                      {item.status === 'idle' && item.lastSyncAt && 'Synced'}
                    </Badge>
                  </div>

                  {item.status === 'syncing' && (
                    <>
                      <Progress value={item.percentage} className="h-2" />
                      <p className="text-xs text-muted-foreground">
                        {item.current} / {item.total} records
                      </p>
                    </>
                  )}

                  {item.status === 'error' && (
                    <div className="space-y-2">
                      <p className="text-xs text-red-600 dark:text-red-400">
                        {item.error || 'Sync failed'}
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full text-xs"
                        onClick={() => handleRetry(item.entity)}
                      >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Retry
                      </Button>
                    </div>
                  )}

                  {item.lastSyncAt && item.status !== 'syncing' && (
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(item.lastSyncAt), { addSuffix: true })}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>

          {lastSyncAt && (
            <div className="pt-3 border-t">
              <p className="text-xs text-muted-foreground text-center">
                Last successful sync: {formatDistanceToNow(lastSyncAt, { addSuffix: true })}
              </p>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
