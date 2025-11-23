
'use client'

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { MainLayout } from "@/components/layout/main-layout"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CommentThread } from "@/components/comments/CommentThread"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { 
  ArrowLeft,
  MoreHorizontal,
  Edit,
  FileDown,
  Send,
  CheckCircle,
  XCircle,
  Eye,
  Copy,
  RefreshCw,
  Building2,
  User,
  Calendar,
  DollarSign,
  FileText,
  Package,
  Clock,
  AlertTriangle,
  Download,
  Mail,
  Truck
} from "lucide-react"
import { format } from "date-fns"
import { DocumentPreview } from "@/components/documents/document-preview"
import { POPDFPreview } from "@/components/purchase-orders/po-pdf-preview"
import Link from "next/link"

interface PurchaseOrder {
  id: string
  poNumber: string
  status: string
  subtotal: number
  taxAmount: number
  totalAmount: number
  currency: string
  deliveryDate: string
  terms?: string
  notes?: string
  createdAt: string
  updatedAt: string
  vendor?: {
    id: string
    name: string
    email?: string
    phone?: string
  }
  supplier?: {
    id: string
    name: string
    companyName: string
    email?: string
    phone?: string
  }
  project?: {
    id: string
    name: string
    projectNumber: string
  }
  requester: {
    id: string
    firstName: string
    lastName: string
  }
  items: Array<{
    id: string
    description: string
    category: string
    quantity: number
    unit: string
    unitPrice: number
    discount: number
    taxRate: number
    subtotal: number
    discountAmount: number
    taxAmount: number
    totalPrice: number
    notes?: string
  }>
  activities: Array<{
    id: string
    action: string
    description: string
    createdAt: string
    userId: string
    userEmail: string
  }>
}

