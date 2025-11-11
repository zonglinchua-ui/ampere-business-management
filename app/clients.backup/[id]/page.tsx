
'use client'

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { MainLayout } from "@/components/layout/main-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
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
  Activity
} from "lucide-react"
import { useRouter } from "next/navigation"

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

export default function ClientDetailPage() {
  const params = useParams()
  const router = useRouter()
  const clientId = params.id as string
  
  const [loading, setLoading] = useState(true)
  const [client, setClient] = useState<Client | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [error, setError] = useState<string | null>(null)
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [activitiesLoading, setActivitiesLoading] = useState(false)

  const fetchActivities = async () => {
    try {
      setActivitiesLoading(true)
      const response = await fetch(`/api/clients/${clientId}/activities`)
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
        
        // Fetch client details
        const clientResponse = await fetch(`/api/clients/${clientId}`)
        if (!clientResponse.ok) {
          console.error(`Failed to fetch client: ${clientResponse.status} ${clientResponse.statusText}`)
          throw new Error('Failed to fetch client details')
        }
        const clientData = await clientResponse.json()
        
        // Validate client data structure
        if (!clientData || typeof clientData !== 'object' || !clientData.id) {
          console.error('Invalid client data received:', clientData)
          throw new Error('Invalid client data received')
        }
        
        setClient(clientData)

        // Fetch client projects (optional - don't fail if it errors)
        try {
          const projectsResponse = await fetch(`/api/projects?clientId=${clientId}`)
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
          const invoicesResponse = await fetch(`/api/invoices?clientId=${clientId}`)
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

        setLoading(false)
      } catch (error) {
        console.error('Error fetching client data:', error)
        const errorMessage = error instanceof Error ? error.message : 'Failed to load client data'
        setError(errorMessage)
        setClient(null)
        setProjects([])
        setInvoices([])
        setLoading(false)
      }
    }

    if (clientId && typeof clientId === 'string') {
      fetchClientData()
    } else {
      console.error('Invalid clientId:', clientId)
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
    if (!type) return "Client"
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

  if (error) {
    return (
      <MainLayout>
        <div className="p-6">
          <div className="text-center py-12">
            <h3 className="text-lg font-medium text-red-600 mb-2">Error Loading Client</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
            <Button onClick={() => router.push('/clients')} className="mt-4">
              Back to Clients
            </Button>
          </div>
        </div>
      </MainLayout>
    )
  }

  if (!client) {
    return (
      <MainLayout>
        <div className="p-6">
          <div className="text-center py-12">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Client not found</h3>
            <p className="text-gray-600 dark:text-gray-400">The requested client could not be found.</p>
            <Button onClick={() => router.push('/clients')} className="mt-4">
              Back to Clients
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
                onClick={() => router.push('/clients')}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Clients
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{client.name}</h1>
                <p className="text-gray-600 dark:text-gray-300 mt-1">
                  {getClientTypeDisplay(client.clientType)} • Member since {new Date(client.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
            <Button 
              className="bg-red-600 hover:bg-red-700"
              onClick={() => router.push(`/clients`)}
            >
              <Edit className="mr-2 h-4 w-4" />
              Edit Client
            </Button>
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
              <div className="text-2xl font-bold">${totalProjectValue.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Across all projects</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Amount Received</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">${totalPaidAmount.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Paid invoices</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Amount</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">${pendingAmount.toLocaleString()}</div>
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
              {/* Client Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Building2 className="mr-2 h-5 w-5" />
                    Client Information
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

              {/* Recent Activity */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Activity className="mr-2 h-5 w-5" />
                    Recent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <Activity className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">No Recent Activity</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Activity will appear here as you work with projects, invoices, and other client-related tasks.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="projects" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Client Projects</CardTitle>
                <CardDescription>All projects associated with this client</CardDescription>
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
                              <p className="font-medium">${(project.estimatedBudget || 0).toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-gray-600 dark:text-gray-400">Actual Cost</p>
                              <p className="font-medium">${(project.actualCost || 0).toLocaleString()}</p>
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
                      This client doesn't have any projects yet. Projects will appear here once they are created.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invoices" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Client Invoices</CardTitle>
                <CardDescription>All invoices for this client</CardDescription>
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
                              <p className="font-medium">${(invoice.totalAmount || 0).toLocaleString()}</p>
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
                      This client doesn't have any invoices yet. Invoices will appear here once they are created.
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
                <CardDescription>Complete activity history for this client</CardDescription>
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
                      No activities have been recorded for this client yet. Activities will appear here as you work with projects, invoices, and other client-related tasks.
                    </p>
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
