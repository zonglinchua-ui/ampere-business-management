
'use client'

import useSWR from 'swr'

interface XeroStatusResponse {
  connected: boolean
  lastSyncTime?: string
  message?: string
}

const fetcher = async (url: string): Promise<XeroStatusResponse> => {
  const response = await fetch(url, {
    cache: 'no-cache',
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache'
    }
  })
  
  if (!response.ok) {
    throw new Error('Failed to fetch Xero status')
  }
  
  return response.json()
}

export function useXeroStatus() {
  const { data, error, isLoading, mutate } = useSWR<XeroStatusResponse>(
    '/api/xero/connection-status',
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60000, // 1 minute
      shouldRetryOnError: false, // Don't retry on error to prevent blocking
    }
  )

  return {
    isConnected: data?.connected ?? false,
    lastSyncTime: data?.lastSyncTime,
    isLoading,
    error,
    refresh: mutate
  }
}
