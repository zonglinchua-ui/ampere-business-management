export type SearchEntityType = 'supplier' | 'project' | 'invoice' | 'customer' | 'user'

export interface GlobalSearchResult {
  id: string
  type: SearchEntityType
  title: string
  subtitle?: string
  href?: string
  status?: string
  amount?: number
  currency?: string
  metadata?: Record<string, unknown>
  label?: string
  value?: string
}

interface SearchOptions {
  query?: string
  entities?: SearchEntityType[]
  limit?: number
  recent?: boolean
  signal?: AbortSignal
}

export async function searchEntities({
  query = '',
  entities = ['supplier', 'project', 'invoice'],
  limit = 8,
  recent = false,
  signal
}: SearchOptions = {}): Promise<GlobalSearchResult[]> {
  const params = new URLSearchParams()
  if (query) params.set('query', query)
  if (entities.length) params.set('entities', entities.join(','))
  if (limit) params.set('limit', String(limit))
  if (recent) params.set('recent', 'true')

  const response = await fetch(`/api/search?${params.toString()}`, { signal })

  if (!response.ok) {
    throw new Error(`Search request failed: ${response.statusText}`)
  }

  const data = await response.json()
  return data.results || []
}

export async function fetchRecentEntities(options: Omit<SearchOptions, 'recent'> = {}) {
  return searchEntities({ ...options, recent: true })
}
