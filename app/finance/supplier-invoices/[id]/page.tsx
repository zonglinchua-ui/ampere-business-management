
'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow 
} from '@/components/ui/table'
import { 
  ArrowLeft,
  Building2,
  Calendar,
  DollarSign,
  FileText,
  CheckCircle,
  Clock,
  AlertTriangle,
  Download,
  Trash2,
  Package,
  User,
  CreditCard
} from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'react-hot-toast'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface InvoiceItem {
  id: string
  description: string
  quantity: number
  unitPrice: number
  totalPrice: number
  unit: string | null
  category: string
  BudgetCategory?: {
    id: string
    name: string
    code: string
  } | null
}

interface Activity {
  id: string
  action: string
  description: string | null
  userEmail: string
  createdAt: string
}

interface SupplierInvoice {
  id: string
  invoiceNumber: string
  supplierInvoiceRef: string | null
  subtotal: number
  taxAmount: number | null
  totalAmount: number
  currency: string
  status: string
  invoiceDate: string
  dueDate: string
  receivedDate: string | null
  approvedDate: string | null
  paidDate: string | null
  description: string | null
  notes: string | null
  documentPath: string | null
  xeroInvoiceId: string | null
  isXeroSynced: boolean
  projectApprovalRequired: boolean
  projectApprovedAt: string | null
  financeApprovedAt: string | null
  Supplier: {
    id: string
    name: string
    email: string | null
    phone: string | null
    contactPerson: string | null
  }
  Project: {
    id: string
    name: string
    projectNumber: string
  } | null
  PurchaseOrder: {
    id: string
    poNumber: string
    totalAmount: number
  } | null
  CreatedBy: {
    id: string
    name: string | null
    email: string
  }
  ProjectApprovedBy: {
    id: string
    name: string | null
    email: string
  } | null
  FinanceApprovedBy: {
    id: string
    name: string | null
    email: string
  } | null
  items: InvoiceItem[]
  activities: Activity[]
}

const statusConfig: Record<string, { color: string; icon: any; label: string }> = {
  DRAFT: { color: 'bg-gray-100 text-gray-700', icon: FileText, label: 'Draft' },
  PENDING_PROJECT_APPROVAL: { color: 'bg-yellow-100 text-yellow-700', icon: Clock, label: 'Pending Project Approval' },
  PENDING_FINANCE_APPROVAL: { color: 'bg-orange-100 text-orange-700', icon: Clock, label: 'Pending Finance Approval' },
  APPROVED: { color: 'bg-blue-100 text-blue-700', icon: CheckCircle, label: 'Approved' },
  PAID: { color: 'bg-green-100 text-green-700', icon: CheckCircle, label: 'Paid' },
  REJECTED: { color: 'bg-red-100 text-red-700', icon: AlertTriangle, label: 'Rejected' },
  CANCELLED: { color: 'bg-gray-100 text-gray-700', icon: FileText, label: 'Cancelled' }
}

