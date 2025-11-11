
'use client'

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Mail,
  Phone,
  MapPin,
  CheckCircle,
  XCircle,
  Building2
} from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export interface SortRule {
  field: string
  direction: 'asc' | 'desc'
}

interface DirectoryTableProps<T> {
  data: T[]
  columns: {
    key: string
    label: string
    sortable?: boolean
    render: (item: T) => React.ReactNode
  }[]
  onRowClick?: (item: T) => void
  isLoading?: boolean
  pagination: {
    page: number
    pageSize: number
    totalRecords: number
    totalPages: number
  }
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  sortRules: SortRule[]
  onSortChange: (sortRules: SortRule[]) => void
  emptyMessage?: string
  emptyDescription?: string
}

export function DirectoryTable<T extends { id: string }>({
  data,
  columns,
  onRowClick,
  isLoading,
  pagination,
  onPageChange,
  onPageSizeChange,
  sortRules,
  onSortChange,
  emptyMessage = "No records found",
  emptyDescription = "Get started by adding your first record"
}: DirectoryTableProps<T>) {
  const [shiftPressed, setShiftPressed] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setShiftPressed(true)
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setShiftPressed(false)
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  const handleSort = (field: string) => {
    const existingRuleIndex = sortRules.findIndex(rule => rule.field === field)
    
    if (shiftPressed) {
      // Multi-column sorting with Shift key
      if (existingRuleIndex >= 0) {
        // Toggle direction for this field
        const newRules = [...sortRules]
        newRules[existingRuleIndex] = {
          field,
          direction: newRules[existingRuleIndex].direction === 'asc' ? 'desc' : 'asc'
        }
        onSortChange(newRules)
      } else {
        // Add new sort rule
        onSortChange([...sortRules, { field, direction: 'asc' }])
      }
    } else {
      // Single column sorting
      if (existingRuleIndex >= 0 && sortRules.length === 1) {
        // Toggle direction
        onSortChange([{
          field,
          direction: sortRules[0].direction === 'asc' ? 'desc' : 'asc'
        }])
      } else {
        // Replace with new sort
        onSortChange([{ field, direction: 'asc' }])
      }
    }
  }

  const getSortIcon = (field: string) => {
    const rule = sortRules.find(r => r.field === field)
    const index = sortRules.findIndex(r => r.field === field)
    
    if (!rule) {
      return <ArrowUpDown className="h-3 w-3 ml-1 text-gray-400" />
    }

    const badge = sortRules.length > 1 ? (
      <span className="ml-1 text-[10px] bg-blue-100 text-blue-700 px-1 rounded">
        {index + 1}
      </span>
    ) : null

    return (
      <div className="flex items-center">
        {rule.direction === 'asc' ? (
          <ArrowUp className="h-3 w-3 ml-1 text-blue-600" />
        ) : (
          <ArrowDown className="h-3 w-3 ml-1 text-blue-600" />
        )}
        {badge}
      </div>
    )
  }

  const pageNumbers = () => {
    const pages: (number | string)[] = []
    const { page, totalPages } = pagination

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      pages.push(1)
      if (page > 3) pages.push('...')
      
      const start = Math.max(2, page - 1)
      const end = Math.min(totalPages - 1, page + 1)
      
      for (let i = start; i <= end; i++) {
        pages.push(i)
      }
      
      if (page < totalPages - 2) pages.push('...')
      pages.push(totalPages)
    }

    return pages
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((col, idx) => (
                  <TableHead key={idx} className="text-xs font-semibold py-2">{col.label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, idx) => (
                <TableRow key={idx}>
                  {columns.map((_, colIdx) => (
                    <TableCell key={colIdx} className="py-2">
                      <Skeleton className="h-3 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-12 border rounded-lg">
        <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          {emptyMessage}
        </h3>
        <p className="text-gray-500 dark:text-gray-400">
          {emptyDescription}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 dark:bg-gray-900">
                {columns.map((column) => (
                  <TableHead 
                    key={column.key}
                    className={cn(
                      "text-xs font-semibold py-2",
                      column.sortable && "cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 select-none",
                      "transition-colors"
                    )}
                    onClick={() => column.sortable && handleSort(column.key)}
                  >
                    <div className="flex items-center">
                      {column.label}
                      {column.sortable && getSortIcon(column.key)}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((item) => (
                <TableRow
                  key={item.id}
                  className={cn(
                    "text-xs",
                    onRowClick && "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800",
                    "transition-colors"
                  )}
                  onClick={() => onRowClick?.(item)}
                >
                  {columns.map((column) => (
                    <TableCell key={column.key} className="py-2">
                      {column.render(item)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-700 dark:text-gray-300">
            Showing {((pagination.page - 1) * pagination.pageSize) + 1} to{' '}
            {Math.min(pagination.page * pagination.pageSize, pagination.totalRecords)} of{' '}
            {pagination.totalRecords.toLocaleString()} records
          </span>
          <select
            value={pagination.pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="border rounded px-2 py-1 text-xs"
          >
            <option value={25}>25 per page</option>
            <option value={50}>50 per page</option>
            <option value={100}>100 per page</option>
            <option value={200}>200 per page</option>
          </select>
        </div>

        <div className="flex items-center gap-1">
          {/* First Page */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(1)}
            disabled={pagination.page === 1}
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>

          {/* Previous Page */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(pagination.page - 1)}
            disabled={pagination.page === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          {/* Page Numbers */}
          {pageNumbers().map((pageNum, idx) => (
            <Button
              key={idx}
              variant={pageNum === pagination.page ? "default" : "outline"}
              size="sm"
              onClick={() => typeof pageNum === 'number' && onPageChange(pageNum)}
              disabled={typeof pageNum === 'string'}
              className={cn(
                "min-w-[36px]",
                typeof pageNum === 'string' && "cursor-default"
              )}
            >
              {pageNum}
            </Button>
          ))}

          {/* Next Page */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(pagination.page + 1)}
            disabled={pagination.page === pagination.totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          {/* Last Page */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(pagination.totalPages)}
            disabled={pagination.page === pagination.totalPages}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Sorting Hint */}
      {sortRules.length > 0 && (
        <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
          {sortRules.length === 1 ? (
            <>Sorting by {sortRules[0].field} ({sortRules[0].direction}). Hold Shift to add more sort columns.</>
          ) : (
            <>Multi-column sorting active. Click column headers without Shift to reset.</>
          )}
        </div>
      )}
    </div>
  )
}
