
'use client'

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useParams, useRouter } from "next/navigation"
import { MainLayout } from "@/components/layout/main-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
  Send,
  CheckCircle,
  XCircle,
  Eye,
  Copy,
  GitBranch,
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
  Mail
} from "lucide-react"
import { format } from "date-fns"
import { PDFPreview } from "@/components/quotation/pdf-preview"
import { toast } from "sonner"

interface Quotation {
  id: string
  quotationNumber: string
  version: number
  title: string
  description: string
  clientReference: string
  subtotal: number
  taxAmount: number
  discountAmount: number
  totalAmount: number
  currency: string
  status: string
  validUntil: string
  terms: string
  notes: string
  requiresApproval: boolean
  approvalValue: number
  createdAt: string
  updatedAt: string
  client: {
    id: string
    name: string
    clientNumber: string
    email: string
    phone: string
    clientType: string
  }
  tender?: {
    id: string
    tenderNumber: string
    title: string
  }
  salesperson: {
    id: string
    firstName: string
    lastName: string
    email: string
  }
  createdBy: {
    id: string
    firstName: string
    lastName: string
    email: string
  }
  items: QuotationItem[]
  approvals: QuotationApproval[]
}

interface QuotationItem {
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
  notes: string
  order: number
}

interface QuotationApproval {
  id: string
  status: string
  comments: string
  approvalLevel: number
  approvedAt: string
  createdAt: string
  approver: {
    id: string
    firstName: string
    lastName: string
    email: string
  }
}

