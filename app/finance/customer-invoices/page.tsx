
'use client'

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { MainLayout } from "@/components/layout/main-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { 
  FileText,
  Building2,
  DollarSign,
  Calendar,
  Search,
  Filter,
  Plus,
  Download,
  ArrowUpDown,
  MoreHorizontal,
  Eye,
  CheckCircle,
  Clock,
  AlertTriangle,
  XCircle,
  ArrowLeft,
  Send,
  Edit,
  RefreshCw,
  Trash2
} from "lucide-react"
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import { format } from "date-fns"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"

interface ClientInvoice {
  id: string
  invoiceNumber: string
  Customer: {
    id: string
    name: string
    email?: string
    customerNumber?: string
    xeroContactId?: string
  }
  Project: {
    id: string
    name: string
    projectNumber: string
  } | null
  subtotal: number
  taxAmount: number
  totalAmount: number
  amountDue: number
  amountPaid: number
  currency: string
  issueDate: string
  dueDate: string
  status: 'DRAFT' | 'SENT' | 'APPROVED' | 'PAID' | 'OVERDUE' | 'CANCELLED'
  description?: string
  notes?: string
  paidDate?: string
  isOverdue: boolean
  daysPastDue?: number
  isXeroSynced: boolean
  xeroInvoiceId?: string
  createdAt: string
}

const statusConfig = {
  DRAFT: { color: 'bg-gray-100 text-gray-700 border-gray-300', icon: Edit, label: 'Draft' },
  SENT: { color: 'bg-blue-100 text-blue-700 border-blue-300', icon: Send, label: 'Sent' },
  APPROVED: { color: 'bg-purple-100 text-purple-700 border-purple-300', icon: CheckCircle, label: 'Approved' },
  PAID: { color: 'bg-green-100 text-green-700 border-green-300', icon: CheckCircle, label: 'Paid' },
  OVERDUE: { color: 'bg-red-100 text-red-700 border-red-300', icon: AlertTriangle, label: 'Overdue' },
  CANCELLED: { color: 'bg-gray-100 text-gray-700 border-gray-300', icon: XCircle, label: 'Cancelled' },
}

const formatCurrency = (amount: number, currency: string = 'SGD') => {
  return new Intl.NumberFormat('en-SG', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount)
}

