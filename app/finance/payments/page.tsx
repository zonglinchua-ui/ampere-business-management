
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
  CreditCard,
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
  Receipt,
  Banknote
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

interface Payment {
  id: string
  paymentNumber: string
  type: 'VENDOR_PAYMENT' | 'CLIENT_PAYMENT' | 'EXPENSE' | 'REFUND'
  entity: {
    id: string
    name: string
    type: 'vendor' | 'client'
  }
  project: {
    id: string
    name: string
    projectNumber: string
  } | null
  amount: number
  currency: string
  paymentDate: string
  dueDate?: string
  method: 'BANK_TRANSFER' | 'CHEQUE' | 'CASH' | 'CREDIT_CARD' | 'ONLINE'
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
  reference: string
  description: string
  invoiceNumber?: string
  bankAccount?: string
  chequeNumber?: string
  notes?: string
  attachments?: string[]
  approvedBy?: {
    id: string
    name: string
  }
  processedBy?: {
    id: string
    name: string
  }
  createdAt: string
}

const statusConfig = {
  PENDING: { color: 'bg-yellow-100 text-yellow-700', icon: Clock, label: 'Pending' },
  PROCESSING: { color: 'bg-blue-100 text-blue-700', icon: Send, label: 'Processing' },
  COMPLETED: { color: 'bg-green-100 text-green-700', icon: CheckCircle, label: 'Completed' },
  FAILED: { color: 'bg-red-100 text-red-700', icon: XCircle, label: 'Failed' },
  CANCELLED: { color: 'bg-gray-100 text-gray-700', icon: XCircle, label: 'Cancelled' },
}

const paymentTypeConfig = {
  VENDOR_PAYMENT: { color: 'bg-purple-100 text-purple-700', label: 'Vendor Payment' },
  CLIENT_PAYMENT: { color: 'bg-green-100 text-green-700', label: 'Client Payment' },
  EXPENSE: { color: 'bg-orange-100 text-orange-700', label: 'Expense' },
  REFUND: { color: 'bg-blue-100 text-blue-700', label: 'Refund' },
}

export default function PaymentsPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterType, setFilterType] = useState("all")
  const [sortField, setSortField] = useState("paymentDate")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  const [payments, setPayments] = useState<Payment[]>([])

  const userRole = session?.user?.role
  const canAccessFinance = ["SUPERADMIN", "FINANCE"].includes(userRole || "")
  const canProcessPayments = ["SUPERADMIN", "FINANCE"].includes(userRole || "")

  useEffect(() => {
    setLoading(false)
    // TODO: Fetch payments from API when endpoint is ready
    setPayments([])
  }, [])

  const handlePaymentClick = (paymentId: string) => {
    router.push(`/finance/payments/${paymentId}`)
  }

  const handleCreatePayment = () => {
    router.push('/finance/payments/new')
  }

  if (!canAccessFinance) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <AlertTriangle className="mx-auto h-12 w-12 text-yellow-600 mb-4" />
            <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
            <p className="text-gray-600 mt-2">You don't have permission to access payments.</p>
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

  const getTypeColor = (type: string) => {
    const config = paymentTypeConfig[type as keyof typeof paymentTypeConfig]
    return config?.color || 'bg-gray-100 text-gray-700'
  }

  const getTypeLabel = (type: string) => {
    const config = paymentTypeConfig[type as keyof typeof paymentTypeConfig]
    return config?.label || type
  }

  const totalAmount = payments.reduce((sum, payment) => sum + payment.amount, 0)
  const pendingAmount = payments
    .filter(payment => ['PENDING', 'PROCESSING'].includes(payment.status))
    .reduce((sum, payment) => sum + payment.amount, 0)

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
              <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
              <p className="text-gray-600">Process and track all financial transactions</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {canProcessPayments && (
              <Button onClick={handleCreatePayment}>
                <Plus className="h-4 w-4 mr-2" />
                New Payment
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
                <CreditCard className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Payments</p>
                  <p className="text-2xl font-bold">{payments.length}</p>
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
                  <p className="text-sm font-medium text-gray-600">Pending</p>
                  <p className="text-2xl font-bold">${pendingAmount.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-8 w-8 text-emerald-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Completed</p>
                  <p className="text-2xl font-bold">
                    {payments.filter(payment => payment.status === 'COMPLETED').length}
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
                    placeholder="Search payments, references..."
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
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="PROCESSING">Processing</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="FAILED">Failed</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="VENDOR_PAYMENT">Vendor Payment</SelectItem>
                  <SelectItem value="CLIENT_PAYMENT">Client Payment</SelectItem>
                  <SelectItem value="EXPENSE">Expense</SelectItem>
                  <SelectItem value="REFUND">Refund</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Payments Content */}
        <Card>
          <CardHeader>
            <CardTitle>Payments ({payments.length})</CardTitle>
            <CardDescription>
              All payment transactions and financial activities
            </CardDescription>
          </CardHeader>
          <CardContent>
            {payments.length === 0 ? (
              <div className="text-center py-12">
                <CreditCard className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Payments</h3>
                <p className="text-gray-500 mb-4">
                  You haven't processed any payments yet.<br />
                  Start by creating your first payment transaction.
                </p>
                {canProcessPayments && (
                  <Button onClick={handleCreatePayment}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Payment
                  </Button>
                )}
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Payment Number</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* Payment rows would go here when data is available */}
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
