
'use client'

import { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Search, Building2, User } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface Customer {
  id: string
  customerNumber?: string
  name: string
  customerType: string
}

interface CustomerComboboxProps {
  value?: string
  customers: Customer[]
  onSelect: (customerId: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function CustomerCombobox({ 
  value, 
  customers,
  onSelect, 
  placeholder = "Search customers...",
  className,
  disabled = false
}: CustomerComboboxProps) {
  const [open, setOpen] = useState(false)
  const [searchValue, setSearchValue] = useState("")
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([])
  const [mounted, setMounted] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  // Update display value when selection changes
  useEffect(() => {
    if (value && customers.length > 0) {
      const selectedCustomer = customers.find(c => c.id === value)
      if (selectedCustomer) {
        const displayValue = selectedCustomer.customerNumber 
          ? `${selectedCustomer.customerNumber} - ${selectedCustomer.name}`
          : selectedCustomer.name
        setSearchValue(displayValue)
      }
    } else if (!value) {
      setSearchValue("")
    }
  }, [value, customers])

  // Filter customers based on search
  useEffect(() => {
    if (searchValue.trim().length === 0) {
      setFilteredCustomers(customers.slice(0, 50)) // Show first 50 when empty
      return
    }

    const query = searchValue.toLowerCase().trim()
    const filtered = customers.filter(customer => {
      const nameMatch = customer.name?.toLowerCase().includes(query)
      const numberMatch = customer.customerNumber?.toLowerCase().includes(query)
      return nameMatch || numberMatch
    }).slice(0, 50) // Limit to 50 results

    setFilteredCustomers(filtered)
  }, [searchValue, customers])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  const handleSelect = (customer: Customer) => {
    try {
      const displayValue = customer.customerNumber 
        ? `${customer.customerNumber} - ${customer.name}`
        : customer.name
      setSearchValue(displayValue)
      onSelect(customer.id)
      setOpen(false)
    } catch (error) {
      console.error('Error selecting customer:', error)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setSearchValue(newValue)
    setOpen(true)
  }

  const handleInputFocus = () => {
    setOpen(true)
  }

  const handleInputBlur = () => {
    // Delay to allow click on suggestion
    setTimeout(() => {
      // If there's a selected value but search was cleared, restore the display value
      if (value && !searchValue) {
        const selectedCustomer = customers.find(c => c.id === value)
        if (selectedCustomer) {
          const displayValue = selectedCustomer.customerNumber 
            ? `${selectedCustomer.customerNumber} - ${selectedCustomer.name}`
            : selectedCustomer.name
          setSearchValue(displayValue)
        }
      }
    }, 200)
  }

  const getCustomerTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'INDIVIDUAL': 'bg-blue-100 text-blue-700 border-blue-200',
      'COMPANY': 'bg-purple-100 text-purple-700 border-purple-200',
      'GOVERNMENT': 'bg-green-100 text-green-700 border-green-200'
    }
    return colors[type] || 'bg-gray-100 text-gray-700 border-gray-200'
  }

  const getCustomerTypeIcon = (type: string) => {
    if (type === 'INDIVIDUAL') {
      return <User className="h-3 w-3" />
    }
    return <Building2 className="h-3 w-3" />
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          value={searchValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          placeholder={placeholder}
          className={`pr-10 ${className || ""}`}
          autoComplete="off"
          disabled={disabled}
        />
        {mounted && (
          <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        )}
      </div>

      {mounted && open && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border rounded-md shadow-lg max-h-80 overflow-auto">
          <div className="p-2">
            {filteredCustomers.length === 0 ? (
              <div className="p-4 text-center text-sm text-gray-500">
                {customers.length === 0 ? 'No customers available' : 'No customers found'}
              </div>
            ) : (
              <>
                <p className="text-xs text-gray-500 mb-2 px-2">
                  {filteredCustomers.length} customer{filteredCustomers.length !== 1 ? 's' : ''} found
                  {filteredCustomers.length === 50 && ' (showing first 50)'}
                </p>
                {filteredCustomers.map((customer) => {
                  if (!customer || !customer.id) return null
                  return (
                    <button
                      key={customer.id}
                      onMouseDown={(e) => {
                        e.preventDefault() // Prevent input blur
                        handleSelect(customer)
                      }}
                      className={`w-full text-left p-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors border-b last:border-b-0 ${
                        value === customer.id ? 'bg-gray-50 dark:bg-gray-700/50' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {customer.customerNumber && (
                              <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
                                {customer.customerNumber}
                              </span>
                            )}
                            <p className="font-medium text-sm text-gray-900 dark:text-white truncate">
                              {customer.name || 'Unnamed Customer'}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge 
                              variant="outline" 
                              className={`text-[10px] px-1.5 py-0 flex items-center gap-1 ${getCustomerTypeColor(customer.customerType || 'INDIVIDUAL')}`}
                            >
                              {getCustomerTypeIcon(customer.customerType)}
                              {customer.customerType || 'INDIVIDUAL'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
