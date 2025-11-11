
'use client'

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { MainLayout } from "@/components/layout/main-layout"
import { ServicingNavigation } from "@/components/servicing/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { 
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Eye,
  Play,
  CheckCircle,
  FileText,
  Upload,
  DollarSign,
  Clock,
  AlertTriangle,
  Calendar
} from "lucide-react"
import Link from "next/link"
import { format } from "date-fns"

interface ServiceJob {
  id: string
  scheduledDate: string
  status: string
  completionNotes?: string
  completedAt?: string
  assignedToType: string
  contract: {
    id: string
    contractNo: string
    serviceType: string
    frequency: string
  }
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
  assignedUser?: {
    id: string
    firstName: string
    lastName: string
    email: string
    role: string
  }
  assignedSupplier?: {
    id: string
    name: string
    email: string
    phone: string
    contactPerson?: string
  }
  _count: {
    jobSheets: number
    vendorReports: number
    invoices: number
  }
}

export default function ServiceJobsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [jobs, setJobs] = useState<ServiceJob[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [assigneeTypeFilter, setAssigneeTypeFilter] = useState("all")
  const [clientFilter, setClientFilter] = useState("all")

  useEffect(() => {
    fetchJobs()
  }, [statusFilter, assigneeTypeFilter, clientFilter])

  const fetchJobs = async () => {
    try {
      const params = new URLSearchParams()
      if (statusFilter !== "all") params.append('status', statusFilter)
      if (assigneeTypeFilter !== "all") params.append('assignedToType', assigneeTypeFilter)
      if (clientFilter !== "all") params.append('clientId', clientFilter)

      const response = await fetch(`/api/servicing/jobs?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        setJobs(data)
      } else {
        console.error('Failed to fetch jobs')
      }
    } catch (error) {
      console.error('Error fetching jobs:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleStatusUpdate = async (jobId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/servicing/jobs/${jobId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      })

      if (response.ok) {
        fetchJobs() // Refresh the list
      } else {
        alert('Failed to update job status')
      }
    } catch (error) {
      console.error('Error updating job status:', error)
      alert('Error updating job status')
    }
  }

  const filteredJobs = jobs.filter(job => {
    const searchMatch = 
      job.contract.contractNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.project?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.contract.serviceType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (job.assignedUser && `${job.assignedUser.firstName} ${job.assignedUser.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (job.assignedSupplier?.name?.toLowerCase().includes(searchTerm.toLowerCase()))

    return searchMatch
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Scheduled': return 'bg-blue-100 text-blue-800'
      case 'InProgress': return 'bg-yellow-100 text-yellow-800'
      case 'Completed': return 'bg-green-100 text-green-800'
      case 'Endorsed': return 'bg-purple-100 text-purple-800'
      case 'Overdue': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
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

  const isOverdue = (scheduledDate: string, status: string) => {
    return new Date(scheduledDate) < new Date() && !['Completed', 'Endorsed'].includes(status)
  }

  const userRole = session?.user?.role
  const userId = session?.user?.id
  const canCreate = ["SUPERADMIN", "PROJECT_MANAGER"].includes(userRole || "")
  const canManageAll = ["SUPERADMIN", "PROJECT_MANAGER"].includes(userRole || "")

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

  return (
    <MainLayout>
      <div className="container mx-auto p-6 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Service Jobs
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Track and manage scheduled service jobs
            </p>
          </div>
          {canCreate && (
            <Link href="/servicing/jobs/create">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Job
              </Button>
            </Link>
          )}
        </div>

        {/* Navigation */}
        <ServicingNavigation />

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Scheduled</CardTitle>
              <Clock className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {jobs.filter(job => job.status === 'Scheduled').length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Progress</CardTitle>
              <Play className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {jobs.filter(job => job.status === 'InProgress').length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {jobs.filter(job => ['Completed', 'Endorsed'].includes(job.status)).length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overdue</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {jobs.filter(job => isOverdue(job.scheduledDate, job.status)).length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Search & Filter</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search jobs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Scheduled">Scheduled</SelectItem>
                  <SelectItem value="InProgress">In Progress</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="Endorsed">Endorsed</SelectItem>
                  <SelectItem value="Overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
              <Select value={assigneeTypeFilter} onValueChange={setAssigneeTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Assignee Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="Staff">Internal Staff</SelectItem>
                  <SelectItem value="Supplier">External Supplier</SelectItem>
                </SelectContent>
              </Select>
              <Select value={clientFilter} onValueChange={setClientFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Customer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Customers</SelectItem>
                  {/* In a real app, you'd populate this with actual customers */}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm("")
                  setStatusFilter("all")
                  setAssigneeTypeFilter("all")
                  setClientFilter("all")
                }}
              >
                <Filter className="mr-2 h-4 w-4" />
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Jobs Table */}
        <Card>
          <CardHeader>
            <CardTitle>Service Jobs ({filteredJobs.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contract</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Service Type</TableHead>
                    <TableHead>Scheduled Date</TableHead>
                    <TableHead>Assignee</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredJobs.map((job) => (
                    <TableRow key={job.id} className={isOverdue(job.scheduledDate, job.status) ? 'bg-red-50' : ''}>
                      <TableCell>
                        <div>
                          <p className="font-mono font-medium">{job.contract.contractNo}</p>
                          <Badge className="text-xs mt-1" variant="outline">
                            {job.contract.frequency}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{job.customer?.name || 'No Customer'}</p>
                          <p className="text-sm text-gray-500">{job.customer?.customerNumber || 'N/A'}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getServiceTypeColor(job.contract.serviceType)}>
                          {job.contract.serviceType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{format(new Date(job.scheduledDate), 'MMM dd, yyyy')}</p>
                          <p className="text-sm text-gray-500">{format(new Date(job.scheduledDate), 'EEEE')}</p>
                          {isOverdue(job.scheduledDate, job.status) && (
                            <Badge className="text-xs mt-1" variant="destructive">
                              <AlertTriangle className="mr-1 h-3 w-3" />
                              Overdue
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {job.assignedUser ? (
                          <div>
                            <p className="font-medium">{job.assignedUser.firstName} {job.assignedUser.lastName}</p>
                            <Badge variant="outline" className="text-[10px] px-1 py-0">Staff</Badge>
                          </div>
                        ) : job.assignedSupplier ? (
                          <div>
                            <p className="font-medium">{job.assignedSupplier?.name || 'Supplier'}</p>
                            <Badge variant="outline" className="text-[10px] px-1 py-0">Supplier</Badge>
                          </div>
                        ) : (
                          <span className="text-gray-400">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(job.status)}>
                          {job.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {job._count.jobSheets > 0 && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0">
                              <FileText className="mr-1 h-3 w-3" />
                              {job._count.jobSheets}
                            </Badge>
                          )}
                          {job._count.vendorReports > 0 && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0">
                              <Upload className="mr-1 h-3 w-3" />
                              {job._count.vendorReports}
                            </Badge>
                          )}
                          {job._count.invoices > 0 && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0">
                              <DollarSign className="mr-1 h-3 w-3" />
                              {job._count.invoices}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => router.push(`/servicing/jobs/${job.id}`)}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            
                            {(canManageAll || job.assignedUser?.id === userId) && job.status === 'Scheduled' && (
                              <DropdownMenuItem onClick={() => handleStatusUpdate(job.id, 'InProgress')}>
                                <Play className="mr-2 h-4 w-4" />
                                Start Job
                              </DropdownMenuItem>
                            )}
                            
                            {(canManageAll || job.assignedUser?.id === userId) && job.status === 'InProgress' && (
                              <DropdownMenuItem onClick={() => handleStatusUpdate(job.id, 'Completed')}>
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Mark Complete
                              </DropdownMenuItem>
                            )}
                            
                            <DropdownMenuSeparator />
                            
                            <DropdownMenuItem 
                              onClick={() => router.push(`/servicing/jobs/${job.id}`)}
                              disabled={job._count?.jobSheets === 0}
                            >
                              <FileText className="mr-2 h-4 w-4" />
                              View Job Sheets ({job._count?.jobSheets || 0})
                            </DropdownMenuItem>
                            
                            {job.assignedToType === 'Supplier' && (
                              <DropdownMenuItem 
                                onClick={() => router.push(`/servicing/jobs/${job.id}`)}
                                disabled={job._count?.vendorReports === 0}
                              >
                                <Upload className="mr-2 h-4 w-4" />
                                View Supplier Reports ({job._count?.vendorReports || 0})
                              </DropdownMenuItem>
                            )}
                            
                            <DropdownMenuItem 
                              onClick={() => router.push(`/servicing/jobs/${job.id}`)}
                              disabled={job._count?.invoices === 0}
                            >
                              <DollarSign className="mr-2 h-4 w-4" />
                              View Invoices ({job._count?.invoices || 0})
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              {filteredJobs.length === 0 && (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No service jobs found</p>
                  {canCreate && (
                    <Link href="/servicing/jobs/create">
                      <Button className="mt-2">
                        <Plus className="mr-2 h-4 w-4" />
                        Create First Job
                      </Button>
                    </Link>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}