export default function QuotationDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session } = useSession()
  const [quotation, setQuotation] = useState<Quotation | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  // Track dropdown state for proper cleanup
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const userRole = session?.user?.role
  const userId = session?.user?.id
  
  const canEdit = ["SUPERADMIN", "ADMIN", "PROJECT_MANAGER"].includes(userRole || "") && 
                  quotation?.status === "DRAFT"
  
  // Users can approve if they have admin rights OR are the quotation creator/salesperson
  const canApproveByRole = ["SUPERADMIN", "ADMIN", "PROJECT_MANAGER"].includes(userRole || "")
  const isQuotationCreator = quotation?.createdBy?.id === userId
  const isQuotationSalesperson = quotation?.salesperson?.id === userId
  
  const canApprove = (canApproveByRole || isQuotationCreator || isQuotationSalesperson) && 
                     quotation?.requiresApproval && 
                     ["DRAFT", "SUBMITTED", "UNDER_REVIEW"].includes(quotation?.status || "")

  // Cleanup effect: close dropdown on unmount
  useEffect(() => {
    return () => {
      setDropdownOpen(false)
      
      // Force close any lingering Radix portals with aria-hidden
      const cleanupAriaHidden = () => {
        const ariaHiddenElements = document.querySelectorAll('[data-radix-popper-content-wrapper]')
        ariaHiddenElements.forEach(element => {
          element.remove()
        })
      }
      cleanupAriaHidden()
    }
  }, [])

  useEffect(() => {
    if (params.id) {
      fetchQuotation(params.id as string)
    }
  }, [params.id])

  const fetchQuotation = async (id: string) => {
    try {
      const response = await fetch(`/api/quotations/${id}`)
      if (response.ok) {
        const data = await response.json()
        setQuotation(data)
      } else {
        console.error("Failed to fetch quotation")
      }
    } catch (error) {
      console.error("Error fetching quotation:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleApproval = async (action: 'APPROVED' | 'REJECTED', comments?: string) => {
    if (!quotation) return

    setProcessing(true)
    try {
      const response = await fetch(`/api/quotations/${quotation.id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          comments
        }),
      })

      if (response.ok) {
        await fetchQuotation(quotation.id)
      } else {
        const error = await response.json()
        alert(`Failed to ${action.toLowerCase()} quotation: ${error.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error(`Error ${action.toLowerCase()} quotation:`, error)
      alert(`Failed to ${action.toLowerCase()} quotation. Please try again.`)
    } finally {
      setProcessing(false)
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    if (!quotation) return

    setProcessing(true)
    try {
      const response = await fetch(`/api/quotations/${quotation.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: newStatus
        }),
      })

      if (response.ok) {
        await fetchQuotation(quotation.id)
        toast('Status updated successfully', {
          description: `Quotation status changed to ${newStatus}`,
        })
      } else {
        const error = await response.json()
        toast.error('Failed to update status', {
          description: error.error || 'Unknown error occurred'
        })
      }
    } catch (error) {
      console.error('Error updating quotation status:', error)
      toast.error('Failed to update status', {
        description: 'Please try again later'
      })
    } finally {
      setProcessing(false)
    }
  }

  const handleDuplicate = async () => {
    if (!quotation) return

    setProcessing(true)
    setDropdownOpen(false)
    
    try {
      const response = await fetch(`/api/quotations/${quotation.id}/duplicate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        const result = await response.json()
        const newQuotationId = result.success ? result.data?.id : result.id
        
        toast('Quotation duplicated successfully', {
          description: `New quotation ${result.data?.quotationNumber || result.quotationNumber} created`,
        })
        
        // Navigate to the new quotation
        if (newQuotationId) {
          router.push(`/quotations/${newQuotationId}`)
        }
      } else {
        const error = await response.json()
        toast.error('Failed to duplicate quotation', {
          description: error.error || 'Unknown error occurred'
        })
      }
    } catch (error) {
      console.error('Error duplicating quotation:', error)
      toast.error('Failed to duplicate quotation', {
        description: 'Please try again later'
      })
    } finally {
      setProcessing(false)
    }
  }

  const handleCreateVersion = async () => {
    if (!quotation) return

    setProcessing(true)
    setDropdownOpen(false)
    
    try {
      const response = await fetch(`/api/quotations/${quotation.id}/create-version`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        const result = await response.json()
        const newVersionId = result.success ? result.data?.id : result.id
        
        toast('New version created successfully', {
          description: `Version ${result.data?.version || result.version} of ${quotation.quotationNumber}`,
        })
        
        // Navigate to the new version
        if (newVersionId) {
          router.push(`/quotations/${newVersionId}`)
        }
      } else {
        const error = await response.json()
        toast.error('Failed to create new version', {
          description: error.error || 'Unknown error occurred'
        })
      }
    } catch (error) {
      console.error('Error creating version:', error)
      toast.error('Failed to create new version', {
        description: 'Please try again later'
      })
    } finally {
      setProcessing(false)
    }
  }

  const handleRefresh = async () => {
    if (!quotation) return
    
    setDropdownOpen(false)
    setLoading(true)
    
    try {
      await fetchQuotation(quotation.id)
      toast('Quotation refreshed successfully', {
        description: 'Latest data loaded from server',
      })
    } catch (error) {
      console.error('Error refreshing quotation:', error)
      toast.error('Failed to refresh quotation', {
        description: 'Please try again later'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSendEmail = async () => {
    if (!quotation) return

    setProcessing(true)
    setDropdownOpen(false)
    
    try {
      const response = await fetch(`/api/quotations/${quotation.id}/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        toast('Email sent successfully', {
          description: `Quotation ${quotation.quotationNumber} sent to ${quotation.client?.email}`,
        })
        
        // Update status to SENT if it was APPROVED
        if (quotation.status === 'APPROVED') {
          await handleStatusChange('SENT')
        }
      } else {
        const error = await response.json()
        toast.error('Failed to send email', {
          description: error.error || 'Unknown error occurred'
        })
      }
    } catch (error) {
      console.error('Error sending email:', error)
      toast.error('Failed to send email', {
        description: 'Please try again later'
      })
    } finally {
      setProcessing(false)
    }
  }

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

  if (!quotation) {
    return (
      <MainLayout>
        <div className="container mx-auto p-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Quotation Not Found
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              The quotation you're looking for doesn't exist or you don't have permission to view it.
            </p>
            <Button onClick={() => router.push('/quotations')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Quotations
            </Button>
          </div>
        </div>
      </MainLayout>
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'bg-gray-100 text-gray-800'
      case 'SUBMITTED': return 'bg-blue-100 text-blue-800'
      case 'UNDER_REVIEW': return 'bg-yellow-100 text-yellow-800'
      case 'APPROVED': return 'bg-green-100 text-green-800'
      case 'REJECTED': return 'bg-red-100 text-red-800'
      case 'CONVERTED': return 'bg-purple-100 text-purple-800'
      case 'SUPERSEDED': return 'bg-orange-100 text-orange-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getApprovalStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'bg-green-100 text-green-800'
      case 'REJECTED': return 'bg-red-100 text-red-800'
      case 'PENDING': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <MainLayout>
      <div className="container mx-auto p-6 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <Button 
              variant="outline" 
              onClick={() => router.push('/quotations')}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Quotations
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {quotation.quotationNumber || 'N/A'}
              </h1>
              <p className="text-gray-600 dark:text-gray-300">
                {quotation.title || 'N/A'}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Badge className={getStatusColor(quotation.status)}>
              {quotation.status}
            </Badge>
            {quotation.requiresApproval && (
              <Badge variant="outline" className="text-[10px] px-1 py-0">
                <AlertTriangle className="mr-1 h-3 w-3" />
                Requires Approval
              </Badge>
            )}
          </div>
        </div>

        {/* Approval Status Alert */}
        {quotation.requiresApproval && quotation.status === "DRAFT" && (
          <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mr-2" />
              <div>
                <h3 className="text-sm font-medium text-yellow-800">
                  Approval Required
                </h3>
                <p className="text-sm text-yellow-600 mt-1">
                  This quotation requires approval before it can be submitted to the client.
                </p>
              </div>
            </div>
          </div>
        )}

        {quotation.status === "SUBMITTED" && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center">
              <Clock className="h-5 w-5 text-blue-600 mr-2" />
              <div>
                <h3 className="text-sm font-medium text-blue-800">
                  Pending Approval
                </h3>
                <p className="text-sm text-blue-600 mt-1">
                  This quotation has been submitted for approval and is awaiting review.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center space-x-2 mb-6">
          {canEdit && (
            <Button variant="outline" onClick={() => router.push(`/quotations/${quotation.id}/edit`)}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
          )}

          {quotation.status === 'DRAFT' && quotation.requiresApproval && (canApproveByRole || isQuotationCreator || isQuotationSalesperson) && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => handleStatusChange('SUBMITTED')}
              disabled={processing}
            >
              <Send className="mr-2 h-4 w-4" />
              Submit for Approval
            </Button>
          )}

          {canApprove && (
            <div className="flex flex-col space-y-2">
              <div className="flex items-center space-x-2">
                <Button 
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => handleApproval('APPROVED')}
                  disabled={processing}
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  {processing ? 'Processing...' : 'Approve Quotation'}
                </Button>
                <Button 
                  variant="destructive"
                  onClick={() => handleApproval('REJECTED')}
                  disabled={processing}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  {processing ? 'Processing...' : 'Reject Quotation'}
                </Button>
              </div>
              {(isQuotationCreator || isQuotationSalesperson) && !canApproveByRole && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-2">
                  <p className="text-xs text-yellow-800 font-medium">
                    {isQuotationCreator && isQuotationSalesperson ? 
                      "⚠️ Self-approval: You created and are assigned to this quotation" :
                      isQuotationCreator ? 
                        "⚠️ Self-approval: You created this quotation" :
                        "⚠️ Self-approval: You are assigned as salesperson"
                    }
                  </p>
                </div>
              )}
            </div>
          )}

          <DropdownMenu
            open={dropdownOpen}
            onOpenChange={setDropdownOpen}
          >
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={processing}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleDuplicate} disabled={processing}>
                <Copy className="mr-2 h-4 w-4" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleCreateVersion} disabled={processing}>
                <GitBranch className="mr-2 h-4 w-4" />
                Create Version
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleRefresh} disabled={processing}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleSendEmail} disabled={processing || !quotation.client?.email}>
                <Mail className="mr-2 h-4 w-4" />
                Send Email {!quotation.client?.email && "(No email)"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="items">Line Items</TabsTrigger>
            <TabsTrigger value="preview">PDF Preview</TabsTrigger>
            <TabsTrigger value="approvals">Approvals</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Quotation Information */}
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <FileText className="mr-2 h-5 w-5" />
                      Quotation Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Quotation Number</label>
                        <p className="font-mono font-medium text-red-600">
                          {quotation.quotationNumber}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Version</label>
                        <p className="font-medium">v{quotation.version}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Status</label>
                        <div>
                          <Badge className={getStatusColor(quotation.status)}>
                            {quotation.status}
                          </Badge>
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Valid Until</label>
                        <p className="font-medium">
                          {(() => {
                            try {
                              return format(new Date(quotation.validUntil), 'MMM dd, yyyy')
                            } catch {
                              return new Date(quotation.validUntil).toLocaleDateString()
                            }
                          })()}
                        </p>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Title</label>
                        <p className="font-medium">{quotation.title || 'N/A'}</p>
                      </div>
                      {quotation.description && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">Description</label>
                          <p className="text-sm text-gray-700">{quotation.description}</p>
                        </div>
                      )}
                      {quotation.clientReference && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">Client Reference</label>
                          <p className="text-sm text-gray-700">{quotation.clientReference}</p>
                        </div>
                      )}
                    </div>

                    <div className="pt-4 border-t">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Created:</span>
                          <span className="ml-2 font-medium">
                            {(() => {
                              try {
                                return format(new Date(quotation.createdAt), 'MMM dd, yyyy HH:mm')
                              } catch {
                                return new Date(quotation.createdAt).toLocaleString()
                              }
                            })()}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">Updated:</span>
                          <span className="ml-2 font-medium">
                            {(() => {
                              try {
                                return format(new Date(quotation.updatedAt), 'MMM dd, yyyy HH:mm')
                              } catch {
                                return new Date(quotation.updatedAt).toLocaleString()
                              }
                            })()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Client Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Building2 className="mr-2 h-5 w-5" />
                      Client Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div>
                        <p className="font-medium text-lg">{quotation.client?.name || 'N/A'}</p>
                        <p className="text-sm text-gray-500">
                          {quotation.client?.clientNumber || 'N/A'} • {quotation.client?.clientType || 'N/A'}
                        </p>
                      </div>
                      {(quotation.client?.email || quotation.client?.phone) && (
                        <div className="pt-2 space-y-1">
                          {quotation.client?.email && (
                            <p className="text-sm text-gray-600">{quotation.client.email}</p>
                          )}
                          {quotation.client?.phone && (
                            <p className="text-sm text-gray-600">{quotation.client.phone}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {quotation.tender && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <FileText className="mr-2 h-5 w-5" />
                        Related Tender
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div>
                        <p className="font-medium">{quotation.tender.title}</p>
                        <p className="text-sm text-gray-500">{quotation.tender.tenderNumber}</p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Right sidebar */}
              <div className="space-y-6">
                {/* Salesperson Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <User className="mr-2 h-5 w-5" />
                      Salesperson
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div>
                      <p className="font-medium">
                        {quotation.salesperson?.firstName || 'N/A'} {quotation.salesperson?.lastName || ''}
                      </p>
                      <p className="text-sm text-gray-500">{quotation.salesperson?.email || 'N/A'}</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Created By Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <User className="mr-2 h-5 w-5" />
                      Created By
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div>
                      <p className="font-medium">
                        {quotation.createdBy?.firstName || 'N/A'} {quotation.createdBy?.lastName || ''}
                        {isQuotationCreator && <Badge variant="outline" className="ml-2 text-xs">You</Badge>}
                      </p>
                      <p className="text-sm text-gray-500">{quotation.createdBy?.email || 'N/A'}</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Financial Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <DollarSign className="mr-2 h-5 w-5" />
                      Financial Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Subtotal:</span>
                      <span className="font-medium">
                        {quotation.currency} {Number(quotation.subtotal).toFixed(2)}
                      </span>
                    </div>
                    {Number(quotation.discountAmount) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Discount:</span>
                        <span className="font-medium text-orange-600">
                          -{quotation.currency} {Number(quotation.discountAmount).toFixed(2)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Tax:</span>
                      <span className="font-medium">
                        {quotation.currency} {Number(quotation.taxAmount).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="font-semibold">Total:</span>
                      <span className="font-bold text-green-600">
                        {quotation.currency} {Number(quotation.totalAmount).toFixed(2)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="items">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Package className="mr-2 h-5 w-5" />
                  Line Items ({quotation.items.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
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
                      {quotation.items.map((item) => (
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
                            <Badge variant="outline">{item.category}</Badge>
                          </TableCell>
                          <TableCell>{item.quantity} {item.unit}</TableCell>
                          <TableCell>
                            {quotation.currency} {Number(item.unitPrice).toFixed(2)}
                          </TableCell>
                          <TableCell>{item.discount}%</TableCell>
                          <TableCell>{item.taxRate}%</TableCell>
                          <TableCell className="text-right font-medium">
                            {quotation.currency} {Number(item.totalPrice).toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="preview">
            <PDFPreview 
              quotationId={quotation.id} 
              quotationNumber={quotation.quotationNumber}
            />
          </TabsContent>

          <TabsContent value="approvals">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CheckCircle className="mr-2 h-5 w-5" />
                  Approval History
                </CardTitle>
              </CardHeader>
              <CardContent>
                {quotation.approvals.length === 0 ? (
                  <div className="text-center py-8">
                    <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No approvals yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {quotation.approvals.map((approval) => (
                      <div 
                        key={approval.id}
                        className="border rounded-lg p-4 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Badge className={getApprovalStatusColor(approval.status)}>
                              {approval.status}
                            </Badge>
                            <span className="font-medium">
                              {approval.approver.firstName} {approval.approver.lastName}
                            </span>
                          </div>
                          <span className="text-sm text-gray-500">
                            {approval.approvedAt ? 
                              (() => {
                                try {
                                  return format(new Date(approval.approvedAt), 'MMM dd, yyyy HH:mm')
                                } catch {
                                  return new Date(approval.approvedAt).toLocaleString()
                                }
                              })() :
                              (() => {
                                try {
                                  return format(new Date(approval.createdAt), 'MMM dd, yyyy HH:mm')
                                } catch {
                                  return new Date(approval.createdAt).toLocaleString()
                                }
                              })()
                            }
                          </span>
                        </div>
                        {approval.comments && (
                          <p className="text-sm text-gray-700">{approval.comments}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Clock className="mr-2 h-5 w-5" />
                  Activity History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">Activity history will be displayed here</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  )
}

