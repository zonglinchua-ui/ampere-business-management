
'use client'

import { useState, useEffect } from "react"
import { MainLayout } from "@/components/layout/main-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { 
  Briefcase, 
  Calendar,
  DollarSign,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  User,
  Building2,
  Mail,
  Phone,
  MapPin,
  FileText,
  Edit,
  ArrowLeft,
  Target,
  ClipboardList,
  History,
  Plus,
  ExternalLink,
  Trash2
} from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { format, isAfter, isBefore } from "date-fns"
import { useRouter, useParams } from "next/navigation"
import { toast } from "react-hot-toast"
import { useSession } from "next-auth/react"
import { formatCurrency } from "@/lib/utils"
import { TenderFileManager } from '@/components/TenderFileManager'

interface TenderDetails {
  id: string
  title: string
  tenderNumber: string
  description?: string
  clientId: string
  client: {
    id: string
    name: string
    email?: string
    phone?: string
    address?: string
    city?: string
    state?: string
    country?: string
    postalCode?: string
    contactPerson?: string
  }
  estimatedValue?: number
  submissionDeadline: string
  openDate: string
  closeDate?: string
  status: string
  priority: string
  category: string
  contactPerson?: string
  contactEmail?: string
  contactPhone?: string
  location?: string
  requirements?: string
  nasDocumentPath?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  createdBy?: {
    id: string
    firstName: string
    lastName: string
    email: string
  }
  assignedTo?: {
    id: string
    firstName: string
    lastName: string
    email: string
  }
  salesperson?: {
    id: string
    firstName: string
    lastName: string
    email: string
  }
  activities: TenderActivity[]
  quotations: TenderQuotation[]
  documents: TenderDocument[]
}

interface TenderActivity {
  id: string
  action: string
  description?: string
  oldValue?: string
  newValue?: string
  userId: string
  userEmail: string
  createdAt: string
}

interface TenderQuotation {
  id: string
  quotationNumber: string
  title: string
  totalAmount?: number
  status: string
  validUntil?: string
  createdAt: string
}

interface TenderDocument {
  id: string
  filename: string
  originalName: string
  category: string
  cloudStoragePath: string
  description?: string
  createdAt: string
}

