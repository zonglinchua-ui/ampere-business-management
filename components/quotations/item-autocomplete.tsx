
'use client'

import { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Search, DollarSign, TrendingUp } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface CommonItem {
  id: string
  description: string
  category: string
  unit: string
  averageUnitPrice: number
  lastUnitPrice: number
  usageCount: number
  lastUsedAt: string
}

interface ItemAutocompleteProps {
  value?: string
  onSelect: (item: CommonItem) => void
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
}

export function ItemAutocomplete({ 
  value, 
  onSelect, 
  onChange, 
  placeholder = "Type to search items...",
  className,
  onKeyDown
}: ItemAutocompleteProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<CommonItem[]>([])
  const [mounted, setMounted] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceTimer = useRef<NodeJS.Timeout | null>(null)

  // Normalize value to always be a string
  const normalizedValue = value ?? ""

  // Prevent hydration mismatch by only rendering interactive parts after mount
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    // Debounced search
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }

    const searchValue = normalizedValue.trim()
    
    if (searchValue.length >= 2) {
      debounceTimer.current = setTimeout(() => {
        searchItems(searchValue)
      }, 300)
    } else {
      setSuggestions([])
      setOpen(false)
    }

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }
    }
  }, [normalizedValue])

  const searchItems = async (query: string) => {
    if (!query || query.length < 2) return
    
    setLoading(true)
    try {
      const response = await fetch(`/api/common-items/search?q=${encodeURIComponent(query)}`)
      if (response.ok) {
        const data = await response.json()
        setSuggestions(Array.isArray(data.items) ? data.items : [])
        setOpen(Array.isArray(data.items) && data.items.length > 0)
      } else {
        setSuggestions([])
        setOpen(false)
      }
    } catch (error) {
      console.error('Error searching items:', error)
      setSuggestions([])
      setOpen(false)
    } finally {
      setLoading(false)
    }
  }

  const handleSelect = (item: CommonItem) => {
    try {
      onSelect(item)
      setOpen(false)
      setSuggestions([])
    } catch (error) {
      console.error('Error selecting item:', error)
    }
  }

  const formatPrice = (price: number) => {
    if (typeof price !== 'number' || isNaN(price)) return '0.00'
    return price.toFixed(2)
  }

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'MATERIALS': 'bg-blue-100 text-blue-700',
      'SERVICES': 'bg-green-100 text-green-700',
      'SUBCONTRACTORS': 'bg-purple-100 text-purple-700',
      'MISCELLANEOUS': 'bg-gray-100 text-gray-700'
    }
    return colors[category] || colors['MISCELLANEOUS']
  }

  return (
    <div className="relative w-full">
      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          value={normalizedValue}
          onChange={(e) => {
            try {
              const newValue = e.target.value ?? ""
              onChange(newValue)
            } catch (error) {
              console.error('Error handling input change:', error)
            }
          }}
          onFocus={() => {
            if (suggestions.length > 0) {
              setOpen(true)
            }
          }}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className={`pr-10 ${className || ""}`}
          autoComplete="off"
        />
        {/* Search icon on the right - hidden when loading */}
        {mounted && !loading && (
          <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        )}
        {/* Loading spinner on the right - replaces search icon when loading */}
        {mounted && loading && (
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
            <div className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-gray-600 rounded-full"></div>
          </div>
        )}
      </div>

      {mounted && open && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border rounded-md shadow-lg max-h-80 overflow-auto">
          <div className="p-2">
            <p className="text-xs text-gray-500 mb-2 px-2">
              {suggestions.length} matching item{suggestions.length !== 1 ? 's' : ''} found
            </p>
            {suggestions.map((item) => {
              if (!item || !item.id) return null
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  className="w-full text-left p-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors border-b last:border-b-0"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-gray-900 dark:text-white truncate">
                        {item.description || 'Untitled Item'}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${getCategoryColor(item.category || 'MISCELLANEOUS')}`}>
                          {item.category || 'MISCELLANEOUS'}
                        </Badge>
                        <span className="text-xs text-gray-500">
                          {item.unit || 'pcs'}
                        </span>
                        <span className="text-xs text-gray-400 flex items-center">
                          <TrendingUp className="h-3 w-3 mr-0.5" />
                          {item.usageCount || 0} uses
                        </span>
                      </div>
                    </div>
                    <div className="ml-4 text-right">
                      <div className="flex items-center text-green-600 font-semibold text-sm">
                        <DollarSign className="h-3 w-3" />
                        {formatPrice(item.lastUnitPrice || 0)}
                      </div>
                      {item.lastUnitPrice !== item.averageUnitPrice && (
                        <div className="text-xs text-gray-500 mt-0.5">
                          Avg: ${formatPrice(item.averageUnitPrice || 0)}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
