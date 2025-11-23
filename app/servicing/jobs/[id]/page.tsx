
'use client'

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { MainLayout } from "@/components/layout/main-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { 
  ArrowLeft,
  Calendar,
  Clock,
  User,
  Building2,
  FileText,
  Play,
  CheckCircle,
  Upload,
  DollarSign,
  Phone,
  Mail,
  MapPin,
  Edit,
  Save,
  AlertTriangle
} from "lucide-react"
import Link from "next/link"
import { format } from "date-fns"
import { UnifiedJobSheetManager } from "@/components/servicing/unified-jobsheet-manager"
import { toast } from "sonner"

interface ServiceJobDetail {
  id: string
  scheduledDate: string
  status: string
  completionNotes?: string
  completedAt?: string
  assignedToType: string
  contract: {
    id: string
    contractNo: string
    serviceType: string
    frequency: string
    startDate: string
    endDate: string
  }
  client: {
    id: string
    name: string
    clientNumber: string
    email: string
    phone: string
    address?: string
    city?: string
    contactPerson?: string
  }
  project?: {
    id: string
    projectNumber: string
    name: string
    status: string
    description?: string
  }
  assignedUser?: {
    id: string
    firstName: string
    lastName: string
    email: string
    role: string
    phone?: string
  }
  assignedVendor?: {
    id: string
    name: string
    email: string
    phone: string
    contactPerson?: string
    address?: string
  }
  jobSheets: Array<{
    id: string
    filePath: string
    endorsedFilePath?: string | null
    endorsedUploadedAt?: string | null
    clientSignature?: string
    generatedAt: string
  }>
  vendorReports: Array<{
    id: string
    filePath: string
    uploadedAt: string
    vendor: {
      id: string
      name: string
      email: string
    }
  }>
  invoices: Array<{
    id: string
    invoiceNo: string
    invoiceType: string
    amount: number
    status: string
    filePath?: string
    createdAt: string
  }>
}