export default function TenderDetailsPage() {
  const router = useRouter()
  const params = useParams()
  const { data: session, status } = useSession()
  const tenderId = params?.id as string

  const [loading, setLoading] = useState(true)
  const [tender, setTender] = useState<TenderDetails | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Check if current user is super admin
  const isSuperAdmin = session?.user?.role === 'SUPERADMIN'

  useEffect(() => {
    const fetchTender = async () => {
      if (!tenderId) {
        console.error('[Tender Details] No tender ID provided')
        setError('Invalid tender ID')
        setLoading(false)
        return
      }

      try {
        console.log(`[Tender Details] Fetching tender: ${tenderId}`)
        const response = await fetch(`/api/tenders/${tenderId}`)
        
        if (response.status === 404) {
          console.warn(`[Tender Details] Tender not found: ${tenderId}`)
          setError('Tender not found')
          setLoading(false)
          return
        }

        if (!response.ok) {
          throw new Error(`Failed to fetch tender: ${response.statusText}`)
        }

        const data = await response.json()
        console.log(`[Tender Details] Successfully loaded tender: ${data.tenderNumber}`)
        setTender(data)
        setError(null)
      } catch (err) {
        console.error('[Tender Details] Error fetching tender:', err)
        setError('Failed to load tender details')
        toast.error('Failed to load tender details')
      } finally {
        setLoading(false)
      }
    }

    fetchTender()
  }, [tenderId])

  const getStatusColor = (status: string) => {
    switch (status) {
      case "OPEN":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
      case "SUBMITTED":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
      case "WON":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
      case "LOST":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
      case "EXPIRED":
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "URGENT":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
      case "HIGH":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
      case "MEDIUM":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
      case "LOW":
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "OPEN":
        return <Briefcase className="w-4 h-4" />
      case "SUBMITTED":
        return <Clock className="w-4 h-4" />
      case "WON":
        return <CheckCircle className="w-4 h-4" />
      case "LOST":
        return <XCircle className="w-4 h-4" />
      case "EXPIRED":
        return <AlertTriangle className="w-4 h-4" />
      default:
        return <Clock className="w-4 h-4" />
    }
  }

  const isDeadlineNear = (deadline: string) => {
    const deadlineDate = new Date(deadline)
    const threeDaysFromNow = new Date()
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3)
    return isBefore(deadlineDate, threeDaysFromNow) && isAfter(deadlineDate, new Date())
  }

  const isOverdue = (deadline: string, status: string) => {
    const deadlineDate = new Date(deadline)
    return isBefore(deadlineDate, new Date()) && (status === "OPEN" || status === "SUBMITTED")
  }

  const handleDeleteTender = async () => {
    if (!tender || !isSuperAdmin) {
      toast.error('You are not authorized to delete tenders')
      return
    }

    setDeleting(true)
    
    try {
      console.log(`[Tender Delete] Super Admin ${session?.user?.email} deleting tender: ${tender.id}`)
      
      const response = await fetch(`/api/tenders/${tender.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (response.status === 403) {
        toast.error('You are not authorized to delete tenders')
        console.warn(`[Tender Delete] User ${session?.user?.email} not authorized to delete tender`)
        return
      }

      if (response.status === 404) {
        toast.error('Tender not found')
        console.warn(`[Tender Delete] Tender not found: ${tender.id}`)
        return
      }

      if (!response.ok) {
        throw new Error('Failed to delete tender')
      }

      const data = await response.json()
      console.log(`[Tender Delete] Successfully deleted tender: ${tender.tenderNumber}`)
      
      toast.success(`Tender ${tender.tenderNumber} deleted successfully`)
      
      // Redirect to tenders list after successful deletion
      router.push('/tenders')
    } catch (error) {
      console.error('[Tender Delete] Error deleting tender:', error)
      toast.error('Failed to delete tender')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-64 bg-gray-200 rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </MainLayout>
    )
  }

  if (error || !tender) {
    return (
      <MainLayout>
        <div className="p-6">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <AlertTriangle className="h-16 w-16 text-red-500 mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                {error || 'Tender Not Found'}
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                The tender you're looking for doesn't exist or has been removed.
              </p>
              <Button onClick={() => router.push('/tenders')}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Tenders
              </Button>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => router.push('/tenders')}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Tenders
          </Button>
          
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-4">
              <div className="w-16 h-16 bg-red-100 rounded-lg flex items-center justify-center">
                <Briefcase className="h-8 w-8 text-red-600" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  {tender.title}
                </h1>
                <p className="text-gray-600 dark:text-gray-300 mt-2">
                  {tender.tenderNumber}
                </p>
                <div className="flex items-center space-x-2 mt-3">
                  <Badge variant="outline" className={getStatusColor(tender.status)}>
                    {getStatusIcon(tender.status)}
                    <span className="ml-1">{tender.status}</span>
                  </Badge>
                  <Badge variant="outline" className={getPriorityColor(tender.priority)}>
                    {tender.priority}
                  </Badge>
                  <Badge variant="outline">
                    {tender.category.replace('_', ' ')}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="flex space-x-2">
              <Button 
                className="bg-red-600 hover:bg-red-700"
                onClick={() => {
                  console.log(`[Tender Details] Navigating to edit page for tender: ${tenderId}`)
                  router.push(`/tenders/${tenderId}/edit`)
                }}
              >
                <Edit className="mr-2 h-4 w-4" />
                Edit Tender
              </Button>
              
              {/* Delete Button - Only visible to Super Admin */}
              {isSuperAdmin && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="destructive"
                      disabled={deleting}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Tender</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete tender "{tender.title}" ({tender.tenderNumber})? 
                        This action cannot be undone and will permanently remove the tender and all associated data including quotations, documents, and activity history.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDeleteTender}
                        disabled={deleting}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        {deleting ? 'Deleting...' : 'Delete Tender'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        </div>

        {/* Deadline Alert */}
        {(isOverdue(tender.submissionDeadline, tender.status) || isDeadlineNear(tender.submissionDeadline)) && (
          <Card className={`mb-6 border-2 ${
            isOverdue(tender.submissionDeadline, tender.status) 
              ? 'border-red-500 bg-red-50 dark:bg-red-900/20' 
              : 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
          }`}>
            <CardContent className="flex items-center space-x-3 py-4">
              <AlertTriangle className={`h-5 w-5 ${
                isOverdue(tender.submissionDeadline, tender.status) ? 'text-red-600' : 'text-orange-600'
              }`} />
              <div>
                <p className={`font-semibold ${
                  isOverdue(tender.submissionDeadline, tender.status) ? 'text-red-900 dark:text-red-100' : 'text-orange-900 dark:text-orange-100'
                }`}>
                  {isOverdue(tender.submissionDeadline, tender.status) 
                    ? 'Submission Deadline Overdue!' 
                    : 'Submission Deadline Approaching!'}
                </p>
                <p className={`text-sm ${
                  isOverdue(tender.submissionDeadline, tender.status) ? 'text-red-700 dark:text-red-200' : 'text-orange-700 dark:text-orange-200'
                }`}>
                  Deadline: {format(new Date(tender.submissionDeadline), "MMMM dd, yyyy 'at' HH:mm")}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Key Information */}
          <Card>
            <CardHeader>
              <CardTitle>Key Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Estimated Value</p>
                <div className="flex items-center space-x-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <p className="text-lg font-semibold">
                    {tender.estimatedValue 
                      ? formatCurrency(tender.estimatedValue) 
                      : 'Not specified'}
                  </p>
                </div>
              </div>
              
              <Separator />
              
              <div>
                <p className="text-sm text-muted-foreground mb-1">Submission Deadline</p>
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium">
                    {format(new Date(tender.submissionDeadline), "MMMM dd, yyyy 'at' HH:mm")}
                  </p>
                </div>
              </div>
              
              <Separator />
              
              <div>
                <p className="text-sm text-muted-foreground mb-1">Open Date</p>
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium">
                    {format(new Date(tender.openDate), "MMMM dd, yyyy")}
                  </p>
                </div>
              </div>

              {tender.closeDate && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Close Date</p>
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm font-medium">
                        {format(new Date(tender.closeDate), "MMMM dd, yyyy")}
                      </p>
                    </div>
                  </div>
                </>
              )}

              {tender.location && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Location</p>
                    <div className="flex items-center space-x-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm font-medium">{tender.location}</p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Client Information */}
          <Card>
            <CardHeader>
              <CardTitle>Client Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Client Name</p>
                <div className="flex items-center space-x-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <p className="font-semibold">{tender.client.name}</p>
                </div>
              </div>

              {tender.client.email && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Email</p>
                    <div className="flex items-center space-x-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <a 
                        href={`mailto:${tender.client.email}`}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        {tender.client.email}
                      </a>
                    </div>
                  </div>
                </>
              )}

              {tender.client.phone && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Phone</p>
                    <div className="flex items-center space-x-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <a 
                        href={`tel:${tender.client.phone}`}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        {tender.client.phone}
                      </a>
                    </div>
                  </div>
                </>
              )}

              {tender.client.address && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Address</p>
                    <div className="flex items-start space-x-2">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <p className="text-sm">
                        {tender.client.address}
                        {tender.client.city && `, ${tender.client.city}`}
                        {tender.client.state && ` ${tender.client.state}`}
                        {tender.client.postalCode && ` ${tender.client.postalCode}`}
                        {tender.client.country && `, ${tender.client.country}`}
                      </p>
                    </div>
                  </div>
                </>
              )}

              {tender.client.contactPerson && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Contact Person</p>
                    <div className="flex items-center space-x-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm font-medium">{tender.client.contactPerson}</p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Team Information */}
          <Card>
            <CardHeader>
              <CardTitle>Team</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {tender.assignedTo && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Assigned To</p>
                  <div className="flex items-center space-x-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <p className="font-semibold">
                      {tender.assignedTo.firstName} {tender.assignedTo.lastName}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 ml-6">
                    {tender.assignedTo.email}
                  </p>
                </div>
              )}

              {tender.salesperson && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Salesperson</p>
                    <div className="flex items-center space-x-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <p className="font-semibold">
                        {tender.salesperson.firstName} {tender.salesperson.lastName}
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 ml-6">
                      {tender.salesperson.email}
                    </p>
                  </div>
                </>
              )}

              {tender.createdBy && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Created By</p>
                    <div className="flex items-center space-x-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <p className="font-medium">
                        {tender.createdBy.firstName} {tender.createdBy.lastName}
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 ml-6">
                      {format(new Date(tender.createdAt), "MMM dd, yyyy")}
                    </p>
                  </div>
                </>
              )}

              {tender.contactPerson && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Tender Contact</p>
                    <div className="flex items-center space-x-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <p className="font-medium">{tender.contactPerson}</p>
                    </div>
                    {tender.contactEmail && (
                      <p className="text-sm text-blue-600 hover:underline mt-1 ml-6">
                        <a href={`mailto:${tender.contactEmail}`}>{tender.contactEmail}</a>
                      </p>
                    )}
                    {tender.contactPhone && (
                      <p className="text-sm text-muted-foreground mt-1 ml-6">
                        {tender.contactPhone}
                      </p>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Tabs for Details */}
        <Tabs defaultValue="details" className="space-y-6">
          <TabsList>
            <TabsTrigger value="details">
              <ClipboardList className="mr-2 h-4 w-4" />
              Details
            </TabsTrigger>
            <TabsTrigger value="quotations">
              <FileText className="mr-2 h-4 w-4" />
              Quotations ({tender.quotations.length})
            </TabsTrigger>
            <TabsTrigger value="documents">
              <FileText className="mr-2 h-4 w-4" />
              Documents ({tender.documents.length})
            </TabsTrigger>
            <TabsTrigger value="activity">
              <History className="mr-2 h-4 w-4" />
              Activity ({tender.activities.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details">
            <Card>
              <CardHeader>
                <CardTitle>Description</CardTitle>
              </CardHeader>
              <CardContent>
                {tender.description ? (
                  <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {tender.description}
                  </p>
                ) : (
                  <p className="text-muted-foreground">No description provided.</p>
                )}
              </CardContent>
            </Card>

            {tender.requirements && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>Requirements</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {tender.requirements}
                  </p>
                </CardContent>
              </Card>
            )}

            {tender.nasDocumentPath && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>NAS Document Path</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground font-mono">
                      {tender.nasDocumentPath}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        try {
                          if (tender.nasDocumentPath!.startsWith('\\\\')) {
                            window.open(`file:///${tender.nasDocumentPath!.replace(/\\/g, '/')}`, '_blank')
                          } else if (tender.nasDocumentPath!.startsWith('smb://')) {
                            window.open(tender.nasDocumentPath!, '_blank')
                          } else {
                            window.open(`file:///${tender.nasDocumentPath!}`, '_blank')
                          }
                        } catch (error) {
                          navigator.clipboard.writeText(tender.nasDocumentPath!)
                          toast.success('Path copied to clipboard')
                        }
                      }}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="quotations">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Quotations</CardTitle>
                  <Button size="sm" className="bg-red-600 hover:bg-red-700">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Quotation
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {tender.quotations.length > 0 ? (
                  <div className="space-y-4">
                    {tender.quotations.map((quotation) => (
                      <div 
                        key={quotation.id}
                        className="border rounded-lg p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => router.push(`/quotations/${quotation.id}`)}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-semibold">{quotation.title}</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              {quotation.quotationNumber}
                            </p>
                          </div>
                          <Badge variant="outline" className={getStatusColor(quotation.status)}>
                            {quotation.status}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between mt-3">
                          <div className="flex items-center space-x-4">
                            {quotation.totalAmount && (
                              <div className="flex items-center space-x-1 text-sm">
                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">{formatCurrency(quotation.totalAmount)}</span>
                              </div>
                            )}
                            {quotation.validUntil && (
                              <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                                <Calendar className="h-4 w-4" />
                                <span>Valid until {format(new Date(quotation.validUntil), "MMM dd, yyyy")}</span>
                              </div>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(quotation.createdAt), "MMM dd, yyyy")}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-muted-foreground">No quotations created yet.</p>
                    <Button size="sm" className="mt-4 bg-red-600 hover:bg-red-700">
                      <Plus className="mr-2 h-4 w-4" />
                      Create First Quotation
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents">
            <TenderFileManager
              tenderId={tender.id}
              tenderNumber={tender.tenderNumber}
              tenderTitle={tender.title}
              customerName={tender.client.name}
            />
          </TabsContent>

          <TabsContent value="activity">
            <Card>
              <CardHeader>
                <CardTitle>Activity Timeline</CardTitle>
                <CardDescription>Recent changes and updates</CardDescription>
              </CardHeader>
              <CardContent>
                {tender.activities.length > 0 ? (
                  <div className="space-y-4">
                    {tender.activities.map((activity, index) => (
                      <div key={activity.id} className="flex space-x-3">
                        <div className="flex flex-col items-center">
                          <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                            <History className="h-4 w-4 text-red-600" />
                          </div>
                          {index < tender.activities.length - 1 && (
                            <div className="w-px h-full bg-gray-200 dark:bg-gray-700 mt-2" />
                          )}
                        </div>
                        <div className="flex-1 pb-4">
                          <div className="flex items-center justify-between">
                            <p className="font-medium">{activity.action}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(activity.createdAt), "MMM dd, yyyy HH:mm")}
                            </p>
                          </div>
                          {activity.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {activity.description}
                            </p>
                          )}
                          {(activity.oldValue || activity.newValue) && (
                            <div className="text-xs text-muted-foreground mt-2">
                              {activity.oldValue && (
                                <span>From: <span className="font-mono">{activity.oldValue}</span></span>
                              )}
                              {activity.oldValue && activity.newValue && <span> â†’ </span>}
                              {activity.newValue && (
                                <span>To: <span className="font-mono">{activity.newValue}</span></span>
                              )}
                            </div>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            by {activity.userEmail}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <History className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-muted-foreground">No activity recorded yet.</p>
                  </div>
                )}
              </CardContent>

		{/* Tender File Manager - NAS Document Storage */}
      		<TenderFileManager
        	tenderId={tender.id}
        	tenderNumber={tender.tenderNumber}
        	tenderTitle={tender.title}
        	customerName={tender.client.name}
        	nasPath={tender.nasDocumentPath}
	      />
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  )
}
