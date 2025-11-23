
'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  Search, 
  Filter, 
  Upload, 
  FileText, 
  Download, 
  Eye, 
  Calendar,
  Building2,
  DollarSign
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { format } from 'date-fns'

interface SupplierInvoice {
  id: string
  uploadDate: string
  supplierName: string
  amount: number
  currency: string
  projectName?: string
  poNumber?: string
  uploadedBy: string
  attachmentUrl?: string
  notes?: string
  status?: string
}

interface SupplierInvoicesGridProps {
  invoices: SupplierInvoice[]
  onInvoiceClick: (invoice: SupplierInvoice) => void
  onUploadClick: () => void
}

export function SupplierInvoicesGrid({
  invoices,
  onInvoiceClick,
  onUploadClick
}: SupplierInvoicesGridProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [supplierFilter, setSupplierFilter] = useState('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  // Get unique suppliers with defensive check
  const safeInvoices = Array.isArray(invoices) ? invoices : []
  const uniqueSuppliers = Array.from(new Set(safeInvoices.map(inv => inv?.supplierName).filter(Boolean)))

  // Filter invoices with defensive checks
  const filteredInvoices = safeInvoices.filter(invoice => {
    // Ensure invoice exists and has required properties
    if (!invoice || !invoice.supplierName) return false
    
    const matchesSearch = 
      invoice.supplierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (invoice.poNumber?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (invoice.projectName?.toLowerCase() || '').includes(searchQuery.toLowerCase())
    
    const matchesSupplier = supplierFilter === 'all' || invoice.supplierName === supplierFilter

    return matchesSearch && matchesSupplier
  })

  const getStatusColor = (status?: string) => {
    if (!status) return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
    
    switch (status.toUpperCase()) {
      case 'APPROVED':
      case 'PAID':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      case 'REJECTED':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      default:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
    }
  }

  return (
    <div className="space-y-4">
      {/* Header with filters */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4 flex-1">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search supplier invoices..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={supplierFilter} onValueChange={setSupplierFilter}>
            <SelectTrigger className="w-[200px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Filter by supplier" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Suppliers</SelectItem>
              {uniqueSuppliers.map(supplier => (
                <SelectItem key={supplier} value={supplier}>{supplier}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={onUploadClick}>
          <Upload className="mr-2 h-4 w-4" />
          Upload Invoice
        </Button>
      </div>

      {/* Grid/List View */}
      {filteredInvoices.length > 0 ? (
        viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredInvoices.map((invoice) => (
              <Card 
                key={invoice.id} 
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => onInvoiceClick(invoice)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center justify-center w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg">
                        <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm truncate max-w-[150px]">
                          {invoice.supplierName}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {format(new Date(invoice.uploadDate), 'MMM dd, yyyy')}
                        </p>
                      </div>
                    </div>
                    {invoice.status && (
                      <Badge variant="outline" className={getStatusColor(invoice.status)}>
                        {invoice.status}
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Amount</span>
                      <span className="font-semibold">
                        {formatCurrency(invoice.amount, invoice.currency === 'USD' ? 'USD' : 'SGD')}
                      </span>
                    </div>
                    {invoice.projectName && (
                      <div className="flex items-center text-xs text-gray-600 dark:text-gray-400">
                        <Building2 className="mr-1 h-3 w-3" />
                        {invoice.projectName}
                      </div>
                    )}
                    {invoice.poNumber && (
                      <div className="flex items-center text-xs text-gray-600 dark:text-gray-400">
                        <FileText className="mr-1 h-3 w-3" />
                        PO: {invoice.poNumber}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      by {invoice.uploadedBy}
                    </span>
                    {invoice.attachmentUrl && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          window.open(invoice.attachmentUrl, '_blank')
                        }}
                      >
                        <Download className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredInvoices.map((invoice) => (
              <Card 
                key={invoice.id} 
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => onInvoiceClick(invoice)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center justify-center w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg">
                        <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{invoice.supplierName}</h3>
                        <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600 dark:text-gray-400">
                          <span className="flex items-center">
                            <Calendar className="mr-1 h-3 w-3" />
                            {format(new Date(invoice.uploadDate), 'MMM dd, yyyy')}
                          </span>
                          {invoice.projectName && (
                            <span className="flex items-center">
                              <Building2 className="mr-1 h-3 w-3" />
                              {invoice.projectName}
                            </span>
                          )}
                          {invoice.poNumber && (
                            <span>PO: {invoice.poNumber}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <div className="font-semibold text-lg">
                          {formatCurrency(invoice.amount, invoice.currency === 'USD' ? 'USD' : 'SGD')}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          by {invoice.uploadedBy}
                        </div>
                      </div>
                      {invoice.status && (
                        <Badge variant="outline" className={getStatusColor(invoice.status)}>
                          {invoice.status}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Upload className="h-16 w-16 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No supplier invoices
            </h3>
            <p className="text-gray-500 text-center mb-6">
              {searchQuery || supplierFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Upload your first supplier invoice to get started'}
            </p>
            {!searchQuery && supplierFilter === 'all' && (
              <Button onClick={onUploadClick}>
                <Upload className="mr-2 h-4 w-4" />
                Upload Invoice
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Results count */}
      {filteredInvoices.length > 0 && (
        <div className="text-xs text-gray-600 dark:text-gray-400">
          Showing {filteredInvoices.length} of {invoices.length} supplier invoices
        </div>
      )}
    </div>
  )
}
