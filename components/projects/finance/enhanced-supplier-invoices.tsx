
'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { 
  FileText, 
  Upload, 
  Search, 
  Filter, 
  Tag, 
  Download,
  Calendar,
  DollarSign,
  Building2,
  Paperclip
} from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { ProjectInvoiceUploadWithOCR } from './project-invoice-upload-with-ocr'
import { BudgetCategoryTag } from './budget-category-tag'

interface EnhancedSupplierInvoicesProps {
  projectId: string
  project: {
    id: string
    name: string
    projectNumber: string
  }
}

interface SupplierInvoice {
  id: string
  invoiceNumber: string
  supplierInvoiceRef?: string
  totalAmount: number
  status: string
  invoiceDate: string
  dueDate: string
  documentPath?: string
  notes?: string
  Supplier: {
    id: string
    name: string
  }
  SupplierInvoiceItem: Array<{
    id: string
    description: string
    totalPrice: number
    budgetCategoryId?: string
    BudgetCategory?: {
      id: string
      name: string
      code: string
      color?: string
    }
  }>
}

interface Supplier {
  id: string
  name: string
}

interface BudgetCategory {
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

export function EnhancedSupplierInvoices({ projectId, project }: EnhancedSupplierInvoicesProps) {
  const [loading, setLoading] = useState(true)
  const [invoices, setInvoices] = useState<SupplierInvoice[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [budgetCategories, setBudgetCategories] = useState<BudgetCategory[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<SupplierInvoice | null>(null)
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false)

  useEffect(() => {
    fetchData()
  }, [projectId])

  const fetchData = async () => {
    try {
      setLoading(true)

      // Fetch supplier invoices
      const invoicesResponse = await fetch(`/api/projects/${projectId}/supplier-invoices`)
      if (invoicesResponse.ok) {
        const invoicesData = await invoicesResponse.json()
        setInvoices(invoicesData.supplierInvoices || [])
      }

      // Fetch ALL suppliers (remove pagination limit)
      const suppliersResponse = await fetch('/api/suppliers?pageSize=1000')
      if (suppliersResponse.ok) {
        const suppliersData = await suppliersResponse.json()
        setSuppliers(suppliersData.data || [])
      }

      // Fetch budget categories
      const budgetResponse = await fetch(`/api/projects/${projectId}/budget`)
      if (budgetResponse.ok) {
        const budgetData = await budgetResponse.json()
        setBudgetCategories(budgetData.budgets || [])
      }

    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Failed to load invoice data')
    } finally {
      setLoading(false)
    }
  }

  const handleInvoiceClick = (invoice: SupplierInvoice) => {
    setSelectedInvoice(invoice)
    setShowInvoiceDialog(true)
  }

  const downloadInvoice = async (invoice: SupplierInvoice) => {
    if (!invoice.documentPath) {
      toast.error('No document available for this invoice')
      return
    }

    try {
      // Direct link to download endpoint which redirects to signed URL
      const downloadUrl = `/api/documents/download?key=${encodeURIComponent(invoice.documentPath)}`
      window.open(downloadUrl, '_blank')
    } catch (error) {
      console.error('Download error:', error)
      toast.error('Failed to download document')
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; className: string }> = {
      DRAFT: { label: 'Draft', className: 'bg-gray-100 text-gray-800' },
      PENDING: { label: 'Pending', className: 'bg-yellow-100 text-yellow-800' },
      APPROVED: { label: 'Approved', className: 'bg-green-100 text-green-800' },
      PARTIALLY_PAID: { label: 'Partial', className: 'bg-blue-100 text-blue-800' },
      PAID: { label: 'Paid', className: 'bg-green-100 text-green-800' },
      OVERDUE: { label: 'Overdue', className: 'bg-red-100 text-red-800' },
      CANCELLED: { label: 'Cancelled', className: 'bg-gray-100 text-gray-800' },
    }
    const variant = variants[status] || { label: status, className: 'bg-gray-100 text-gray-800' }
    return <Badge className={variant.className}>{variant.label}</Badge>
  }

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

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = 
      invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.Supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (invoice.supplierInvoiceRef && invoice.supplierInvoiceRef.toLowerCase().includes(searchTerm.toLowerCase()))

    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter

    const matchesCategory = categoryFilter === 'all' || 
      invoice.SupplierInvoiceItem.some(item => item.budgetCategoryId === categoryFilter)

    return matchesSearch && matchesStatus && matchesCategory
  })

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Upload */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold flex items-center">
            <FileText className="mr-2 h-5 w-5" />
            Supplier Invoices
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Upload and manage supplier invoices with budget category tagging
          </p>
        </div>
        <Button onClick={() => setShowUploadDialog(!showUploadDialog)}>
          <Upload className="mr-2 h-4 w-4" />
          Upload Invoices
        </Button>
      </div>

