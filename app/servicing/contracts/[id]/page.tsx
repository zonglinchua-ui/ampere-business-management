
'use client'

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter, useParams } from "next/navigation"
import { MainLayout } from "@/components/layout/main-layout"
import { ServicingNavigation } from "@/components/servicing/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { 
  ArrowLeft,
  Edit,
  Trash,
  Download,
  FileText,
  Building2,
  User,
  Calendar,
  Clock,
  Wrench,
  Users,
  Briefcase
} from "lucide-react"
import Link from "next/link"
import { format } from "date-fns"

interface ServiceContract {
  id: string
  contractNo: string
  title: string
  status: string
  serviceType: string
  frequency: string
  startDate: string
  endDate: string
  filePath?: string
  notes?: string
  createdAt: string
  updatedAt: string
  customer: {
    id: string
    name: string
    customerNumber: string
    email: string
    phone: string
    contactPerson?: string
  }
  project?: {
    id: string
    projectNumber: string
    name: string
    status: string
  }
  createdBy: {
    id: string
    firstName: string
    lastName: string
    email: string
  }
  suppliers: Array<{
    supplier: {
      id: string
      name: string
      supplierNumber: string | null
      email: string
      phone: string
      contactPerson?: string
    }
  }>
  _count: {
    jobs: number
  }
}

