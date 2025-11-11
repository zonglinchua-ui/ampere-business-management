
'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter,
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog'
import { Settings } from 'lucide-react'
import { toast } from 'sonner'
import { BudgetCategoryManager } from './budget-category-manager'

interface BudgetDialogProps {
  projectId: string
  budget?: {
    id: string
    category: string
    customCategoryId?: string | null
    budgetedAmount: number
    budgetedAmountBeforeTax?: number | null
    budgetedTaxAmount?: number | null
    actualAmount: number
    actualAmountBeforeTax?: number | null
    actualTaxAmount?: number | null
    description?: string
    customCategory?: {
      id: string
      name: string
      code: string
      color?: string
    }
  } | null
  onSaved: () => void
  onCancel: () => void
}

interface BudgetCategory {
  id: string
  name: string
  code: string
  color?: string
  isActive: boolean
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

export function BudgetDialog({ projectId, budget, onSaved, onCancel }: BudgetDialogProps) {
  const [loading, setLoading] = useState(false)
  const [loadingCategories, setLoadingCategories] = useState(true)
  const [customCategories, setCustomCategories] = useState<BudgetCategory[]>([])
  const [formData, setFormData] = useState({
    category: budget?.category || 'GENERAL',
    customCategoryId: budget?.customCategoryId || '',
    budgetedAmountBeforeTax: budget?.budgetedAmountBeforeTax?.toString() || '',
    budgetedTaxAmount: budget?.budgetedTaxAmount?.toString() || '',
    budgetedAmount: budget?.budgetedAmount?.toString() || '',
    description: budget?.description || '',
    taxRate: '9' // Default GST rate for Singapore
  })

  const isEditing = !!budget

  useEffect(() => {
    fetchCategories()
  }, [])

  const fetchCategories = async () => {
    try {
      setLoadingCategories(true)
      const response = await fetch('/api/budget-categories')
      
      if (!response.ok) {
        throw new Error('Failed to fetch categories')
      }

      const data = await response.json()
      setCustomCategories(data.customCategories.filter((cat: BudgetCategory) => cat.isActive))
    } catch (error) {
      console.error('Error fetching categories:', error)
    } finally {
      setLoadingCategories(false)
    }
  }

  // Calculate total when amount before tax or tax changes
  useEffect(() => {
    const amountBeforeTax = parseFloat(formData.budgetedAmountBeforeTax) || 0
    const taxAmount = parseFloat(formData.budgetedTaxAmount) || 0
    const total = amountBeforeTax + taxAmount
    
    if (total !== parseFloat(formData.budgetedAmount)) {
      setFormData(prev => ({
        ...prev,
        budgetedAmount: total.toFixed(2)
      }))
    }
  }, [formData.budgetedAmountBeforeTax, formData.budgetedTaxAmount])

  // Auto-calculate tax when amount before tax changes
  const handleAmountBeforeTaxChange = (value: string) => {
    const amountBeforeTax = parseFloat(value) || 0
    const taxRate = parseFloat(formData.taxRate) || 0
    const taxAmount = (amountBeforeTax * taxRate / 100).toFixed(2)
    
    setFormData(prev => ({
      ...prev,
      budgetedAmountBeforeTax: value,
      budgetedTaxAmount: taxAmount
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if ((!formData.category && !formData.customCategoryId) || !formData.budgetedAmountBeforeTax) {
      toast.error('Please fill in all required fields')
      return
    }

    const budgetedAmountBeforeTax = parseFloat(formData.budgetedAmountBeforeTax)
    const budgetedTaxAmount = parseFloat(formData.budgetedTaxAmount) || 0
    const budgetedAmount = budgetedAmountBeforeTax + budgetedTaxAmount

    if (isNaN(budgetedAmountBeforeTax) || budgetedAmountBeforeTax < 0) {
      toast.error('Please enter a valid budget amount')
      return
    }

    try {
      setLoading(true)
      
      const url = isEditing 
        ? `/api/projects/${projectId}/budget/${budget.id}`
        : `/api/projects/${projectId}/budget`
      
      const method = isEditing ? 'PUT' : 'POST'
      
      const payload = {
        budgetedAmount,
        budgetedAmountBeforeTax,
        budgetedTaxAmount,
        description: formData.description || undefined,
        ...(formData.customCategoryId 
          ? { customCategoryId: formData.customCategoryId }
          : { category: formData.category }
        )
      }
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Failed to ${isEditing ? 'update' : 'create'} budget`)
      }

      onSaved()
    } catch (error) {
      console.error('Error saving budget:', error)
      toast.error(error instanceof Error ? error.message : `Failed to ${isEditing ? 'update' : 'create'} budget`)
    } finally {
      setLoading(false)
    }
  }

  const getCurrentCategoryDisplayName = () => {
    if (formData.customCategoryId) {
      const customCat = customCategories.find(cat => cat.id === formData.customCategoryId)
      return customCat?.name || 'Custom Category'
    } else {
      const systemCat = SYSTEM_BUDGET_CATEGORIES.find(cat => cat.value === formData.category)
      return systemCat?.label || 'System Category'
    }
  }

  const handleCategoryChange = (value: string) => {
    if (value.startsWith('custom_')) {
      const customCategoryId = value.replace('custom_', '')
      setFormData(prev => ({
        ...prev,
        category: 'OTHER', // Default fallback for system category
        customCategoryId
      }))
    } else {
      setFormData(prev => ({
        ...prev,
        category: value,
        customCategoryId: ''
      }))
    }
  }

  return (
    <Dialog open onOpenChange={() => onCancel()}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEditing ? 'Edit Budget Category' : 'Add Budget Category'}
            </DialogTitle>
            <DialogDescription>
              {isEditing 
                ? 'Update the budget category details below.'
                : 'Add a new budget category to track expenses for this project.'
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="category">Category *</Label>
                <BudgetCategoryManager 
                  trigger={
                    <Button type="button" variant="ghost" size="sm">
                      <Settings className="h-4 w-4 mr-2" />
                      Manage
                    </Button>
                  }
                />
              </div>
              <Select 
                value={formData.customCategoryId ? `custom_${formData.customCategoryId}` : formData.category}
                onValueChange={handleCategoryChange}
                disabled={isEditing} // Don't allow changing category when editing
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a category">
                    {getCurrentCategoryDisplayName()}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <div className="px-2 py-1 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    System Categories
                  </div>
                  {SYSTEM_BUDGET_CATEGORIES.map(category => (
                    <SelectItem key={category.value} value={category.value}>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                        {category.label}
                      </div>
                    </SelectItem>
                  ))}
                  
                  {customCategories.length > 0 && (
                    <>
                      <div className="px-2 py-1 text-xs font-medium text-gray-500 uppercase tracking-wider border-t mt-2 pt-2">
                        Custom Categories
                      </div>
                      {customCategories.map(category => (
                        <SelectItem key={`custom_${category.id}`} value={`custom_${category.id}`}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: category.color || '#6B7280' }}
                            ></div>
                            {category.name}
                          </div>
                        </SelectItem>
                      ))}
                    </>
                  )}
                  
                  {loadingCategories && (
                    <div className="px-2 py-4 text-center text-xs text-gray-500">
                      Loading categories...
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="taxRate">Tax Rate (%)</Label>
              <Input
                id="taxRate"
                type="number"
                step="0.01"
                min="0"
                max="100"
                placeholder="9.00"
                value={formData.taxRate}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, taxRate: e.target.value }))
                  // Recalculate tax when rate changes
                  if (formData.budgetedAmountBeforeTax) {
                    handleAmountBeforeTaxChange(formData.budgetedAmountBeforeTax)
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">Default: 9% GST for Singapore</p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="budgetedAmountBeforeTax">Budget Amount (Before Tax) *</Label>
              <Input
                id="budgetedAmountBeforeTax"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formData.budgetedAmountBeforeTax}
                onChange={(e) => handleAmountBeforeTaxChange(e.target.value)}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="budgetedTaxAmount">Tax Amount</Label>
              <Input
                id="budgetedTaxAmount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formData.budgetedTaxAmount}
                onChange={(e) => setFormData(prev => ({ ...prev, budgetedTaxAmount: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">Auto-calculated based on tax rate</p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="budgetedAmount">Total Budget Amount</Label>
              <Input
                id="budgetedAmount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formData.budgetedAmount}
                disabled
                className="bg-gray-50"
              />
              <p className="text-xs text-muted-foreground">Amount Before Tax + Tax Amount</p>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Optional description for this budget category..."
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : (isEditing ? 'Update' : 'Create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
