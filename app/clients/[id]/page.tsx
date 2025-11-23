
'use client'

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { MainLayout } from "@/components/layout/main-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  MapPin,
  Globe,
  FileText,
  FolderOpen,
  DollarSign,
  Calendar,
  Users,
  CheckCircle,
  Clock,
  AlertCircle,
  Edit,
  Activity,
  CreditCard,
  Trash2
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat"
import { format } from "date-fns"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"

interface Client {
  id: string
  name: string
  email?: string | null
  phone?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  country: string
  postalCode?: string | null
  contactPerson?: string | null
  companyReg?: string | null
  website?: string | null
  notes?: string | null
  clientType?: string
  isActive: boolean
  createdAt: string
  // Xero fields
  isXeroSynced?: boolean
  xeroContactId?: string | null
}

interface ActivityItem {
  id: string
  type: 'project' | 'invoice' | 'quotation' | 'general'
  action: string
  description: string
  date: string
  entityId?: string
  entityName?: string
}

interface Project {
  id: string
  name: string
  status: string
  progress: number
  estimatedBudget: number
  actualCost: number
  startDate: string
  endDate?: string
}

interface Invoice {
  id: string
  invoiceNumber: string
  title: string
  amount: number
  totalAmount: number
  status: string
  issueDate: string
  dueDate: string
  paidDate?: string
}

