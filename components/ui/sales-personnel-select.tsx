
'use client'

import { useState, useEffect } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { User } from 'lucide-react'

interface SalesPerson {
  id: string
  firstName: string
  lastName: string
  email: string
  displayName: string
}

interface SalesPersonnelSelectProps {
  value?: string
  onValueChange: (value: string) => void
  label?: string
  placeholder?: string
  required?: boolean
  className?: string
  disabled?: boolean
}

export function SalesPersonnelSelect({
  value,
  onValueChange,
  label = "Sales Personnel",
  placeholder = "Select sales personnel",
  required = false,
  className,
  disabled = false
}: SalesPersonnelSelectProps) {
  const [salesPersonnel, setSalesPersonnel] = useState<SalesPerson[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchSalesPersonnel()
  }, [])

  const fetchSalesPersonnel = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/users/sales')
      
      if (!response.ok) {
        throw new Error('Failed to fetch sales personnel')
      }
      
      const data = await response.json()
      setSalesPersonnel(data)
    } catch (err: any) {
      console.error('Error fetching sales personnel:', err)
      setError(err.message || 'Failed to load sales personnel')
    } finally {
      setLoading(false)
    }
  }

  const handleValueChange = (newValue: string) => {
    if (newValue === "none") {
      onValueChange("")
    } else {
      onValueChange(newValue)
    }
  }

  return (
    <div className={className}>
      {label && (
        <Label htmlFor="salesPersonnelSelect" className="text-sm font-medium">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
      )}
      
      <Select 
        value={value || "none"} 
        onValueChange={handleValueChange}
        disabled={disabled || loading}
      >
        <SelectTrigger id="salesPersonnelSelect" className="w-full">
          <SelectValue placeholder={loading ? "Loading..." : placeholder}>
            {loading ? (
              <span className="text-muted-foreground">Loading...</span>
            ) : error ? (
              <span className="text-red-500">Error loading data</span>
            ) : value && salesPersonnel.length > 0 ? (
              <div className="flex items-center gap-2">
                <User className="h-4 w-4" />
                {salesPersonnel.find(person => person.id === value)?.displayName || 'Unknown'}
              </div>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </SelectValue>
        </SelectTrigger>
        
        <SelectContent>
          <SelectItem value="none">
            <span className="text-muted-foreground">No sales personnel assigned</span>
          </SelectItem>
          
          {error ? (
            <SelectItem value="error" disabled>
              <span className="text-red-500">Failed to load options</span>
            </SelectItem>
          ) : (
            salesPersonnel.map((person) => (
              <SelectItem key={person.id} value={person.id}>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <div>
                    <div className="font-medium">{person.displayName}</div>
                    <div className="text-sm text-muted-foreground">{person.email}</div>
                  </div>
                </div>
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  )
}
