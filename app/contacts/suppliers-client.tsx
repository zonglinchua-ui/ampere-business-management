'use client'

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { 
  Building2, 
  Search, 
  Plus,
  CheckCircle,
  XCircle,
  Mail,
  Phone
} from "lucide-react"
import { DirectoryTable, SortRule } from "@/components/contacts/directory-table"
import { useDirectoryData } from "@/hooks/use-directory-data"
import { eventBus, XERO_SYNC_COMPLETED } from "@/lib/events"
import { useEffect } from "react"

interface Supplier {
  id: string
  supplierNumber?: string
  name: string
  email?: string | null
  phone?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  country: string
  postalCode?: string | null
  contactPerson?: string | null
  companyReg?: string | null
  website?: string | null
  notes?: string | null
  supplierType?: string | null
  paymentTerms?: string | null
  isActive: boolean
  createdAt: string
  isXeroSynced?: boolean
  xeroContactId?: string | null
  totalPurchaseValue?: number
  _count?: {
    SupplierInvoice: number
  }
}

export function SuppliersClient() {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [sortRules, setSortRules] = useState<SortRule[]>([
    { field: 'createdAt', direction: 'desc' }
  ])

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm)
      setPage(1) // Reset to first page on search
    }, 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  const { data: suppliers, pagination, isLoading, refetch } = useDirectoryData<Supplier>(
    '/api/suppliers',
    {
      page,
      pageSize,
      search: debouncedSearch,
      sortRules
    },
    'suppliers'
  )

  // Listen for Xero sync completion
  useEffect(() => {
    const unsubscribe = eventBus.on(XERO_SYNC_COMPLETED, () => {
      console.log('Xero sync completed, refreshing suppliers...')
      refetch()
    })
    return () => unsubscribe()
  }, [refetch])

  const getStatusBadge = (supplier: Supplier) => {
    if (!supplier.isActive) {
      return (
        <Badge variant="secondary" className="bg-gray-100 text-gray-800 text-[10px] px-1.5 py-0">
          <XCircle className="h-2.5 w-2.5 mr-0.5" />
          Inactive
        </Badge>
      )
    }
    return (
      <Badge variant="secondary" className="bg-green-100 text-green-800 text-[10px] px-1.5 py-0">
        <CheckCircle className="h-2.5 w-2.5 mr-0.5" />
        Active
      </Badge>
    )
  }

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount == null) return "-"
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const columns = [
    {
      key: 'supplierNumber',
      label: 'Supplier No',
      sortable: true,
      render: (supplier: Supplier) => (
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-xs">{supplier.supplierNumber || "N/A"}</span>
          {supplier.isXeroSynced && (
            <Badge variant="outline" className="text-[10px] px-1 py-0">Xero</Badge>
          )}
        </div>
      ),
    },
    {
      key: 'name',
      label: 'Supplier Name',
      sortable: true,
      render: (supplier: Supplier) => (
        <div>
          <div className="font-medium text-xs">{supplier.name}</div>
          {supplier.companyReg && (
            <div className="text-[10px] text-gray-500">{supplier.companyReg}</div>
          )}
        </div>
      ),
    },
    {
      key: 'createdAt',
      label: 'Added On',
      sortable: true,
      render: (supplier: Supplier) => (
        <div className="text-xs text-gray-600">
          {new Date(supplier.createdAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          })}
        </div>
      ),
    },
    {
      key: 'totalPurchaseValue',
      label: 'Total Purchase Value',
      sortable: true,
      render: (supplier: Supplier) => {
        const totalValue = supplier.totalPurchaseValue || 0
        const invoiceCount = supplier._count?.SupplierInvoice || 0
        return (
          <div className="text-xs">
            <div className="font-medium">
              {formatCurrency(totalValue)}
            </div>
            {invoiceCount > 0 && (
              <div className="text-[10px] text-gray-500">
                {invoiceCount} invoice{invoiceCount !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        )
      },
    },
    {
      key: 'email',
      label: 'Contact',
      sortable: true,
      render: (supplier: Supplier) => (
        <div className="space-y-0.5">
          {supplier.email && (
            <div className="flex items-center text-xs text-gray-600">
              <Mail className="h-2.5 w-2.5 mr-1.5 text-gray-400" />
              {supplier.email}
            </div>
          )}
          {supplier.phone && (
            <div className="flex items-center text-xs text-gray-600">
              <Phone className="h-2.5 w-2.5 mr-1.5 text-gray-400" />
              {supplier.phone}
            </div>
          )}
          {!supplier.email && !supplier.phone && <span className="text-xs text-gray-400">-</span>}
        </div>
      ),
    },
    {
      key: 'companyReg',
      label: 'Company Reg',
      sortable: true,
      render: (supplier: Supplier) => (
        <div className="text-xs">{supplier.companyReg || "-"}</div>
      ),
    },
    {
      key: 'paymentTerms',
      label: 'Payment Terms',
      sortable: true,
      render: (supplier: Supplier) => (
        <div className="text-xs">{supplier.paymentTerms || "-"}</div>
      ),
    },
    {
      key: 'isActive',
      label: 'Status',
      sortable: true,
      render: (supplier: Supplier) => getStatusBadge(supplier),
    },
  ]

  return (
    <div className="space-y-6">
      {/* Single Total Count Header */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex items-center gap-3">
            <Building2 className="h-6 w-6 text-muted-foreground" />
            <div>
              <CardTitle className="text-2xl font-bold">{pagination.totalRecords.toLocaleString()} Suppliers</CardTitle>
              <CardDescription>Total suppliers in your directory</CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Main Directory Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Suppliers Directory</CardTitle>
              <CardDescription>
                Manage your supplier relationships and information
              </CardDescription>
            </div>
            <Button onClick={() => router.push('/contacts/suppliers/new')}>
              <Plus className="h-4 w-4 mr-2" />
              Add Supplier
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by name, email, phone, supplier number, or company registration..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Directory Table */}
          <DirectoryTable
            data={suppliers}
            columns={columns}
            onRowClick={(supplier) => router.push(`/suppliers/${supplier.id}`)}
            isLoading={isLoading}
            pagination={pagination}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size)
              setPage(1)
            }}
            sortRules={sortRules}
            onSortChange={setSortRules}
            emptyMessage={searchTerm ? "No suppliers match your search" : "No suppliers found"}
            emptyDescription={searchTerm ? "Try adjusting your search terms" : "Get started by adding your first supplier"}
          />
        </CardContent>
      </Card>
    </div>
  )
}
