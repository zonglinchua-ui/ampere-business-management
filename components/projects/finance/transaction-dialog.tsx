
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { DynamicSelect } from '@/components/ui/dynamic-select'
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
import { Calendar } from '@/components/ui/calendar'
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { CalendarIcon } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface TransactionDialogProps {
  projectId: string
  transaction?: {
    id: string
    transactionType: 'INCOME' | 'EXPENSE'
    amount: number
    description: string
    notes?: string
    category: string
    date: string
    reference?: string
    vendorId?: string
    clientId?: string
  } | null
  onSaved: () => void
  onCancel: () => void
}

const TRANSACTION_CATEGORIES = [
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

export function TransactionDialog({ projectId, transaction, onSaved, onCancel }: TransactionDialogProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    transactionType: transaction?.transactionType || 'EXPENSE' as 'INCOME' | 'EXPENSE',
    amount: transaction?.amount?.toString() || '',
    description: transaction?.description || '',
    notes: transaction?.notes || '',
    category: transaction?.category || 'GENERAL',
    date: transaction?.date ? new Date(transaction.date) : new Date(),
    reference: transaction?.reference || '',
    supplierId: transaction?.vendorId || '',
    customerId: transaction?.clientId || ''
  })

  const isEditing = !!transaction

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.transactionType || !formData.amount || !formData.description || !formData.category) {
      toast.error('Please fill in all required fields')
      return
    }

    const amount = parseFloat(formData.amount)
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount greater than 0')
      return
    }

    try {
      setLoading(true)
      
      const url = isEditing 
        ? `/api/projects/${projectId}/transactions/${transaction.id}`
        : `/api/projects/${projectId}/transactions`
      
      const method = isEditing ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          transactionType: formData.transactionType,
          amount,
          description: formData.description,
          notes: formData.notes || undefined,
          category: formData.category,
          date: formData.date.toISOString(),
          reference: formData.reference || undefined,
          vendorId: formData.supplierId || undefined,
          clientId: formData.customerId || undefined
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Failed to ${isEditing ? 'update' : 'create'} transaction`)
      }

      onSaved()
    } catch (error) {
      console.error('Error saving transaction:', error)
      toast.error(error instanceof Error ? error.message : `Failed to ${isEditing ? 'update' : 'create'} transaction`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open onOpenChange={() => onCancel()}>
      <DialogContent className="sm:max-w-[600px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEditing ? 'Edit Transaction' : 'Add Transaction'}
            </DialogTitle>
            <DialogDescription>
              {isEditing 
                ? 'Update the transaction details below.'
                : 'Add a new financial transaction for this project.'
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="transactionType">Transaction Type *</Label>
                <Select 
                  value={formData.transactionType} 
                  onValueChange={(value: 'INCOME' | 'EXPENSE') => setFormData(prev => ({ ...prev, transactionType: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INCOME">Income (Money In)</SelectItem>
                    <SelectItem value="EXPENSE">Expense (Money Out)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="amount">Amount *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description *</Label>
              <Input
                id="description"
                placeholder="Brief description of the transaction..."
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="category">Category *</Label>
                <Select 
                  value={formData.category} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRANSACTION_CATEGORIES.map(category => (
                      <SelectItem key={category.value} value={category.value}>
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "justify-start text-left font-normal",
                        !formData.date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.date ? format(formData.date, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={formData.date}
                      onSelect={(date) => date && setFormData(prev => ({ ...prev, date }))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="reference">Reference</Label>
              <Input
                id="reference"
                placeholder="Invoice number, receipt number, etc."
                value={formData.reference}
                onChange={(e) => setFormData(prev => ({ ...prev, reference: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="supplierId">Supplier (Optional)</Label>
                <DynamicSelect
                  entity="supplier"
                  value={formData.supplierId}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, supplierId: value, customerId: '' }))}
                  placeholder="Search and select a supplier..."
                  allowClear={true}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="customerId">Customer (Optional)</Label>
                <DynamicSelect
                  entity="customer"
                  value={formData.customerId}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, customerId: value, supplierId: '' }))}
                  placeholder="Search and select a customer..."
                  allowClear={true}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Additional notes about this transaction..."
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : (isEditing ? 'Update Transaction' : 'Create Transaction')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
