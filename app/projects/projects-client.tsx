
'use client'

import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SalesPersonnelSelect } from "@/components/ui/sales-personnel-select"
import { geocodeAddressWithRetry } from "@/lib/client-geocoding"
import { 
  Plus, 
  Search, 
  Filter, 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  FolderOpen, 
  User, 
  Calendar, 
  DollarSign,
  Clock,
  Building,
  FileText,
  Upload,
  Target,
  TrendingUp,
  AlertCircle,
  ArrowUpDown,
  Building2,
  CheckCircle,
  XCircle,
  Eye
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
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

interface Project {
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
  estimatedBudget?: number | null
  contractValue?: number | null
  actualCost?: number | null
  progress: number
  address?: string | null
  city?: string | null
  postalCode?: string | null
  country?: string | null
  latitude?: number | null
  longitude?: number | null
  createdAt: string
  customer: {
    id: string
    name: string
    contactPerson?: string | null
  }
  manager?: {
    id: string
    name?: string | null
    firstName?: string | null
    lastName?: string | null
  } | null
  _count: {
    invoices: number
    documents: number
  }
}

interface Customer {
  id: string
  name: string
  contactPerson?: string | null
}

interface User {
  id: string
  firstName?: string | null
  lastName?: string | null
  email: string
  role: string
}

const projectSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  description: z.string().optional(),
  projectType: z.enum(["REGULAR", "MAINTENANCE"]).default("REGULAR"),
  workType: z.enum([
    "REINSTATEMENT",
    "MEP",
    "ELECTRICAL_ONLY",
    "ACMV_ONLY",
    "PLUMBING_SANITARY",
    "FIRE_PROTECTION",
    "CIVIL_STRUCTURAL",
    "INTERIOR_FITOUT",
    "EXTERNAL_WORKS",
    "GENERAL_CONSTRUCTION",
    "OTHER"
  ]).optional().or(z.literal("")),
  status: z.enum(["PLANNING", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "CANCELLED"]).default("PLANNING"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  estimatedBudget: z.number().min(0).optional().or(z.literal("")),
  contractValue: z.number().min(0).optional().or(z.literal("")),
  progress: z.number().min(0).max(100).default(0),
  customerId: z.string().min(1, "Customer is required"),
  managerId: z.string().optional(),
  salespersonId: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
})

type ProjectFormData = z.infer<typeof projectSchema>

