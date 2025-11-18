
'use client'

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  ArrowLeft, 
  Edit, 
  FileText, 
  Calendar, 
  DollarSign,
  User,
  Building2,
  Target,
  Clock,
  Upload,
  Download,
  AlertCircle,
  TrendingUp,
  CheckCircle,
  XCircle,
  MoreHorizontal,
  Settings,
  Activity,
  FolderOpen
} from "lucide-react"
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toast } from "sonner"
import { motion } from "framer-motion"
import { useRouter } from "next/navigation"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import { ProjectDocuments } from "@/components/projects/project-documents"
import { ProjectFinance } from "@/components/projects/project-finance"
import { ProgressEditDialog } from "@/components/projects/progress-edit-dialog"
import { VariationOrders } from "@/components/projects/variation-orders"
import { ProjectFormsManager } from "@/components/bca/project-forms-manager"
import { InvoiceReminderAlert } from "@/components/projects/invoice-reminder-alert"

interface ProjectDetail {
  id: string
  projectNumber: string
  name: string
  description?: string | null
  projectType: "REGULAR" | "MAINTENANCE"
  workType?: "REINSTATEMENT" | "MEP" | "ELECTRICAL_ONLY" | "ACMV_ONLY" | "PLUMBING_SANITARY" | "FIRE_PROTECTION" | "CIVIL_STRUCTURAL" | "INTERIOR_FITOUT" | "EXTERNAL_WORKS" | "GENERAL_CONSTRUCTION" | "OTHER" | null
  status: "PLANNING" | "IN_PROGRESS" | "ON_HOLD" | "COMPLETED" | "CANCELLED"
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT"
  startDate?: string | null
  endDate?: string | null
  contractValue?: number | null
  estimatedBudget?: number | null
  actualCost?: number | null
  progress: number
  createdAt: string
  updatedAt: string
  Customer: {
    id: string
    name: string
    contactPerson?: string | null
    email?: string | null
    phone?: string | null
  }
  User_Project_managerIdToUser?: {
    id: string
    name?: string | null
    firstName?: string | null
    lastName?: string | null
    email: string
  } | null
  User_Project_salespersonIdToUser?: {
    id: string
    firstName?: string | null
    lastName?: string | null
    email: string
  } | null
  CustomerInvoice: Array<{
    id: string
    invoiceNumber: string
    totalAmount: number
    status: string
    issueDate: string
    dueDate: string
  }>
  LegacyInvoice: Array<{
    id: string
    invoiceNumber: string
    totalAmount: number
    status: string
    issueDate: string
    dueDate: string
  }>
  Document: Array<{
    id: string
    filename: string
    originalName: string
    size: number
    category?: string | null
    createdAt: string
    User: {
      name?: string | null
      firstName?: string | null
      lastName?: string | null
    }
  }>
  _count: {
    invoices: number
    documents: number
  }
}

const statusConfig = {
  PLANNING: { color: "bg-yellow-100 text-yellow-800", label: "Planning", icon: Clock },
  IN_PROGRESS: { color: "bg-blue-100 text-blue-800", label: "In Progress", icon: TrendingUp },
  ON_HOLD: { color: "bg-gray-100 text-gray-800", label: "On Hold", icon: Clock },
  COMPLETED: { color: "bg-green-100 text-green-800", label: "Completed", icon: CheckCircle },
  CANCELLED: { color: "bg-red-100 text-red-800", label: "Cancelled", icon: XCircle },
}

const priorityConfig = {
  LOW: { color: "bg-green-100 text-green-800", label: "Low", icon: "🟢" },
  MEDIUM: { color: "bg-blue-100 text-blue-800", label: "Medium", icon: "🔵" },
  HIGH: { color: "bg-orange-100 text-orange-800", label: "High", icon: "🟠" },
  URGENT: { color: "bg-red-100 text-red-800", label: "Urgent", icon: "🔴" },
}

const projectTypeConfig = {
  REGULAR: { color: "bg-blue-100 text-blue-800", label: "Regular Project", icon: "🏗️" },
  MAINTENANCE: { color: "bg-purple-100 text-purple-800", label: "Maintenance", icon: "🔧" },
}

