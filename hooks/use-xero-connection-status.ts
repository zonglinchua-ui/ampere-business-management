
/**
 * Custom Hook: useXeroConnectionStatus
 * Polls Xero connection status with smart backoff, visibility awareness, and proper cleanup
 * Prevents excessive requests and Xero disconnects through robust interval management
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { toast } from 'sonner'

export interface XeroConnectionStatus {
  connected: boolean
  checking: boolean
  reason?: string
  tenantName?: string
  tenantId?: string
  organization?: any
  connection?: {
    connectedAt: string
    lastSyncAt?: string
    tenantId: string
    expiresAt: string
  }
  user?: {
    role: string
    canManage: boolean
  }
  tokenExpired?: boolean
  lastChecked?: Date
}

interface UseXeroConnectionStatusOptions {
  /** Base poll interval in milliseconds (default: 5 minutes) */
  interval?: number
  /** Whether to start polling immediately (default: true) */
  enabled?: boolean
  /** Callback when connection is lost */
  onConnectionLost?: (reason: string) => void
  /** Callback when connection is restored */
  onConnectionRestored?: () => void
}

export function useXeroConnectionStatus(options: UseXeroConnectionStatusOptions = {}) {
  const {
    interval: baseInterval = 5 * 60 * 1000, // 5 minutes default
    enabled = true
  } = options

  const [status, setStatus] = useState<XeroConnectionStatus>({
    connected: false,
    checking: true
  })

  // Refs for managing state and intervals
  const intervalRef = useRef<number | null>(null)
  const backoffRef = useRef<number>(0) // Current backoff delay in ms
  const mountedRef = useRef<boolean>(false)
  const previousConnectionRef = useRef<boolean | null>(null)
  
  // Store callbacks in refs to avoid recreating fetchStatus
  const onConnectionLostRef = useRef(options.onConnectionLost)
  const onConnectionRestoredRef = useRef(options.onConnectionRestored)

  // Update callback refs when they change
  useEffect(() => {
    onConnectionLostRef.current = options.onConnectionLost
    onConnectionRestoredRef.current = options.onConnectionRestored
  }, [options.onConnectionLost, options.onConnectionRestored])

  // Constants for backoff strategy
  const BASE_INTERVAL = baseInterval
  const MAX_BACKOFF = 30 * 60 * 1000 // 30 minutes max backoff
  const MIN_BACKOFF = 10 * 1000 // 10 seconds min backoff
  const JITTER_FACTOR = 0.2 // 20% jitter

  const clearPolling = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearTimeout(intervalRef.current)
      intervalRef.current = null
      console.log('[useXeroConnectionStatus] Stopping polling')
    }
  }, [])

  const scheduleNext = useCallback((delay?: number) => {
    // Don't schedule if component is unmounted or already scheduled
    if (!mountedRef.current || intervalRef.current !== null) {
      return
    }

    // Add jitter to prevent thundering herd
    const jitter = Math.floor(Math.random() * (BASE_INTERVAL * JITTER_FACTOR))
    const nextInterval = typeof delay === 'number' ? delay : BASE_INTERVAL + jitter

    intervalRef.current = window.setTimeout(async () => {
      // Clear the ref immediately
      intervalRef.current = null

      // Check if we should defer due to visibility or network
      if (document.visibilityState !== 'visible' || !navigator.onLine) {
        console.log('[useXeroConnectionStatus] Deferring poll - page hidden or offline')
        scheduleNext(BASE_INTERVAL) // Try again with normal interval
        return
      }

      console.log('[useXeroConnectionStatus] Fetching connection status...')

      try {
        const res = await fetch('/api/xero/connection-status', { 
          credentials: 'include',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        })
        
        // Handle rate limiting
        if (res.status === 429) {
          const retryAfter = res.headers.get('Retry-After')
          const retryAfterMs = retryAfter 
            ? parseInt(retryAfter, 10) * 1000 
            : Math.min(MAX_BACKOFF, (backoffRef.current || MIN_BACKOFF) * 2)
          
          console.log(`[useXeroConnectionStatus] Rate limited, backing off for ${retryAfterMs}ms`)
          backoffRef.current = retryAfterMs
          scheduleNext(retryAfterMs)
          return
        }

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`)
        }

        const data = await res.json()
        
        // Reset backoff on successful request
        backoffRef.current = 0
        
        // Only update state if component is still mounted
        if (mountedRef.current) {
          const newStatus = {
            ...data,
            lastChecked: new Date()
          }
          
          setStatus(newStatus)

          // Handle connection state changes
          if (previousConnectionRef.current !== null) {
            // Connection was lost
            if (previousConnectionRef.current && !data.connected) {
              console.log('[useXeroConnectionStatus] Connection lost:', data.reason)
              toast.error('⚠️ Xero Connection Lost', {
                description: data.reason || 'Please reconnect to continue syncing.',
                duration: 8000
              })
              onConnectionLostRef.current?.(data.reason || 'Connection lost')
            }
            
            // Connection was restored
            if (!previousConnectionRef.current && data.connected) {
              console.log('[useXeroConnectionStatus] Connection restored')
              toast.success('✅ Xero Connection Restored', {
                description: 'You can now sync data with Xero.',
                duration: 5000
              })
              onConnectionRestoredRef.current?.()
            }
          }

          previousConnectionRef.current = data.connected
        }

        // Schedule next poll with normal interval
        scheduleNext()

      } catch (error: any) {
        console.error('[useXeroConnectionStatus] Fetch error:', error)
        
        // Apply exponential backoff on errors
        const nextBackoff = Math.min(MAX_BACKOFF, (backoffRef.current || MIN_BACKOFF) * 2)
        backoffRef.current = nextBackoff
        
        // Only update state if component is still mounted
        if (mountedRef.current) {
          setStatus(prevStatus => ({
            ...prevStatus,
            connected: false,
            checking: false,
            reason: error.message || 'Failed to check connection status',
            lastChecked: new Date()
          }))
        }

        // Schedule retry with backoff
        scheduleNext(nextBackoff)
      }
    }, nextInterval) as unknown as number

    console.log(`[useXeroConnectionStatus] Starting polling (interval: ${nextInterval}ms)`)
  }, [BASE_INTERVAL, MAX_BACKOFF, MIN_BACKOFF, JITTER_FACTOR])

  const startPolling = useCallback(() => {
    if (intervalRef.current !== null || !mountedRef.current) {
      return // Already polling or unmounted
    }
    scheduleNext(0) // Start immediately
  }, [scheduleNext])

  const stopPolling = useCallback(() => {
    clearPolling()
  }, [clearPolling])

  // Manual refresh function
  const refresh = useCallback(() => {
    if (!mountedRef.current) return
    
    setStatus(prev => ({ ...prev, checking: true }))
    stopPolling()
    startPolling()
  }, [startPolling, stopPolling])

  // Main effect for setup and cleanup
  useEffect(() => {
    mountedRef.current = true

    if (!enabled) {
      console.log('[useXeroConnectionStatus] Polling disabled')
      return
    }

    // Start polling
    startPolling()

    // Visibility change handler
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        console.log('[useXeroConnectionStatus] Page became visible, resuming polling')
        if (intervalRef.current === null) {
          startPolling()
        }
      } else {
        console.log('[useXeroConnectionStatus] Page hidden or offline, pausing polling')
        stopPolling()
      }
    }

    // Online/offline handlers
    const handleOnline = () => {
      console.log('[useXeroConnectionStatus] Connection restored, resuming polling')
      if (intervalRef.current === null && document.visibilityState === 'visible') {
        startPolling()
      }
    }

    const handleOffline = () => {
      console.log('[useXeroConnectionStatus] Connection lost, pausing polling')
      stopPolling()
    }

    // Add event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Cleanup function
    return () => {
      mountedRef.current = false
      stopPolling()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [enabled, startPolling, stopPolling])

  return {
    ...status,
    refresh
  }
}