export default function SupplierInvoiceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session } = useSession() || {}
  const [invoice, setInvoice] = useState<SupplierInvoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const userRole = session?.user?.role
  const canDelete = ["SUPERADMIN", "PROJECT_MANAGER"].includes(userRole || "")

  useEffect(() => {
    if (params?.id) {
      fetchInvoice()
    }
  }, [params?.id])

  const fetchInvoice = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/supplier-invoices/${params?.id}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch supplier invoice')
      }

      const data = await response.json()
      console.log('✅ Supplier invoice data loaded:', {
        id: data.id,
        invoiceNumber: data.invoiceNumber,
        hasItems: Array.isArray(data.items),
        itemsCount: data.items?.length || 0,
        status: data.status,
        isXeroSynced: data.isXeroSynced
      })
      setInvoice(data)
    } catch (error) {
      console.error('❌ Error loading supplier invoice:', error)
      toast.error('Failed to load invoice details')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!invoice) return

    try {
      setDeleting(true)
      const response = await fetch(`/api/supplier-invoices/${invoice.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete invoice')
      }

      toast.success('Supplier invoice deleted successfully')
      router.push('/finance')
    } catch (error: any) {
      console.error('❌ Error deleting supplier invoice:', error)
      toast.error(error.message || 'Failed to delete invoice')
    } finally {
      setDeleting(false)
      setShowDeleteDialog(false)
    }
  }

  const formatCurrency = (amount: number | null | undefined, currency: string = 'SGD') => {
    if (amount === null || amount === undefined) return '-'
    return new Intl.NumberFormat('en-SG', {
      style: 'currency',
      currency: currency,
    }).format(Number(amount))
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-4 text-sm text-muted-foreground">Loading invoice details...</p>
          </div>
        </div>
      </MainLayout>
    )
  }

  if (!invoice) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold">Invoice not found</h3>
            <p className="text-sm text-muted-foreground mt-2">
              The requested invoice could not be found.
            </p>
            <Button onClick={() => router.push('/finance')} className="mt-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Finance
            </Button>
          </div>
        </div>
      </MainLayout>
    )
  }

  const StatusIcon = statusConfig[invoice.status]?.icon || FileText
  const canDeleteInvoice = canDelete && !invoice.isXeroSynced && invoice.status === 'DRAFT'

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/finance')}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                Supplier Invoice Details
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Invoice #{invoice.invoiceNumber}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={statusConfig[invoice.status]?.color || 'bg-gray-100'}>
              <StatusIcon className="mr-1 h-3 w-3" />
              {statusConfig[invoice.status]?.label || invoice.status}
            </Badge>
            {invoice.isXeroSynced && (
              <Badge variant="outline" className="bg-green-50 border-green-200">
                Synced to Xero
              </Badge>
            )}
            {canDeleteInvoice && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Supplier Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Supplier Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Supplier Name</p>
                <p className="text-base font-semibold">{invoice.Supplier.name}</p>
                {invoice.Supplier.contactPerson && (
                  <p className="text-sm text-muted-foreground">Contact: {invoice.Supplier.contactPerson}</p>
                )}
              </div>
              {invoice.Supplier.email && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Email</p>
                  <p className="text-base">{invoice.Supplier.email}</p>
                </div>
              )}
              {invoice.Supplier.phone && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Phone</p>
                  <p className="text-base">{invoice.Supplier.phone}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Invoice Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Invoice Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {invoice.supplierInvoiceRef && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Supplier Reference</p>
                  <p className="text-base font-semibold">{invoice.supplierInvoiceRef}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Invoice Date</p>
                  <p className="text-base">{format(new Date(invoice.invoiceDate), 'dd MMM yyyy')}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Due Date</p>
                  <p className="text-base">{format(new Date(invoice.dueDate), 'dd MMM yyyy')}</p>
                </div>
              </div>
              {invoice.receivedDate && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Received Date</p>
                  <p className="text-base">{format(new Date(invoice.receivedDate), 'dd MMM yyyy')}</p>
                </div>
              )}
              {invoice.paidDate && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Paid Date</p>
                  <p className="text-base">{format(new Date(invoice.paidDate), 'dd MMM yyyy')}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Project Info */}
          {invoice.Project && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Project Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Project</p>
                  <p className="text-base font-semibold">{invoice.Project.name}</p>
                  <p className="text-sm text-muted-foreground">#{invoice.Project.projectNumber}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Financial Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Financial Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Subtotal</span>
                <span className="text-base font-semibold">{formatCurrency(Number(invoice.subtotal), invoice.currency)}</span>
              </div>
              {invoice.taxAmount && (
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Tax</span>
                  <span className="text-base">{formatCurrency(Number(invoice.taxAmount), invoice.currency)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between">
                <span className="text-base font-semibold">Total Amount</span>
                <span className="text-lg font-bold text-primary">{formatCurrency(Number(invoice.totalAmount), invoice.currency)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Line Items */}
        <Card>
          <CardHeader>
            <CardTitle>Line Items</CardTitle>
            <CardDescription>
              Detailed breakdown of invoice items
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoice.items && invoice.items.length > 0 ? (
                  invoice.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{item.description}</p>
                          {item.BudgetCategory && (
                            <p className="text-xs text-muted-foreground">
                              {item.BudgetCategory.code} - {item.BudgetCategory.name}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {item.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {Number(item.quantity)} {item.unit || 'pcs'}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(Number(item.unitPrice), invoice.currency)}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(Number(item.totalPrice), invoice.currency)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No line items available
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Description and Notes */}
        {(invoice.description || invoice.notes) && (
          <div className="grid gap-6 md:grid-cols-2">
            {invoice.description && (
              <Card>
                <CardHeader>
                  <CardTitle>Description</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">{invoice.description}</p>
                </CardContent>
              </Card>
            )}
            {invoice.notes && (
              <Card>
                <CardHeader>
                  <CardTitle>Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">{invoice.notes}</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Recent Activity */}
        {invoice.activities && invoice.activities.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest updates and changes to this invoice</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {invoice.activities.map((activity) => (
                  <div key={activity.id} className="flex gap-4 text-sm">
                    <div className="flex-shrink-0">
                      <User className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="font-medium">{activity.action}</p>
                      {activity.description && (
                        <p className="text-muted-foreground">{activity.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {activity.userEmail} • {format(new Date(activity.createdAt), 'dd MMM yyyy HH:mm')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the supplier invoice <strong>{invoice.invoiceNumber}</strong>.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  )
}