export default function ServiceJobDetailPage({ params }: { params: { id: string } }) {
  const { data: session } = useSession()
  const router = useRouter()
  const [job, setJob] = useState<ServiceJobDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesValue, setNotesValue] = useState("")
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false)
  const [invoiceAmount, setInvoiceAmount] = useState("")
  const [invoiceType, setInvoiceType] = useState<'Client' | 'Vendor'>('Client')

  useEffect(() => {
    fetchJob()
  }, [params.id])

  const fetchJob = async () => {
    try {
      const response = await fetch(`/api/servicing/jobs/${params.id}`)
      if (response.ok) {
        const data = await response.json()
        setJob(data)
        setNotesValue(data.completionNotes || "")
      } else {
        console.error('Failed to fetch job')
        router.push('/servicing/jobs')
      }
    } catch (error) {
      console.error('Error fetching job:', error)
      router.push('/servicing/jobs')
    } finally {
      setLoading(false)
    }
  }

  const handleStatusUpdate = async (newStatus: string) => {
    if (!job) return
    
    setUpdating(true)
    try {
      const response = await fetch(`/api/servicing/jobs/${job.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      })

      if (response.ok) {
        toast.success('Job status updated successfully')
        fetchJob() // Refresh the job data
      } else {
        toast.error('Failed to update job status')
      }
    } catch (error) {
      console.error('Error updating job status:', error)
      toast.error('Error updating job status')
    } finally {
      setUpdating(false)
    }
  }

  const handleNotesUpdate = async () => {
    if (!job) return
    
    setUpdating(true)
    try {
      const response = await fetch(`/api/servicing/jobs/${job.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ completionNotes: notesValue }),
      })

      if (response.ok) {
        setEditingNotes(false)
        toast.success('Completion notes updated')
        fetchJob()
      } else {
        toast.error('Failed to update notes')
      }
    } catch (error) {
      console.error('Error updating notes:', error)
      toast.error('Error updating notes')
    } finally {
      setUpdating(false)
    }
  }

  const handleGenerateJobSheet = async () => {
    if (!job) return
    
    setUpdating(true)
    toast.info('Generating job sheet...')
    
    try {
      const response = await fetch(`/api/servicing/jobs/${job.id}/jobsheet`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        const result = await response.json()
        toast.success('Job sheet generated successfully!')
        fetchJob() // Refresh to show new job sheet
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to generate job sheet')
      }
    } catch (error) {
      console.error('Error generating job sheet:', error)
      toast.error('Error generating job sheet')
    } finally {
      setUpdating(false)
    }
  }

  const handleCreateInvoice = async () => {
    if (!job || !invoiceAmount) {
      toast.error('Please enter an invoice amount')
      return
    }
    
    setUpdating(true)
    toast.info('Creating invoice...')
    
    try {
      const response = await fetch(`/api/servicing/jobs/${job.id}/invoices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invoiceType: invoiceType,
          amount: parseFloat(invoiceAmount),
          status: 'Draft',
          generatePdf: true
        })
      })

      if (response.ok) {
        const result = await response.json()
        toast.success(result.message || 'Invoice created successfully!')
        toast.info('Invoice has been added to Unsynced Invoices in Finance module for review before Xero sync')
        if (result.warning) {
          toast.warning(result.warning, { duration: 5000 })
        }
        setShowInvoiceDialog(false)
        setInvoiceAmount("")
        fetchJob() // Refresh to show new invoice
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to create invoice')
      }
    } catch (error) {
      console.error('Error creating invoice:', error)
      toast.error('Error creating invoice')
    } finally {
      setUpdating(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Scheduled': return 'bg-blue-100 text-blue-800'
      case 'InProgress': return 'bg-yellow-100 text-yellow-800'
      case 'Completed': return 'bg-green-100 text-green-800'
      case 'Endorsed': return 'bg-purple-100 text-purple-800'
      case 'Overdue': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const isOverdue = (scheduledDate: string, status: string) => {
    return new Date(scheduledDate) < new Date() && !['Completed', 'Endorsed'].includes(status)
  }

  const userRole = session?.user?.role
  const userId = session?.user?.id
  const canManageAll = ["SUPERADMIN", "PROJECT_MANAGER"].includes(userRole || "")
  const canUpdate = canManageAll || (job?.assignedUser?.id === userId)

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

  if (!job) {
    return (
      <MainLayout>
        <div className="container mx-auto p-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Service Job Not Found
            </h1>
            <Link href="/servicing/jobs">
              <Button>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Jobs
              </Button>
            </Link>
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
            <Link href="/servicing/jobs">
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Jobs
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Service Job Details
              </h1>
              <p className="text-gray-600 dark:text-gray-300">
                Contract: {job.contract.contractNo}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Badge className={getStatusColor(job.status)}>
              {job.status}
            </Badge>
            {isOverdue(job.scheduledDate, job.status) && (
              <Badge variant="destructive">
                <AlertTriangle className="mr-1 h-3 w-3" />
                Overdue
              </Badge>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2 mb-6">
          {canUpdate && job.status === 'Scheduled' && (
            <Button 
              onClick={() => handleStatusUpdate('InProgress')}
              disabled={updating}
            >
              <Play className="mr-2 h-4 w-4" />
              Start Job
            </Button>
          )}
          
          {canUpdate && job.status === 'InProgress' && (
            <Button 
              onClick={() => handleStatusUpdate('Completed')}
              disabled={updating}
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Mark Complete
            </Button>
          )}

          <Button 
            variant="outline"
            onClick={handleGenerateJobSheet}
            disabled={updating}
          >
            <FileText className="mr-2 h-4 w-4" />
            Generate Job Sheet
          </Button>

          {job.assignedToType === 'Vendor' && (
            <Button variant="outline">
              <Upload className="mr-2 h-4 w-4" />
              Upload Vendor Report
            </Button>
          )}

          <Button 
            variant="outline"
            onClick={() => setShowInvoiceDialog(true)}
            disabled={!job.project}
          >
            <DollarSign className="mr-2 h-4 w-4" />
            Create Invoice
          </Button>
        </div>

        {!job.project && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <p className="text-sm text-yellow-800">
              <AlertTriangle className="inline h-4 w-4 mr-1" />
              This job is not linked to a project. To create invoices, please link it to a project first.
            </p>
          </div>
        )}

        {/* Invoice Creation Dialog */}
        <AlertDialog open={showInvoiceDialog} onOpenChange={setShowInvoiceDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Create Service Invoice</AlertDialogTitle>
              <AlertDialogDescription>
                Create a new invoice for this service job. The invoice will be added to the Unsynced Invoices section in the Finance module for review before syncing to Xero.
              </AlertDialogDescription>
            </AlertDialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="invoiceType">Invoice Type</Label>
                <select
                  id="invoiceType"
                  className="w-full p-2 border rounded-md"
                  value={invoiceType}
                  onChange={(e) => setInvoiceType(e.target.value as 'Client' | 'Vendor')}
                >
                  <option value="Client">Client Invoice (Revenue)</option>
                  <option value="Vendor">Vendor Invoice (Expense)</option>
                </select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="invoiceAmount">Amount (Before Tax)</Label>
                <Input
                  id="invoiceAmount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={invoiceAmount}
                  onChange={(e) => setInvoiceAmount(e.target.value)}
                />
                <p className="text-xs text-gray-500">
                  GST (9%) will be calculated automatically
                </p>
              </div>
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleCreateInvoice}
                disabled={!invoiceAmount || updating}
              >
                {updating ? 'Creating...' : 'Create Invoice'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Main Content */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="jobsheet">Job Sheet ({job.jobSheets.length})</TabsTrigger>
            {job.assignedToType === 'Vendor' && (
              <TabsTrigger value="reports">Vendor Reports ({job.vendorReports.length})</TabsTrigger>
            )}
            <TabsTrigger value="invoices">Invoices ({job.invoices.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Job Information */}
              <div className="lg:col-span-2 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Calendar className="mr-2 h-5 w-5" />
                      Job Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Contract Number</label>
                        <p className="font-mono font-medium">{job.contract.contractNo}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Service Type</label>
                        <p className="font-medium">{job.contract.serviceType}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Frequency</label>
                        <p className="font-medium">{job.contract.frequency}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Status</label>
                        <Badge className={getStatusColor(job.status)}>
                          {job.status}
                        </Badge>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Scheduled Date</label>
                        <p className="font-medium">
                          {format(new Date(job.scheduledDate), 'MMMM dd, yyyy')}
                        </p>
                      </div>
                      {job.completedAt && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">Completed Date</label>
                          <p className="font-medium">
                            {format(new Date(job.completedAt), 'MMMM dd, yyyy HH:mm')}
                          </p>
                        </div>
                      )}
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
                    <div className="space-y-3">
                      <div>
                        <p className="font-medium text-lg">{job.client.name}</p>
                        <p className="text-sm text-gray-500">{job.client.clientNumber}</p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {job.client.email && (
                          <div className="flex items-center">
                            <Mail className="mr-2 h-4 w-4 text-gray-400" />
                            <span className="text-sm">{job.client.email}</span>
                          </div>
                        )}
                        {job.client.phone && (
                          <div className="flex items-center">
                            <Phone className="mr-2 h-4 w-4 text-gray-400" />
                            <span className="text-sm">{job.client.phone}</span>
                          </div>
                        )}
                        {job.client.contactPerson && (
                          <div className="flex items-center">
                            <User className="mr-2 h-4 w-4 text-gray-400" />
                            <span className="text-sm">{job.client.contactPerson}</span>
                          </div>
                        )}
                        {job.client.address && (
                          <div className="flex items-center">
                            <MapPin className="mr-2 h-4 w-4 text-gray-400" />
                            <span className="text-sm">{job.client.address}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Project Information */}
                {job.project && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Project Information</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div>
                          <p className="font-medium text-lg">{job.project.name}</p>
                          <p className="text-sm text-gray-500">{job.project.projectNumber}</p>
                        </div>
                        {job.project.description && (
                          <p className="text-sm text-gray-600">{job.project.description}</p>
                        )}
                        <Badge variant="outline">{job.project.status}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Right sidebar */}
              <div className="space-y-6">
                {/* Assignee Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <User className="mr-2 h-5 w-5" />
                      Assigned To
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {job.assignedUser ? (
                      <div className="space-y-2">
                        <div>
                          <p className="font-medium">
                            {job.assignedUser.firstName} {job.assignedUser.lastName}
                          </p>
                          <Badge variant="outline" className="text-[10px] px-1 py-0">Internal Staff</Badge>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center">
                            <Mail className="mr-2 h-4 w-4 text-gray-400" />
                            <span className="text-sm">{job.assignedUser.email}</span>
                          </div>
                          <div className="flex items-center">
                            <User className="mr-2 h-4 w-4 text-gray-400" />
                            <span className="text-sm">{job.assignedUser.role}</span>
                          </div>
                        </div>
                      </div>
                    ) : job.assignedVendor ? (
                      <div className="space-y-2">
                        <div>
                          <p className="font-medium">{job.assignedVendor.name}</p>
                          <Badge variant="outline" className="text-[10px] px-1 py-0">External Vendor</Badge>
                        </div>
                        <div className="space-y-1">
                          {job.assignedVendor.email && (
                            <div className="flex items-center">
                              <Mail className="mr-2 h-4 w-4 text-gray-400" />
                              <span className="text-sm">{job.assignedVendor.email}</span>
                            </div>
                          )}
                          {job.assignedVendor.phone && (
                            <div className="flex items-center">
                              <Phone className="mr-2 h-4 w-4 text-gray-400" />
                              <span className="text-sm">{job.assignedVendor.phone}</span>
                            </div>
                          )}
                          {job.assignedVendor.contactPerson && (
                            <div className="flex items-center">
                              <User className="mr-2 h-4 w-4 text-gray-400" />
                              <span className="text-sm">{job.assignedVendor.contactPerson}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="text-gray-500">Not assigned</p>
                    )}
                  </CardContent>
                </Card>

                {/* Completion Notes */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>Completion Notes</span>
                      {canUpdate && !editingNotes && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingNotes(true)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {editingNotes ? (
                      <div className="space-y-3">
                        <Textarea
                          value={notesValue}
                          onChange={(e) => setNotesValue(e.target.value)}
                          placeholder="Add completion notes..."
                          rows={4}
                        />
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            onClick={handleNotesUpdate}
                            disabled={updating}
                          >
                            <Save className="mr-2 h-4 w-4" />
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingNotes(false)
                              setNotesValue(job.completionNotes || "")
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        {job.completionNotes ? (
                          <p className="text-sm">{job.completionNotes}</p>
                        ) : (
                          <p className="text-sm text-gray-500">No completion notes yet</p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="jobsheet">
            <UnifiedJobSheetManager
              jobId={job.id}
              jobSheetNumber={`JS-${job.contract.contractNo}`}
              existingJobSheets={job.jobSheets}
              onUpdate={fetchJob}
            />
          </TabsContent>

          {job.assignedToType === 'Vendor' && (
            <TabsContent value="reports">
              <Card>
                <CardHeader>
                  <CardTitle>Vendor Reports</CardTitle>
                  <CardDescription>
                    Reports uploaded by the assigned vendor
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {job.vendorReports.length === 0 ? (
                    <div className="text-center py-8">
                      <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">No vendor reports uploaded yet</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {job.vendorReports.map((report) => (
                        <div key={report.id} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">Report from {report.vendor.name}</p>
                              <p className="text-sm text-gray-500">
                                Uploaded: {format(new Date(report.uploadedAt), 'MMM dd, yyyy HH:mm')}
                              </p>
                            </div>
                            <Link 
                              href={report.filePath || '#'} 
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Button size="sm" variant="outline">
                                <Upload className="mr-2 h-4 w-4" />
                                Download
                              </Button>
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          <TabsContent value="invoices">
            <Card>
              <CardHeader>
                <CardTitle>Invoices</CardTitle>
                <CardDescription>
                  Service invoices linked to this job (automatically synced to Finance module)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {job.invoices.length === 0 ? (
                  <div className="text-center py-8">
                    <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No invoices created yet</p>
                    <Button 
                      className="mt-2"
                      onClick={() => setShowInvoiceDialog(true)}
                      disabled={!job.project}
                    >
                      <DollarSign className="mr-2 h-4 w-4" />
                      Create Invoice
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {job.invoices.map((invoice) => (
                      <div key={invoice.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="font-medium">{invoice.invoiceNo}</p>
                            <div className="flex items-center space-x-2 mt-1">
                              <Badge variant="outline">{invoice.invoiceType}</Badge>
                              <Badge className={
                                invoice.status === 'Paid' ? 'bg-green-100 text-green-800' :
                                invoice.status === 'Approved' ? 'bg-blue-100 text-blue-800' :
                                invoice.status === 'Draft' ? 'bg-gray-100 text-gray-800' :
                                'bg-yellow-100 text-yellow-800'
                              }>
                                {invoice.status}
                              </Badge>
                            </div>
                          </div>
                          <div className="text-right flex items-center gap-4">
                            <div>
                              <p className="font-medium text-lg">${invoice.amount.toFixed(2)}</p>
                              <p className="text-sm text-gray-500">
                                {format(new Date(invoice.createdAt), 'MMM dd, yyyy')}
                              </p>
                            </div>
                            {invoice.filePath && (
                              <Link 
                                href={invoice.filePath} 
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <Button size="sm" variant="outline">
                                  <FileText className="mr-2 h-4 w-4" />
                                  View
                                </Button>
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                      <p className="text-sm text-blue-800">
                        💡 Service invoices are automatically added to the Unsynced Invoices section in the Finance module for review before syncing to Xero.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  )
}
