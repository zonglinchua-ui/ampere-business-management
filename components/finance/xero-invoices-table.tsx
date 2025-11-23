
'use client'

import { useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Search, Filter, ArrowUpDown, MoreHorizontal, ExternalLink, Edit, FileText, Tag } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { format } from 'date-fns'

interface XeroInvoice {
  id: string
  invoiceNumber: string
  customerName: string
  amount: number
  status: string
  dueDate: string
  issueDate: string
  projectName?: string
  poNumber?: string
  xeroUrl?: string
  lastUpdated: string
  type?: 'CUSTOMER' | 'SUPPLIER' // Customer invoice (receivable) or Supplier invoice (payable)
}

interface XeroInvoicesTableProps {
  invoices: XeroInvoice[]
  onInvoiceClick: (invoice: XeroInvoice) => void
  onEditMetadata: (invoiceId: string) => void
  showTypeColumn?: boolean // Whether to show the Type column
  entityLabel?: string // Label for the entity column (e.g., 'Customer' or 'Supplier')
  pagination?: {
    page: number
    pageSize: number
    totalCount: number
    totalPages: number
  }
  onPageChange?: (page: number) => void
}

export function XeroInvoicesTable({
  invoices,
  onInvoiceClick,
  onEditMetadata,
  showTypeColumn = false,
  entityLabel = 'Customer/Supplier',
  pagination,
  onPageChange
}: XeroInvoicesTableProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortField, setSortField] = useState<keyof XeroInvoice>('issueDate')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  // Filter invoices with defensive checks
  const safeInvoices = Array.isArray(invoices) ? invoices : []
  const filteredInvoices = safeInvoices.filter(invoice => {
    if (!invoice) return false
    
    const matchesSearch = 
      (invoice.invoiceNumber || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (invoice.customerName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (invoice.poNumber?.toLowerCase() || '').includes(searchQuery.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter

    return matchesSearch && matchesStatus
  })

  // Sort invoices
  const sortedInvoices = [...filteredInvoices].sort((a, b) => {
    const aValue = a[sortField]
    const bValue = b[sortField]
    
    if (aValue === null || aValue === undefined) return 1
    if (bValue === null || bValue === undefined) return -1
    
    let comparison = 0
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      comparison = aValue.localeCompare(bValue)
    } else if (typeof aValue === 'number' && typeof bValue === 'number') {
      comparison = aValue - bValue
    } else {
      comparison = String(aValue).localeCompare(String(bValue))
    }
    
    return sortDirection === 'asc' ? comparison : -comparison
  })

  const handleSort = (field: keyof XeroInvoice) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case 'PAID':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'PARTIALLY_PAID':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
      case 'APPROVED':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
      case 'SENT':
      case 'AUTHORISED':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case 'DRAFT':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
      case 'OVERDUE':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      case 'CANCELLED':
      case 'VOIDED':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center space-x-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search invoices, clients, or PO numbers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="SENT">Sent</SelectItem>
            <SelectItem value="PAID">Paid</SelectItem>
            <SelectItem value="PARTIALLY_PAID">Partially Paid</SelectItem>
            <SelectItem value="OVERDUE">Overdue</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50 dark:bg-gray-800">
              <TableHead className="text-xs font-semibold py-2 cursor-pointer" onClick={() => handleSort('issueDate')}>
                <div className="flex items-center">
                  Invoice Date
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </div>
              </TableHead>
              {showTypeColumn && (
                <TableHead className="text-xs font-semibold py-2">Type</TableHead>
              )}
              <TableHead className="text-xs font-semibold py-2 cursor-pointer" onClick={() => handleSort('invoiceNumber')}>
                <div className="flex items-center">
                  Invoice #
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </div>
              </TableHead>
              <TableHead className="text-xs font-semibold py-2 cursor-pointer" onClick={() => handleSort('customerName')}>
                <div className="flex items-center">
                  {entityLabel}
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </div>
              </TableHead>
              <TableHead className="text-xs font-semibold py-2 cursor-pointer" onClick={() => handleSort('amount')}>
                <div className="flex items-center">
                  Amount
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </div>
              </TableHead>
              <TableHead className="text-xs font-semibold py-2 cursor-pointer" onClick={() => handleSort('status')}>
                <div className="flex items-center">
                  Status
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </div>
              </TableHead>
              <TableHead className="text-xs font-semibold py-2 cursor-pointer" onClick={() => handleSort('dueDate')}>
                <div className="flex items-center">
                  Due Date
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </div>
              </TableHead>
              <TableHead className="text-xs font-semibold py-2">Project</TableHead>
              <TableHead className="text-xs font-semibold py-2">PO No</TableHead>
              <TableHead className="text-xs font-semibold py-2">Category</TableHead>
              <TableHead className="text-xs font-semibold py-2 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedInvoices.length > 0 ? (
              sortedInvoices.map((invoice) => (
                <TableRow
                  key={invoice.id}
                  className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                  onClick={() => onInvoiceClick(invoice)}
                >
                  <TableCell className="py-2 text-xs">
                    {format(new Date(invoice.issueDate), 'MMM dd, yyyy')}
                  </TableCell>
                  {showTypeColumn && (
                    <TableCell className="py-2 text-xs">
                      <Badge 
                        variant="outline" 
                        className={invoice.type === 'SUPPLIER' 
                          ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' 
                          : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                        }
                      >
                        {invoice.type === 'SUPPLIER' ? 'Supplier' : 'Customer'}
                      </Badge>
                    </TableCell>
                  )}
                  <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                  <TableCell className="py-2 text-xs">{invoice.customerName}</TableCell>
                  <TableCell className="font-semibold">
                    {formatCurrency(invoice.amount, 'SGD')}
                  </TableCell>
                  <TableCell className="py-2 text-xs">
                    <Badge variant="outline" className={getStatusColor(invoice.status)}>
                      {invoice.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-2 text-xs">
                    {format(new Date(invoice.dueDate), 'MMM dd, yyyy')}
                  </TableCell>
                  <TableCell className="py-2 text-xs">
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      {invoice.projectName || '-'}
                    </span>
                  </TableCell>
                  <TableCell className="py-2 text-xs">
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      {invoice.poNumber || '-'}
                    </span>
                  </TableCell>
                  <TableCell className="py-2 text-xs">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        onEditMetadata(invoice.id)
                      }}
                      className="h-7 text-xs"
                    >
                      <Tag className="mr-1 h-3 w-3" />
                      Add Category
                    </Button>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation()
                          onInvoiceClick(invoice)
                        }}>
                          <FileText className="mr-2 h-4 w-4" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation()
                          onEditMetadata(invoice.id)
                        }}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit Metadata
                        </DropdownMenuItem>
                        {invoice.xeroUrl && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation()
                              window.open(invoice.xeroUrl, '_blank')
                            }}>
                              <ExternalLink className="mr-2 h-4 w-4" />
                              Open in Xero
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={showTypeColumn ? 11 : 10} className="text-center py-12">
                  <div className="flex flex-col items-center justify-center text-gray-500">
                    <FileText className="h-12 w-12 mb-2 opacity-50" />
                    <p className="text-lg font-medium">No invoices found</p>
                    <p className="text-xs">
                      {searchQuery || statusFilter !== 'all'
                        ? 'Try adjusting your filters'
                        : 'Sync from Xero to load invoices'}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Results count and pagination */}
      <div className="flex items-center justify-between mt-4">
        {sortedInvoices.length > 0 && (
          <div className="text-xs text-gray-600 dark:text-gray-400">
            {pagination ? (
              <>
                Showing {sortedInvoices.length} invoices on this page (Page {pagination.page} of {pagination.totalPages} - Total: {pagination.totalCount})
              </>
            ) : (
              <>
                Showing {sortedInvoices.length} of {invoices.length} invoices
              </>
            )}
          </div>
        )}

        {/* Pagination Controls */}
        {pagination && onPageChange && pagination.totalPages > 1 && (
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
            >
              Previous
            </Button>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
