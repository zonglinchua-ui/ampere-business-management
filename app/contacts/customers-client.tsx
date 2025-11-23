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

interface Customer {
  id: string
  customerNumber?: string
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
  customerType: string
  isActive: boolean
  createdAt: string
  isXeroSynced?: boolean
  xeroContactId?: string | null
  totalProjectValue?: number
  _count?: {
    Project: number
    CustomerInvoice: number
    LegacyInvoice: number
  }
}

export function CustomersClient() {
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

  const { data: customers, pagination, isLoading, refetch } = useDirectoryData<Customer>(
    '/api/customers',
    {
      page,
      pageSize,
      search: debouncedSearch,
      sortRules
    },
    'customers'
  )

  // Listen for Xero sync completion
  useEffect(() => {
    const unsubscribe = eventBus.on(XERO_SYNC_COMPLETED, () => {
      console.log('Xero sync completed, refreshing customers...')
      refetch()
    })
    return () => unsubscribe()
  }, [refetch])

  const getStatusBadge = (customer: Customer) => {
    if (!customer.isActive) {
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

  const getTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      ENTERPRISE: "bg-purple-100 text-purple-800",
      SME: "bg-blue-100 text-blue-800",
      GOVERNMENT: "bg-green-100 text-green-800",
      INDIVIDUAL: "bg-orange-100 text-orange-800",
    }
    const labels: Record<string, string> = {
      ENTERPRISE: "Enterprise",
      SME: "SME",
      GOVERNMENT: "Government",
      INDIVIDUAL: "Individual",
    }
    return (
      <Badge variant="secondary" className={`${colors[type] || "bg-gray-100 text-gray-800"} text-[10px] px-1.5 py-0`}>
        {labels[type] || type}
      </Badge>
    )
  }

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount == null) return "-"
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const columns = [
    {
      key: 'customerNumber',
      label: 'Customer No',
      sortable: true,
      render: (customer: Customer) => (
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-xs">{customer.customerNumber || "N/A"}</span>
          {customer.isXeroSynced && (
            <Badge variant="outline" className="text-[10px] px-1 py-0">Xero</Badge>
          )}
        </div>
      ),
    },
    {
      key: 'name',
      label: 'Customer Name',
      sortable: true,
      render: (customer: Customer) => (
        <div>
          <div className="font-medium text-xs">{customer.name}</div>
          {customer.companyReg && (
            <div className="text-[10px] text-gray-500">{customer.companyReg}</div>
          )}
        </div>
      ),
    },
    {
      key: 'createdAt',
      label: 'Added On',
      sortable: true,
      render: (customer: Customer) => (
        <div className="text-xs text-gray-600">
          {new Date(customer.createdAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          })}
        </div>
      ),
    },
    {
      key: 'totalProjectValue',
      label: 'Total Project Value',
      sortable: true,
      render: (customer: Customer) => {
        const totalValue = customer.totalProjectValue || 0
        const projectCount = customer._count?.Project || 0
        return (
          <div className="text-xs">
            <div className="font-medium">
              {formatCurrency(totalValue)}
            </div>
            {projectCount > 0 && (
              <div className="text-[10px] text-gray-500">
                {projectCount} project{projectCount !== 1 ? 's' : ''}
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
      render: (customer: Customer) => (
        <div className="space-y-0.5">
          {customer.email && (
            <div className="flex items-center text-xs text-gray-600">
              <Mail className="h-2.5 w-2.5 mr-1.5 text-gray-400" />
              {customer.email}
            </div>
          )}
          {customer.phone && (
            <div className="flex items-center text-xs text-gray-600">
              <Phone className="h-2.5 w-2.5 mr-1.5 text-gray-400" />
              {customer.phone}
            </div>
          )}
          {!customer.email && !customer.phone && <span className="text-xs text-gray-400">-</span>}
        </div>
      ),
    },
    {
      key: 'companyReg',
      label: 'Company Reg',
      sortable: true,
      render: (customer: Customer) => (
        <div className="text-xs">{customer.companyReg || "-"}</div>
      ),
    },
    {
      key: 'customerType',
      label: 'Type',
      sortable: true,
      render: (customer: Customer) => getTypeBadge(customer.customerType),
    },
    {
      key: 'isActive',
      label: 'Status',
      sortable: true,
      render: (customer: Customer) => getStatusBadge(customer),
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
              <CardTitle className="text-2xl font-bold">{pagination.totalRecords.toLocaleString()} Customers</CardTitle>
              <CardDescription>Total customers in your directory</CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Main Directory Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Customers Directory</CardTitle>
              <CardDescription>
                Manage your customer relationships and information
              </CardDescription>
            </div>
            <Button onClick={() => router.push('/contacts/customers/new')}>
              <Plus className="h-4 w-4 mr-2" />
              Add Customer
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by name, email, phone, customer number, or company registration..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Directory Table */}
          <DirectoryTable
            data={customers}
            columns={columns}
            onRowClick={(customer) => router.push(`/clients/${customer.id}`)}
            isLoading={isLoading}
            pagination={pagination}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size)
              setPage(1)
            }}
            sortRules={sortRules}
            onSortChange={setSortRules}
            emptyMessage={searchTerm ? "No customers match your search" : "No customers found"}
            emptyDescription={searchTerm ? "Try adjusting your search terms" : "Get started by adding your first customer"}
          />
        </CardContent>
      </Card>
    </div>
  )
}
