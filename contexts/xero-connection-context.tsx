
/**
 * Xero Connection Status Context Provider
 * Ensures only one polling instance across the entire app
 * Provides connection status to all components that need it
 */

'use client'

import React, { createContext, useContext, ReactNode } from 'react'
import { useXeroConnectionStatus as useXeroConnectionStatusHook, XeroConnectionStatus } from '@/hooks/use-xero-connection-status'

interface XeroConnectionContextType {
  status: XeroConnectionStatus & { refresh: () => void }
}

const XeroConnectionContext = createContext<XeroConnectionContextType | undefined>(undefined)

interface XeroConnectionProviderProps {
  children: ReactNode
  /** Whether polling is enabled (default: true) */
  enabled?: boolean
  /** Poll interval in milliseconds (default: 5 minutes) */
  interval?: number
}

export function XeroConnectionProvider({ 
  children, 
  enabled = true,
  interval = 5 * 60 * 1000
}: XeroConnectionProviderProps) {
  const status = useXeroConnectionStatusHook({
    enabled,
    interval,
    onConnectionLost: (reason: string) => {
      console.log('[XeroConnectionProvider] Connection lost:', reason)
      // Could dispatch global events here for other components to listen
    },
    onConnectionRestored: () => {
      console.log('[XeroConnectionProvider] Connection restored')
      // Could dispatch global events here for other components to listen
    }
  })

  return (
    <XeroConnectionContext.Provider value={{ status }}>
      {children}
    </XeroConnectionContext.Provider>
  )
}

export function useXeroConnection() {
  const context = useContext(XeroConnectionContext)
  if (context === undefined) {
    throw new Error('useXeroConnection must be used within a XeroConnectionProvider')
  }
  return context.status
}

// Hook for components that only need to know if Xero is connected
export function useXeroConnectionStatus() {
  const status = useXeroConnection()
  return {
    connected: status.connected,
    checking: status.checking,
    reason: status.reason,
    tenantName: status.tenantName,
    lastChecked: status.lastChecked,
    refresh: status.refresh
  }
}
