
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
  ShoppingCart,
  Building2,
  FolderOpen,
  Calendar,
  DollarSign,
  Search,
  Filter,
  Plus,
  Download,
  ArrowUpDown,
  MoreHorizontal,
  Eye,
  Edit,
  CheckCircle,
  Clock,
  AlertTriangle,
  XCircle,
  Truck,
  FileCheck
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

interface PurchaseOrder {
  id: string
  poNumber: string
  type: 'OUTGOING' | 'INCOMING'
  supplier: {
    id: string
    name: string
    companyName: string
  } | null
  customer: {
    id: string
    name: string
    email: string
    phone: string
  } | null
  vendor: {
    id: string
    name: string
    companyName: string
  } | null
  project: {
    id: string
    name: string
    projectNumber: string
  } | null
  requester: {
    id: string
    firstName: string
    lastName: string
  }
  subtotal: number
  taxAmount: number
  totalAmount: number
  currency: string
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'ISSUED' | 'ACKNOWLEDGED' | 'DELIVERED' | 'COMPLETED' | 'CANCELLED'
  issueDate: string | null
  deliveryDate: string | null
  terms: string | null
  notes: string | null
  documentPath: string | null
  approvedBy: {
    id: string
    firstName: string
    lastName: string
  } | null
  approvedAt: string | null
  createdAt: string
  updatedAt: string
  itemsCount: number
  isOverdue: boolean
  daysPastDue?: number
}

const statusConfig = {
  DRAFT: { color: 'bg-gray-100 text-gray-700', icon: Edit, label: 'Draft' },
  SUBMITTED: { color: 'bg-blue-100 text-blue-700', icon: Clock, label: 'Submitted' },
  APPROVED: { color: 'bg-green-100 text-green-700', icon: CheckCircle, label: 'Approved' },
  ISSUED: { color: 'bg-purple-100 text-purple-700', icon: FileCheck, label: 'Issued' },
  ACKNOWLEDGED: { color: 'bg-indigo-100 text-indigo-700', icon: Eye, label: 'Acknowledged' },
  DELIVERED: { color: 'bg-orange-100 text-orange-700', icon: Truck, label: 'Delivered' },
  COMPLETED: { color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle, label: 'Completed' },
  CANCELLED: { color: 'bg-red-100 text-red-700', icon: XCircle, label: 'Cancelled' },
}

