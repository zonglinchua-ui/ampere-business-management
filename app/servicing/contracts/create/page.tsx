
'use client'

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { MainLayout } from "@/components/layout/main-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DynamicSelect } from "@/components/ui/dynamic-select"
import { ArrowLeft, Save, Loader2 } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { addYears } from "date-fns"

// No need for interface definitions - DynamicSelect handles data fetching

export default function CreateContractPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const [formData, setFormData] = useState({
    title: '',
    customerId: '',
    projectId: '',
    serviceType: 'Electrical',
    frequency: 'Monthly',
    startDate: '',
    endDate: '',
    supplierId: '' // Single supplier selection
  })

  // Auto-calculate end date (+1 year from start date)
  useEffect(() => {
    if (formData.startDate && !formData.endDate) {
      const startDate = new Date(formData.startDate)
      const endDate = new Date(startDate)
      endDate.setFullYear(endDate.getFullYear() + 1)
      setFormData(prev => ({
        ...prev,
        endDate: endDate.toISOString().split('T')[0]
      }))
    }
  }, [formData.startDate])

  const handleChange = (field: string, value: string | string[]) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    console.log("[Create Contract] Form submitted with data:", formData)

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

    // Validate end date is after start date
    if (new Date(formData.endDate) <= new Date(formData.startDate)) {
      toast.error("End date must be after start date")
      return
    }

    setLoading(true)

    try {
      const payload = {
        title: formData.title.trim(),
        customerId: formData.customerId,
        projectId: formData.projectId || null,
        serviceType: formData.serviceType,
        frequency: formData.frequency,
        startDate: formData.startDate,
        endDate: formData.endDate,
        supplierIds: formData.supplierId ? [formData.supplierId] : [] // Convert single selection to array
      }

      console.log("[Create Contract] Sending payload:", payload)

      const response = await fetch('/api/servicing/contracts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      const data = await response.json()

      if (!response.ok) {
        console.error("[Create Contract] API error response:", data)
        throw new Error(data.error || data.details || 'Failed to create contract')
      }

      console.log("[Create Contract] Success:", data)
      toast.success(`✅ Contract ${data.contractNo} created successfully!`)
      
      // Redirect to contracts list
      router.push('/servicing/contracts')
    } catch (error) {
      console.error("[Create Contract] Error:", error)
      toast.error(`❌ ${error instanceof Error ? error.message : 'Failed to create contract'}`)
    } finally {
      setLoading(false)
    }
  }

  const userRole = session?.user?.role
  const canCreate = ["SUPERADMIN", "PROJECT_MANAGER"].includes(userRole || "")

  if (!canCreate) {
    return (
      <MainLayout>
        <div className="container mx-auto p-6">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Access Denied
              </h3>
              <p className="text-gray-500 text-center mb-6">
                You don't have permission to create service contracts.
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

  return (
    <MainLayout>
      <div className="container mx-auto p-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Create Service Contract
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Set up a new service and maintenance contract
            </p>
          </div>
          <Link href="/servicing/contracts">
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
                Enter the service contract information. Required fields are marked with *
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
                <p className="text-sm text-muted-foreground">
                  A descriptive title for this service contract
                </p>
              </div>

              {/* Customer Selection */}
              <div className="space-y-2">
                <Label htmlFor="customerId">Customer *</Label>
                <DynamicSelect
                  entity="customer"
                  value={formData.customerId}
                  onValueChange={(value) => handleChange('customerId', value)}
                  placeholder="Search and select a customer..."
                />
                <p className="text-sm text-muted-foreground">
                  Type to search for the customer this contract is for
                </p>
              </div>

              {/* Project Selection (Optional) */}
              <div className="space-y-2">
                <Label htmlFor="projectId">Project (Optional)</Label>
                <DynamicSelect
                  entity="project"
                  value={formData.projectId}
                  onValueChange={(value) => handleChange('projectId', value)}
                  placeholder="Search and select a project..."
                  disabled={!formData.customerId}
                  allowClear={true}
                />
                <p className="text-sm text-muted-foreground">
                  Link this contract to a specific project if applicable
                </p>
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
                <p className="text-sm text-muted-foreground">
                  Type of service covered by this contract
                </p>
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
                <p className="text-sm text-muted-foreground">
                  How often servicing should be performed
                </p>
              </div>

              {/* Supplier Selection */}
              <div className="space-y-2">
                <Label htmlFor="supplierId">Supplier Name (Optional)</Label>
                <DynamicSelect
                  entity="supplier"
                  value={formData.supplierId}
                  onValueChange={(value) => handleChange('supplierId', value)}
                  placeholder="Search and select a supplier..."
                  allowClear={true}
                />
                <p className="text-sm text-muted-foreground">
                  Select a supplier who will service this contract
                </p>
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
                  <p className="text-sm text-muted-foreground">
                    Contract start date
                  </p>
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
                  <p className="text-sm text-muted-foreground">
                    Contract end date (auto-set to +1 year, editable)
                  </p>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex items-center justify-end space-x-4 pt-4">
                <Link href="/servicing/contracts">
                  <Button type="button" variant="outline" disabled={loading}>
                    Cancel
                  </Button>
                </Link>
                <Button type="submit" disabled={loading} className="bg-red-600 hover:bg-red-700">
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating Contract...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Create Contract
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