export default function ClientInvoicesPage() {
  const router = useRouter()
  const { data: session } = useSession() || {}
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterClient, setFilterClient] = useState("all")
  const [sortField, setSortField] = useState("issueDate")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  const [clientInvoices, setClientInvoices] = useState<ClientInvoice[]>([])
  const [page, setPage] = useState(1)
  const [pageSize] = useState(50)
  const [total, setTotal] = useState(0)

  const userRole = session?.user?.role
  const canAccessFinance = ["SUPERADMIN", "FINANCE", "PROJECT_MANAGER"].includes(userRole || "")
  const canCreateInvoices = ["SUPERADMIN", "PROJECT_MANAGER"].includes(userRole || "")
  const canDeleteInvoices = ["SUPERADMIN", "PROJECT_MANAGER"].includes(userRole || "")

  // Fetch invoices
  const fetchInvoices = async () => {
    try {
      setLoading(true)
      
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        ...(searchTerm && { search: searchTerm }),
        ...(filterStatus !== 'all' && { status: filterStatus }),
        ...(filterClient !== 'all' && { customerId: filterClient })
      })

      const response = await fetch(`/api/finance/customer-invoices?${params}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch invoices')
      }

      const data = await response.json()
      
      if (data.success) {
        setClientInvoices(data.invoices || [])
        setTotal(data.pagination?.total || 0)
        console.log(`✅ Loaded ${data.invoices?.length || 0} invoices`)
      } else {
        throw new Error(data.error || 'Unknown error')
      }
    } catch (error: any) {
      console.error('Failed to fetch invoices:', error)
      toast.error('Failed to load invoices', {
        description: error.message
      })
      setClientInvoices([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (canAccessFinance) {
      fetchInvoices()
    } else {
      setLoading(false)
    }
  }, [page, filterStatus, filterClient])

  // Search with debounce
  useEffect(() => {
    if (!canAccessFinance) return
    
    const timer = setTimeout(() => {
      if (page === 1) {
        fetchInvoices()
      } else {
        setPage(1) // Reset to page 1, which will trigger fetchInvoices
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [searchTerm])

  const handleInvoiceClick = (invoiceId: string) => {
    router.push(`/finance/client-invoices/${invoiceId}`)
  }

  const handleCreateInvoice = () => {
    router.push('/finance/client-invoices/new')
  }

  const handleDeleteInvoice = async (invoice: ClientInvoice, e: React.MouseEvent) => {
    e.stopPropagation()

    // Check if invoice can be deleted
    if (invoice.isXeroSynced) {
      toast.error('Cannot delete Xero-synced invoice', {
        description: 'This invoice has been synced to Xero. Please delete it from Xero or issue a credit note.'
      })
      return
    }

    if (invoice.status !== 'DRAFT') {
      toast.error('Cannot delete non-draft invoice', {
        description: `Only draft invoices can be deleted. This invoice has status: ${invoice.status}`
      })
      return
    }

    if (!confirm(`Are you sure you want to delete invoice ${invoice.invoiceNumber}? This action cannot be undone.`)) {
      return
    }

    try {
      const response = await fetch(`/api/invoices/${invoice.id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to delete invoice')
      }

      toast.success('Invoice deleted successfully')
      fetchInvoices() // Refresh the list
    } catch (error: any) {
      console.error('Failed to delete invoice:', error)
      toast.error('Failed to delete invoice', {
        description: error.message
      })
    }
  }

  if (!canAccessFinance) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <AlertTriangle className="mx-auto h-12 w-12 text-yellow-600 mb-4" />
            <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
            <p className="text-gray-600 mt-2">You don't have permission to access client invoices.</p>
          </div>
        </div>
      </MainLayout>
    )
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="p-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded mb-4"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </MainLayout>
    )
  }

  const getStatusIcon = (status: string) => {
    const config = statusConfig[status as keyof typeof statusConfig]
    if (!config) return null
    const Icon = config.icon
    return <Icon className="h-4 w-4" />
  }

  const getStatusColor = (status: string) => {
    const config = statusConfig[status as keyof typeof statusConfig]
    return config?.color || 'bg-gray-100 text-gray-700 border-gray-300'
  }

  const getStatusLabel = (status: string) => {
    const config = statusConfig[status as keyof typeof statusConfig]
    return config?.label || status
  }

  const totalAmount = clientInvoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0)
  const outstandingAmount = clientInvoices
    .filter(invoice => ['SENT', 'APPROVED', 'OVERDUE'].includes(invoice.status))
    .reduce((sum, invoice) => sum + invoice.amountDue, 0)
  const paidAmount = clientInvoices
    .filter(invoice => invoice.status === 'PAID')
    .reduce((sum, invoice) => sum + invoice.totalAmount, 0)

  return (
    <MainLayout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <Link href="/finance">
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Finance
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Client Invoices</h1>
              <p className="text-gray-600">Manage and track customer invoices</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Button 
              variant="outline" 
              size="sm"
              onClick={fetchInvoices}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {canCreateInvoices && (
              <Button onClick={handleCreateInvoice}>
                <Plus className="h-4 w-4 mr-2" />
                New Invoice
              </Button>
            )}
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <FileText className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Invoices</p>
                  <p className="text-2xl font-bold">{total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <DollarSign className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Value</p>
                  <p className="text-2xl font-bold">{formatCurrency(totalAmount)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Clock className="h-8 w-8 text-orange-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Outstanding</p>
                  <p className="text-2xl font-bold">{formatCurrency(outstandingAmount)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Paid</p>
                  <p className="text-2xl font-bold">{formatCurrency(paidAmount)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center space-x-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search invoices, customers..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="SENT">Sent</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="PAID">Paid</SelectItem>
                  <SelectItem value="OVERDUE">Overdue</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Client Invoices Content */}
        <Card>
          <CardHeader>
            <CardTitle>Client Invoices ({total})</CardTitle>
            <CardDescription>
              View and manage all customer invoices
            </CardDescription>
          </CardHeader>
          <CardContent>
            {clientInvoices.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Client Invoices</h3>
                <p className="text-gray-500 mb-4">
                  {searchTerm || filterStatus !== 'all' 
                    ? 'No invoices match your filters. Try adjusting your search criteria.'
                    : 'You haven\'t created any client invoices yet. Start by creating your first invoice or sync from Xero.'
                  }
                </p>
                {canCreateInvoices && !searchTerm && filterStatus === 'all' && (
                  <Button onClick={handleCreateInvoice}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Invoice
                  </Button>
                )}
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice Number</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Issue Date</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientInvoices.map((invoice) => (
                      <TableRow 
                        key={invoice.id}
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => handleInvoiceClick(invoice.id)}
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center space-x-2">
                            <FileText className="h-4 w-4 text-gray-400" />
                            <span>{invoice.invoiceNumber}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{invoice.Customer.name}</div>
                            {invoice.Customer.customerNumber && (
                              <div className="text-xs text-gray-500">
                                {invoice.Customer.customerNumber}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {invoice.Project ? (
                            <div>
                              <div className="text-sm">{invoice.Project.name}</div>
                              <div className="text-xs text-gray-500">
                                {invoice.Project.projectNumber}
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell className="font-semibold">
                          {formatCurrency(invoice.totalAmount, invoice.currency)}
                        </TableCell>
                        <TableCell>
                          {format(new Date(invoice.issueDate), 'dd MMM yyyy')}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div>{format(new Date(invoice.dueDate), 'dd MMM yyyy')}</div>
                            {invoice.isOverdue && invoice.daysPastDue && (
                              <div className="text-xs text-red-600">
                                {invoice.daysPastDue} days overdue
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className={getStatusColor(invoice.status)}
                          >
                            <span className="flex items-center space-x-1">
                              {getStatusIcon(invoice.status)}
                              <span>{getStatusLabel(invoice.status)}</span>
                            </span>
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {invoice.isXeroSynced ? (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
                              <Building2 className="h-3 w-3 mr-1" />
                              Xero
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-300">
                              Manual
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation()
                                handleInvoiceClick(invoice.id)
                              }}>
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </DropdownMenuItem>
                              {!invoice.isXeroSynced && (
                                <>
                                  <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                                    <Edit className="mr-2 h-4 w-4" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                </>
                              )}
                              <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                                <Download className="mr-2 h-4 w-4" />
                                Download PDF
                              </DropdownMenuItem>
                              
                              {/* Delete option for draft invoices */}
                              {canDeleteInvoices && invoice.status === 'DRAFT' && !invoice.isXeroSynced && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    onClick={(e) => handleDeleteInvoice(invoice, e)}
                                    className="text-red-600 focus:text-red-600"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete Invoice
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Pagination */}
                {total > pageSize && (
                  <div className="flex items-center justify-between p-4 border-t">
                    <div className="text-sm text-gray-600">
                      Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total} invoices
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                      >
                        Previous
                      </Button>
                      <div className="text-sm">
                        Page {page} of {Math.ceil(total / pageSize)}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.min(Math.ceil(total / pageSize), p + 1))}
                        disabled={page >= Math.ceil(total / pageSize)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}
