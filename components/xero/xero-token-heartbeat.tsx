
/**
 * Xero Token Heartbeat Component
 * Silently keeps Xero tokens fresh by calling the refresh endpoint periodically
 * This prevents token expiration and ensures seamless operation
 * 
 * This component should be included in the main layout to run continuously
 */

'use client'

import { useEffect, useRef } from 'react'

interface XeroTokenHeartbeatProps {
  interval?: number // Interval in milliseconds (default: 10 minutes)
  initialDelay?: number // Initial delay before first check (default: 30 seconds)
}

export function XeroTokenHeartbeat({ 
  interval = 10 * 60 * 1000, // 10 minutes
  initialDelay = 30000 // 30 seconds
}: XeroTokenHeartbeatProps = {}) {
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Function to call the token refresh endpoint
    const refreshTokens = async () => {
      try {
        const response = await fetch('/api/cron/xero-token-refresh', {
          method: 'POST'
        })
        
        if (response.ok) {
          const data = await response.json()
          if (data.success) {
            console.log('✓ [Heartbeat] Token status:', data.message)
          }
        }
      } catch (error) {
        // Silently fail - don't spam the console
        console.debug('[Heartbeat] Refresh check failed:', error)
      }
    }

    // Initial check after specified delay
    const initialTimeout = setTimeout(refreshTokens, initialDelay)

    // Then check at specified interval
    heartbeatIntervalRef.current = setInterval(refreshTokens, interval)

    // Cleanup on unmount
    return () => {
      clearTimeout(initialTimeout)
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current)
      }
    }
  }, [interval, initialDelay])

  // This component doesn't render anything
  return null
}