export default function ContractDetailPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const params = useParams()
  const contractId = params.id as string
  
  const [contract, setContract] = useState<ServiceContract | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (contractId) {
      fetchContract()
    }
  }, [contractId])

  const fetchContract = async () => {
    try {
      const response = await fetch(`/api/servicing/contracts/${contractId}`)
      if (response.ok) {
        const data = await response.json()
        setContract(data)
      } else {
        console.error('Failed to fetch contract')
        router.push('/servicing/contracts')
      }
    } catch (error) {
      console.error('Error fetching contract:', error)
      router.push('/servicing/contracts')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this service contract? This action cannot be undone.')) {
      return
    }

    try {
      const response = await fetch(`/api/servicing/contracts/${contractId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        router.push('/servicing/contracts')
      } else {
        alert('Failed to delete contract')
      }
    } catch (error) {
      console.error('Error deleting contract:', error)
      alert('Error deleting contract')
    }
  }

  const getServiceTypeColor = (serviceType: string) => {
    switch (serviceType) {
      case 'Electrical': return 'bg-yellow-100 text-yellow-800'
      case 'Mechanical': return 'bg-blue-100 text-blue-800'
      case 'Plumbing': return 'bg-cyan-100 text-cyan-800'
      case 'Sanitary': return 'bg-green-100 text-green-800'
      case 'Other': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getFrequencyColor = (frequency: string) => {
    switch (frequency) {
      case 'Monthly': return 'bg-red-100 text-red-800'
      case 'Quarterly': return 'bg-orange-100 text-orange-800'
      case 'BiAnnual': return 'bg-blue-100 text-blue-800'
      case 'Annual': return 'bg-green-100 text-green-800'
      case 'Custom': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return 'bg-green-100 text-green-800'
      case 'Expired': return 'bg-gray-100 text-gray-800'
      case 'Cancelled': return 'bg-red-100 text-red-800'
      case 'OnHold': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const userRole = session?.user?.role
  const canEdit = ["SUPERADMIN", "PROJECT_MANAGER"].includes(userRole || "")
  const canDelete = ["SUPERADMIN"].includes(userRole || "")

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

  if (!contract) {
    return (
      <MainLayout>
        <div className="container mx-auto p-6">
          <div className="text-center py-8">
            <p className="text-gray-500">Contract not found</p>
            <Link href="/servicing/contracts">
              <Button className="mt-4">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Contracts
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
            <Link href="/servicing/contracts">
              <Button variant="outline" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                {contract.title}
              </h1>
              <p className="text-gray-600 dark:text-gray-300">
                Contract #{contract.contractNo}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {canEdit && (
              <Link href={`/servicing/contracts/${contractId}/edit`}>
                <Button variant="outline">
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </Button>
              </Link>
            )}
            {canDelete && (
              <Button variant="destructive" onClick={handleDelete}>
                <Trash className="mr-2 h-4 w-4" />
                Delete
              </Button>
            )}
          </div>
        </div>

        {/* Navigation */}
        <ServicingNavigation />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Contract Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FileText className="mr-2 h-5 w-5" />
                  Contract Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Contract Number</p>
                    <p className="font-mono font-medium">{contract.contractNo}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Status</p>
                    <Badge className={getStatusColor(contract.status)}>
                      {contract.status}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Service Type</p>
                    <Badge className={getServiceTypeColor(contract.serviceType)}>
                      {contract.serviceType}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Frequency</p>
                    <Badge className={getFrequencyColor(contract.frequency)}>
                      {contract.frequency}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Start Date</p>
                    <p className="font-medium">{format(new Date(contract.startDate), 'MMMM dd, yyyy')}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">End Date</p>
                    <p className="font-medium">{format(new Date(contract.endDate), 'MMMM dd, yyyy')}</p>
                  </div>
                </div>

                {contract.notes && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-sm text-gray-500 mb-2">Notes</p>
                      <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                        {contract.notes}
                      </p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Customer Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Building2 className="mr-2 h-5 w-5" />
                  Customer Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-500">Company Name</p>
                    <p className="font-medium">{contract.customer.name}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Customer Number</p>
                      <p className="font-mono">{contract.customer.customerNumber}</p>
                    </div>
                    {contract.customer.contactPerson && (
                      <div>
                        <p className="text-sm text-gray-500">Contact Person</p>
                        <p>{contract.customer.contactPerson}</p>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Email</p>
                      <p>{contract.customer.email || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Phone</p>
                      <p>{contract.customer.phone || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Project Information */}
            {contract.project && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Briefcase className="mr-2 h-5 w-5" />
                    Project Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-gray-500">Project Name</p>
                      <p className="font-medium">{contract.project.name}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">Project Number</p>
                        <p className="font-mono">{contract.project.projectNumber}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Status</p>
                        <p>{contract.project.status}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Suppliers */}
            {contract.suppliers && contract.suppliers.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Users className="mr-2 h-5 w-5" />
                    Assigned Suppliers
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {contract.suppliers.map((supplierRel, index) => {
                      // Defensive check for supplier data
                      if (!supplierRel?.supplier) {
                        return null
                      }
                      
                      return (
                        <div key={index} className="border rounded-lg p-4">
                          <div className="space-y-2">
                            <div>
                              <p className="font-medium">{supplierRel.supplier.name || 'Unnamed Supplier'}</p>
                              <p className="text-sm text-gray-500">
                                {supplierRel.supplier.supplierNumber || 'No supplier number'}
                              </p>
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <p className="text-gray-500">Email</p>
                                <p>{supplierRel.supplier.email || 'N/A'}</p>
                              </div>
                              <div>
                                <p className="text-gray-500">Phone</p>
                                <p>{supplierRel.supplier.phone || 'N/A'}</p>
                              </div>
                            </div>
                            {supplierRel.supplier.contactPerson && (
                              <div className="text-sm">
                                <p className="text-gray-500">Contact Person</p>
                                <p>{supplierRel.supplier.contactPerson}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Link href={`/servicing/jobs?contractId=${contractId}`}>
                  <Button variant="outline" className="w-full justify-start">
                    <Wrench className="mr-2 h-4 w-4" />
                    View Jobs ({contract._count.jobs})
                  </Button>
                </Link>
                <Link href={`/servicing/contracts/${contractId}/jobs`}>
                  <Button variant="outline" className="w-full justify-start">
                    <Calendar className="mr-2 h-4 w-4" />
                    Manage Schedule
                  </Button>
                </Link>
                {contract.filePath && (
                  <Button variant="outline" className="w-full justify-start">
                    <Download className="mr-2 h-4 w-4" />
                    Download Contract
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Metadata */}
            <Card>
              <CardHeader>
                <CardTitle>Metadata</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-gray-500">Created By</p>
                  <p className="font-medium">
                    {contract.createdBy.firstName} {contract.createdBy.lastName}
                  </p>
                  <p className="text-sm text-gray-500">{contract.createdBy.email}</p>
                </div>
                <Separator />
                <div>
                  <p className="text-sm text-gray-500">Created</p>
                  <p>{format(new Date(contract.createdAt), 'MMMM dd, yyyy HH:mm')}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Last Updated</p>
                  <p>{format(new Date(contract.updatedAt), 'MMMM dd, yyyy HH:mm')}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  )
}