const statusConfig = {
  PLANNING: { color: "bg-yellow-100 text-yellow-800", label: "Planning" },
  IN_PROGRESS: { color: "bg-blue-100 text-blue-800", label: "In Progress" },
  ON_HOLD: { color: "bg-gray-100 text-gray-800", label: "On Hold" },
  COMPLETED: { color: "bg-green-100 text-green-800", label: "Completed" },
  CANCELLED: { color: "bg-red-100 text-red-800", label: "Cancelled" },
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

export function ProjectsClient() {
  const router = useRouter()
  const [hasError, setHasError] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [projectTypeFilter, setProjectTypeFilter] = useState("all")
  const [workTypeFilter, setWorkTypeFilter] = useState("all")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [sortField, setSortField] = useState<keyof Project>("name")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")

  const form = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema) as any,
    defaultValues: {
      name: "",
      description: "",
      projectType: "REGULAR",
      workType: "",
      status: "PLANNING",
      priority: "MEDIUM",
      startDate: "",
      endDate: "",
      estimatedBudget: "",
      contractValue: "",
      progress: 0,
      customerId: "",
      managerId: "",
      salespersonId: "",
      address: "",
      city: "",
      postalCode: "",
      country: "Singapore",
    },
  })

  const fetchProjects = async () => {
    try {
      const params = new URLSearchParams()
      if (searchTerm) params.append("search", searchTerm)
      if (statusFilter && statusFilter !== "all") params.append("status", statusFilter)
      if (projectTypeFilter && projectTypeFilter !== "all") params.append("projectType", projectTypeFilter)
      if (workTypeFilter && workTypeFilter !== "all") params.append("workType", workTypeFilter)

      const response = await fetch(`/api/projects?${params.toString()}`)
      
      if (!response.ok) {
        throw new Error("Failed to fetch projects")
      }

      const data = await response.json()
      
      // Defensive extraction: handle various response structures
      let projectsData: any[] = []
      if (Array.isArray(data)) {
        projectsData = data
      } else if (Array.isArray(data?.projects)) {
        projectsData = data.projects
      } else if (Array.isArray(data?.data)) {
        projectsData = data.data
      } else {
        console.warn("[Projects] Unexpected API response structure:", data)
        projectsData = []
      }
      
      // Transform the data to match the expected interface
      const transformedProjects = projectsData.map((project: any) => ({
        ...project,
        customer: project.Customer || project.customer,
        manager: project.User_Project_managerIdToUser || project.manager,
      }))
      
      setProjects(transformedProjects)
    } catch (error) {
      console.error("Error fetching projects:", error)
      toast.error("Failed to load projects")
      setProjects([])
      setHasError(true)
    } finally {
      setLoading(false)
    }
  }

  const fetchCustomers = async () => {
    try {
      console.log("[Project Form] Fetching customers...")
      const response = await fetch("/api/customers/list")
      if (!response.ok) {
        console.error("[Project Form] Customer fetch failed:", response.status, response.statusText)
        throw new Error("Failed to fetch customers")
      }
      const data = await response.json()
      console.log("[Project Form] Raw API response:", data)
      
      // Defensive extraction: handle various response structures
      let customerList: Customer[] = []
      if (Array.isArray(data)) {
        // Direct array response
        customerList = data
      } else if (data && typeof data === 'object') {
        // Wrapped response - try common patterns
        if (Array.isArray(data.customers)) {
          customerList = data.customers
        } else if (Array.isArray(data.data)) {
          customerList = data.data
        } else {
          console.warn("[Project Form] Unexpected API response structure:", data)
        }
      }
      
      console.log("[Project Form] Customers loaded:", customerList.length, "customers")
      setCustomers(customerList)
    } catch (error) {
      console.error("[Project Form] Error fetching customers:", error)
      toast.error("Failed to load customers")
      setCustomers([])
    }
  }

  const fetchUsers = async () => {
    try {
      console.log("[Project Form] Fetching users for project managers...")
      const response = await fetch("/api/users")
      if (!response.ok) {
        console.error("[Project Form] Users fetch failed:", response.status, response.statusText)
        throw new Error("Failed to fetch users")
      }
      const data = await response.json()
      console.log("[Project Form] Users data:", data)
      
      // API returns array directly
      const userList: User[] = Array.isArray(data) ? data : []
      console.log("[Project Form] Users loaded:", userList.length, "users")
      setUsers(userList)
    } catch (error) {
      console.error("[Project Form] Error fetching users:", error)
      toast.error("Failed to load users")
      setUsers([])
    }
  }

  useEffect(() => {
    fetchCustomers()
    fetchUsers()
  }, [])

  useEffect(() => {
    fetchProjects()
  }, [searchTerm, statusFilter, projectTypeFilter, workTypeFilter])

  const handleSubmit = async (data: ProjectFormData) => {
    try {
      console.log("[Project Form] Form data received:", data)
      
      // Geocode address if provided
      let latitude = null
      let longitude = null
      
      if (data.address && data.address.trim() !== '') {
        try {
          toast.info("Geocoding address...", { duration: 2000 })
          
          // Build full address with city and country for better geocoding accuracy
          const addressParts = [
            data.address,
            data.city,
            data.postalCode,
            data.country || 'Singapore' // Default to Singapore if not specified
          ].filter(Boolean) // Remove null/undefined/empty values
          
          const fullAddress = addressParts.join(', ')
          console.log("[Project Form] Geocoding full address:", fullAddress)
          
          const geocodeResult = await geocodeAddressWithRetry(fullAddress)
          
          if (geocodeResult) {
            latitude = geocodeResult.latitude
            longitude = geocodeResult.longitude
            console.log("[Project Form] Geocoding successful:", geocodeResult)
            toast.success("Address geocoded successfully", { duration: 2000 })
          } else {
            console.warn("[Project Form] Geocoding returned no results")
            toast.warning("Could not find exact coordinates for this address. Project will be saved without location data.", { duration: 3000 })
          }
        } catch (geocodeError) {
          console.error("[Project Form] Geocoding error:", geocodeError)
          toast.warning("Failed to geocode address. Project will be saved without location data.", { duration: 3000 })
        }
      }
      
      const cleanedData = {
        ...data,
        workType: (data.workType && (data.workType as string) !== "") ? data.workType : null,
        estimatedBudget: data.estimatedBudget ? Number(data.estimatedBudget) : null,
        contractValue: data.contractValue ? Number(data.contractValue) : null,
        startDate: data.startDate || null,
        endDate: data.endDate || null,
        description: data.description || null,
        address: data.address || null,
        city: data.city || null,
        postalCode: data.postalCode || null,
        country: data.country || "Singapore",
        latitude,
        longitude,
      }

      console.log("[Project Form] Cleaned data to send:", cleanedData)

      const url = editingProject ? `/api/projects/${editingProject.id}` : "/api/projects"
      const method = editingProject ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(cleanedData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error("[Project Form] API error response:", errorData)
        throw new Error(errorData.error || "Failed to save project")
      }

      toast.success(editingProject ? "Project updated successfully" : "Project created successfully")
      setIsDialogOpen(false)
      setEditingProject(null)
      form.reset()
      fetchProjects()
    } catch (error) {
      console.error("[Project Form] Error saving project:", error)
      toast.error(error instanceof Error ? error.message : "Failed to save project")
    }
  }

  const handleEdit = (project: Project) => {
    setEditingProject(project)
    try {
      form.reset({
        name: project.name || "",
        description: project.description || "",
        projectType: project.projectType || "REGULAR",
        workType: project.workType || "",
        status: project.status || "PLANNING",
        priority: project.priority || "MEDIUM",
        startDate: project.startDate ? new Date(project.startDate).toISOString().split('T')[0] : "",
        endDate: project.endDate ? new Date(project.endDate).toISOString().split('T')[0] : "",
        estimatedBudget: project.estimatedBudget || "",
        contractValue: (project as any).contractValue || "",
        progress: project.progress || 0,
        customerId: project.customer?.id || "",
        address: project.address || "",
        city: project.city || "",
        postalCode: project.postalCode || "",
        country: project.country || "Singapore",
        managerId: project.manager?.id || undefined,
        salespersonId: (project as any).salespersonId || undefined,
      })
      setIsDialogOpen(true)
    } catch (error) {
      console.error("Error setting up edit form:", error)
      toast.error("Error opening edit form")
    }
  }

  const handleDelete = async (projectId: string) => {
    if (!confirm("Are you sure you want to delete this project?")) {
      return
    }

    setIsDeleting(projectId)
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete project")
      }

      toast.success("Project deleted successfully")
      fetchProjects()
    } catch (error) {
      console.error("Error deleting project:", error)
      toast.error("Failed to delete project")
    } finally {
      setIsDeleting(null)
    }
  }

  const handleAddNew = () => {
    setEditingProject(null)
    form.reset()
    setIsDialogOpen(true)
  }

  const handleProjectClick = (projectId: string) => {
    router.push(`/projects/${projectId}`)
  }

  const getDaysUntilDeadline = (endDate: string) => {
    const now = new Date()
    const deadline = new Date(endDate)
    const diffTime = deadline.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  const handleSort = (field: keyof Project) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  // Defensive array handling: ensure projects is always an array before sorting
  const safeProjects = React.useMemo(() => {
    // Multiple layers of defensive checks
    if (Array.isArray(projects)) {
      return projects
    }
    
    if (projects && typeof projects === 'object') {
      // Check for common response wrapper patterns
      if (Array.isArray((projects as any).data)) {
        console.warn('[Projects] API returned wrapped data structure')
        return (projects as any).data
      }
      if (Array.isArray((projects as any).projects)) {
        console.warn('[Projects] API returned nested projects structure')
        return (projects as any).projects
      }
    }
    
    console.error('[Projects] Invalid projects data structure:', projects)
    return []
  }, [projects])
  
  const sortedProjects = React.useMemo(() => {
    // Safety check before spreading
    if (!Array.isArray(safeProjects)) {
      console.error('[Projects] safeProjects is not an array:', safeProjects)
      return []
    }
    
    // Create a copy and sort
    return [...safeProjects].sort((a, b) => {
      let aValue: any = a[sortField]
      let bValue: any = b[sortField]
      
      // Handle special cases for nested objects
      if (sortField === "customer" && a.customer && b.customer) {
        aValue = a.customer.name
        bValue = b.customer.name
      }
      
      if (aValue === null || aValue === undefined) return 1
      if (bValue === null || bValue === undefined) return -1
      
      let comparison = 0
      if (typeof aValue === "string" && typeof bValue === "string") {
        comparison = aValue.localeCompare(bValue)
      } else if (typeof aValue === "number" && typeof bValue === "number") {
        comparison = aValue - bValue
      } else if (aValue instanceof Date && bValue instanceof Date) {
        comparison = aValue.getTime() - bValue.getTime()
      } else {
        comparison = String(aValue).localeCompare(String(bValue))
      }
      
      return sortDirection === "asc" ? comparison : -comparison
    })
  }, [safeProjects, sortField, sortDirection])

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-64 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (hasError) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <AlertCircle className="mx-auto h-12 w-12 text-red-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">Error Loading Projects</h3>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            There was an error loading the projects page. Please refresh and try again.
          </p>
          <Button 
            onClick={() => {
              setHasError(false)
              setLoading(true)
              fetchProjects()
            }} 
            className="mt-4 bg-red-600 hover:bg-red-700"
          >
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Projects</h1>
          <p className="text-gray-600 dark:text-gray-300">
            Manage your engineering projects and track progress
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleAddNew} className="text-[10px] px-1.5 py-0 bg-red-600 hover:bg-red-700">
              <Plus className="mr-2 h-4 w-4" />
              Add Project
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingProject ? "Edit Project" : "Create New Project"}
              </DialogTitle>
              <DialogDescription>
                {editingProject ? "Update project information and status." : "Set up a new project with customer and timeline."}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="name">Project Name *</Label>
                  <Input
                    id="name"
                    {...form.register("name")}
                    placeholder="Office Renovation Project"
                  />
                  {form.formState.errors.name && (
                    <p className="text-xs text-red-600">{form.formState.errors.name.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="customerId">Customer *</Label>
                  <Select
                    value={form.watch("customerId")}
                    onValueChange={(value) => form.setValue("customerId", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {!Array.isArray(customers) || customers.length === 0 ? (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">
                          {!Array.isArray(customers) 
                            ? "Loading customers..." 
                            : "No customers available"}
                        </div>
                      ) : (
                        customers.map((customer) => (
                          <SelectItem key={customer.id} value={customer.id}>
                            {customer.name}
                            {customer.contactPerson && ` (${customer.contactPerson})`}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {form.formState.errors.customerId && (
                    <p className="text-xs text-red-600">{form.formState.errors.customerId.message}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="projectType">Project Type</Label>
                  <Select
                    value={form.watch("projectType")}
                    onValueChange={(value) => form.setValue("projectType", value as any)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(projectTypeConfig).map(([type, config]) => (
                        <SelectItem key={type} value={type}>
                          {config.icon} {config.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Work Type Selection */}
              <div>
                <Label htmlFor="workType">Project Work Type (Optional)</Label>
                <Select
                  value={form.watch("workType") || "no-work-type"}
                  onValueChange={(value) => form.setValue("workType", value === "no-work-type" ? "" : value as any)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select work type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no-work-type">
                      <span className="text-muted-foreground">No work type</span>
                    </SelectItem>
                    {Object.entries(workTypeConfig).map(([type, config]) => (
                      <SelectItem key={type} value={type}>
                        {config.icon} {config.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">
                  Helps categorize projects for company profile and project references
                </p>
              </div>

              {/* Sales Personnel and Manager Selection */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <SalesPersonnelSelect
                    value={form.watch("salespersonId")}
                    onValueChange={(value) => form.setValue("salespersonId", value)}
                    label="Sales Personnel"
                    placeholder="Select sales personnel"
                  />
                </div>
                <div>
                  <Label htmlFor="managerId">Project Manager</Label>
                  <Select
                    value={form.watch("managerId") || "no-manager"}
                    onValueChange={(value) => form.setValue("managerId", value === "no-manager" ? undefined : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select project manager" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no-manager">
                        <span className="text-muted-foreground">No manager assigned</span>
                      </SelectItem>
                      {users
                        .filter((user) => user.role === 'PROJECT_MANAGER' || user.role === 'SUPERADMIN')
                        .map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.firstName && user.lastName 
                              ? `${user.firstName} ${user.lastName}` 
                              : user.email}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500 mt-1">
                    Only Project Managers and Super Admins are shown
                  </p>
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  {...form.register("description")}
                  placeholder="Project description and objectives..."
                  rows={3}
                />
              </div>

              {/* Location Fields for Google Maps */}
              <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-semibold">Project Location (for Map Display)</Label>
                </div>
                <div>
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    {...form.register("address")}
                    placeholder="123 Main Street"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    📍 The system will automatically geocode the address to display the project location on the map
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      {...form.register("city")}
                      placeholder="Enter city"
                    />
                  </div>
                  <div>
                    <Label htmlFor="postalCode">Postal Code</Label>
                    <Input
                      id="postalCode"
                      {...form.register("postalCode")}
                      placeholder="Enter postal code"
                    />
                  </div>
                  <div>
                    <Label htmlFor="country">Country</Label>
                    <Input
                      id="country"
                      {...form.register("country")}
                      placeholder="Enter country"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={form.watch("status")}
                    onValueChange={(value) => form.setValue("status", value as any)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(statusConfig).map(([status, config]) => (
                        <SelectItem key={status} value={status}>
                          {config.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="priority">Priority</Label>
                  <Select
                    value={form.watch("priority")}
                    onValueChange={(value) => form.setValue("priority", value as any)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(priorityConfig).map(([priority, config]) => (
                        <SelectItem key={priority} value={priority}>
                          {config.icon} {config.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    {...form.register("startDate")}
                  />
                </div>
                <div>
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    {...form.register("endDate")}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="estimatedBudget">Estimated Budget ($)</Label>
                  <Input
                    id="estimatedBudget"
                    type="number"
                    step="0.01"
                    {...form.register("estimatedBudget", { valueAsNumber: true })}
                    placeholder="50000"
                  />
                </div>
                <div>
                  <Label htmlFor="contractValue">
                    Contract Value ($)
                    <span className="text-xs text-muted-foreground ml-1">(Auto-updates with POs & VOs)</span>
                  </Label>
                  <Input
                    id="contractValue"
                    type="number"
                    step="0.01"
                    {...form.register("contractValue", { valueAsNumber: true })}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <Label htmlFor="progress">Progress (%)</Label>
                  <Input
                    id="progress"
                    type="number"
                    min="0"
                    max="100"
                    {...form.register("progress", { valueAsNumber: true })}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsDialogOpen(false)
                    setEditingProject(null)
                    form.reset()
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" className="text-[10px] px-1.5 py-0 bg-red-600 hover:bg-red-700">
                  {editingProject ? "Update Project" : "Create Project"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and Filter */}
      <div className="flex items-center space-x-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search projects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {Object.entries(statusConfig).map(([status, config]) => (
              <SelectItem key={status} value={status}>
                {config.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={projectTypeFilter} onValueChange={setProjectTypeFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(projectTypeConfig).map(([type, config]) => (
              <SelectItem key={type} value={type}>
                {config.icon} {config.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={workTypeFilter} onValueChange={setWorkTypeFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Work Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Work Types</SelectItem>
            {Object.entries(workTypeConfig).map(([type, config]) => (
              <SelectItem key={type} value={type}>
                {config.icon} {config.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Project Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Target className="h-4 w-4 text-blue-600" />
              <div>
                <p className="text-xs text-gray-600">Total Projects</p>
                <p className="text-xl font-bold">{safeProjects.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <div>
                <p className="text-xs text-gray-600">In Progress</p>
                <p className="text-xl font-bold">
                  {safeProjects.filter((p: Project) => p.status === "IN_PROGRESS").length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-orange-600" />
              <div>
                <p className="text-xs text-gray-600">Planning</p>
                <p className="text-xl font-bold">
                  {safeProjects.filter((p: Project) => p.status === "PLANNING").length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <div>
                <p className="text-xs text-gray-600">High Priority</p>
                <p className="text-xl font-bold">
                  {safeProjects.filter((p: Project) => p.priority === "HIGH" || p.priority === "URGENT").length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <span className="text-lg">🔧</span>
              <div>
                <p className="text-xs text-gray-600">Maintenance</p>
                <p className="text-xl font-bold">
                  {safeProjects.filter((p: Project) => p.projectType === "MAINTENANCE").length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Projects Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Projects</CardTitle>
          <CardDescription>Complete list of engineering projects</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-semibold py-2 cursor-pointer" onClick={() => handleSort("projectNumber")}>
                    <div className="flex items-center">
                      Project #
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </div>
                  </TableHead>
                  <TableHead className="text-xs font-semibold py-2 cursor-pointer" onClick={() => handleSort("name")}>
                    <div className="flex items-center">
                      Project Name
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </div>
                  </TableHead>
                  <TableHead className="text-xs font-semibold py-2 cursor-pointer" onClick={() => handleSort("projectType")}>
                    <div className="flex items-center">
                      Type
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </div>
                  </TableHead>
                  <TableHead className="text-xs font-semibold py-2">
                    Work Type
                  </TableHead>
                  <TableHead className="text-xs font-semibold py-2 cursor-pointer" onClick={() => handleSort("customer")}>
                    <div className="flex items-center">
                      Customer
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </div>
                  </TableHead>
                  <TableHead className="text-xs font-semibold py-2 cursor-pointer" onClick={() => handleSort("status")}>
                    <div className="flex items-center">
                      Status
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </div>
                  </TableHead>
                  <TableHead className="text-xs font-semibold py-2 cursor-pointer" onClick={() => handleSort("priority")}>
                    <div className="flex items-center">
                      Priority
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </div>
                  </TableHead>
                  <TableHead className="text-xs font-semibold py-2 cursor-pointer" onClick={() => handleSort("progress")}>
                    <div className="flex items-center">
                      Progress
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </div>
                  </TableHead>
                  <TableHead className="text-xs font-semibold py-2 cursor-pointer" onClick={() => handleSort("estimatedBudget")}>
                    <div className="flex items-center">
                      Budget
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </div>
                  </TableHead>
                  <TableHead className="text-xs font-semibold py-2 cursor-pointer" onClick={() => handleSort("endDate")}>
                    <div className="flex items-center">
                      Due Date
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </div>
                  </TableHead>
                  <TableHead className="text-xs font-semibold py-2">Manager</TableHead>
                  <TableHead className="text-xs font-semibold py-2">Activity</TableHead>
                  <TableHead className="text-xs font-semibold py-2 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.isArray(sortedProjects) && sortedProjects.length > 0 && sortedProjects.map((project) => (
                  <TableRow 
                    key={project.id} 
                    className="hover:bg-muted/50 cursor-pointer"
                    onClick={() => handleProjectClick(project.id)}
                  >
                    <TableCell className="py-2 text-[10px]">
                      <div className="font-mono text-sm font-medium">
                        {project.projectNumber}
                      </div>
                    </TableCell>
                    <TableCell className="py-2 text-[10px]">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                          <FolderOpen className="h-4 w-4 text-red-600" />
                        </div>
                        <div>
                          <div className="font-medium">{project.name}</div>
                          {project.description && (
                            <div className="text-xs text-muted-foreground truncate max-w-64">
                              {project.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-2 text-[10px]">
                      <Badge variant="outline" className={projectTypeConfig[project.projectType as keyof typeof projectTypeConfig]?.color}>
                        {projectTypeConfig[project.projectType as keyof typeof projectTypeConfig]?.icon} {projectTypeConfig[project.projectType as keyof typeof projectTypeConfig]?.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-2 text-[10px]">
                      {project.workType ? (
                        <Badge variant="outline" className={workTypeConfig[project.workType as keyof typeof workTypeConfig]?.color}>
                          {workTypeConfig[project.workType as keyof typeof workTypeConfig]?.icon} {workTypeConfig[project.workType as keyof typeof workTypeConfig]?.label}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="py-2 text-[10px]">
                      <div className="flex items-center space-x-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <span>{project.customer?.name || "Unknown Customer"}</span>
                          {project.customer?.contactPerson && (
                            <div className="text-xs text-muted-foreground">
                              {project.customer.contactPerson}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-2 text-[10px]">
                      <Badge variant="outline" className={statusConfig[project.status as keyof typeof statusConfig]?.color}>
                        {project.status === "COMPLETED" ? <CheckCircle className="w-3 h-3 mr-1" /> :
                         project.status === "CANCELLED" ? <XCircle className="w-3 h-3 mr-1" /> :
                         project.status === "ON_HOLD" ? <Clock className="w-3 h-3 mr-1" /> :
                         <TrendingUp className="w-3 h-3 mr-1" />}
                        {statusConfig[project.status as keyof typeof statusConfig]?.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-2 text-[10px]">
                      <Badge variant="outline" className={priorityConfig[project.priority as keyof typeof priorityConfig]?.color}>
                        {priorityConfig[project.priority as keyof typeof priorityConfig]?.icon} {priorityConfig[project.priority as keyof typeof priorityConfig]?.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-2 text-[10px]">
                      <div className="flex items-center space-x-3 min-w-32">
                        <Progress value={project.progress} className="h-2 flex-1" />
                        <span className="text-xs font-medium min-w-10">{project.progress}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-2 text-[10px]">
                      {project.estimatedBudget ? (
                        <div className="flex items-center space-x-2">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">${project.estimatedBudget.toLocaleString()}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Not set</span>
                      )}
                    </TableCell>
                    <TableCell className="py-2 text-[10px]">
                      {project.endDate ? (
                        <div className="flex items-center space-x-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="text-[10px]">
                              {new Date(project.endDate).toLocaleDateString()}
                            </div>
                            {(() => {
                              const days = getDaysUntilDeadline(project.endDate)
                              if (days < 0) {
                                return <div className="text-xs text-red-600 font-medium">Overdue</div>
                              } else if (days <= 7) {
                                return <div className="text-xs text-orange-600 font-medium">Due Soon</div>
                              }
                              return null
                            })()}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Not set</span>
                      )}
                    </TableCell>
                    <TableCell className="py-2 text-[10px]">
                      {project.manager ? (
                        <div className="flex items-center space-x-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="text-[10px]">
                            {project.manager?.firstName && project.manager?.lastName
                              ? `${project.manager.firstName} ${project.manager.lastName}`
                              : project.manager?.name || "Unassigned"}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell className="py-2 text-[10px]">
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-1">
                          <FileText className="h-4 w-4 text-blue-600" />
                          <span className="text-xs font-medium">{project._count?.invoices || 0}</span>
                          <span className="text-[10px] text-gray-500">inv</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Upload className="h-4 w-4 text-green-600" />
                          <span className="text-xs font-medium">{project._count?.documents || 0}</span>
                          <span className="text-[10px] text-gray-500">docs</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation()
                            handleProjectClick(project.id)
                          }}>
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation()
                            handleEdit(project)
                          }}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit Project
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDelete(project.id)
                            }}
                            disabled={isDeleting === project.id}
                            className="text-red-600"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
          {(!Array.isArray(sortedProjects) || sortedProjects.length === 0) && !loading && (
            <div className="text-center py-12">
              <FolderOpen className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">No projects found</h3>
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                {searchTerm || (statusFilter && statusFilter !== "all") || (projectTypeFilter && projectTypeFilter !== "all") || (workTypeFilter && workTypeFilter !== "all") ? "Try adjusting your search or filters." : "Get started by creating your first project."}
              </p>
              {!searchTerm && (!statusFilter || statusFilter === "all") && (!projectTypeFilter || projectTypeFilter === "all") && (!workTypeFilter || workTypeFilter === "all") && (
                <Button onClick={handleAddNew} className="mt-4 bg-red-600 hover:bg-red-700">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Your First Project
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
