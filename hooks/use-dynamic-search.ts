
'use client'

import { useState, useEffect, useRef } from 'react'

export type SearchEntity = 'customer' | 'supplier' | 'project' | 'user'

export interface SearchResult {
  id: string
  label: string
  value: string
  subtitle?: string
  metadata?: Record<string, any>
}

interface UseDynamicSearchOptions {
  entity: SearchEntity
  query: string
  limit?: number
  debounceMs?: number
  enabled?: boolean
}

interface UseDynamicSearchResult {
  results: SearchResult[]
  loading: boolean
  error: Error | null
  refetch: () => void
}

/**
 * Custom hook for dynamic entity search with debouncing
 * 
 * @example
 * const { results, loading } = useDynamicSearch({
 *   entity: 'customer',
 *   query: searchTerm,
 *   limit: 20
 * })
 */
export function useDynamicSearch({
  entity,
  query,
  limit = 20,
  debounceMs = 300,
  enabled = true
}: UseDynamicSearchOptions): UseDynamicSearchResult {
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const debounceTimerRef = useRef<NodeJS.Timeout>()
  const abortControllerRef = useRef<AbortController>()

  const fetchResults = async () => {
    if (!enabled) return

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    abortControllerRef.current = new AbortController()

    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        entity,
        query,
        limit: limit.toString()
      })

      const response = await fetch(`/api/search?${params}`, {
        signal: abortControllerRef.current.signal
      })

      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`)
      }

      const data = await response.json()
      setResults(data.results || [])
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err)
        console.error('Search error:', err)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!enabled) return

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = setTimeout(() => {
      fetchResults()
    }, debounceMs)

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [entity, query, limit, enabled])

  return {
    results,
    loading,
    error,
    refetch: fetchResults
  }
}
