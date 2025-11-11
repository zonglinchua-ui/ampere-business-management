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
  CreditCard,
  CheckCircle,
  Clock,
  AlertTriangle,
  Download,
  Trash2
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

interface Payment {
  id: string
  paymentNumber: string
  amount: number
  currency: string
  paymentDate: string
  reference: string | null
  status: string
  paymentMethod: string
  xeroPaymentId: string | null
}

interface InvoiceItem {
  id: string
  description: string
  quantity: number
  unitPrice: number
  totalPrice: number
  unit: string | null
}

interface Invoice {
  id: string
  invoiceNumber: string
  subtotal: number
  taxAmount: number | null
  totalAmount: number
  amountDue: number | null
  amountPaid: number | null
  currency: string
  status: string
  issueDate: string
  dueDate: string
  paidDate: string | null
  description: string | null
  notes: string | null
  xeroInvoiceId: string | null
  isXeroSynced: boolean
  isProgressClaimInvoice: boolean | null
  Customer: {
    id: string
    name: string
    email: string | null
    phone: string | null
  }
  Project: {
    id: string
    name: string
    projectNumber: string
  } | null
  items: InvoiceItem[]
  payments: Payment[]
}

const statusConfig: Record<string, { color: string; icon: any; label: string }> = {
  DRAFT: { color: 'bg-gray-100 text-gray-700', icon: FileText, label: 'Draft' },
  APPROVED: { color: 'bg-blue-100 text-blue-700', icon: CheckCircle, label: 'Approved' },
  SENT: { color: 'bg-purple-100 text-purple-700', icon: FileText, label: 'Sent' },
  PAID: { color: 'bg-green-100 text-green-700', icon: CheckCircle, label: 'Paid' },
  PARTIALLY_PAID: { color: 'bg-yellow-100 text-yellow-700', icon: Clock, label: 'Partially Paid' },
  OVERDUE: { color: 'bg-red-100 text-red-700', icon: AlertTriangle, label: 'Overdue' },
  CANCELLED: { color: 'bg-gray-100 text-gray-700', icon: FileText, label: 'Cancelled' }
}

const paymentStatusConfig: Record<string, { color: string; label: string }> = {
  PENDING: { color: 'bg-yellow-100 text-yellow-700', label: 'Pending' },
  COMPLETED: { color: 'bg-green-100 text-green-700', label: 'Completed' },
  FAILED: { color: 'bg-red-100 text-red-700', label: 'Failed' },
  CANCELLED: { color: 'bg-gray-100 text-gray-700', label: 'Cancelled' }
}

