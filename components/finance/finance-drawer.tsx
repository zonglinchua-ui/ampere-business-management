
'use client'

import { useState, useEffect } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  FileText, 
  Calendar, 
  DollarSign, 
  Building2, 
  User,
  Tag,
  Save,
  ExternalLink,
  CreditCard,
  Clock
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { format } from 'date-fns'
import { toast } from 'sonner'

interface FinanceDrawerProps {
  isOpen: boolean
  onClose: () => void
  type: 'invoice' | 'payment' | 'supplier-invoice'
  data: any
  projects?: Array<{ id: string; name: string; projectNumber: string }>
  budgetCategories?: Array<{ id: string; name: string; code: string; color?: string }>
  onSaveMetadata?: (metadata: any) => Promise<void>
  initialEditingMode?: boolean
}

export function FinanceDrawer({
  isOpen,
  onClose,
  type,
  data,
  projects = [],
  budgetCategories = [],
  onSaveMetadata,
  initialEditingMode = false
}: FinanceDrawerProps) {
  const [isEditing, setIsEditing] = useState(initialEditingMode)
  const [isSaving, setIsSaving] = useState(false)
  const [metadata, setMetadata] = useState({
    projectId: data?.projectId || '',
    budgetCategoryId: data?.budgetCategoryId || '',
    poNumber: data?.poNumber || '',
    notes: data?.notes || '',
    tags: data?.tags || []
  })

  // Reset editing mode and metadata when drawer opens or data changes
  useEffect(() => {
    setIsEditing(initialEditingMode)
    
    // Try to find projectId from data if not explicitly set
    let resolvedProjectId = data?.projectId || ''
    if (!resolvedProjectId && data?.projectName && Array.isArray(projects)) {
      // Try to find the project by name if projectId not available
      const project = projects.find(p => p.name === data?.projectName)
      if (project) {
        resolvedProjectId = project.id
      }
    }
    
    setMetadata({
      projectId: resolvedProjectId,
      budgetCategoryId: data?.budgetCategoryId || '',
      poNumber: data?.poNumber || '',
      notes: data?.notes || '',
      tags: data?.tags || []
    })
  }, [isOpen, data, initialEditingMode, projects])

  const handleSaveMetadata = async () => {
    if (!onSaveMetadata) return

    setIsSaving(true)
    try {
      await onSaveMetadata(metadata)
      toast.success('Metadata saved successfully')
      setIsEditing(false)
    } catch (error) {
      console.error('Failed to save metadata:', error)
      toast.error('Failed to save metadata')
    } finally {
      setIsSaving(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'PAID':
      case 'COMPLETED':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'SENT':
      case 'AUTHORISED':
      case 'PROCESSING':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case 'DRAFT':
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      case 'OVERDUE':
      case 'FAILED':
      case 'VOIDED':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
    }
  }

  const renderInvoiceContent = () => (
    <div className="space-y-6">
      {/* Summary Info */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Invoice Number</div>
          <div className="font-semibold">{data?.invoiceNumber}</div>
        </div>
        <div className="space-y-1">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</div>
          <Badge variant="outline" className={getStatusColor(data?.status)}>
            {data?.status}
          </Badge>
        </div>
        <div className="space-y-1">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Client</div>
          <div className="flex items-center">
            <Building2 className="mr-2 h-4 w-4 text-gray-400" />
            {data?.customerName}
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Amount</div>
          <div className="font-bold text-lg">
            {formatCurrency(data?.amount || 0, 'SGD')}
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Issue Date</div>
          <div className="flex items-center">
            <Calendar className="mr-2 h-4 w-4 text-gray-400" />
            {data?.issueDate ? format(new Date(data.issueDate), 'MMM dd, yyyy') : '-'}
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Due Date</div>
          <div className="flex items-center">
            <Clock className="mr-2 h-4 w-4 text-gray-400" />
            {data?.dueDate ? format(new Date(data.dueDate), 'MMM dd, yyyy') : '-'}
          </div>
        </div>
      </div>

      {/* Xero Link */}
      {data?.xeroUrl && (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => window.open(data.xeroUrl, '_blank')}
        >
          <ExternalLink className="mr-2 h-4 w-4" />
          Open in Xero
        </Button>
      )}
    </div>
  )

  const renderPaymentContent = () => (
    <div className="space-y-6">
      {/* Summary Info */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Payment ID</div>
          <div className="font-semibold">{data?.paymentNumber}</div>
        </div>
        <div className="space-y-1">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</div>
          <Badge variant="outline" className={getStatusColor(data?.status)}>
            {data?.status}
          </Badge>
        </div>
        <div className="space-y-1">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Client</div>
          <div className="flex items-center">
            <Building2 className="mr-2 h-4 w-4 text-gray-400" />
            {data?.clientName || '-'}
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Amount</div>
          <div className="font-bold text-lg">
            <span className={data?.type === 'received' ? 'text-green-600' : 'text-red-600'}>
              {data?.type === 'received' ? '+' : '-'}
              {formatCurrency(data?.amount || 0, data?.currency === 'USD' ? 'USD' : 'SGD')}
            </span>
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Date</div>
          <div className="flex items-center">
            <Calendar className="mr-2 h-4 w-4 text-gray-400" />
            {data?.date ? format(new Date(data.date), 'MMM dd, yyyy HH:mm') : '-'}
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Method</div>
          <div className="flex items-center">
            <CreditCard className="mr-2 h-4 w-4 text-gray-400" />
            {data?.method || '-'}
          </div>
        </div>
      </div>

      {/* Reference */}
      {data?.reference && (
        <div className="space-y-1">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Reference</div>
          <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-md text-sm">
            {data.reference}
          </div>
        </div>
      )}

      {/* Invoice Link */}
      {data?.invoiceNumber && (
        <div className="space-y-1">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Related Invoice</div>
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md flex items-center justify-between">
            <span className="font-medium text-blue-600 dark:text-blue-400">{data.invoiceNumber}</span>
            <Button variant="ghost" size="sm">
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )

  const renderSupplierInvoiceContent = () => (
    <div className="space-y-6">
      {/* Summary Info */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Vendor</div>
          <div className="font-semibold">{data?.vendorName}</div>
        </div>
        <div className="space-y-1">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</div>
          <Badge variant="outline" className={getStatusColor(data?.status || 'UPLOADED')}>
            {data?.status || 'UPLOADED'}
          </Badge>
        </div>
        <div className="space-y-1">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Amount</div>
          <div className="font-bold text-lg">
            {formatCurrency(data?.amount || 0, data?.currency === 'USD' ? 'USD' : 'SGD')}
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Upload Date</div>
          <div className="flex items-center">
            <Calendar className="mr-2 h-4 w-4 text-gray-400" />
            {data?.uploadDate ? format(new Date(data.uploadDate), 'MMM dd, yyyy') : '-'}
          </div>
        </div>
        <div className="space-y-1 col-span-2">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Uploaded By</div>
          <div className="flex items-center">
            <User className="mr-2 h-4 w-4 text-gray-400" />
            {data?.uploadedBy}
          </div>
        </div>
      </div>

      {/* Attachment */}
      {data?.attachmentUrl && (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => window.open(data.attachmentUrl, '_blank')}
        >
          <FileText className="mr-2 h-4 w-4" />
          View Invoice Document
        </Button>
      )}
    </div>
  )

  const renderMetadataTab = () => (
    <div className="space-y-4">
      {isEditing ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="projectId">Link to Project</Label>
            <Select
              value={metadata.projectId || "no-project"}
              onValueChange={(value) => setMetadata({ ...metadata, projectId: value === "no-project" ? "" : value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="no-project">No Project</SelectItem>
                {(Array.isArray(projects) ? projects : []).map(project => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.projectNumber} - {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="budgetCategoryId">Budget Category</Label>
            <Select
              value={metadata.budgetCategoryId || "no-category"}
              onValueChange={(value) => setMetadata({ ...metadata, budgetCategoryId: value === "no-category" ? "" : value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a budget category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="no-category">No Category</SelectItem>
                {(Array.isArray(budgetCategories) ? budgetCategories : []).map(category => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.code} - {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="poNumber">Purchase Order Number</Label>
            <Input
              id="poNumber"
              placeholder="Enter PO number"
              value={metadata.poNumber}
              onChange={(e) => setMetadata({ ...metadata, poNumber: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Internal Notes</Label>
            <Textarea
              id="notes"
              placeholder="Add internal notes (not synced to Xero)"
              value={metadata.notes}
              onChange={(e) => setMetadata({ ...metadata, notes: e.target.value })}
              rows={4}
            />
          </div>

          <div className="flex space-x-2">
            <Button onClick={handleSaveMetadata} disabled={isSaving}>
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? 'Saving...' : 'Save Metadata'}
            </Button>
            <Button variant="outline" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="space-y-4">
            <div className="space-y-1">
              <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Project</div>
              <div>
                {metadata.projectId 
                  ? projects.find(p => p.id === metadata.projectId)?.name || data?.projectName || 'Not linked'
                  : data?.projectName || 'Not linked'
                }
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Budget Category</div>
              <div>
                {metadata.budgetCategoryId ? (
                  <Badge variant="outline" style={{
                    backgroundColor: budgetCategories.find(c => c.id === metadata.budgetCategoryId)?.color + '20' || undefined,
                    borderColor: budgetCategories.find(c => c.id === metadata.budgetCategoryId)?.color || undefined,
                    color: budgetCategories.find(c => c.id === metadata.budgetCategoryId)?.color || undefined
                  }}>
                    <Tag className="mr-1 h-3 w-3" />
                    {budgetCategories.find(c => c.id === metadata.budgetCategoryId)?.code} - {budgetCategories.find(c => c.id === metadata.budgetCategoryId)?.name}
                  </Badge>
                ) : (
                  'Not categorized'
                )}
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-sm font-medium text-gray-500 dark:text-gray-400">PO Number</div>
              <div>{metadata.poNumber || '-'}</div>
            </div>

            {metadata.notes && (
              <div className="space-y-1">
                <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Notes</div>
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-md text-sm whitespace-pre-wrap">
                  {metadata.notes}
                </div>
              </div>
            )}

            {metadata.tags && metadata.tags.length > 0 && (
              <div className="space-y-1">
                <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Tags</div>
                <div className="flex flex-wrap gap-2">
                  {(Array.isArray(metadata.tags) ? metadata.tags : []).map((tag: string, index: number) => (
                    <Badge key={index} variant="secondary">
                      <Tag className="mr-1 h-3 w-3" />
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          {onSaveMetadata && (
            <Button onClick={() => setIsEditing(true)} className="w-full">
              Edit Metadata
            </Button>
          )}
        </>
      )}
    </div>
  )

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {type === 'invoice' && 'Invoice Details'}
            {type === 'payment' && 'Payment Details'}
            {type === 'supplier-invoice' && 'Supplier Invoice Details'}
          </SheetTitle>
          <SheetDescription>
            {type === 'invoice' && 'View invoice details and manage metadata'}
            {type === 'payment' && 'View payment transaction details'}
            {type === 'supplier-invoice' && 'View uploaded supplier invoice'}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6">
          {type === 'payment' ? (
            // Payments don't have tabs, just show the content
            renderPaymentContent()
          ) : (
            <Tabs defaultValue="summary" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="metadata">Metadata</TabsTrigger>
              </TabsList>

              <TabsContent value="summary" className="space-y-4 mt-4">
                {type === 'invoice' && renderInvoiceContent()}
                {type === 'supplier-invoice' && renderSupplierInvoiceContent()}
              </TabsContent>

              <TabsContent value="metadata" className="space-y-4 mt-4">
                {renderMetadataTab()}
              </TabsContent>
            </Tabs>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
