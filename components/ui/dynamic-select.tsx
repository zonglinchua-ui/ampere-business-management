
'use client'

import * as React from 'react'
import { Check, ChevronsUpDown, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

export type SearchEntity = 'customer' | 'supplier' | 'project' | 'user'

export interface SearchResult {
  id: string
  label: string
  value: string
  subtitle?: string
  metadata?: Record<string, any>
}

interface DynamicSelectProps {
  entity: SearchEntity
  value?: string
  onValueChange: (value: string, result?: SearchResult) => void
  placeholder?: string
  emptyText?: string
  disabled?: boolean
  className?: string
  allowClear?: boolean
}

/**
 * DynamicSelect Component
 * 
 * A searchable dropdown that queries live data from the database via the unified search API.
 * Supports debounced search, loading states, and proper validation.
 * 
 * @example
 * <DynamicSelect
 *   entity="customer"
 *   value={customerId}
 *   onValueChange={(id, result) => setCustomerId(id)}
 *   placeholder="Select customer..."
 * />
 */
export function DynamicSelect({
  entity,
  value,
  onValueChange,
  placeholder = 'Search...',
  emptyText = 'No results found',
  disabled = false,
  className,
  allowClear = true,
}: DynamicSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const [results, setResults] = React.useState<SearchResult[]>([])
  const [loading, setLoading] = React.useState(false)
  const [selectedItem, setSelectedItem] = React.useState<SearchResult | null>(null)
  const debounceTimerRef = React.useRef<NodeJS.Timeout>()

  // Fetch selected item label when value changes
  React.useEffect(() => {
    if (value && !selectedItem) {
      fetchSelectedItem(value)
    } else if (!value) {
      setSelectedItem(null)
    }
  }, [value])

  // Debounced search
  React.useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = setTimeout(() => {
      if (open) {
        fetchResults(search)
      }
    }, 300)

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [search, open])

  const fetchResults = async (query: string) => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        entity,
        query,
        limit: '20'
      })
      const response = await fetch(`/api/search?${params}`)
      if (response.ok) {
        const data = await response.json()
        setResults(data.results || [])
      } else {
        console.error('Search failed:', response.statusText)
        setResults([])
      }
    } catch (error) {
      console.error('Search error:', error)
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  const fetchSelectedItem = async (id: string) => {
    try {
      // Try to fetch the item details
      const params = new URLSearchParams({
        entity,
        query: '',
        limit: '1'
      })
      const response = await fetch(`/api/search?${params}`)
      if (response.ok) {
        const data = await response.json()
        const item = data.results?.find((r: SearchResult) => r.id === id || r.value === id)
        if (item) {
          setSelectedItem(item)
        }
      }
    } catch (error) {
      console.error('Failed to fetch selected item:', error)
    }
  }

  const handleSelect = (result: SearchResult) => {
    setSelectedItem(result)
    onValueChange(result.value, result)
    setOpen(false)
    setSearch('')
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedItem(null)
    onValueChange('', undefined)
    setSearch('')
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'w-full justify-between',
            !value && 'text-muted-foreground',
            className
          )}
          disabled={disabled}
        >
          <span className="truncate">
            {selectedItem ? selectedItem.label : placeholder}
          </span>
          <div className="flex items-center gap-1">
            {allowClear && value && !disabled && (
              <X
                className="h-4 w-4 shrink-0 opacity-50 hover:opacity-100"
                onClick={handleClear}
              />
            )}
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={placeholder}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {loading && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="ml-2 text-sm text-muted-foreground">Searching...</span>
              </div>
            )}
            {!loading && results.length === 0 && (
              <CommandEmpty>{emptyText}</CommandEmpty>
            )}
            {!loading && results.length > 0 && (
              <CommandGroup>
                {results.map((result) => (
                  <CommandItem
                    key={result.id}
                    value={result.id}
                    onSelect={() => handleSelect(result)}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === result.value ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <div className="flex flex-col">
                      <span className="font-medium">{result.label}</span>
                      {result.subtitle && (
                        <span className="text-xs text-muted-foreground">
                          {result.subtitle}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
