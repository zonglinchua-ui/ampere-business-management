
'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tag, Edit2, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

interface BudgetCategoryTagProps {
  currentCategoryId?: string
  itemId: string
  itemType: 'purchase_order_item' | 'supplier_invoice_item'
  budgetCategories?: Array<{
    id: string
    name: string
    code: string
    color?: string
    customCategory?: {
      id: string
      name: string
      code: string
      color?: string
    }
  }>
  onCategoryUpdate?: (categoryId?: string) => void
  readonly?: boolean
}

const SYSTEM_BUDGET_CATEGORIES = [
  { value: 'GENERAL', label: 'General' },
  { value: 'MATERIALS', label: 'Materials' },
  { value: 'LABOR', label: 'Labor' },
  { value: 'EQUIPMENT', label: 'Equipment' },
  { value: 'SUBCONTRACTOR', label: 'Subcontractor' },
  { value: 'PERMITS', label: 'Permits' },
  { value: 'TRANSPORTATION', label: 'Transportation' },
  { value: 'OVERHEAD', label: 'Overhead' },
  { value: 'CONTINGENCY', label: 'Contingency' },
  { value: 'OTHER', label: 'Other' },
]

export function BudgetCategoryTag({
  currentCategoryId,
  itemId,
  itemType,
  budgetCategories = [],
  onCategoryUpdate,
  readonly = false
}: BudgetCategoryTagProps) {
  const [showEditPopover, setShowEditPopover] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState(currentCategoryId || 'no-category')
  const [loading, setLoading] = useState(false)

  const getCategoryLabel = (categoryId?: string) => {
    if (!categoryId) return null

    // Check custom categories first
    const customCategory = budgetCategories.find(cat => 
      (cat.customCategory && cat.customCategory.id === categoryId) || cat.id === categoryId
    )
    if (customCategory) {
      return customCategory.customCategory?.name || customCategory.name
    }
    
    // Check system categories
    const systemCategory = SYSTEM_BUDGET_CATEGORIES.find(cat => cat.value === categoryId)
    return systemCategory?.label || categoryId
  }

  const getCategoryColor = (categoryId?: string) => {
    if (!categoryId) return undefined

    // Check custom categories first
    const customCategory = budgetCategories.find(cat => 
      (cat.customCategory && cat.customCategory.id === categoryId) || cat.id === categoryId
    )
    return customCategory?.customCategory?.color || customCategory?.color
  }

  const handleSaveCategory = async () => {
    try {
      setLoading(true)

      const response = await fetch(`/api/${itemType === 'purchase_order_item' ? 'purchase-orders/items' : 'supplier-invoices/items'}/${itemId}/category`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          budgetCategoryId: selectedCategory === 'no-category' ? null : selectedCategory
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('=== Category Update Error Details ===')
        console.error('Status:', response.status)
        console.error('Error data:', errorData)
        console.error('Item ID:', itemId)
        console.error('Selected category:', selectedCategory)
        console.error('====================================')
        throw new Error(errorData.details || errorData.error || 'Failed to update category')
      }

      toast.success('Budget category updated successfully')
      setShowEditPopover(false)
      onCategoryUpdate?.(selectedCategory === 'no-category' ? undefined : selectedCategory)

    } catch (error) {
      console.error('Error updating category:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update budget category')
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveCategory = async () => {
    try {
      setLoading(true)

      const response = await fetch(`/api/${itemType === 'purchase_order_item' ? 'purchase-orders/items' : 'supplier-invoices/items'}/${itemId}/category`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          budgetCategoryId: null
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('=== Category Remove Error Details ===')
        console.error('Status:', response.status)
        console.error('Error data:', errorData)
        console.error('Item ID:', itemId)
        console.error('====================================')
        throw new Error(errorData.details || errorData.error || 'Failed to remove category')
      }

      toast.success('Budget category removed')
      setShowEditPopover(false)
      onCategoryUpdate?.(undefined)

    } catch (error) {
      console.error('Error removing category:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to remove budget category')
    } finally {
      setLoading(false)
    }
  }

  if (!currentCategoryId && readonly) {
    return (
      <span className="text-xs text-gray-400">
        No category assigned
      </span>
    )
  }

  if (!currentCategoryId) {
    return (
      <Popover open={showEditPopover} onOpenChange={setShowEditPopover}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedCategory('no-category')
              setShowEditPopover(true)
            }}
            className="h-6 px-2 text-xs text-gray-400 hover:text-gray-600"
          >
            <Tag className="h-3 w-3 mr-1" />
            Add Category
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="start">
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-sm mb-2">Assign Budget Category</h4>
              <p className="text-xs text-gray-500 mb-3">Select a category for better expense tracking</p>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Budget Category</label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="no-category">No Category</SelectItem>
                  
                  {/* System Categories */}
                  {SYSTEM_BUDGET_CATEGORIES.map((category) => (
                    <SelectItem key={category.value} value={category.value}>
                      {category.label}
                    </SelectItem>
                  ))}
                  
                  {/* Custom Categories */}
                  {budgetCategories.map((category) => (
                    <SelectItem 
                      key={category.id} 
                      value={category.customCategory?.id || category.id}
                    >
                      {category.customCategory?.name || category.name} ({category.customCategory?.code || category.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowEditPopover(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button 
                size="sm"
                onClick={handleSaveCategory}
                disabled={loading}
              >
                {loading ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    )
  }

  const categoryLabel = getCategoryLabel(currentCategoryId)
  const categoryColor = getCategoryColor(currentCategoryId)

  return (
    <>
      <div className="flex items-center gap-1">
        <Badge 
          variant="secondary" 
          className="text-xs"
          style={categoryColor ? { backgroundColor: `${categoryColor}20`, color: categoryColor } : undefined}
        >
          <Tag className="h-3 w-3 mr-1" />
          {categoryLabel}
        </Badge>
        
        {!readonly && (
          <Popover open={showEditPopover} onOpenChange={setShowEditPopover}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedCategory(currentCategoryId)
                  setShowEditPopover(true)
                }}
                className="h-5 w-5 p-0 text-gray-400 hover:text-gray-600"
              >
                <Edit2 className="h-3 w-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="start">
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-sm mb-2">Update Budget Category</h4>
                  <p className="text-xs text-gray-500 mb-3">Change or remove the budget category</p>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Budget Category</label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no-category">No Category</SelectItem>
                      
                      {/* System Categories */}
                      {SYSTEM_BUDGET_CATEGORIES.map((category) => (
                        <SelectItem key={category.value} value={category.value}>
                          {category.label}
                        </SelectItem>
                      ))}
                      
                      {/* Custom Categories */}
                      {budgetCategories.map((category) => (
                        <SelectItem 
                          key={category.id} 
                          value={category.customCategory?.id || category.id}
                        >
                          {category.customCategory?.name || category.name} ({category.customCategory?.code || category.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRemoveCategory}
                    disabled={loading}
                    className="text-red-600 hover:text-red-700"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Remove
                  </Button>
                  
                  <div className="flex gap-2">
                    <Button 
                      variant="outline"
                      size="sm"
                      onClick={() => setShowEditPopover(false)}
                      disabled={loading}
                    >
                      Cancel
                    </Button>
                    <Button 
                      size="sm"
                      onClick={handleSaveCategory}
                      disabled={loading}
                    >
                      {loading ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </>
  )
}
