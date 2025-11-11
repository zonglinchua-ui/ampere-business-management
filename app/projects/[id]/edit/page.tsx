
'use client'

import { useState, useEffect } from "react"
import { MainLayout } from "@/components/layout/main-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SalesPersonnelSelect } from "@/components/ui/sales-personnel-select"
import { geocodeAddressWithRetry } from "@/lib/client-geocoding"
import { CalendarIcon, ArrowLeft, Save, AlertCircle, Loader2 } from "lucide-react"
import { useRouter, useParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { toast } from "react-hot-toast"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface Customer {
  id: string
  name: string
  email?: string
  contactPerson?: string
}

interface User {
  id: string
  firstName: string
  lastName: string
  email: string
  role: string
}

interface ProjectFormData {
  name: string
  description?: string
  customerId: string
  projectType: 'REGULAR' | 'MAINTENANCE'
  status: 'PLANNING' | 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  startDate?: Date
  endDate?: Date
  contractValue?: number
  estimatedBudget?: number
  actualCost?: number
  progress: number
  managerId?: string
  salespersonId?: string
  contractDocument?: any
  address?: string
  city?: string
  postalCode?: string
  country?: string
}

const statusConfig = {
  PLANNING: { label: "Planning", color: "bg-yellow-100 text-yellow-800" },
  IN_PROGRESS: { label: "In Progress", color: "bg-blue-100 text-blue-800" },
  ON_HOLD: { label: "On Hold", color: "bg-gray-100 text-gray-800" },
  COMPLETED: { label: "Completed", color: "bg-green-100 text-green-800" },
  CANCELLED: { label: "Cancelled", color: "bg-red-100 text-red-800" },
}

const priorityConfig = {
  LOW: { label: "Low", color: "bg-green-100 text-green-800", icon: "🟢" },
  MEDIUM: { label: "Medium", color: "bg-blue-100 text-blue-800", icon: "🔵" },
  HIGH: { label: "High", color: "bg-orange-100 text-orange-800", icon: "🟠" },
  URGENT: { label: "Urgent", color: "bg-red-100 text-red-800", icon: "🔴" },
}

const projectTypeConfig = {
  REGULAR: { label: "Regular Project", icon: "🏗️" },
  MAINTENANCE: { label: "Maintenance", icon: "🔧" },
}

export default function EditProjectPage() {
  const router = useRouter()
  const params = useParams()
  const projectId = params?.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [startDateOpen, setStartDateOpen] = useState(false)
  const [endDateOpen, setEndDateOpen] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<ProjectFormData>({
    defaultValues: {
      projectType: 'REGULAR',
      status: 'PLANNING',
      priority: 'MEDIUM',
      progress: 0
    }
  })

  // Register required fields that are controlled by Select components
  register("customerId", { required: "Customer selection is required" })
  register("status", { required: "Status is required" })
  register("projectType", { required: "Project type is required" })
  register("priority", { required: "Priority is required" })

  const startDate = watch('startDate')
  const endDate = watch('endDate')
  const selectedCustomerId = watch('customerId')
  const selectedStatus = watch('status')
  const selectedProjectType = watch('projectType')
  const selectedPriority = watch('priority')
  const selectedManagerId = watch('managerId')
  const progress = watch('progress')

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log(`[Edit Project] Fetching data for project: ${projectId}`)

        // Fetch project details
        const projectResponse = await fetch(`/api/projects/${projectId}`)
        if (!projectResponse.ok) {
          if (projectResponse.status === 404) {
            toast.error('Project not found')
            router.push('/projects')
            return
          }
          throw new Error('Failed to fetch project')
        }
        const project = await projectResponse.json()
        console.log(`[Edit Project] Successfully loaded project: ${project.projectNumber}`)

        // Pre-fill form with project data
        reset({
          name: project.name,
          description: project.description || '',
          customerId: project.Customer?.id || '',
          projectType: project.projectType,
          status: project.status,
          priority: project.priority,
          startDate: project.startDate ? new Date(project.startDate) : undefined,
          endDate: project.endDate ? new Date(project.endDate) : undefined,
          estimatedBudget: project.estimatedBudget || undefined,
          actualCost: project.actualCost || undefined,
          progress: project.progress || 0,
          managerId: project.User_Project_managerIdToUser?.id || undefined,
          salespersonId: project.User_Project_salespersonIdToUser?.id || undefined,
          address: project.address || '',
          city: project.city || '',
          postalCode: project.postalCode || '',
          country: project.country || 'Singapore'
        })

        // Fetch customers
        try {
          const customersResponse = await fetch('/api/customers/list')
          if (customersResponse.ok) {
            const customersData = await customersResponse.json()
            console.log('[Edit Project] Customers API response:', customersData)
            // ✅ FIX: Extract the customers array from the response object
            const customersList = customersData.customers || []
            setCustomers(Array.isArray(customersList) ? customersList : [])
            console.log('[Edit Project] Customers set to state:', customersList.length, 'items')
          } else {
            setCustomers([])
          }
        } catch (error) {
          console.error('[Edit Project] Error fetching customers:', error)
          setCustomers([])
        }

        // Fetch users for assignment
        try {
          const usersResponse = await fetch('/api/users')
          if (usersResponse.ok) {
            const usersData = await usersResponse.json()
            // Ensure usersData is always an array
            setUsers(Array.isArray(usersData) ? usersData : [])
          } else {
            setUsers([])
          }
        } catch (error) {
          console.error('[Edit Project] Error fetching users:', error)
          setUsers([])
        }

        setLoading(false)
      } catch (error) {
        console.error('[Edit Project] Error fetching data:', error)
        toast.error('Failed to load project data')
        router.push('/projects')
      }
    }

    if (projectId) {
      fetchData()
    }
  }, [projectId, reset, router])

  const onSubmit = async (data: ProjectFormData) => {
    setSaving(true)
    
    try {
      console.log(`[Edit Project] Updating project: ${projectId}`)
      
      // Geocode address if provided
      let latitude = null
      let longitude = null
      
      if (data.address && data.address.trim() !== '') {
        try {
          toast.loading("Geocoding address...", { duration: 2000 })
          const geocodeResult = await geocodeAddressWithRetry(data.address)
          
          if (geocodeResult) {
            latitude = geocodeResult.latitude
            longitude = geocodeResult.longitude
            console.log("[Edit Project] Geocoding successful:", geocodeResult)
            toast.success("Address geocoded successfully", { duration: 2000 })
          } else {
            console.warn("[Edit Project] Geocoding returned no results")
            toast.loading("Could not find exact coordinates. Saving without location data.", { duration: 3000 })
          }
        } catch (geocodeError) {
          console.error("[Edit Project] Geocoding error:", geocodeError)
          toast.loading("Failed to geocode address. Saving without location data.", { duration: 3000 })
        }
      }
      
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          estimatedBudget: data.estimatedBudget ? parseFloat(data.estimatedBudget.toString()) : null,
          actualCost: data.actualCost ? parseFloat(data.actualCost.toString()) : null,
          startDate: data.startDate ? data.startDate.toISOString() : null,
          endDate: data.endDate ? data.endDate.toISOString() : null,
          address: data.address || null,
          city: data.city || null,
          postalCode: data.postalCode || null,
          country: data.country || 'Singapore',
          latitude,
          longitude,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to update project')
      }

      const updatedProject = await response.json()
      console.log(`[Edit Project] Successfully updated project: ${updatedProject.projectNumber}`)
      
      toast.success('Project updated successfully!')
      router.push(`/projects/${projectId}`)
    } catch (error) {
      console.error('[Edit Project] Error updating project:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update project')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-red-600" />
            <p className="text-gray-600 dark:text-gray-400">Loading project data...</p>
          </div>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/projects/${projectId}`)}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Edit Project
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Update project information and status
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>
                Core project details and identification
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label htmlFor="name">Project Name *</Label>
                  <Input
                    id="name"
                    {...register("name", { required: "Project name is required" })}
                    placeholder="Enter project name"
                  />
                  {errors.name && (
                    <p className="text-sm text-red-600 mt-1">{errors.name.message}</p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    {...register("description")}
                    placeholder="Enter project description"
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="customerId">Customer *</Label>
                  <Select
                    value={selectedCustomerId}
                    onValueChange={(value) => setValue("customerId", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.length === 0 ? (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">
                          No customers available
                        </div>
                      ) : (
                        Array.isArray(customers) && customers.map((customer) => (
                          <SelectItem key={customer.id} value={customer.id}>
                            {customer.name}
                            {customer.contactPerson && ` (${customer.contactPerson})`}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {errors.customerId && (
                    <p className="text-sm text-red-600 mt-1">{errors.customerId.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="projectType">Project Type *</Label>
                  <Select
                    value={selectedProjectType}
                    onValueChange={(value) => setValue("projectType", value as ProjectFormData['projectType'])}
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
            </CardContent>
          </Card>

          {/* Project Location */}
          <Card>
            <CardHeader>
              <CardTitle>Project Location</CardTitle>
              <CardDescription>
                Enter the project address and location details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    {...register("address")}
                    placeholder="Enter project address (e.g., 123 Main Street)"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      {...register("city")}
                      placeholder="Enter city"
                    />
                  </div>

                  <div>
                    <Label htmlFor="postalCode">Postal Code</Label>
                    <Input
                      id="postalCode"
                      {...register("postalCode")}
                      placeholder="Enter postal code"
                    />
                  </div>

                  <div>
                    <Label htmlFor="country">Country</Label>
                    <Input
                      id="country"
                      {...register("country")}
                      placeholder="Enter country"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Status and Priority */}
          <Card>
            <CardHeader>
              <CardTitle>Status and Priority</CardTitle>
              <CardDescription>
                Set the current status and priority level
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="status">Status *</Label>
                  <Select
                    value={selectedStatus}
                    onValueChange={(value) => setValue("status", value as ProjectFormData['status'])}
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
                  <Label htmlFor="priority">Priority *</Label>
                  <Select
                    value={selectedPriority}
                    onValueChange={(value) => setValue("priority", value as ProjectFormData['priority'])}
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

                <div className="md:col-span-2">
                  <Label htmlFor="progress">Progress (%)</Label>
                  <div className="flex items-center space-x-4">
                    <Input
                      id="progress"
                      type="number"
                      min="0"
                      max="100"
                      {...register("progress", {
                        valueAsNumber: true,
                        min: 0,
                        max: 100
                      })}
                      className="w-32"
                    />
                    <div className="flex-1">
                      <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-red-600 h-2 rounded-full transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-sm font-medium">{progress}%</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
              <CardDescription>
                Set project start and end dates
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startDate">Start Date</Label>
                  <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !startDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={(date) => {
                          setValue("startDate", date)
                          setStartDateOpen(false)
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div>
                  <Label htmlFor="endDate">End Date</Label>
                  <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !endDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {endDate ? format(endDate, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={(date) => {
                          setValue("endDate", date)
                          setEndDateOpen(false)
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contract & Budget */}
          <Card>
            <CardHeader>
              <CardTitle>Contract & Budget</CardTitle>
              <CardDescription>
                Set contract value, budget and upload contract documents
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="contractValue">Contract Value ($)</Label>
                  <Input
                    id="contractValue"
                    type="number"
                    step="0.01"
                    {...register("contractValue", { valueAsNumber: true })}
                    placeholder="0.00"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Updated automatically when VOs are approved
                  </p>
                </div>

                <div>
                  <Label htmlFor="estimatedBudget">Estimated Budget ($)</Label>
                  <Input
                    id="estimatedBudget"
                    type="number"
                    step="0.01"
                    {...register("estimatedBudget", { valueAsNumber: true })}
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <Label htmlFor="actualCost">Actual Cost ($)</Label>
                  <Input
                    id="actualCost"
                    type="number"
                    step="0.01"
                    {...register("actualCost", { valueAsNumber: true })}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="contractDocument">Contract Document (PO/Signed Quotation)</Label>
                <Input
                  id="contractDocument"
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      // Handle file upload
                      console.log('[Project Edit] Contract document selected:', file.name)
                      setValue("contractDocument", file)
                    }
                  }}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Upload signed PO or quotation from client (PDF, DOC, DOCX)
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Assignment */}
          <Card>
            <CardHeader>
              <CardTitle>Team Assignment</CardTitle>
              <CardDescription>
                Assign project manager and sales personnel
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="managerId">Project Manager</Label>
                  <Select
                    value={selectedManagerId || "no-manager"}
                    onValueChange={(value) => setValue("managerId", value === "no-manager" ? undefined : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select project manager" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no-manager">No Manager</SelectItem>
                      {users.length === 0 ? (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">
                          No users available
                        </div>
                      ) : (
                        Array.isArray(users) && users
                          .filter((user) => user.role === 'PROJECT_MANAGER' || user.role === 'SUPERADMIN')
                          .map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.firstName} {user.lastName}
                            </SelectItem>
                          ))
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500 mt-1">
                    Only Project Managers and Super Admins are shown
                  </p>
                </div>

                <div>
                  <SalesPersonnelSelect
                    value={watch("salespersonId")}
                    onValueChange={(value) => setValue("salespersonId", value)}
                    label="Sales Personnel"
                    placeholder="Select sales personnel"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end space-x-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push(`/projects/${projectId}`)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-red-600 hover:bg-red-700"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </MainLayout>
  )
}