export default function InvoiceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session } = useSession() || {}
  const [invoice, setInvoice] = useState<Invoice | null>(null)
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
      const response = await fetch(`/api/invoices/${params?.id}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch invoice')
      }

      const data = await response.json()
      console.log('✅ Invoice data loaded:', {
        id: data.id,
        invoiceNumber: data.invoiceNumber,
        hasItems: Array.isArray(data.items),
        itemsCount: data.items?.length || 0,
        status: data.status,
        isXeroSynced: data.isXeroSynced
      })
      setInvoice(data)
    } catch (error: any) {
      console.error('Failed to fetch invoice:', error)
      toast.error('Failed to load invoice details')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteInvoice = async () => {
    if (!invoice) return

    try {
      setDeleting(true)
      
      const response = await fetch(`/api/invoices/${invoice.id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to delete invoice')
      }

      toast.success('Invoice deleted successfully')
      router.push('/finance/customer-invoices')
    } catch (error: any) {
      console.error('Failed to delete invoice:', error)
      toast.error(error.message || 'Failed to delete invoice')
    } finally {
      setDeleting(false)
      setShowDeleteDialog(false)
    }
  }

  const formatCurrency = (amount: number | null | undefined, currency: string = 'SGD') => {
    if (amount === null || amount === undefined) return '$0.00'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount)
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Loading invoice...</p>
          </div>
        </div>
      </MainLayout>
    )
  }

  if (!invoice) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold">Invoice Not Found</h3>
            <p className="text-muted-foreground mb-4">The requested invoice could not be found.</p>
            <Button onClick={() => router.push('/finance/client-invoices')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Invoices
            </Button>
          </div>
        </div>
      </MainLayout>
    )
  }

  const StatusIcon = statusConfig[invoice.status]?.icon || FileText
  const paidPercentage = invoice.totalAmount > 0 
    ? ((invoice.amountPaid || 0) / invoice.totalAmount) * 100 
    : 0

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/finance/client-invoices')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Invoice {invoice.invoiceNumber}</h1>
              <p className="text-muted-foreground">View and manage invoice details</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={statusConfig[invoice.status]?.color || 'bg-gray-100 text-gray-700'}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {statusConfig[invoice.status]?.label || invoice.status}
            </Badge>
            {invoice.isXeroSynced && (
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                Xero Synced
              </Badge>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Invoice Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Invoice Information */}
            <Card>
              <CardHeader>
                <CardTitle>Invoice Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Invoice Number</p>
                    <p className="font-medium">{invoice.invoiceNumber}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Issue Date</p>
                    <p className="font-medium">{format(new Date(invoice.issueDate), 'dd MMM yyyy')}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Due Date</p>
                    <p className="font-medium">{format(new Date(invoice.dueDate), 'dd MMM yyyy')}</p>
                  </div>
                  {invoice.paidDate && (
                    <div>
                      <p className="text-sm text-muted-foreground">Paid Date</p>
                      <p className="font-medium">{format(new Date(invoice.paidDate), 'dd MMM yyyy')}</p>
                    </div>
                  )}
                </div>

                {invoice.description && (
                  <div>
                    <p className="text-sm text-muted-foreground">Description</p>
                    <p className="font-medium">{invoice.description}</p>
                  </div>
                )}

                {invoice.notes && (
                  <div>
                    <p className="text-sm text-muted-foreground">Notes</p>
                    <p className="text-sm">{invoice.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Line Items */}
            {invoice.items && invoice.items.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Line Items</CardTitle>
                  <CardDescription>Items included in this invoice</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Quantity</TableHead>
                          <TableHead className="text-right">Unit Price</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invoice.items.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <div className="font-medium">{item.description}</div>
                            </TableCell>
                            <TableCell className="text-right">
                              {item.quantity} {item.unit || 'pcs'}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(item.unitPrice, invoice.currency)}
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {formatCurrency(item.totalPrice, invoice.currency)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Payment Reconciliation */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5" />
                      Payment Reconciliation
                    </CardTitle>
                    <CardDescription>
                      Track all payments received for this invoice
                    </CardDescription>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Payment Progress</p>
                    <p className="text-2xl font-bold">
                      {paidPercentage.toFixed(0)}%
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Payment Progress Bar */}
                <div className="mb-6">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">
                      Paid: {formatCurrency(invoice.amountPaid || 0, invoice.currency)}
                    </span>
                    <span className="text-muted-foreground">
                      Total: {formatCurrency(invoice.totalAmount, invoice.currency)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        paidPercentage >= 100 
                          ? 'bg-green-500' 
                          : paidPercentage > 0 
                            ? 'bg-yellow-500' 
                            : 'bg-gray-400'
                      }`}
                      style={{ width: `${Math.min(paidPercentage, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Payments Table */}
                {invoice.payments && invoice.payments.length > 0 ? (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Reference</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Method</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Xero ID</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invoice.payments.map((payment) => (
                          <TableRow key={payment.id}>
                            <TableCell>
                              {format(new Date(payment.paymentDate), 'dd MMM yyyy')}
                            </TableCell>
                            <TableCell>
                              {payment.reference || '-'}
                            </TableCell>
                            <TableCell className="font-medium">
                              {formatCurrency(payment.amount, payment.currency)}
                            </TableCell>
                            <TableCell className="capitalize">
                              {payment.paymentMethod.replace(/_/g, ' ').toLowerCase()}
                            </TableCell>
                            <TableCell>
                              <Badge 
                                className={paymentStatusConfig[payment.status]?.color || 'bg-gray-100 text-gray-700'}
                                variant="outline"
                              >
                                {paymentStatusConfig[payment.status]?.label || payment.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground">
                              {payment.xeroPaymentId 
                                ? payment.xeroPaymentId.substring(0, 8) + '...' 
                                : '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <CreditCard className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No payments recorded for this invoice</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Customer Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Customer
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="font-medium">{invoice.Customer.name}</p>
                {invoice.Customer.email && (
                  <p className="text-sm text-muted-foreground">{invoice.Customer.email}</p>
                )}
                {invoice.Customer.phone && (
                  <p className="text-sm text-muted-foreground">{invoice.Customer.phone}</p>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-4"
                  onClick={() => router.push(`/clients/${invoice.Customer.id}`)}
                >
                  View Customer
                </Button>
              </CardContent>
            </Card>

            {/* Project Info */}
            {invoice.Project && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Project
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="font-medium">{invoice.Project.name}</p>
                  <p className="text-sm text-muted-foreground">{invoice.Project.projectNumber}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-4"
                    onClick={() => router.push(`/projects/${invoice.Project?.id}`)}
                  >
                    View Project
                  </Button>
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
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">{formatCurrency(invoice.subtotal, invoice.currency)}</span>
                </div>
                {invoice.taxAmount && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tax</span>
                    <span className="font-medium">{formatCurrency(invoice.taxAmount, invoice.currency)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>{formatCurrency(invoice.totalAmount, invoice.currency)}</span>
                </div>
                <div className="flex justify-between text-green-600">
                  <span>Paid</span>
                  <span>{formatCurrency(invoice.amountPaid || 0, invoice.currency)}</span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span>Due</span>
                  <span>{formatCurrency(invoice.amountDue || invoice.totalAmount, invoice.currency)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </Button>
                <Button variant="outline" className="w-full" size="sm">
                  <FileText className="h-4 w-4 mr-2" />
                  Send to Customer
                </Button>
                
                {/* Delete button - only show for draft invoices not synced to Xero */}
                {canDelete && invoice.status === 'DRAFT' && !invoice.isXeroSynced && (
                  <>
                    <div className="pt-2 border-t">
                      <p className="text-xs text-muted-foreground mb-2">
                        Danger Zone
                      </p>
                      <Button 
                        variant="destructive" 
                        className="w-full" 
                        size="sm"
                        onClick={() => setShowDeleteDialog(true)}
                        disabled={deleting}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        {deleting ? 'Deleting...' : 'Delete Invoice'}
                      </Button>
                      <p className="text-xs text-muted-foreground mt-2">
                        Draft invoices can be deleted before syncing to Xero
                      </p>
                    </div>
                  </>
                )}

                {/* Info for synced invoices */}
                {invoice.isXeroSynced && (
                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground">
                      <AlertTriangle className="h-3 w-3 inline mr-1" />
                      This invoice is synced with Xero. It can only be deleted from Xero or by issuing a credit note.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Draft Invoice?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete invoice <strong>{invoice.invoiceNumber}</strong>?
                <br /><br />
                This action cannot be undone. All invoice data and line items will be permanently removed.
                <br /><br />
                <span className="text-xs text-muted-foreground">
                  Note: This invoice has not been synced to Xero yet, so it can be safely deleted.
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteInvoice}
                disabled={deleting}
                className="bg-red-600 hover:bg-red-700"
              >
                {deleting ? 'Deleting...' : 'Delete Invoice'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MainLayout>
  )
}