export default function PurchaseOrdersPage() {
  const router = useRouter()
  const { data: session } = useSession() || {}
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterType, setFilterType] = useState<"all" | "OUTGOING" | "INCOMING">("all")
  const [filterVendor, setFilterVendor] = useState("all")
  const [sortField, setSortField] = useState<keyof PurchaseOrder>("createdAt")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])

  const userRole = session?.user?.role
  const canAccessFinance = ["SUPERADMIN", "FINANCE", "PROJECT_MANAGER"].includes(userRole || "")
  const canCreatePO = ["SUPERADMIN", "PROJECT_MANAGER"].includes(userRole || "")

  useEffect(() => {
    const fetchPurchaseOrders = async () => {
      try {
        const response = await fetch('/api/finance/purchase-orders')
        if (!response.ok) {
          throw new Error('Failed to fetch purchase orders')
        }
        const data = await response.json()
        setPurchaseOrders(data)
        setLoading(false)
      } catch (error) {
        console.error('Error fetching purchase orders:', error)
        setPurchaseOrders([])
        setLoading(false)
      }
    }

    fetchPurchaseOrders()
  }, [])

  const handleSort = (field: keyof PurchaseOrder) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  const handlePOClick = (poId: string) => {
    router.push(`/finance/purchase-orders/${poId}`)
  }

  if (!canAccessFinance) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
            <p className="text-gray-600 mt-2">You don't have permission to access finance information.</p>
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

  // Filter and sort purchase orders
  const filteredPOs = purchaseOrders.filter(po => {
    const vendorName = po.supplier?.companyName || po.vendor?.companyName || ''
    const customerName = po.customer?.name || ''
    const partyName = po.type === 'OUTGOING' ? vendorName : customerName
    
    const matchesSearch = po.poNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         partyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         po.project?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         po.notes?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = filterStatus === "all" || po.status === filterStatus
    const matchesType = filterType === "all" || po.type === filterType
    const matchesVendor = filterVendor === "all" || (po.supplier?.id === filterVendor || po.vendor?.id === filterVendor)
    
    return matchesSearch && matchesStatus && matchesType && matchesVendor
  })

  const sortedPOs = [...filteredPOs].sort((a, b) => {
    let aValue: any = a[sortField]
    let bValue: any = b[sortField]

    // Handle nested object sorting
    if (sortField === 'vendor') {
      aValue = a.vendor?.companyName || ''
      bValue = b.vendor?.companyName || ''
    } else if (sortField === 'project') {
      aValue = a.project?.name || ''
      bValue = b.project?.name || ''
    } else if (sortField === 'requester') {
      aValue = `${a.requester.firstName} ${a.requester.lastName}`
      bValue = `${b.requester.firstName} ${b.requester.lastName}`
    }

    // Handle null values
    if (aValue === null && bValue === null) return 0
    if (aValue === null) return sortDirection === "asc" ? 1 : -1
    if (bValue === null) return sortDirection === "asc" ? -1 : 1

    // Handle string and number comparison
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortDirection === "asc" 
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue)
    }

    if (sortDirection === "asc") {
      return aValue < bValue ? -1 : aValue > bValue ? 1 : 0
    } else {
      return aValue > bValue ? -1 : aValue < bValue ? 1 : 0
    }
  })

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

  const totalValue = filteredPOs.reduce((sum, po) => sum + po.totalAmount, 0)
  const avgOrderValue = filteredPOs.length > 0 ? totalValue / filteredPOs.length : 0

  return (
    <MainLayout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Purchase Orders</h1>
            <p className="text-gray-600">Manage and track purchase orders</p>
          </div>
          <div className="flex items-center space-x-3">
            <Link href="/finance">
              <Button variant="outline" size="sm">
                <ArrowUpDown className="h-4 w-4 mr-2" />
                Back to Finance
              </Button>
            </Link>
            {canCreatePO && (
              <Button size="sm" onClick={() => router.push('/finance/purchase-orders/create')}>
                <Plus className="h-4 w-4 mr-2" />
                New PO
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
                <ShoppingCart className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Total POs</p>
                  <p className="text-2xl font-bold">{filteredPOs.length}</p>
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
                  <p className="text-2xl font-bold">${totalValue.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <FileCheck className="h-8 w-8 text-purple-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Avg Order</p>
                  <p className="text-2xl font-bold">${avgOrderValue.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-8 w-8 text-orange-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Pending</p>
                  <p className="text-2xl font-bold">
                    {filteredPOs.filter(po => ['DRAFT', 'SUBMITTED'].includes(po.status)).length}
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
                    placeholder="Search POs, vendors, projects..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <Select value={filterType} onValueChange={(value) => setFilterType(value as "all" | "OUTGOING" | "INCOMING")}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="OUTGOING">Outgoing</SelectItem>
                  <SelectItem value="INCOMING">Incoming</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="SUBMITTED">Submitted</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="ISSUED">Issued</SelectItem>
                  <SelectItem value="ACKNOWLEDGED">Acknowledged</SelectItem>
                  <SelectItem value="DELIVERED">Delivered</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterVendor} onValueChange={setFilterVendor}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by party" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Parties</SelectItem>
                  {/* Dynamic vendor/customer options will be populated when data exists */}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Purchase Orders Table */}
        <Card>
          <CardHeader>
            <CardTitle>Purchase Orders ({sortedPOs.length})</CardTitle>
            <CardDescription>
              Click on any row to view purchase order details
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="cursor-pointer" onClick={() => handleSort("poNumber")}>
                      <div className="flex items-center">
                        PO Number
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                      </div>
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSort("type")}>
                      <div className="flex items-center">
                        Type
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                      </div>
                    </TableHead>
                    <TableHead>
                      <div className="flex items-center">
                        Party
                      </div>
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSort("project")}>
                      <div className="flex items-center">
                        Project
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                      </div>
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSort("totalAmount")}>
                      <div className="flex items-center">
                        Total Amount
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                      </div>
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSort("status")}>
                      <div className="flex items-center">
                        Status
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                      </div>
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSort("issueDate")}>
                      <div className="flex items-center">
                        Issue Date
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                      </div>
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSort("deliveryDate")}>
                      <div className="flex items-center">
                        Delivery Date
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                      </div>
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSort("requester")}>
                      <div className="flex items-center">
                        Requester
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                      </div>
                    </TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedPOs.map((po) => (
                    <TableRow 
                      key={po.id} 
                      className="hover:bg-muted/50 cursor-pointer"
                      onClick={() => handlePOClick(po.id)}
                    >
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <ShoppingCart className="h-4 w-4 text-blue-600" />
                          </div>
                          <div>
                            <div className="font-mono font-medium">{po.poNumber}</div>
                            {po.itemsCount > 0 && (
                              <div className="text-xs text-muted-foreground">{po.itemsCount} items</div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={po.type === 'OUTGOING' ? 'bg-orange-100 text-orange-700 border-0' : 'bg-green-100 text-green-700 border-0'}>
                          {po.type === 'OUTGOING' ? 'Outgoing' : 'Incoming'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <div>
                            {po.type === 'OUTGOING' ? (
                              <>
                                <div className="font-medium">{po.supplier?.companyName || po.vendor?.companyName || 'N/A'}</div>
                                <div className="text-xs text-muted-foreground">{po.supplier?.name || po.vendor?.name || ''}</div>
                              </>
                            ) : (
                              <>
                                <div className="font-medium">{po.customer?.name || 'N/A'}</div>
                                <div className="text-xs text-muted-foreground">{po.customer?.email || ''}</div>
                              </>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {po.project ? (
                          <div className="flex items-center space-x-2">
                            <FolderOpen className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <div className="font-medium">{po.project.name}</div>
                              <div className="text-xs text-muted-foreground font-mono">{po.project.projectNumber}</div>
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">No project</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">${po.totalAmount.toLocaleString()}</div>
                            <div className="text-xs text-muted-foreground">{po.currency}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Badge className={`${getStatusColor(po.status)} border-0`}>
                            <span className="flex items-center space-x-1">
                              {getStatusIcon(po.status)}
                              <span>{getStatusLabel(po.status)}</span>
                            </span>
                          </Badge>
                          {po.isOverdue && (
                            <div className="flex items-center space-x-1 text-red-600">
                              <AlertTriangle className="h-3 w-3" />
                              <span className="text-xs">{po.daysPastDue}d overdue</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {po.issueDate ? (
                          <div className="flex items-center space-x-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span>{format(new Date(po.issueDate), "MMM dd, yyyy")}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Not issued</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {po.deliveryDate ? (
                          <div className="flex items-center space-x-2">
                            <Truck className="h-4 w-4 text-muted-foreground" />
                            <span>{format(new Date(po.deliveryDate), "MMM dd, yyyy")}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">TBD</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {po.requester.firstName} {po.requester.lastName}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handlePOClick(po.id)}>
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </DropdownMenuItem>
                              {['DRAFT', 'SUBMITTED'].includes(po.status) && canCreatePO && (
                                <DropdownMenuItem>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit PO
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem>
                                <Download className="mr-2 h-4 w-4" />
                                Download PDF
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            
            {sortedPOs.length === 0 && (
              <div className="text-center py-12">
                <ShoppingCart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No purchase orders found</h3>
                <p className="text-gray-500 mb-4">
                  {searchTerm || filterStatus !== "all" || filterVendor !== "all"
                    ? "Try adjusting your search or filter criteria."
                    : "Get started by creating your first purchase order."
                  }
                </p>
                {canCreatePO && (!searchTerm && filterStatus === "all" && filterVendor === "all") && (
                  <Button onClick={() => router.push('/finance/purchase-orders/create')}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Purchase Order
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}
