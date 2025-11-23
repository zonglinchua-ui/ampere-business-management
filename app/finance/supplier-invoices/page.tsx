
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
  Upload,
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
  CreditCard,
  ArrowLeft
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

interface VendorInvoice {
  id: string
  invoiceNumber: string
  vendor: {
    id: string
    name: string
    email?: string
  }
  project: {
    id: string
    name: string
    projectNumber: string
  } | null
  amount: number
  currency: string
  dueDate: string
  receivedDate: string
  status: 'RECEIVED' | 'UNDER_REVIEW' | 'APPROVED' | 'PAID' | 'DISPUTED' | 'REJECTED'
  description: string
  attachments?: string[]
  paymentTerms?: string
  notes?: string
  isOverdue: boolean
  daysPastDue?: number
}

const statusConfig = {
  RECEIVED: { color: 'bg-blue-100 text-blue-700', icon: Upload, label: 'Received' },
  UNDER_REVIEW: { color: 'bg-yellow-100 text-yellow-700', icon: Clock, label: 'Under Review' },
  APPROVED: { color: 'bg-green-100 text-green-700', icon: CheckCircle, label: 'Approved' },
  PAID: { color: 'bg-emerald-100 text-emerald-700', icon: CreditCard, label: 'Paid' },
  DISPUTED: { color: 'bg-orange-100 text-orange-700', icon: AlertTriangle, label: 'Disputed' },
  REJECTED: { color: 'bg-red-100 text-red-700', icon: XCircle, label: 'Rejected' },
}

export default function VendorInvoicesPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterVendor, setFilterVendor] = useState("all")
  const [sortField, setSortField] = useState("receivedDate")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  const [vendorInvoices, setVendorInvoices] = useState<VendorInvoice[]>([])

  const userRole = session?.user?.role
  const canAccessFinance = ["SUPERADMIN", "FINANCE"].includes(userRole || "")
  const canProcessPayments = ["SUPERADMIN", "FINANCE"].includes(userRole || "")

  useEffect(() => {
    fetchVendorInvoices()
  }, [])

  const fetchVendorInvoices = async () => {
    try {
      const response = await fetch('/api/finance/vendor-invoices')
      if (response.ok) {
        const data = await response.json()
        setVendorInvoices(data || [])
      }
    } catch (error) {
      console.error('Error fetching vendor invoices:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleInvoiceClick = (invoiceId: string) => {
    router.push(`/finance/vendor-invoices/${invoiceId}`)
  }

  const handleProcessPayment = (invoiceId: string) => {
    router.push(`/finance/payments/new?invoiceId=${invoiceId}`)
  }

  const handleUploadInvoice = () => {
    router.push('/finance/vendor-invoices/upload')
  }

  if (!canAccessFinance) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <AlertTriangle className="mx-auto h-12 w-12 text-yellow-600 mb-4" />
            <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
            <p className="text-gray-600 mt-2">You don't have permission to access vendor invoices.</p>
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
    return config?.color || 'bg-gray-100 text-gray-700'
  }

  const getStatusLabel = (status: string) => {
    const config = statusConfig[status as keyof typeof statusConfig]
    return config?.label || status
  }

  const totalAmount = vendorInvoices.reduce((sum, invoice) => sum + invoice.amount, 0)
  const pendingAmount = vendorInvoices
    .filter(invoice => ['RECEIVED', 'UNDER_REVIEW', 'APPROVED'].includes(invoice.status))
    .reduce((sum, invoice) => sum + invoice.amount, 0)

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
              <h1 className="text-2xl font-bold text-gray-900">Vendor Invoices</h1>
              <p className="text-gray-600">Review and process vendor bills and invoices</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Button variant="outline" size="sm" onClick={handleUploadInvoice}>
              <Upload className="h-4 w-4 mr-2" />
              Upload Invoice
            </Button>
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
                <Upload className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Invoices</p>
                  <p className="text-2xl font-bold">{vendorInvoices.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <DollarSign className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Amount</p>
                  <p className="text-2xl font-bold">${totalAmount.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Clock className="h-8 w-8 text-orange-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Pending Payment</p>
                  <p className="text-2xl font-bold">${pendingAmount.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-8 w-8 text-red-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Overdue</p>
                  <p className="text-2xl font-bold">
                    {vendorInvoices.filter(invoice => invoice.isOverdue).length}
                  </p>
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
                    placeholder="Search invoices, vendors..."
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
                  <SelectItem value="RECEIVED">Received</SelectItem>
                  <SelectItem value="UNDER_REVIEW">Under Review</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="PAID">Paid</SelectItem>
                  <SelectItem value="DISPUTED">Disputed</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterVendor} onValueChange={setFilterVendor}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by vendor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Vendors</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Vendor Invoices Content */}
        <Card>
          <CardHeader>
            <CardTitle>Vendor Invoices ({vendorInvoices.length})</CardTitle>
            <CardDescription>
              Review and process vendor bills and invoices
            </CardDescription>
          </CardHeader>
          <CardContent>
            {vendorInvoices.length === 0 ? (
              <div className="text-center py-12">
                <Upload className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Vendor Invoices</h3>
                <p className="text-gray-500 mb-4">
                  You haven't received any vendor invoices yet.<br />
                  Invoices will appear here when vendors submit bills.
                </p>
                <Button onClick={handleUploadInvoice}>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Invoice
                </Button>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice Number</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* Invoice rows would go here when data is available */}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}
