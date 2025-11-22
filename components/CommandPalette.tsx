'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator
} from '@/components/ui/command'
import { Badge } from '@/components/ui/badge'
import { GlobalSearchResult, SearchEntityType, fetchRecentEntities, searchEntities } from '@/lib/search'
import {
  ArrowUpRight,
  Building2,
  FileText,
  FolderKanban,
  Loader2,
  UserCircle2
} from 'lucide-react'

interface PaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  recentResults?: GlobalSearchResult[]
  loadingRecent?: boolean
  searcher?: (query: string, signal?: AbortSignal) => Promise<GlobalSearchResult[]>
  searchDebounceMs?: number
  onNavigate?: (href: string) => void
  testMode?: boolean
}

const ENTITY_META: Record<
  SearchEntityType,
  { label: string; icon: typeof Building2 }
> = {
  supplier: { label: 'Suppliers', icon: Building2 },
  project: { label: 'Projects', icon: FolderKanban },
  invoice: { label: 'Invoices', icon: FileText },
  customer: { label: 'Customers', icon: Building2 },
  user: { label: 'Users', icon: UserCircle2 }
}

const STATUS_STYLES: Record<string, string> = {
  approved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  paid: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  pending: 'bg-amber-100 text-amber-800 border-amber-200',
  draft: 'bg-slate-100 text-slate-700 border-slate-200',
  overdue: 'bg-red-100 text-red-800 border-red-200',
  cancelled: 'bg-slate-100 text-slate-700 border-slate-200'
}

const defaultSearcher = (query: string, signal?: AbortSignal) =>
  searchEntities({ query, signal })

