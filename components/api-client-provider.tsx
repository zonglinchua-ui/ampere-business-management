
/**
 * API Client Provider Component
 * 
 * Initializes the global API client and error logging on the client side
 */

'use client'

import { useEffect } from 'react'
import { initializeApiClient } from '@/lib/api-client'

export function ApiClientProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Initialize API client on mount
    initializeApiClient()

    console.log('[API Client Provider] Global error logging initialized')
  }, [])

  return <>{children}</>
}
