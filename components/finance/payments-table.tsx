
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
import { Search, Filter, ArrowUpDown, ArrowDownRight, ArrowUpRight, CreditCard } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { format } from 'date-fns'

interface Payment {
  id: string
  paymentNumber: string
  invoiceNumber?: string
  clientName?: string
  amount: number
  currency: string
  date: string
  method: string
  reference?: string
  status: string
  projectName?: string
  type: 'received' | 'sent'
}

interface PaymentsTableProps {
  payments: Payment[]
  onPaymentClick: (payment: Payment) => void
  pagination?: {
    page: number
    pageSize: number
    totalCount: number
    totalPages: number
  }
  onPageChange?: (page: number) => void
  hideTypeColumn?: boolean
}

export function PaymentsTable({
  payments,
  onPaymentClick,
  pagination,
  onPageChange,
  hideTypeColumn = false
}: PaymentsTableProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [sortField, setSortField] = useState<keyof Payment>('date')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  // Filter payments with defensive checks
  const safePayments = Array.isArray(payments) ? payments : []
  const filteredPayments = safePayments.filter(payment => {
    if (!payment) return false
    
    const matchesSearch = 
      (payment.paymentNumber || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (payment.invoiceNumber?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (payment.clientName?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (payment.reference?.toLowerCase() || '').includes(searchQuery.toLowerCase())
    
    const matchesType = 
      typeFilter === 'all' || 
      (typeFilter === 'received' && payment.type === 'received') ||
      (typeFilter === 'sent' && payment.type === 'sent')

    return matchesSearch && matchesType
  })

  // Sort payments
  const sortedPayments = [...filteredPayments].sort((a, b) => {
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

  const handleSort = (field: keyof Payment) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case 'COMPLETED':
      case 'PAID':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'PROCESSING':
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      case 'FAILED':
      case 'CANCELLED':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
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
            placeholder="Search payments, invoices, or clients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        {!hideTypeColumn && (
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[180px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Payments</SelectItem>
              <SelectItem value="received">Payments Received</SelectItem>
              <SelectItem value="sent">Payments Sent</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50 dark:bg-gray-800">
              <TableHead className="text-xs font-semibold py-2 cursor-pointer" onClick={() => handleSort('date')}>
                <div className="flex items-center">
                  Payment Date
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </div>
              </TableHead>
              {!hideTypeColumn && (
                <TableHead className="text-xs font-semibold py-2">Type</TableHead>
              )}
              <TableHead className="text-xs font-semibold py-2 cursor-pointer" onClick={() => handleSort('paymentNumber')}>
                <div className="flex items-center">
                  Payment ID
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </div>
              </TableHead>
              <TableHead className="text-xs font-semibold py-2">Invoice #</TableHead>
              <TableHead className="text-xs font-semibold py-2 cursor-pointer" onClick={() => handleSort('clientName')}>
                <div className="flex items-center">
                  Customer/Supplier
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </div>
              </TableHead>
              <TableHead className="text-xs font-semibold py-2 cursor-pointer" onClick={() => handleSort('amount')}>
                <div className="flex items-center">
                  Amount
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </div>
              </TableHead>
              <TableHead className="text-xs font-semibold py-2">Method</TableHead>
              <TableHead className="text-xs font-semibold py-2">Reference</TableHead>
              <TableHead className="text-xs font-semibold py-2">Project</TableHead>
              <TableHead className="text-xs font-semibold py-2">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedPayments.length > 0 ? (
              sortedPayments.map((payment) => (
                <TableRow
                  key={payment.id}
                  className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                  onClick={() => onPaymentClick(payment)}
                >
                  <TableCell className="py-2 text-xs">
                    {format(new Date(payment.date), 'MMM dd, yyyy HH:mm')}
                  </TableCell>
                  {!hideTypeColumn && (
                    <TableCell className="py-2 text-xs">
                      <Badge 
                        variant="outline" 
                        className={payment.type === 'received' 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                          : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }
                      >
                        <span className="flex items-center gap-1">
                          {payment.type === 'received' ? (
                            <>
                              <ArrowDownRight className="w-3 h-3" />
                              Payment In
                            </>
                          ) : (
                            <>
                              <ArrowUpRight className="w-3 h-3" />
                              Payment Out
                            </>
                          )}
                        </span>
                      </Badge>
                    </TableCell>
                  )}
                  <TableCell className="font-medium">{payment.paymentNumber}</TableCell>
                  <TableCell className="py-2 text-xs">
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      {payment.invoiceNumber || '-'}
                    </span>
                  </TableCell>
                  <TableCell className="py-2 text-xs">{payment.clientName || '-'}</TableCell>
                  <TableCell className="font-semibold">
                    <span className={payment.type === 'received' ? 'text-green-600' : 'text-red-600'}>
                      {payment.type === 'received' ? '+' : '-'}
                      {formatCurrency(payment.amount, payment.currency === 'USD' ? 'USD' : 'SGD')}
                    </span>
                  </TableCell>
                  <TableCell className="py-2 text-xs">
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      {payment.method || '-'}
                    </span>
                  </TableCell>
                  <TableCell className="py-2 text-xs">
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      {payment.reference || '-'}
                    </span>
                  </TableCell>
                  <TableCell className="py-2 text-xs">
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      {payment.projectName || '-'}
                    </span>
                  </TableCell>
                  <TableCell className="py-2 text-xs">
                    <Badge variant="outline" className={getStatusColor(payment.status)}>
                      {payment.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-12">
                  <div className="flex flex-col items-center justify-center text-gray-500">
                    <CreditCard className="h-12 w-12 mb-2 opacity-50" />
                    <p className="text-lg font-medium">No payments found</p>
                    <p className="text-xs">
                      {searchQuery || typeFilter !== 'all'
                        ? 'Try adjusting your filters'
                        : 'Sync from Xero to load payments'}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Results count and pagination */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-600 dark:text-gray-400">
          {pagination ? (
            <>Showing {sortedPayments.length} of {pagination.totalCount} total payments</>
          ) : (
            <>Showing {sortedPayments.length} payments</>
          )}
        </div>

        {pagination && pagination.totalPages > 1 && onPageChange && (
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(Math.max(1, pagination.page - 1))}
              disabled={pagination.page === 1}
            >
              Previous
            </Button>
            <span className="text-xs text-gray-600 dark:text-gray-400">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(Math.min(pagination.totalPages, pagination.page + 1))}
              disabled={pagination.page === pagination.totalPages}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