const customerSchema = z.object({
  name: z.string().min(1, "Customer name is required"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().default("Singapore"),
  postalCode: z.string().optional(),
  contactPerson: z.string().optional(),
  companyReg: z.string().optional(),
  website: z.string().optional(),
  notes: z.string().optional(),
  customerType: z.enum(["ENTERPRISE", "SME", "GOVERNMENT", "INDIVIDUAL"]).default("ENTERPRISE"),
  // Bank Information
  bankName: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  bankAccountName: z.string().optional(),
  bankSwiftCode: z.string().optional(),
  bankAddress: z.string().optional(),
})

type CustomerFormData = z.infer<typeof customerSchema>

export default function ClientDetailPage() {
  const params = useParams()
  const router = useRouter()
  const clientId = params.id as string
  const { formatCurrency } = useCurrencyFormat()
  const { data: session } = useSession() || {}
  
  const [loading, setLoading] = useState(true)
  const [client, setClient] = useState<Client | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [activitiesLoading, setActivitiesLoading] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const form = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      state: "",
      country: "Singapore",
      postalCode: "",
      contactPerson: "",
      companyReg: "",
      website: "",
      notes: "",
      customerType: "ENTERPRISE",
      bankName: "",
      bankAccountNumber: "",
      bankAccountName: "",
      bankSwiftCode: "",
      bankAddress: "",
    }
  })

  const fetchActivities = async () => {
    try {
      setActivitiesLoading(true)
      const response = await fetch(`/api/customers/${clientId}/activities`)
      if (response.ok) {
        const data = await response.json()
        setActivities(data.activities || [])
      } else {
        console.error('Failed to fetch activities:', response.statusText)
      }
    } catch (error) {
      console.error('Error fetching activities:', error)
    } finally {
      setActivitiesLoading(false)
    }
  }

  const handleOpenEdit = () => {
    if (client) {
      form.reset({
        name: client.name,
        email: client.email || "",
        phone: client.phone || "",
        address: client.address || "",
        city: client.city || "",
        state: client.state || "",
        country: client.country || "Singapore",
        postalCode: client.postalCode || "",
        contactPerson: client.contactPerson || "",
        companyReg: client.companyReg || "",
        website: client.website || "",
        notes: client.notes || "",
        customerType: (client.clientType as any) || "ENTERPRISE",
        bankName: "",
        bankAccountNumber: "",
        bankAccountName: "",
        bankSwiftCode: "",
        bankAddress: "",
      })
      setIsEditDialogOpen(true)
    }
  }

  const handleSubmitEdit = async (data: CustomerFormData) => {
    try {
      const response = await fetch(`/api/customers/${clientId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error("Update error response:", errorData)
        
        // Show detailed validation errors if available
        const errorMessage = errorData.message || errorData.error || "Failed to update customer"
        throw new Error(errorMessage)
      }

      const updatedClient = await response.json()
      setClient(updatedClient)
      toast.success("✅ Customer updated successfully")
      setIsEditDialogOpen(false)
      
      // Refresh the page data
      window.location.reload()
    } catch (error) {
      console.error("Error updating customer:", error)
      const errorMsg = error instanceof Error ? error.message : "Update failed"
      toast.error(`❌ ${errorMsg}`)
    }
  }

  const handleDeleteCustomer = async () => {
    try {
      setDeleteLoading(true)
      
      const response = await fetch(`/api/customers/${clientId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hard: false, // Soft delete by default
          reason: "Deleted by Super Admin"
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to delete customer")
      }

      toast.success("✅ Customer deleted successfully")
      setIsDeleteDialogOpen(false)
      
      // Redirect to customers list
      router.push('/contacts')
    } catch (error) {
      console.error("Error deleting customer:", error)
      const errorMsg = error instanceof Error ? error.message : "Delete failed"
      toast.error(`❌ ${errorMsg}`)
    } finally {
      setDeleteLoading(false)
    }
  }

  const getActivityIcon = (activity: ActivityItem) => {
    switch (activity.action) {
      case 'PROJECT_CREATED':
      case 'PROJECT_UPDATED':
        return <FolderOpen className="w-4 h-4 text-blue-600" />
      case 'INVOICE_CREATED':
        return <FileText className="w-4 h-4 text-gray-600" />
      case 'INVOICE_PAID':
        return <CheckCircle className="w-4 h-4 text-green-600" />
      case 'INVOICE_OVERDUE':
        return <AlertCircle className="w-4 h-4 text-red-600" />
      case 'APPROVED':
      case 'REJECTED':
        return <CheckCircle className="w-4 h-4 text-blue-600" />
      default:
        return <Activity className="w-4 h-4 text-gray-600" />
    }
  }

  const getActivityBgColor = (activity: ActivityItem) => {
    switch (activity.action) {
      case 'PROJECT_CREATED':
      case 'PROJECT_UPDATED':
        return 'bg-blue-100'
      case 'INVOICE_CREATED':
        return 'bg-gray-100'
      case 'INVOICE_PAID':
        return 'bg-green-100'
      case 'INVOICE_OVERDUE':
        return 'bg-red-100'
      case 'APPROVED':
      case 'REJECTED':
        return 'bg-blue-100'
      default:
        return 'bg-gray-100'
    }
  }

  useEffect(() => {
    const fetchClientData = async () => {
      try {
        setLoading(true)
        
        // Fetch customer details
        const clientResponse = await fetch(`/api/customers/${clientId}`)
        if (!clientResponse.ok) {
          if (clientResponse.status === 404) {
            throw new Error('Customer not found. This record may have been removed or does not exist.')
          }
          console.error(`Failed to fetch customer: ${clientResponse.status} ${clientResponse.statusText}`)
          throw new Error('Failed to fetch customer details')
        }
        const clientData = await clientResponse.json()
        
        // Validate customer data structure
        if (!clientData || typeof clientData !== 'object' || !clientData.id) {
          console.error('Invalid customer data received:', clientData)
          throw new Error('Invalid customer data received')
        }
        
        setClient(clientData)

        // Fetch client projects (optional - don't fail if it errors)
        try {
          const projectsResponse = await fetch(`/api/projects?customerId=${clientId}`)
          if (projectsResponse.ok) {
            const projectsData = await projectsResponse.json()
            setProjects(projectsData.projects || [])
          } else {
            console.warn(`Projects fetch failed: ${projectsResponse.status} ${projectsResponse.statusText}`)
            setProjects([])
          }
        } catch (projectError) {
          console.warn('Error fetching projects:', projectError)
          setProjects([])
        }

        // Fetch client invoices (optional - don't fail if it errors)
        try {
          const invoicesResponse = await fetch(`/api/invoices?customerId=${clientId}`)
          if (invoicesResponse.ok) {
            const invoicesData = await invoicesResponse.json()
            setInvoices(invoicesData.invoices || [])
          } else {
            console.warn(`Invoices fetch failed: ${invoicesResponse.status} ${invoicesResponse.statusText}`)
            setInvoices([])
          }
        } catch (invoiceError) {
          console.warn('Error fetching invoices:', invoiceError)
          setInvoices([])
        }

        // Fetch recent payments (optional - don't fail if it errors)
        try {
          const paymentsResponse = await fetch(`/api/payments?customerId=${clientId}&limit=5`)
          if (paymentsResponse.ok) {
            const paymentsData = await paymentsResponse.json()
            setPayments(paymentsData.payments || [])
          } else {
            console.warn(`Payments fetch failed: ${paymentsResponse.status} ${paymentsResponse.statusText}`)
            setPayments([])
          }
        } catch (paymentError) {
          console.warn('Error fetching payments:', paymentError)
          setPayments([])
        }

        setLoading(false)
      } catch (error) {
        console.error('Error fetching customer data:', error)
        const errorMessage = error instanceof Error ? error.message : 'Failed to load customer data'
        setError(errorMessage)
        setClient(null)
        setProjects([])
        setInvoices([])
        setLoading(false)
        
        // Log error to system logs
        try {
          await fetch('/api/logs/error', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'VIEW_CUSTOMER_DETAILS',
              message: errorMessage,
              module: 'Customers',
              endpoint: `/clients/${clientId}`,
              errorCode: error instanceof Error && error.message.includes('not found') ? '404' : '500',
              metadata: { clientId }
            })
          })
        } catch (logError) {
          console.error('Failed to log error:', logError)
        }
      }
    }

    if (clientId && typeof clientId === 'string') {
      fetchClientData()
    } else {
      console.error('Invalid customerId:', clientId)
      setError('Invalid customer ID')
      setLoading(false)
    }
  }, [clientId])

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PAID":
      case "COMPLETED":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
      case "IN_PROGRESS":
      case "SENT":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
      case "OVERDUE":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
      case "DRAFT":
      case "PLANNING":
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "PAID":
      case "COMPLETED":
        return CheckCircle
      case "IN_PROGRESS":
      case "SENT":
        return Clock
      case "OVERDUE":
        return AlertCircle
      default:
        return Clock
    }
  }

  const getClientTypeDisplay = (type?: string) => {
    if (!type) return "Customer"
    switch (type) {
      case "ENTERPRISE":
        return "Enterprise"
      case "SME":
        return "SME"
      case "GOVERNMENT":
        return "Government"
      case "INDIVIDUAL":
        return "Individual"
      default:
        return type
    }
  }

  const totalProjectValue = projects?.reduce((sum, project) => sum + (project?.estimatedBudget || 0), 0) || 0
  const totalPaidAmount = invoices?.filter(inv => inv?.status === "PAID")?.reduce((sum, inv) => sum + (inv?.totalAmount || 0), 0) || 0
  const pendingAmount = invoices?.filter(inv => inv?.status && inv.status !== "PAID" && inv.status !== "CANCELLED")?.reduce((sum, inv) => sum + (inv?.totalAmount || 0), 0) || 0

  if (loading) {
    return (
      <MainLayout>
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </MainLayout>
    )
  }

  if (error || !client) {
    return (
      <MainLayout>
        <div className="p-6">
          <div className="text-center py-12">
            <Building2 className="mx-auto h-16 w-16 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-red-600 mb-2">
              {error ? 'Error Loading Customer' : 'Customer Not Found'}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {error || 'This customer no longer exists or was removed from the system.'}
            </p>
            <Button onClick={() => router.push('/contacts')} className="mt-4">
              Back to Customers
            </Button>
          </div>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="p-6">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => router.push('/contacts')}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Customers
              </Button>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{client.name}</h1>
                  {client.isXeroSynced && (
                    <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Xero Synced
                    </Badge>
                  )}
                </div>
                <p className="text-gray-600 dark:text-gray-300 mt-1">
                  {getClientTypeDisplay(client.clientType)} • Member since {new Date(client.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                className="bg-red-600 hover:bg-red-700"
                onClick={handleOpenEdit}
              >
                <Edit className="mr-2 h-4 w-4" />
                Edit Customer
              </Button>
              {session?.user?.role === 'SUPERADMIN' && (
                <Button 
                  variant="destructive"
                  onClick={() => setIsDeleteDialogOpen(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Project Value</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalProjectValue)}</div>
              <p className="text-xs text-muted-foreground">Across all projects for this customer</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Amount Received</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(totalPaidAmount)}</div>
              <p className="text-xs text-muted-foreground">Paid invoices</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Outstanding Receivables</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{formatCurrency(pendingAmount)}</div>
              <p className="text-xs text-muted-foreground">Awaiting payment</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{projects.filter(p => p.status === "IN_PROGRESS").length}</div>
              <p className="text-xs text-muted-foreground">Currently active</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabbed Content */}
        <Tabs defaultValue="overview" className="space-y-6" onValueChange={(value) => {
          if (value === 'activity' && activities.length === 0 && !activitiesLoading) {
            fetchActivities()
          }
        }}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="projects">Projects</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Customer Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Building2 className="mr-2 h-5 w-5" />
                    Customer Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <Mail className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Email</p>
                      <p className="font-medium">{client.email || 'Not provided'}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Phone</p>
                      <p className="font-medium">{client.phone || 'Not provided'}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <MapPin className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Address</p>
                      <p className="font-medium">{client.address || 'Not provided'}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Users className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Contact Person</p>
                      <p className="font-medium">{client.contactPerson || 'Not provided'}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <FileText className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Company Registration</p>
                      <p className="font-medium">{client.companyReg}</p>
                    </div>
                  </div>
                  {client.website && (
                    <div className="flex items-center space-x-3">
                      <Globe className="h-4 w-4 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Website</p>
                        <a 
                          href={client.website} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="font-medium text-blue-600 hover:text-blue-500"
                        >
                          {client.website}
                        </a>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Company Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <FileText className="mr-2 h-5 w-5" />
                    Company Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <FileText className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Company Registration</p>
                      <p className="font-medium">{client.companyReg || 'Not provided'}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Added On</p>
                      <p className="font-medium">{format(new Date(client.createdAt), 'PPP')}</p>
                    </div>
                  </div>
                  {client.xeroContactId && (
                    <div className="flex items-center space-x-3">
                      <CheckCircle className="h-4 w-4 text-purple-600" />
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Xero Contact ID</p>
                        <p className="font-medium text-purple-600">{client.xeroContactId}</p>
                      </div>
                    </div>
                  )}
                  {client.notes && (
                    <div className="space-y-2">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Notes</p>
                      <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
                        <p className="text-sm whitespace-pre-wrap">{client.notes}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Recent Payments Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Recent Payments
                </CardTitle>
                <CardDescription>
                  Last 5 payments received from this customer
                </CardDescription>
              </CardHeader>
              <CardContent>
                {payments && payments.length > 0 ? (
                  <div className="space-y-3">
                    {payments.map((payment: any) => (
                      <div key={payment.id} className="flex items-center justify-between py-3 border-b last:border-0">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">
                              {new Date(payment.paymentDate).toLocaleDateString('en-SG', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric'
                              })}
                            </p>
                            {payment.status === 'COMPLETED' && (
                              <Badge className="bg-green-100 text-green-700" variant="outline">
                                Completed
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {payment.reference || payment.paymentNumber}
                            {payment.CustomerInvoice?.invoiceNumber && 
                              ` • Invoice ${payment.CustomerInvoice.invoiceNumber}`
                            }
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-green-600">
                            ${payment.amount.toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            })}
                          </p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {payment.paymentMethod.replace(/_/g, ' ').toLowerCase()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <CreditCard className="h-12 w-12 mx-auto text-muted-foreground opacity-50 mb-2" />
                    <p className="text-sm text-muted-foreground">No payments yet for this customer</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="projects" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Customer Projects</CardTitle>
                <CardDescription>All projects associated with this customer</CardDescription>
              </CardHeader>
              <CardContent>
                {projects && projects.length > 0 ? (
                  <div className="space-y-4">
                    {projects.map((project) => {
                      const StatusIcon = getStatusIcon(project.status)
                      return (
                        <div key={project.id} className="p-4 border rounded-lg">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-medium">{project.name}</h4>
                            <Badge variant="outline" className={getStatusColor(project.status)}>
                              <StatusIcon className="w-3 h-3 mr-1" />
                              {project.status.replace('_', ' ')}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <p className="text-gray-600 dark:text-gray-400">Budget</p>
                              <p className="font-medium">{formatCurrency(project.estimatedBudget || 0)}</p>
                            </div>
                            <div>
                              <p className="text-gray-600 dark:text-gray-400">Actual Cost</p>
                              <p className="font-medium">{formatCurrency(project.actualCost || 0)}</p>
                            </div>
                            <div>
                              <p className="text-gray-600 dark:text-gray-400">Start Date</p>
                              <p className="font-medium">{project.startDate ? new Date(project.startDate).toLocaleDateString() : 'Not set'}</p>
                            </div>
                            <div>
                              <p className="text-gray-600 dark:text-gray-400">End Date</p>
                              <p className="font-medium">{project.endDate ? new Date(project.endDate).toLocaleDateString() : "TBD"}</p>
                            </div>
                          </div>
                          {project.status === "IN_PROGRESS" && (
                            <div className="mt-3">
                              <div className="flex justify-between text-sm mb-1">
                                <span>Progress</span>
                                <span>{project.progress || 0}%</span>
                              </div>
                              <Progress value={project.progress || 0} className="h-2" />
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <FolderOpen className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">No Projects Yet</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      This customer doesn't have any projects yet. Projects will appear here once they are created.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invoices" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Customer Invoices</CardTitle>
                <CardDescription>All invoices for this customer</CardDescription>
              </CardHeader>
              <CardContent>
                {invoices && invoices.length > 0 ? (
                  <div className="space-y-4">
                    {invoices.map((invoice) => {
                      const StatusIcon = getStatusIcon(invoice.status)
                      return (
                        <div key={invoice.id} className="p-4 border rounded-lg">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <h4 className="font-medium">{invoice.invoiceNumber}</h4>
                              <p className="text-sm text-gray-600 dark:text-gray-400">{invoice.title}</p>
                            </div>
                            <Badge variant="outline" className={getStatusColor(invoice.status)}>
                              <StatusIcon className="w-3 h-3 mr-1" />
                              {invoice.status}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <p className="text-gray-600 dark:text-gray-400">Amount</p>
                              <p className="font-medium">{formatCurrency(invoice.totalAmount || 0)}</p>
                            </div>
                            <div>
                              <p className="text-gray-600 dark:text-gray-400">Issue Date</p>
                              <p className="font-medium">{invoice.issueDate ? new Date(invoice.issueDate).toLocaleDateString() : 'Not set'}</p>
                            </div>
                            <div>
                              <p className="text-gray-600 dark:text-gray-400">Due Date</p>
                              <p className="font-medium">{invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : 'Not set'}</p>
                            </div>
                            <div>
                              <p className="text-gray-600 dark:text-gray-400">Paid Date</p>
                              <p className="font-medium">{invoice.paidDate ? new Date(invoice.paidDate).toLocaleDateString() : "-"}</p>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">No Invoices Yet</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      This customer doesn't have any invoices yet. Invoices will appear here once they are created.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Activity Timeline
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={fetchActivities}
                    disabled={activitiesLoading}
                  >
                    {activitiesLoading ? 'Loading...' : 'Refresh'}
                  </Button>
                </CardTitle>
                <CardDescription>Complete activity history for this customer</CardDescription>
              </CardHeader>
              <CardContent>
                {activitiesLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Loading activities...</p>
                  </div>
                ) : activities.length > 0 ? (
                  <div className="space-y-6">
                    {activities.map((activity) => (
                      <div key={activity.id} className="flex items-start space-x-4">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${getActivityBgColor(activity)}`}>
                          {getActivityIcon(activity)}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{activity.description}</p>
                          {activity.entityName && (
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              Related to: {activity.entityName}
                            </p>
                          )}
                          <p className="text-xs text-gray-500">
                            {new Date(activity.date).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Activity className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">No Activities Found</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      No activities have been recorded for this customer yet. Activities will appear here as you work with projects, invoices, and other customer-related tasks.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Edit Customer Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Customer</DialogTitle>
              <DialogDescription>
                Update customer information
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(handleSubmitEdit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="name">Customer Name *</Label>
                  <Input id="name" {...form.register("name")} />
                  {form.formState.errors.name && (
                    <p className="text-sm text-red-500 mt-1">{form.formState.errors.name.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" {...form.register("email")} />
                  {form.formState.errors.email && (
                    <p className="text-sm text-red-500 mt-1">{form.formState.errors.email.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" {...form.register("phone")} />
                </div>

                <div>
                  <Label htmlFor="contactPerson">Contact Person</Label>
                  <Input id="contactPerson" {...form.register("contactPerson")} />
                </div>

                <div>
                  <Label htmlFor="companyReg">Company Registration</Label>
                  <Input id="companyReg" {...form.register("companyReg")} />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="address">Address</Label>
                  <Input id="address" {...form.register("address")} />
                </div>

                <div>
                  <Label htmlFor="city">City</Label>
                  <Input id="city" {...form.register("city")} />
                </div>

                <div>
                  <Label htmlFor="state">State</Label>
                  <Input id="state" {...form.register("state")} />
                </div>

                <div>
                  <Label htmlFor="country">Country</Label>
                  <Input id="country" {...form.register("country")} />
                </div>

                <div>
                  <Label htmlFor="postalCode">Postal Code</Label>
                  <Input id="postalCode" {...form.register("postalCode")} />
                </div>

                <div>
                  <Label htmlFor="website">Website</Label>
                  <Input id="website" {...form.register("website")} />
                </div>

                <div>
                  <Label htmlFor="customerType">Customer Type</Label>
                  <Select
                    value={form.watch("customerType")}
                    onValueChange={(value) => form.setValue("customerType", value as any)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ENTERPRISE">Enterprise</SelectItem>
                      <SelectItem value="SME">SME</SelectItem>
                      <SelectItem value="GOVERNMENT">Government</SelectItem>
                      <SelectItem value="INDIVIDUAL">Individual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-2">
                  <Label htmlFor="bankName">Bank Name</Label>
                  <Input id="bankName" {...form.register("bankName")} />
                </div>

                <div>
                  <Label htmlFor="bankAccountNumber">Account Number</Label>
                  <Input id="bankAccountNumber" {...form.register("bankAccountNumber")} />
                </div>

                <div>
                  <Label htmlFor="bankAccountName">Account Name</Label>
                  <Input id="bankAccountName" {...form.register("bankAccountName")} />
                </div>

                <div>
                  <Label htmlFor="bankSwiftCode">SWIFT Code</Label>
                  <Input id="bankSwiftCode" {...form.register("bankSwiftCode")} />
                </div>

                <div>
                  <Label htmlFor="bankAddress">Bank Address</Label>
                  <Input id="bankAddress" {...form.register("bankAddress")} />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea id="notes" {...form.register("notes")} rows={3} />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-red-600 hover:bg-red-700">
                  Update Customer
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Customer</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this customer? This action will soft-delete the customer record, making it inactive but preserving the data for audit purposes.
                {client?.isXeroSynced && (
                  <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-md border border-yellow-200 dark:border-yellow-800">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium">
                      ⚠️ Xero Synced Contact
                    </p>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                      This customer is synced with Xero. Deleting it here will not affect the Xero record. The contact will remain in Xero and may be re-synced in future sync operations.
                    </p>
                  </div>
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsDeleteDialogOpen(false)}
                disabled={deleteLoading}
              >
                Cancel
              </Button>
              <Button 
                type="button" 
                variant="destructive"
                onClick={handleDeleteCustomer}
                disabled={deleteLoading}
              >
                {deleteLoading ? "Deleting..." : "Delete Customer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  )
}
