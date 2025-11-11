
'use client'

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter, useParams } from "next/navigation"
import { MainLayout } from "@/components/layout/main-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Save, Loader2 } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

interface Customer {
  id: string
  name: string
  customerNumber: string | null
  email: string | null
  contactPerson: string | null
}

interface Project {
  id: string
  projectNumber: string
  name: string
}

interface Supplier {
  id: string
  name: string
  supplierNumber: string | null
  email: string | null
  phone: string | null
}

export default function EditContractPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const params = useParams()
  const contractId = params.id as string
  
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loadingCustomers, setLoadingCustomers] = useState(true)
  const [loadingProjects, setLoadingProjects] = useState(false)
  const [loadingSuppliers, setLoadingSuppliers] = useState(true)

  const [formData, setFormData] = useState({
    title: '',
    customerId: '',
    projectId: '',
    serviceType: 'Electrical',
    frequency: 'Monthly',
    startDate: '',
    endDate: '',
    status: 'Active',
    supplierId: '' // Single supplier selection
  })

  useEffect(() => {
    fetchCustomers()
    fetchSuppliers()
    fetchContract()
  }, [contractId])

  useEffect(() => {
    if (formData.customerId) {
      fetchProjectsForCustomer(formData.customerId)
    } else {
      setProjects([])
    }
  }, [formData.customerId])

  const fetchContract = async () => {
    try {
      const response = await fetch(`/api/servicing/contracts/${contractId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch contract')
      }
      const data = await response.json()
      
      // Pre-fill form with existing data
      setFormData({
        title: data.title || '',
        customerId: data.customer?.id || '',
        projectId: data.project?.id || '',
        serviceType: data.serviceType || 'Electrical',
        frequency: data.frequency || 'Monthly',
        startDate: data.startDate ? new Date(data.startDate).toISOString().split('T')[0] : '',
        endDate: data.endDate ? new Date(data.endDate).toISOString().split('T')[0] : '',
        status: data.status || 'Active',
        supplierId: data.suppliers && data.suppliers.length > 0 ? data.suppliers[0].supplier.id : ''
      })
    } catch (error) {
      console.error('Error fetching contract:', error)
      toast.error('Failed to load contract')
      router.push('/servicing/contracts')
    } finally {
      setInitialLoading(false)
    }
  }

  const fetchCustomers = async () => {
    try {
      const response = await fetch("/api/customers/list")
      if (!response.ok) {
        throw new Error("Failed to fetch customers")
      }
      const data = await response.json()
      
      // Defensive extraction: handle various response structures
      let customerList: Customer[] = []
      if (Array.isArray(data)) {
        customerList = data
      } else if (data && typeof data === 'object') {
        if (Array.isArray(data.customers)) {
          customerList = data.customers
        } else if (Array.isArray(data.data)) {
          customerList = data.data
        }
      }
      
      setCustomers(customerList)
    } catch (error) {
      console.error("Error fetching customers:", error)
      toast.error("Failed to load customers")
      setCustomers([])
    } finally {
      setLoadingCustomers(false)
    }
  }

  const fetchProjectsForCustomer = async (customerId: string) => {
    try {
      setLoadingProjects(true)
      const response = await fetch(`/api/projects?customerId=${customerId}`)
      if (response.ok) {
        const data = await response.json()
        const projectList = Array.isArray(data) ? data : (data.projects || data.data || [])
        setProjects(projectList)
      } else {
        setProjects([])
      }
    } catch (error) {
      console.error('Error fetching projects:', error)
      setProjects([])
    } finally {
      setLoadingProjects(false)
    }
  }

  const fetchSuppliers = async () => {
    try {
      const response = await fetch("/api/suppliers/list")
      if (!response.ok) {
        throw new Error("Failed to fetch suppliers")
      }
      const data = await response.json()
      const supplierList = data.suppliers || []
      setSuppliers(supplierList)
    } catch (error) {
      console.error("Error fetching suppliers:", error)
      toast.error("Failed to load suppliers")
      setSuppliers([])
    } finally {
      setLoadingSuppliers(false)
    }
  }

  const handleChange = (field: string, value: string | string[]) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    if (!formData.title || !formData.title.trim()) {
      toast.error("Please enter a contract title")
      return
    }

    if (!formData.customerId) {
      toast.error("Please select a customer")
      return
    }

    if (!formData.serviceType) {
      toast.error("Please select a service type")
      return
    }

    if (!formData.frequency) {
      toast.error("Please select a frequency")
      return
    }

    if (!formData.startDate || !formData.endDate) {
      toast.error("Please specify contract start and end dates")
      return
    }

    if (new Date(formData.endDate) <= new Date(formData.startDate)) {
      toast.error("End date must be after start date")
      return
    }

    setLoading(true)

    try {
      const payload = {
        title: formData.title.trim(),
        customerId: formData.customerId,
        projectId: formData.projectId && formData.projectId !== 'none' ? formData.projectId : null,
        serviceType: formData.serviceType,
        frequency: formData.frequency,
        startDate: formData.startDate,
        endDate: formData.endDate,
        status: formData.status,
        supplierIds: (formData.supplierId && formData.supplierId !== 'none') ? [formData.supplierId] : []
      }

      const response = await fetch(`/api/servicing/contracts/${contractId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || data.details || 'Failed to update contract')
      }

      toast.success(`✅ Contract updated successfully!`)
      router.push(`/servicing/contracts/${contractId}`)
    } catch (error) {
      console.error("Error updating contract:", error)
      toast.error(`❌ ${error instanceof Error ? error.message : 'Failed to update contract'}`)
    } finally {
      setLoading(false)
    }
  }

  const userRole = session?.user?.role
  const canEdit = ["SUPERADMIN", "PROJECT_MANAGER"].includes(userRole || "")

  if (!canEdit) {
    return (
      <MainLayout>
        <div className="container mx-auto p-6">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Access Denied
              </h3>
              <p className="text-gray-500 text-center mb-6">
                You don't have permission to edit service contracts.
              </p>
              <Link href="/servicing/contracts">
                <Button variant="outline">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Contracts
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    )
  }

  if (initialLoading) {
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

  return (
    <MainLayout>
      <div className="container mx-auto p-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Edit Service Contract
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Update service and maintenance contract details
            </p>
          </div>
          <Link href={`/servicing/contracts/${contractId}`}>
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </Link>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Contract Details</CardTitle>
              <CardDescription>
                Update the service contract information. Required fields are marked with *
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">Contract Title *</Label>
                <Input
                  id="title"
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleChange('title', e.target.value)}
                  placeholder="e.g., Annual Electrical Maintenance - ABC Company"
                  required
                />
              </div>

              {/* Status */}
              <div className="space-y-2">
                <Label htmlFor="status">Status *</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => handleChange('status', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="OnHold">On Hold</SelectItem>
                    <SelectItem value="Expired">Expired</SelectItem>
                    <SelectItem value="Cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Customer Selection */}
              <div className="space-y-2">
                <Label htmlFor="customerId">Customer *</Label>
                <Select
                  value={formData.customerId}
                  onValueChange={(value) => handleChange('customerId', value)}
                  disabled={loadingCustomers}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={loadingCustomers ? "Loading customers..." : "Select a customer"} />
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
                          {customer.customerNumber && ` (${customer.customerNumber})`}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Project Selection (Optional) */}
              <div className="space-y-2">
                <Label htmlFor="projectId">Project (Optional)</Label>
                <Select
                  value={formData.projectId}
                  onValueChange={(value) => handleChange('projectId', value)}
                  disabled={!formData.customerId || loadingProjects}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={
                      !formData.customerId 
                        ? "Select a customer first" 
                        : loadingProjects 
                        ? "Loading projects..."
                        : "Select a project (optional)"
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      <span className="text-muted-foreground">No project</span>
                    </SelectItem>
                    {Array.isArray(projects) && projects.length > 0 && projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                        {project.projectNumber && ` (${project.projectNumber})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Service Type */}
              <div className="space-y-2">
                <Label htmlFor="serviceType">Service Type *</Label>
                <Select
                  value={formData.serviceType}
                  onValueChange={(value) => handleChange('serviceType', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Electrical">Electrical</SelectItem>
                    <SelectItem value="Mechanical">Mechanical</SelectItem>
                    <SelectItem value="Plumbing">Plumbing</SelectItem>
                    <SelectItem value="Sanitary">Sanitary</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Service Frequency */}
              <div className="space-y-2">
                <Label htmlFor="frequency">Service Frequency *</Label>
                <Select
                  value={formData.frequency}
                  onValueChange={(value) => handleChange('frequency', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Monthly">Monthly</SelectItem>
                    <SelectItem value="Quarterly">Quarterly (Every 3 months)</SelectItem>
                    <SelectItem value="BiAnnual">Bi-Annual (Every 6 months)</SelectItem>
                    <SelectItem value="Annual">Annual (Once a year)</SelectItem>
                    <SelectItem value="Custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Supplier Selection */}
              <div className="space-y-2">
                <Label htmlFor="supplierId">Supplier Name (Optional)</Label>
                <Select
                  value={formData.supplierId}
                  onValueChange={(value) => handleChange('supplierId', value)}
                  disabled={loadingSuppliers}
                >
                  <SelectTrigger id="supplierId">
                    <SelectValue placeholder={loadingSuppliers ? "Loading suppliers..." : "Select a supplier"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Supplier</SelectItem>
                    {(Array.isArray(suppliers) ? suppliers : []).map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.name}
                        {supplier.supplierNumber && ` (${supplier.supplierNumber})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date *</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => handleChange('startDate', e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date *</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => handleChange('endDate', e.target.value)}
                    required
                    min={formData.startDate}
                  />
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex items-center justify-end space-x-4 pt-4">
                <Link href={`/servicing/contracts/${contractId}`}>
                  <Button type="button" variant="outline" disabled={loading}>
                    Cancel
                  </Button>
                </Link>
                <Button type="submit" disabled={loading} className="bg-red-600 hover:bg-red-700">
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating Contract...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Update Contract
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </MainLayout>
  )
}