const workTypeConfig = {
  REINSTATEMENT: { color: "bg-orange-100 text-orange-800", label: "Reinstatement", icon: "🔨" },
  MEP: { color: "bg-purple-100 text-purple-800", label: "MEP", icon: "⚡" },
  ELECTRICAL_ONLY: { color: "bg-yellow-100 text-yellow-800", label: "Electrical Only", icon: "💡" },
  ACMV_ONLY: { color: "bg-cyan-100 text-cyan-800", label: "ACMV Only", icon: "❄️" },
  PLUMBING_SANITARY: { color: "bg-blue-100 text-blue-800", label: "Plumbing & Sanitary", icon: "🚿" },
  FIRE_PROTECTION: { color: "bg-red-100 text-red-800", label: "Fire Protection", icon: "🔥" },
  CIVIL_STRUCTURAL: { color: "bg-gray-100 text-gray-800", label: "Civil & Structural", icon: "🏗️" },
  INTERIOR_FITOUT: { color: "bg-green-100 text-green-800", label: "Interior Fit-out", icon: "🪑" },
  EXTERNAL_WORKS: { color: "bg-emerald-100 text-emerald-800", label: "External Works", icon: "🌳" },
  GENERAL_CONSTRUCTION: { color: "bg-indigo-100 text-indigo-800", label: "General Construction", icon: "👷" },
  OTHER: { color: "bg-slate-100 text-slate-800", label: "Other", icon: "📋" },
}

const invoiceStatusConfig = {
  DRAFT: { color: "bg-gray-100 text-gray-800", label: "Draft" },
  SENT: { color: "bg-blue-100 text-blue-800", label: "Sent" },
  PAID: { color: "bg-green-100 text-green-800", label: "Paid" },
  OVERDUE: { color: "bg-red-100 text-red-800", label: "Overdue" },
  CANCELLED: { color: "bg-red-100 text-red-800", label: "Cancelled" },
}