const formatCurrency = (amount: number, currency = 'SGD') =>
  new Intl.NumberFormat('en-SG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount)

function renderMetadata(item: GlobalSearchResult) {
  const parts: string[] = []

  if (item.type === 'invoice') {
    const amountDue = item.metadata?.amountDue as number | undefined
    const projectNumber = item.metadata?.projectNumber as string | undefined
    if (typeof amountDue === 'number') {
      parts.push(`Due ${formatCurrency(amountDue, item.currency)}`)
    }
    if (projectNumber) {
      parts.push(projectNumber)
    }
  }

  if (item.type === 'project') {
    const customerName = item.metadata?.customerName as string | undefined
    if (customerName) {
      parts.push(customerName)
    }
  }

  if (item.type === 'supplier') {
    const phone = item.metadata?.phone as string | undefined
    if (phone) {
      parts.push(phone)
    }
  }

  if (!parts.length && item.subtitle) {
    parts.push(item.subtitle)
  }

  return parts.join(' • ')
}

export function CommandPalette({
  open,
  onOpenChange,
  recentResults = [],
  loadingRecent = false,
  searcher = defaultSearcher,
  searchDebounceMs = 200,
  onNavigate,
  testMode = false
}: PaletteProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GlobalSearchResult[]>(recentResults)
  const [loading, setLoading] = useState(false)
  const abortController = useRef<AbortController | null>(null)
  const router = useRouter()

  useEffect(() => {
    if (!open) {
      setQuery('')
      setResults(recentResults)
    }
  }, [open, recentResults])

  useEffect(() => {
    if (!open) return

    if (!query) {
      setResults(recentResults)
      return
    }

    abortController.current?.abort()
    const controller = new AbortController()
    abortController.current = controller

    const timer = setTimeout(() => {
      setLoading(true)
      searcher(query, controller.signal)
        .then((nextResults) => setResults(nextResults))
        .catch((error) => {
          if ((error as Error).name !== 'AbortError') {
            console.error('Command palette search failed', error)
          }
        })
        .finally(() => setLoading(false))
    }, searchDebounceMs)

    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [query, open, searcher, searchDebounceMs, recentResults])

  const groupedResults = useMemo(() => {
    return results.reduce<Partial<Record<SearchEntityType, GlobalSearchResult[]>>>((acc, item) => {
      if (!acc[item.type]) acc[item.type] = []
      acc[item.type]!.push(item)
      return acc
    }, {})
  }, [results])

  const handleSelect = (item: GlobalSearchResult) => {
    if (item.href) {
      if (onNavigate) {
        onNavigate(item.href)
      } else {
        router.push(item.href)
      }
    }
    onOpenChange(false)
  }

  const paletteContent = (
    <>
      <CommandInput
        placeholder="Search suppliers, projects, invoices..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {(loading || loadingRecent) && (
          <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Searching...</span>
          </div>
        )}
        {!loading && !loadingRecent && results.length === 0 && (
          <CommandEmpty>No results found.</CommandEmpty>
        )}
        {Object.entries(groupedResults).map(([type, items]) => {
          const entityType = type as SearchEntityType
          const meta = ENTITY_META[entityType]
          if (!meta || !items.length) return null

          const Icon = meta.icon

          return (
            <CommandGroup key={type} heading={meta.label}>
              {items.map((item) => {
                const statusKey = (item.status || '').toLowerCase()
                const badgeClass = STATUS_STYLES[statusKey]
                const metaLine = renderMetadata(item)
                return (
                  <CommandItem
                    key={`${type}-${item.id}`}
                    value={`${type}-${item.id}`}
                    onSelect={() => handleSelect(item)}
                    className="cursor-pointer"
                  >
                    <Icon className="mr-3 h-4 w-4 text-muted-foreground" />
                    <div className="flex flex-1 flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{item.title}</span>
                        {item.status && (
                          <Badge
                            variant="secondary"
                            className={badgeClass || 'bg-slate-100 text-slate-700 border-slate-200'}
                          >
                            {item.status}
                          </Badge>
                        )}
                      </div>
                      {item.subtitle && (
                        <span className="text-xs text-muted-foreground">{item.subtitle}</span>
                      )}
                      {metaLine && (
                        <span className="text-xs text-muted-foreground">{metaLine}</span>
                      )}
                    </div>
                    <div className="ml-auto flex flex-col items-end gap-1 text-right text-xs text-muted-foreground">
                      {typeof item.amount === 'number' && (
                        <span className="font-semibold text-foreground">
                          {formatCurrency(item.amount, item.currency)}
                        </span>
                      )}
                      <ArrowUpRight className="h-4 w-4" />
                    </div>
                  </CommandItem>
                )
              })}
              <CommandSeparator />
            </CommandGroup>
          )
        })}
      </CommandList>
    </>
  )

  const commandShell = (
    <Command
      className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5"
    >
      {paletteContent}
    </Command>
  )

  if (testMode) {
    if (!open) return null
    return <div data-testid="command-palette">{commandShell}</div>
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} label="Global command palette">
      {commandShell}
    </CommandDialog>
  )
}

export default function CommandPaletteProvider() {
  const [open, setOpen] = useState(false)
  const [recentResults, setRecentResults] = useState<GlobalSearchResult[]>([])
  const [loadingRecent, setLoadingRecent] = useState(false)
  const openRef = useRef(false)

  useEffect(() => {
    openRef.current = open
  }, [open])

  const preloadRecent = useCallback(async () => {
    if (recentResults.length || loadingRecent) return
    setLoadingRecent(true)
    try {
      const results = await fetchRecentEntities({ limit: 8 })
      setRecentResults(results)
    } catch (error) {
      console.error('Failed to preload recent entities', error)
    } finally {
      setLoadingRecent(false)
    }
  }, [recentResults.length, loadingRecent])

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        preloadRecent()
      }
      setOpen(nextOpen)
    },
    [preloadRecent]
  )

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        const targetOpen = !openRef.current
        if (targetOpen) {
          preloadRecent()
        }
        setOpen(targetOpen)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [preloadRecent])

  return (
    <CommandPalette
      open={open}
      onOpenChange={handleOpenChange}
      recentResults={recentResults}
      loadingRecent={loadingRecent}
    />
  )
}
