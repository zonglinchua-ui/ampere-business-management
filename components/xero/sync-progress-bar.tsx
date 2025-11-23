
'use client'

import { useEffect, useState } from 'react'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, Loader2, XCircle, AlertTriangle } from 'lucide-react'
import { SyncProgress } from '@/lib/sync-progress'

interface SyncProgressBarProps {
  entity?: string
  autoHide?: boolean
}

export function SyncProgressBar({ entity, autoHide = true }: SyncProgressBarProps) {
  const [progressData, setProgressData] = useState<Record<string, SyncProgress>>({})
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let eventSource: EventSource | null = null
    let reconnectTimeout: NodeJS.Timeout | null = null

    const connect = () => {
      try {
        eventSource = new EventSource('/api/xero/sync/progress')
        
        eventSource.onopen = () => {
          console.log('[SSE] Connected to sync progress stream')
          setIsConnected(true)
          setError(null)
        }

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            
            switch (data.type) {
              case 'connected':
                console.log('[SSE] Connection confirmed')
                break
                
              case 'initial_state':
                const initialProgress: Record<string, SyncProgress> = {}
                data.progress.forEach((p: SyncProgress) => {
                  initialProgress[p.entity] = p
                })
                setProgressData(initialProgress)
                break
                
              case 'progress':
                setProgressData(prev => ({
                  ...prev,
                  [data.data.entity]: data.data
                }))
                break
                
              default:
                console.log('[SSE] Unknown message type:', data.type)
            }
          } catch (error) {
            console.error('[SSE] Error parsing message:', error)
          }
        }

        eventSource.onerror = (error) => {
          console.error('[SSE] Connection error:', error)
          setIsConnected(false)
          setError('Connection lost. Reconnecting...')
          eventSource?.close()
          
          // Reconnect after 5 seconds
          reconnectTimeout = setTimeout(() => {
            console.log('[SSE] Attempting to reconnect...')
            connect()
          }, 5000)
        }
      } catch (error: any) {
        console.error('[SSE] Failed to connect:', error)
        setError('Failed to connect to sync progress stream')
      }
    }

    connect()

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout)
      if (eventSource) {
        eventSource.close()
        console.log('[SSE] Disconnected from sync progress stream')
      }
    }
  }, [])

  // Filter progress data by entity if specified
  const filteredProgress = entity 
    ? Object.values(progressData).filter(p => p.entity === entity)
    : Object.values(progressData)

  // Auto-hide completed/idle syncs after 5 seconds
  useEffect(() => {
    if (!autoHide) return

    const timers = filteredProgress
      .filter(p => p.status === 'completed' || p.status === 'idle')
      .map(p => {
        return setTimeout(() => {
          setProgressData(prev => {
            const next = { ...prev }
            delete next[p.entity]
            return next
          })
        }, 5000)
      })

    return () => {
      timers.forEach(timer => clearTimeout(timer))
    }
  }, [filteredProgress, autoHide])

  // Don't show if no active syncs and autoHide is enabled
  const hasActiveSyncs = filteredProgress.some(p => p.status === 'syncing')
  if (autoHide && !hasActiveSyncs && filteredProgress.length === 0) {
    return null
  }

  return (
    <div className="space-y-2">
      {filteredProgress.map((progress) => (
        <Card key={progress.entity} className={`
          border-l-4 transition-all
          ${progress.status === 'syncing' ? 'border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/20' : ''}
          ${progress.status === 'completed' ? 'border-l-green-500 bg-green-50/50 dark:bg-green-950/20' : ''}
          ${progress.status === 'error' ? 'border-l-red-500 bg-red-50/50 dark:bg-red-950/20' : ''}
        `}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {progress.status === 'syncing' && (
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                )}
                {progress.status === 'completed' && (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                )}
                {progress.status === 'error' && (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
                
                <span className="font-medium capitalize">{progress.entity}</span>
                
                <Badge variant={progress.status === 'syncing' ? 'default' : 'outline'}>
                  {progress.status}
                </Badge>
              </div>
              
              <div className="text-sm text-muted-foreground">
                {progress.current} / {progress.total} ({progress.percentage}%)
              </div>
            </div>
            
            <Progress 
              value={progress.percentage} 
              className="h-2"
            />
            
            {progress.message && (
              <p className="text-xs text-muted-foreground mt-2">{progress.message}</p>
            )}
            
            {progress.error && (
              <div className="flex items-center gap-1 mt-2 text-xs text-red-600">
                <AlertTriangle className="h-3 w-3" />
                <span>{progress.error}</span>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
      
      {error && (
        <Card className="border-yellow-500 bg-yellow-50/50 dark:bg-yellow-950/20">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-sm text-yellow-800 dark:text-yellow-200">
              <AlertTriangle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