      {/* Upload Section */}
      {showUploadDialog && (
        <Card className="border-2 border-blue-200 bg-blue-50/50">
          <CardHeader>
            <CardTitle className="text-lg">Upload Supplier Invoices</CardTitle>
            <CardDescription>
              Drag and drop multiple invoice files and assign them to budget categories
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProjectInvoiceUploadWithOCR
              projectId={projectId}
              suppliers={suppliers}
              budgetCategories={budgetCategories}
              onUploadComplete={fetchData}
            />
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search invoices..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="PAID">Paid</SelectItem>
                  <SelectItem value="OVERDUE">Overdue</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Budget Category</label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {SYSTEM_BUDGET_CATEGORIES.map((category) => (
                    <SelectItem key={category.value} value={category.value}>
                      {category.label}
                    </SelectItem>
                  ))}
                  {budgetCategories.map((category) => (
                    <SelectItem 
                      key={category.id} 
                      value={category.customCategory?.id || category.id}
                    >
                      {category.customCategory?.name || category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button 
                variant="outline" 
                onClick={() => {
                  setSearchTerm('')
                  setStatusFilter('all')
                  setCategoryFilter('all')
                }}
                className="w-full"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invoice Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Invoices ({filteredInvoices.length})</span>
            <div className="text-sm text-gray-600">
              Total: ${filteredInvoices.reduce((sum, inv) => sum + parseFloat(inv.totalAmount.toString()), 0).toLocaleString()}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredInvoices.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No supplier invoices found</p>
              <p className="text-sm mt-1">Upload invoices to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Budget Category</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Document</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map((invoice) => (
                    <TableRow 
                      key={invoice.id} 
                      onClick={() => handleInvoiceClick(invoice)}
                      className="cursor-pointer hover:bg-gray-50"
                    >
                      <TableCell className="font-medium">
                        <div>
                          <div>{invoice.invoiceNumber}</div>
                          {invoice.supplierInvoiceRef && (
                            <div className="text-xs text-gray-500">
                              Ref: {invoice.supplierInvoiceRef}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <Building2 className="h-4 w-4 mr-2 text-gray-400" />
                          {invoice.Supplier.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <DollarSign className="h-4 w-4 mr-1 text-gray-400" />
                          ${parseFloat(invoice.totalAmount.toString()).toLocaleString()}
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(invoice.status)}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="space-y-1">
                          {invoice.SupplierInvoiceItem.length > 0 ? (
                            invoice.SupplierInvoiceItem.map((item) => (
                              <div key={item.id}>
                                <BudgetCategoryTag
                                  currentCategoryId={item.budgetCategoryId}
                                  itemId={item.id}
                                  itemType="supplier_invoice_item"
                                  budgetCategories={budgetCategories}
                                  onCategoryUpdate={fetchData}
                                />
                              </div>
                            ))
                          ) : (
                            <span className="text-xs text-gray-400">No items</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center text-sm">
                          <Calendar className="h-4 w-4 mr-1 text-gray-400" />
                          {format(new Date(invoice.invoiceDate), 'MMM dd, yyyy')}
                        </div>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {invoice.documentPath ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => downloadInvoice(invoice)}
                          >
                            <Paperclip className="h-4 w-4 mr-1" />
                            Download
                          </Button>
                        ) : (
                          <span className="text-xs text-gray-400">No document</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invoice Details Dialog */}
      <Dialog open={showInvoiceDialog} onOpenChange={setShowInvoiceDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedInvoice && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Invoice Details: {selectedInvoice.invoiceNumber}
                </DialogTitle>
                <DialogDescription>
                  View and manage invoice details and budget categories
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 mt-4">
                {/* Invoice Information */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Supplier</label>
                    <div className="flex items-center mt-1">
                      <Building2 className="h-4 w-4 mr-2 text-gray-400" />
                      <span className="font-medium">{selectedInvoice.Supplier.name}</span>
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-600">Status</label>
                    <div className="mt-1">
                      {getStatusBadge(selectedInvoice.status)}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-600">Invoice Date</label>
                    <div className="flex items-center mt-1">
                      <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                      <span>{format(new Date(selectedInvoice.invoiceDate), 'MMM dd, yyyy')}</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-600">Due Date</label>
                    <div className="flex items-center mt-1">
                      <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                      <span>{format(new Date(selectedInvoice.dueDate), 'MMM dd, yyyy')}</span>
                    </div>
                  </div>

                  {selectedInvoice.supplierInvoiceRef && (
                    <div>
                      <label className="text-sm font-medium text-gray-600">Supplier Reference</label>
                      <div className="mt-1">
                        <span className="text-sm">{selectedInvoice.supplierInvoiceRef}</span>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-sm font-medium text-gray-600">Total Amount</label>
                    <div className="flex items-center mt-1">
                      <DollarSign className="h-5 w-5 mr-1 text-green-600" />
                      <span className="text-lg font-bold text-green-600">
                        ${parseFloat(selectedInvoice.totalAmount.toString()).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {selectedInvoice.notes && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Notes</label>
                    <div className="mt-1 p-3 bg-gray-50 rounded-md">
                      <p className="text-sm">{selectedInvoice.notes}</p>
                    </div>
                  </div>
                )}

                {/* Invoice Items */}
                <div>
                  <h4 className="text-sm font-semibold mb-3">Invoice Items & Budget Categories</h4>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Description</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Budget Category</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedInvoice.SupplierInvoiceItem.length > 0 ? (
                          selectedInvoice.SupplierInvoiceItem.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell>{item.description}</TableCell>
                              <TableCell>
                                <div className="flex items-center">
                                  <DollarSign className="h-4 w-4 mr-1 text-gray-400" />
                                  ${parseFloat(item.totalPrice.toString()).toLocaleString()}
                                </div>
                              </TableCell>
                              <TableCell>
                                <BudgetCategoryTag
                                  currentCategoryId={item.budgetCategoryId}
                                  itemId={item.id}
                                  itemType="supplier_invoice_item"
                                  budgetCategories={budgetCategories}
                                  onCategoryUpdate={() => {
                                    fetchData()
                                    // Refresh the selected invoice data
                                    const updatedInvoice = invoices.find(inv => inv.id === selectedInvoice.id)
                                    if (updatedInvoice) {
                                      setSelectedInvoice(updatedInvoice)
                                    }
                                  }}
                                />
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center text-gray-500">
                              No items found for this invoice
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Document Download */}
                {selectedInvoice.documentPath && (
                  <div className="flex justify-between items-center p-4 bg-blue-50 rounded-lg">
                    <div className="flex items-center">
                      <Paperclip className="h-5 w-5 mr-2 text-blue-600" />
                      <div>
                        <div className="font-medium">Invoice Document</div>
                        <div className="text-sm text-gray-600">Download the attached invoice file</div>
                      </div>
                    </div>
                    <Button onClick={() => downloadInvoice(selectedInvoice)}>
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