export function ProjectDetailClient({ projectId }: { projectId: string }) {
  const router = useRouter()
  const { data: session } = useSession()
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showProgressDialog, setShowProgressDialog] = useState(false)

  const fetchProject = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}`)
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Project not found")
        }
        throw new Error("Failed to fetch project")
      }

      const data = await response.json()
      setProject(data)
    } catch (error) {
      console.error("Error fetching project:", error)
      setError(error instanceof Error ? error.message : "Failed to load project")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProject()
  }, [projectId])

  const handleBack = () => {
    router.push("/projects")
  }

  const getManagerDisplayName = (manager: ProjectDetail["User_Project_managerIdToUser"]) => {
    if (!manager) return "Unassigned"
    if (manager.firstName && manager.lastName) {
      return `${manager.firstName} ${manager.lastName}`
    }
    return manager.name || "Unknown"
  }

  const getSalespersonDisplayName = (salesperson: ProjectDetail["User_Project_salespersonIdToUser"]) => {
    if (!salesperson) return "Unassigned"
    if (salesperson.firstName && salesperson.lastName) {
      return `${salesperson.firstName} ${salesperson.lastName}`
    }
    return "Unknown"
  }

  const getUserDisplayName = (user: { name?: string | null, firstName?: string | null, lastName?: string | null }) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`
    }
    return user.name || "Unknown User"
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  const getDaysUntilDeadline = (endDate: string) => {
    const now = new Date()
    const deadline = new Date(endDate)
    const diffTime = deadline.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="flex items-center space-x-4">
            <div className="h-4 w-4 bg-gray-200 rounded"></div>
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">
              <div className="h-64 bg-gray-200 rounded"></div>
              <div className="h-48 bg-gray-200 rounded"></div>
            </div>
            <div className="space-y-6">
              <div className="h-48 bg-gray-200 rounded"></div>
              <div className="h-32 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <AlertCircle className="mx-auto h-12 w-12 text-red-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">Error Loading Project</h3>
          <p className="mt-2 text-gray-600 dark:text-gray-400">{error}</p>
          <div className="mt-6 flex justify-center space-x-4">
            <Button onClick={handleBack} variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Projects
            </Button>
            <Button onClick={fetchProject} className="bg-red-600 hover:bg-red-700">
              Try Again
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <FolderOpen className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">Project Not Found</h3>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            The project you're looking for doesn't exist or has been removed.
          </p>
          <Button onClick={handleBack} className="mt-4" variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Projects
          </Button>
        </div>
      </div>
    )
  }

  const StatusIcon = statusConfig[project.status].icon
  const allInvoices = [
    ...(project.CustomerInvoice || []), 
    ...(project.LegacyInvoice || [])
  ].sort(
    (a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime()
  )

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="p-6 space-y-4"
    >
      {/* Header - Compact */}
      <div className="flex items-center justify-between pb-4 border-b">
        <div className="flex items-center space-x-3">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {project.name}
              </h1>
              <Badge variant="outline" className={statusConfig[project.status].color}>
                <StatusIcon className="w-3 h-3 mr-1" />
                {statusConfig[project.status].label}
              </Badge>
            </div>
            <div className="flex items-center space-x-3 mt-1">
              <span className="text-xs text-gray-500 font-mono">
                {project.projectNumber}
              </span>
              <Badge variant="outline" className={`${projectTypeConfig[project.projectType].color} text-xs`}>
                {projectTypeConfig[project.projectType].icon} {projectTypeConfig[project.projectType].label}
              </Badge>
              {project.workType && (
                <Badge variant="outline" className={`${workTypeConfig[project.workType as keyof typeof workTypeConfig]?.color} text-xs`}>
                  {workTypeConfig[project.workType as keyof typeof workTypeConfig]?.icon} {workTypeConfig[project.workType as keyof typeof workTypeConfig]?.label}
                </Badge>
              )}
              <Badge variant="outline" className={`${priorityConfig[project.priority].color} text-xs`}>
                {priorityConfig[project.priority].icon} {priorityConfig[project.priority].label}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              console.log('Edit Project clicked for ID:', projectId)
              router.push(`/projects/${projectId}/edit`)
            }}
          >
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                Project Settings
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Activity className="mr-2 h-4 w-4" />
                View Activity Log
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Download className="mr-2 h-4 w-4" />
                Export Project Data
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Project Info - Compact Single Row */}
      <div className="grid grid-cols-5 gap-4">
        {/* Customer */}
        <Card className="col-span-1">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center space-x-2 mb-1">
              <Building2 className="h-4 w-4 text-gray-500" />
              <span className="text-xs text-gray-500">Customer</span>
            </div>
            <p className="text-sm font-medium truncate" title={project.Customer?.name}>
              {project.Customer?.name || 'Unassigned'}
            </p>
          </CardContent>
        </Card>

        {/* Manager */}
        <Card className="col-span-1">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center space-x-2 mb-1">
              <User className="h-4 w-4 text-gray-500" />
              <span className="text-xs text-gray-500">Manager</span>
            </div>
            <p className="text-sm font-medium truncate">
              {getManagerDisplayName(project.User_Project_managerIdToUser)}
            </p>
          </CardContent>
        </Card>

        {/* Sales Personnel */}
        <Card className="col-span-1">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center space-x-2 mb-1">
              <User className="h-4 w-4 text-gray-500" />
              <span className="text-xs text-gray-500">Sales Personnel</span>
            </div>
            <p className="text-sm font-medium truncate">
              {getSalespersonDisplayName(project.User_Project_salespersonIdToUser)}
            </p>
          </CardContent>
        </Card>

        {/* Timeline */}
        <Card className="col-span-1">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center space-x-2 mb-1">
              <Calendar className="h-4 w-4 text-gray-500" />
              <span className="text-xs text-gray-500">Timeline</span>
            </div>
            <p className="text-xs font-medium">
              {project.startDate ? new Date(project.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A'} - {project.endDate ? new Date(project.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A'}
            </p>
          </CardContent>
        </Card>

        {/* Progress - Clickable */}
        <Card 
          className="col-span-1 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setShowProgressDialog(true)}
        >
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center space-x-2 mb-1">
              <Target className="h-4 w-4 text-gray-500" />
              <span className="text-xs text-gray-500">Progress (Click to edit)</span>
            </div>
            <div className="flex items-center space-x-2">
              <Progress value={project.progress} className="h-1.5 flex-1" />
              <span className="text-xs font-medium">{project.progress}%</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content - Navigation Tabs */}
      <Card>
        <CardContent className="p-0">
          <Tabs defaultValue="finance" className="w-full">
            <TabsList className="grid w-full grid-cols-7 rounded-none border-b">
              <TabsTrigger value="finance">
                <DollarSign className="h-4 w-4 mr-2" />
                Finance
              </TabsTrigger>
              <TabsTrigger value="budget">
                <Target className="h-4 w-4 mr-2" />
                Budget
              </TabsTrigger>
              <TabsTrigger value="variation-orders">
                <TrendingUp className="h-4 w-4 mr-2" />
                Variation Orders
              </TabsTrigger>
              <TabsTrigger value="invoices">
                <FileText className="h-4 w-4 mr-2" />
                Invoices ({project._count.invoices})
              </TabsTrigger>
              <TabsTrigger value="bca-forms">
                <CheckCircle className="h-4 w-4 mr-2" />
                BCA Forms
              </TabsTrigger>
              <TabsTrigger value="documents">
                <FolderOpen className="h-4 w-4 mr-2" />
                Documents
              </TabsTrigger>
              <TabsTrigger value="activity">
                <Activity className="h-4 w-4 mr-2" />
                Activity
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="finance" className="p-6 m-0">
              <ProjectFinance 
                projectId={projectId}
                project={{
                  id: project.id,
                  name: project.name,
                  projectNumber: project.projectNumber,
                  contractValue: project.contractValue,
                  estimatedBudget: project.estimatedBudget,
                  customerId: project.Customer.id
                }}
              />
            </TabsContent>
            
            <TabsContent value="budget" className="p-6 m-0">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">Supplier Budget</h3>
                    <p className="text-sm text-gray-500">Track supplier quotations, costs, and profit/loss</p>
                  </div>
                  <Button onClick={() => router.push(`/projects/${projectId}/budget`)}>
                    <Target className="h-4 w-4 mr-2" />
                    Open Budget Module
                  </Button>
                </div>
                <div className="text-sm text-gray-600">
                  Click "Open Budget Module" to access the full budget management interface.
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="invoices" className="p-6 m-0">
              {allInvoices.length > 0 ? (
                <div className="space-y-3">
                  {allInvoices.map((invoice) => (
                    <div key={invoice.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                      <div className="flex items-center space-x-3">
                        <FileText className="h-4 w-4 text-blue-600" />
                        <div>
                          <div className="font-medium text-sm">{invoice.invoiceNumber}</div>
                          <div className="text-xs text-gray-500">
                            {new Date(invoice.issueDate).toLocaleDateString()}
                            {invoice.dueDate && ` • Due: ${new Date(invoice.dueDate).toLocaleDateString()}`}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <Badge 
                          variant="outline" 
                          className={invoiceStatusConfig[invoice.status as keyof typeof invoiceStatusConfig]?.color || "bg-gray-100 text-gray-800"}
                        >
                          {invoiceStatusConfig[invoice.status as keyof typeof invoiceStatusConfig]?.label || invoice.status}
                        </Badge>
                        <div className="font-medium text-sm">${invoice.totalAmount.toLocaleString()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <FileText className="mx-auto h-10 w-10 text-gray-300" />
                  <h3 className="mt-3 text-sm font-medium">No invoices yet</h3>
                  <p className="mt-1 text-xs text-gray-500">Invoices for this project will appear here.</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="variation-orders" className="p-6 m-0">
              <VariationOrders projectId={projectId} />
            </TabsContent>

            <TabsContent value="bca-forms" className="p-6 m-0">
              <ProjectFormsManager 
                projectId={projectId}
                showCreateButton={session?.user?.role === "SUPERADMIN"}
              />
            </TabsContent>

            <TabsContent value="documents" className="p-0 m-0">
              <ProjectDocuments 
                projectId={projectId} 
                userRole={session?.user?.role as string || 'VIEWER'}
                projectDetails={project ? {
                  projectNumber: project.projectNumber,
                  name: project.name,
                  description: project.description || undefined,
                  customerName: project.Customer?.name || 'N/A',
                  location: project.description || undefined,
                  startDate: project.startDate || undefined,
                  endDate: project.endDate || undefined
                } : undefined}
              />
            </TabsContent>

            <TabsContent value="activity" className="p-6 m-0">
              <div className="text-center py-12">
                <Activity className="mx-auto h-10 w-10 text-gray-300" />
                <h3 className="mt-3 text-sm font-medium">Activity log coming soon</h3>
                <p className="mt-1 text-xs text-gray-500">Project activity and timeline will be displayed here.</p>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Progress Edit Dialog */}
      <ProgressEditDialog
        projectId={projectId}
        currentProgress={project.progress}
        open={showProgressDialog}
        onOpenChange={setShowProgressDialog}
        onSuccess={fetchProject}
      />
    </motion.div>
  )
}