export default function PurchaseOrderDetailPage({ params }: { params: { id: string } }) {
  const { data: session } = useSession() || {}
  const router = useRouter()
  const searchParams = useSearchParams()
  const [purchaseOrder, setPurchaseOrder] = useState<PurchaseOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  
  // Get return URL from query params
  const returnUrl = searchParams?.get('returnUrl')

  useEffect(() => {
    fetchPurchaseOrder()
  }, [params.id])

  const fetchPurchaseOrder = async () => {
    try {
      const response = await fetch(`/api/finance/purchase-orders/${params.id}`)
      if (response.ok) {
        const data = await response.json()
        setPurchaseOrder(data)
      } else {
        console.error('Failed to fetch purchase order')
      }
    } catch (error) {
      console.error('Error fetching purchase order:', error)
    } finally {
      setLoading(false)
    }
  }

  // Navigate back to appropriate page
  const navigateBack = () => {
    if (returnUrl) {
      router.push(returnUrl)
    } else if (purchaseOrder?.project?.id) {
      router.push(`/projects/${purchaseOrder.project.id}`)
    } else {
      router.push('/finance/purchase-orders')
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    setProcessing(true)
    try {
      // Use approve endpoint for APPROVED status
      if (newStatus === 'APPROVED') {
        const response = await fetch(`/api/finance/purchase-orders/${params.id}/approve`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          }
        })

        if (response.ok) {
          const result = await response.json()
          toast.success(result.message || 'Purchase order approved successfully')
          await fetchPurchaseOrder() // Refresh data
          // Navigate back after a short delay to allow user to see the toast
          setTimeout(() => navigateBack(), 1000)
        } else {
          const error = await response.json()
          toast.error(error.error || 'Failed to approve purchase order')
        }
      } else {
        // Use status endpoint for other status changes
        const response = await fetch(`/api/finance/purchase-orders/${params.id}/status`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status: newStatus }),
        })

        if (response.ok) {
          const result = await response.json()
          toast.success(result.message || 'Purchase order status updated successfully')
          await fetchPurchaseOrder() // Refresh data
          // Navigate back after a short delay for submitted and cancelled status
          if (newStatus === 'SUBMITTED' || newStatus === 'CANCELLED') {
            setTimeout(() => navigateBack(), 1000)
          }
        } else {
          const error = await response.json()
          toast.error(error.error || 'Failed to update purchase order status')
        }
      }
    } catch (error) {
      console.error('Error updating status:', error)
      toast.error('Error updating status')
    } finally {
      setProcessing(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'bg-gray-100 text-gray-800'
      case 'SUBMITTED': return 'bg-blue-100 text-blue-800'
      case 'APPROVED': return 'bg-green-100 text-green-800'
      case 'REJECTED': return 'bg-red-100 text-red-800'
      case 'CANCELLED': return 'bg-gray-100 text-gray-800'
      case 'PARTIALLY_RECEIVED': return 'bg-yellow-100 text-yellow-800'
      case 'FULLY_RECEIVED': return 'bg-green-100 text-green-800'
      case 'INVOICED': return 'bg-purple-100 text-purple-800'
      case 'COMPLETED': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'MATERIALS': return 'bg-blue-100 text-blue-800'
      case 'SERVICES': return 'bg-green-100 text-green-800'
      case 'SUBCONTRACTORS': return 'bg-purple-100 text-purple-800'
      case 'MISCELLANEOUS': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const userRole = session?.user?.role
  const userId = session?.user?.id
  
  const canEdit = ["SUPERADMIN", "PROJECT_MANAGER"].includes(userRole || "") && 
                  purchaseOrder?.status === "DRAFT"
  
  const canApprove = userRole === "SUPERADMIN" && 
                     purchaseOrder?.status === "SUBMITTED"

  const canReject = userRole === "SUPERADMIN" && 
                    purchaseOrder?.status === "SUBMITTED"

  if (loading) {
    return (
      <MainLayout>
        <div className="container mx-auto p-6">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
          </div>
        </div>
      </MainLayout>
    )
  }

  if (!purchaseOrder) {
    return (
      <MainLayout>
        <div className="container mx-auto p-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Purchase Order Not Found
            </h1>
            <Button onClick={() => router.push('/finance/purchase-orders')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Purchase Orders
            </Button>
          </div>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="container mx-auto p-6 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <Button variant="outline" onClick={navigateBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <div>
              <div className="flex items-center space-x-3">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {purchaseOrder.poNumber}
                </h1>
                <Badge className={getStatusColor(purchaseOrder.status)}>
                  {purchaseOrder.status}
                </Badge>
              </div>
              <p className="text-gray-600 dark:text-gray-300">
                Purchase Order Details
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button 
              variant="outline"
              onClick={() => window.open(`/api/finance/purchase-orders/${purchaseOrder.id}/export`, '_blank')}
            >
              <FileDown className="mr-2 h-4 w-4" />
              Export Document
            </Button>
            
            {canEdit && (
              <Button variant="outline">
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>
            )}

            {purchaseOrder.status === 'DRAFT' && (
              <Button 
                onClick={() => handleStatusChange('SUBMITTED')}
                disabled={processing}
              >
                <Send className="mr-2 h-4 w-4" />
                Submit for Approval
              </Button>
            )}

            {canApprove && (
              <Button 
                onClick={() => handleStatusChange('APPROVED')}
                disabled={processing}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Approve
              </Button>
            )}

            {canReject && (
              <Button 
                variant="destructive"
                onClick={() => handleStatusChange('CANCELLED')}
                disabled={processing}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Reject
              </Button>
            )}
          </div>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="items">Items ({purchaseOrder.items?.length || 0})</TabsTrigger>
            <TabsTrigger value="preview">PDF Preview</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* PO Information */}
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <FileText className="mr-2 h-5 w-5" />
                      Purchase Order Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500">PO Number</label>
                        <p className="font-mono font-medium">{purchaseOrder.poNumber}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Status</label>
                        <div className="mt-1">
                          <Badge className={getStatusColor(purchaseOrder.status)}>
                            {purchaseOrder.status}
                          </Badge>
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Currency</label>
                        <p className="font-medium">{purchaseOrder.currency}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Expected Delivery</label>
                        <p className="font-medium">
                          {purchaseOrder.deliveryDate 
                            ? format(new Date(purchaseOrder.deliveryDate), 'PPP')
                            : 'Not specified'
                          }
                        </p>
                      </div>
                    </div>

                    {purchaseOrder.terms && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">Payment Terms</label>
                        <p className="text-sm mt-1 bg-gray-50 p-3 rounded">{purchaseOrder.terms}</p>
                      </div>
                    )}

                    {purchaseOrder.notes && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">Notes</label>
                        <p className="text-sm mt-1 bg-gray-50 p-3 rounded">{purchaseOrder.notes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Financial Summary */}
                <Card className="mt-6">
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <DollarSign className="mr-2 h-5 w-5" />
                      Financial Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span>Subtotal:</span>
                        <span className="font-medium">
                          {purchaseOrder.currency} {Number(purchaseOrder.subtotal).toFixed(2)}
                        </span>
                      </div>
                      {purchaseOrder.taxAmount > 0 && (
                        <div className="flex justify-between">
                          <span>Tax:</span>
                          <span className="font-medium">
                            {purchaseOrder.currency} {Number(purchaseOrder.taxAmount).toFixed(2)}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between text-lg font-bold border-t pt-3">
                        <span>Total Amount:</span>
                        <span>
                          {purchaseOrder.currency} {Number(purchaseOrder.totalAmount).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right sidebar */}
              <div className="space-y-6">
                {/* Supplier Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Building2 className="mr-2 h-5 w-5" />
                      Supplier Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <p className="font-medium text-lg">{purchaseOrder.vendor?.name || purchaseOrder.supplier?.name || 'N/A'}</p>
                      </div>
                      {(purchaseOrder.vendor?.email || purchaseOrder.supplier?.email) && (
                        <div className="flex items-center text-sm">
                          <Mail className="mr-2 h-4 w-4 text-gray-400" />
                          <span>{purchaseOrder.vendor?.email || purchaseOrder.supplier?.email}</span>
                        </div>
                      )}
                      {(purchaseOrder.vendor?.phone || purchaseOrder.supplier?.phone) && (
                        <div className="flex items-center text-sm">
                          <User className="mr-2 h-4 w-4 text-gray-400" />
                          <span>{purchaseOrder.vendor?.phone || purchaseOrder.supplier?.phone}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Project Information */}
                {purchaseOrder.project && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <Package className="mr-2 h-5 w-5" />
                        Project Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <p className="font-medium">{purchaseOrder.project.name}</p>
                        <p className="text-sm text-gray-600">{purchaseOrder.project.projectNumber}</p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Requester Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <User className="mr-2 h-5 w-5" />
                      Requested By
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="font-medium">
                      {purchaseOrder.requester.firstName} {purchaseOrder.requester.lastName}
                    </p>
                    <p className="text-sm text-gray-600">
                      {format(new Date(purchaseOrder.createdAt), 'PPP')}
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="items">
            <Card>
              <CardHeader>
                <CardTitle>Purchase Order Items</CardTitle>
                <CardDescription>
                  Detailed breakdown of all items in this purchase order
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Unit Price</TableHead>
                      <TableHead>Discount</TableHead>
                      <TableHead>Tax</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchaseOrder.items?.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{item.description}</p>
                            {item.notes && (
                              <p className="text-sm text-gray-500">{item.notes}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getCategoryColor(item.category)}>
                            {item.category}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {Number(item.quantity)} {item.unit}
                        </TableCell>
                        <TableCell>
                          {purchaseOrder.currency} {Number(item.unitPrice).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {item.discount > 0 ? `${Number(item.discount)}%` : '-'}
                        </TableCell>
                        <TableCell>
                          {item.taxRate > 0 ? `${Number(item.taxRate)}%` : '-'}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {purchaseOrder.currency} {Number(item.totalPrice).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="preview">
            <POPDFPreview 
              poId={purchaseOrder.id} 
              poNumber={purchaseOrder.poNumber}
            />
          </TabsContent>

          <TabsContent value="activity">
            <Card>
              <CardHeader>
                <CardTitle>Activity Log</CardTitle>
                <CardDescription>
                  Track all changes and actions performed on this purchase order
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {purchaseOrder.activities?.map((activity) => (
                    <div key={activity.id} className="flex items-start space-x-3 pb-4 border-b last:border-b-0">
                      <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <Clock className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          {activity.description}
                        </p>
                        <div className="flex items-center space-x-2 text-xs text-gray-500 mt-1">
                          <span>{activity.userEmail}</span>
                          <span>•</span>
                          <span>{format(new Date(activity.createdAt), 'PPP p')}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {(!purchaseOrder.activities || purchaseOrder.activities.length === 0) && (
                    <div className="text-center py-8">
                      <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">No activities recorded yet</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        <CommentThread entityId={purchaseOrder.id} entityType="PURCHASE_ORDER" />
      </div>
    </MainLayout>
  )
}
