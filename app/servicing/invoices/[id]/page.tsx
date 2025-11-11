
'use client'

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter, useParams } from "next/navigation"
import { MainLayout } from "@/components/layout/main-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ServiceInvoicePDFPreview } from "@/components/servicing/service-invoice-pdf-preview"
import { 
  ArrowLeft,
  FileText,
  DollarSign,
  Calendar,
  User,
  Building2,
  CheckCircle,
  Clock,
  XCircle,
  Download
} from "lucide-react"
import Link from "next/link"
import { format } from "date-fns"
import { toast } from "sonner"

interface ServiceInvoiceDetail {
  id: string
  invoiceNo: string
  invoiceType: string
  amount: number
  status: string
  filePath?: string | null
  xeroId?: string | null
  createdAt: string
  updatedAt: string
  ServiceJob: {
    id: string
    scheduledDate: string
    completedAt?: string | null
    status: string
    ServiceContract: {
      id: string
      contractNo: string
      serviceType: string
      title: string
    }
    Customer: {
      id: string
      name: string
      customerNumber?: string | null
      email?: string | null
      phone?: string | null
    }
    Project?: {
      id: string
      projectNumber: string
      name: string
    } | null
  }
}

export default function ServiceInvoiceDetailPage() {
  const { data: session, status } = useSession() || {}
  const router = useRouter()
  const params = useParams()
  const invoiceId = params?.id as string

  const [invoice, setInvoice] = useState<ServiceInvoiceDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push('/auth/login')
    } else if (status === "authenticated") {
      fetchInvoiceDetail()
    }
  }, [status, router, invoiceId])

  const fetchInvoiceDetail = async () => {
    try {
      const response = await fetch(`/api/servicing/invoices/${invoiceId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch invoice')
      }
      const data = await response.json()
      setInvoice(data)
    } catch (error) {
      console.error('Error fetching invoice:', error)
      toast.error('Failed to load invoice details')
    } finally {
      setLoading(false)
    }
  }

  const handleStatusUpdate = async (newStatus: string) => {
    try {
      setUpdating(true)
      const response = await fetch(`/api/servicing/invoices/${invoiceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })

      if (!response.ok) {
        throw new Error('Failed to update invoice status')
      }

      toast.success(`Invoice ${newStatus.toLowerCase()} successfully`)
      fetchInvoiceDetail()
    } catch (error) {
      console.error('Error updating invoice:', error)
      toast.error('Failed to update invoice status')
    } finally {
      setUpdating(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const variants = {
      'Draft': 'secondary',
      'Approved': 'default',
      'Paid': 'default',
      'Rejected': 'destructive'
    } as const
    
    const colors = {
      'Draft': 'bg-gray-500',
      'Approved': 'bg-blue-500',
      'Paid': 'bg-green-500',
      'Rejected': 'bg-red-500'
    } as const

    return (
      <Badge variant={variants[status as keyof typeof variants] || 'secondary'} className={colors[status as keyof typeof colors] || ''}>
        {status}
      </Badge>
    )
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Loading invoice details...</p>
          </div>
        </div>
      </MainLayout>
    )
  }

  if (!invoice) {
    return (
      <MainLayout>
        <div className="container mx-auto py-6">
          <Card>
            <CardHeader>
              <CardTitle>Invoice Not Found</CardTitle>
              <CardDescription>The requested invoice could not be found.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => router.back()}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Go Back
              </Button>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    )
  }

  // Calculate GST and total
  const subtotal = invoice.amount
  const gst = subtotal * 0.09
  const total = subtotal + gst

  return (
    <MainLayout>
      <div className="container mx-auto py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Service Invoice</h1>
              <p className="text-muted-foreground">{invoice.invoiceNo}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge(invoice.status)}
            {invoice.xeroId && (
              <Badge variant="outline" className="bg-purple-50">
                Synced to Xero
              </Badge>
            )}
          </div>
        </div>

        {/* Invoice Details Card */}
        <Card>
          <CardHeader>
            <CardTitle>Invoice Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Invoice Details */}
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Invoice Details
                </h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Invoice No:</span>
                    <p className="font-medium">{invoice.invoiceNo}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Type:</span>
                    <p className="font-medium">{invoice.invoiceType}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Created:</span>
                    <p className="font-medium">{format(new Date(invoice.createdAt), 'dd MMM yyyy')}</p>
                  </div>
                </div>
              </div>

              {/* Customer Details */}
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Customer
                </h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Name:</span>
                    <p className="font-medium">{invoice.ServiceJob.Customer.name}</p>
                  </div>
                  {invoice.ServiceJob.Customer.customerNumber && (
                    <div>
                      <span className="text-muted-foreground">Customer #:</span>
                      <p className="font-medium">{invoice.ServiceJob.Customer.customerNumber}</p>
                    </div>
                  )}
                  {invoice.ServiceJob.Customer.email && (
                    <div>
                      <span className="text-muted-foreground">Email:</span>
                      <p className="font-medium">{invoice.ServiceJob.Customer.email}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Amount Details */}
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Amount
                </h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Subtotal:</span>
                    <p className="font-medium">${subtotal.toFixed(2)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">GST (9%):</span>
                    <p className="font-medium">${gst.toFixed(2)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total:</span>
                    <p className="font-bold text-lg">${total.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Service Job Details */}
            <div className="mt-6 pt-6 border-t space-y-3">
              <h3 className="font-semibold">Related Service Job</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Contract:</span>
                  <p className="font-medium">{invoice.ServiceJob.ServiceContract.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {invoice.ServiceJob.ServiceContract.contractNo} - {invoice.ServiceJob.ServiceContract.serviceType}
                  </p>
                </div>
                {invoice.ServiceJob.Project && (
                  <div>
                    <span className="text-muted-foreground">Project:</span>
                    <p className="font-medium">{invoice.ServiceJob.Project.name}</p>
                    <p className="text-xs text-muted-foreground">{invoice.ServiceJob.Project.projectNumber}</p>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">Scheduled Date:</span>
                  <p className="font-medium">{format(new Date(invoice.ServiceJob.scheduledDate), 'dd MMM yyyy')}</p>
                </div>
                {invoice.ServiceJob.completedAt && (
                  <div>
                    <span className="text-muted-foreground">Completed Date:</span>
                    <p className="font-medium">{format(new Date(invoice.ServiceJob.completedAt), 'dd MMM yyyy')}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            {invoice.status === 'Draft' && (
              <div className="mt-6 pt-6 border-t flex gap-2">
                <Button
                  onClick={() => handleStatusUpdate('Approved')}
                  disabled={updating}
                  className="bg-blue-500 hover:bg-blue-600"
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Approve Invoice
                </Button>
                <Button
                  onClick={() => handleStatusUpdate('Rejected')}
                  disabled={updating}
                  variant="destructive"
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Reject Invoice
                </Button>
              </div>
            )}
            
            {invoice.status === 'Approved' && (
              <div className="mt-6 pt-6 border-t flex gap-2">
                <Button
                  onClick={() => handleStatusUpdate('Paid')}
                  disabled={updating}
                  className="bg-green-500 hover:bg-green-600"
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Mark as Paid
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabs for PDF Preview */}
        <Tabs defaultValue="preview" className="w-full">
          <TabsList>
            <TabsTrigger value="preview">
              <FileText className="mr-2 h-4 w-4" />
              PDF Preview
            </TabsTrigger>
            <TabsTrigger value="details">
              <FileText className="mr-2 h-4 w-4" />
              Details
            </TabsTrigger>
          </TabsList>

          <TabsContent value="preview" className="mt-4">
            <ServiceInvoicePDFPreview
              invoiceId={invoice.id}
              invoiceNo={invoice.invoiceNo}
              onGenerated={() => fetchInvoiceDetail()}
            />
          </TabsContent>

          <TabsContent value="details" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Technical Details</CardTitle>
                <CardDescription>System information and metadata</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Invoice ID:</span>
                    <p className="font-mono">{invoice.id}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Job ID:</span>
                    <p className="font-mono">{invoice.ServiceJob.id}</p>
                  </div>
                  {invoice.xeroId && (
                    <div>
                      <span className="text-muted-foreground">Xero ID:</span>
                      <p className="font-mono">{invoice.xeroId}</p>
                    </div>
                  )}
                  {invoice.filePath && (
                    <div>
                      <span className="text-muted-foreground">File Path:</span>
                      <p className="font-mono text-xs">{invoice.filePath}</p>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground">Last Updated:</span>
                    <p className="font-medium">{format(new Date(invoice.updatedAt), 'dd MMM yyyy HH:mm:ss')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  )
}
