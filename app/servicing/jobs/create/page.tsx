
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
import { ArrowLeft, Save, Loader2 } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

interface ServiceContract {
  id: string
  contractNo: string
  title: string
  serviceType: string
  frequency: string
  customer: {
    id: string
    name: string
    customerNumber: string
  }
  project?: {
    id: string
    name: string
    projectNumber: string
  }
}

interface User {
  id: string
  firstName: string
  lastName: string
  email: string
  role: string
}

interface Supplier {
  id: string
  name: string
  email: string
  phone: string
}

export default function CreateJobPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [contracts, setContracts] = useState<ServiceContract[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loadingData, setLoadingData] = useState(true)

  const [formData, setFormData] = useState({
    contractId: '',
    scheduledDate: '',
    assignedToType: 'Staff' as 'Staff' | 'Supplier',
    assignedToId: '',
    completionNotes: ''
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [contractsRes, usersRes, suppliersRes] = await Promise.all([
        fetch('/api/servicing/contracts'),
        fetch('/api/users/list'),
        fetch('/api/suppliers/list')
      ])

      if (contractsRes.ok) {
        const contractsData = await contractsRes.json()
        setContracts(contractsData)
      }

      if (usersRes.ok) {
        const usersData = await usersRes.json()
        setUsers(usersData.users || usersData)
      }

      if (suppliersRes.ok) {
        const suppliersData = await suppliersRes.json()
        setSuppliers(suppliersData.suppliers || suppliersData)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Failed to load form data')
    } finally {
      setLoadingData(false)
    }
  }

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))

    // Reset assigned person when type changes
    if (field === 'assignedToType') {
      setFormData(prev => ({
        ...prev,
        assignedToId: ''
      }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.contractId) {
      toast.error('Please select a service contract')
      return
    }

    if (!formData.scheduledDate) {
      toast.error('Please set a scheduled date')
      return
    }

    if (!formData.assignedToId) {
      toast.error('Please assign the job to someone')
      return
    }

    setLoading(true)

    try {
      const selectedContract = contracts.find(c => c.id === formData.contractId)
      if (!selectedContract) {
        throw new Error('Selected contract not found')
      }

      const payload = {
        contractId: formData.contractId,
        customerId: selectedContract.customer.id,
        projectId: selectedContract.project?.id || null,
        assignedToType: formData.assignedToType,
        assignedToId: formData.assignedToId,
        scheduledDate: formData.scheduledDate,
        completionNotes: formData.completionNotes || null,
        status: 'Scheduled'
      }

      const response = await fetch('/api/servicing/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create job')
      }

      const data = await response.json()
      toast.success('Service job created successfully!')
      router.push('/servicing/jobs')
    } catch (error) {
      console.error('Error creating job:', error)
      toast.error(`Failed to create job: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const userRole = session?.user?.role
  const canCreate = ["SUPERADMIN", "PROJECT_MANAGER", "ADMIN"].includes(userRole || "")

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
                You don't have permission to create service jobs.
              </p>
              <Link href="/servicing/jobs">
                <Button variant="outline">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Jobs
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    )
  }

  if (loadingData) {
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
              Create Service Job
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Schedule a new maintenance job
            </p>
          </div>
          <Link href="/servicing/jobs">
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
              <CardTitle>Job Details</CardTitle>
              <CardDescription>
                Create a new service job for an existing contract
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Service Contract */}
              <div className="space-y-2">
                <Label htmlFor="contractId">Service Contract *</Label>
                <Select
                  value={formData.contractId}
                  onValueChange={(value) => handleChange('contractId', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a service contract" />
                  </SelectTrigger>
                  <SelectContent>
                    {contracts.map((contract) => (
                      <SelectItem key={contract.id} value={contract.id}>
                        <div>
                          <div className="font-medium">{contract.contractNo}</div>
                          <div className="text-sm text-gray-500">
                            {contract.customer.name} - {contract.serviceType}
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formData.contractId && (
                  <div className="text-sm text-gray-500 mt-2">
                    {(() => {
                      const contract = contracts.find(c => c.id === formData.contractId)
                      return contract ? (
                        <div>
                          <p><strong>Customer:</strong> {contract.customer.name}</p>
                          <p><strong>Service Type:</strong> {contract.serviceType}</p>
                          <p><strong>Frequency:</strong> {contract.frequency}</p>
                          {contract.project && (
                            <p><strong>Project:</strong> {contract.project.name}</p>
                          )}
                        </div>
                      ) : null
                    })()}
                  </div>
                )}
              </div>

              {/* Scheduled Date */}
              <div className="space-y-2">
                <Label htmlFor="scheduledDate">Scheduled Date *</Label>
                <Input
                  id="scheduledDate"
                  type="datetime-local"
                  value={formData.scheduledDate}
                  onChange={(e) => handleChange('scheduledDate', e.target.value)}
                  required
                />
                <p className="text-sm text-muted-foreground">
                  When should this service job be performed?
                </p>
              </div>

              {/* Assignment Type */}
              <div className="space-y-2">
                <Label htmlFor="assignedToType">Assign To *</Label>
                <Select
                  value={formData.assignedToType}
                  onValueChange={(value) => handleChange('assignedToType', value as 'Staff' | 'Supplier')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Staff">Internal Staff</SelectItem>
                    <SelectItem value="Supplier">External Supplier</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Assignment Target */}
              <div className="space-y-2">
                <Label htmlFor="assignedToId">
                  {formData.assignedToType === 'Staff' ? 'Staff Member' : 'Supplier'} *
                </Label>
                <Select
                  value={formData.assignedToId}
                  onValueChange={(value) => handleChange('assignedToId', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={`Select ${formData.assignedToType === 'Staff' ? 'a staff member' : 'a supplier'}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {formData.assignedToType === 'Staff' 
                      ? users.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.firstName} {user.lastName} ({user.role})
                          </SelectItem>
                        ))
                      : suppliers.map((supplier) => (
                          <SelectItem key={supplier.id} value={supplier.id}>
                            {supplier.name}
                          </SelectItem>
                        ))
                    }
                  </SelectContent>
                </Select>
              </div>

              {/* Completion Notes */}
              <div className="space-y-2">
                <Label htmlFor="completionNotes">Initial Notes (Optional)</Label>
                <Textarea
                  id="completionNotes"
                  value={formData.completionNotes}
                  onChange={(e) => handleChange('completionNotes', e.target.value)}
                  placeholder="Any initial notes or special instructions for this job..."
                  rows={4}
                />
              </div>

              {/* Submit Button */}
              <div className="flex items-center justify-end space-x-4 pt-4">
                <Link href="/servicing/jobs">
                  <Button type="button" variant="outline" disabled={loading}>
                    Cancel
                  </Button>
                </Link>
                <Button type="submit" disabled={loading} className="bg-red-600 hover:bg-red-700">
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating Job...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Create Job
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
