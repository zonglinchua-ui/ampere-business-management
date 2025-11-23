'use client'

import useSWR from 'swr'
import { useCallback } from 'react'
import { IntegrationHealthSnapshot } from '@/lib/health/integrations'

const fetcher = (url: string) =>
  fetch(url, { cache: 'no-cache' }).then((res) => {
    if (!res.ok) {
      throw new Error('Failed to load integration health')
    }
    return res.json()
  })

export function useHealthIntegrations() {
  const { data, error, isLoading, mutate } = useSWR<IntegrationHealthSnapshot>(
    '/api/health/integrations',
    fetcher,
    {
      revalidateOnFocus: false,
      refreshInterval: 60_000
    }
  )

  const retrySync = useCallback(
    async (logId: string) => {
      const response = await fetch('/api/health/integrations/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logId })
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || 'Failed to request retry')
      }

      await mutate()
      return response.json()
    },
    [mutate]
  )

  const resolveConflict = useCallback(
    async (conflictId: string, resolution: string, notes?: string) => {
      const response = await fetch('/api/health/integrations/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conflictId, resolution, notes })
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || 'Failed to resolve conflict')
      }

      await mutate()
      return response.json()
    },
    [mutate]
  )

  return {
    snapshot: data,
    isLoading,
    error,
    refresh: mutate,
    retrySync,
    resolveConflict
  }
}
