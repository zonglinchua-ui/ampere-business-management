
'use client'

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { MainLayout } from "@/components/layout/main-layout"
import { ServicingNavigation } from "@/components/servicing/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Calendar,
  Clock,
  CheckCircle,
  AlertTriangle,
  Users,
  Building2,
  Wrench,
  FileText,
  TrendingUp,
  Plus
} from "lucide-react"
import Link from "next/link"

interface DashboardStats {
  jobsDueThisWeek: number
  overdueJobs: number
  completedJobsThisMonth: number
  totalActiveContracts: number
  vendorJobs: number
  internalJobs: number
  jobsByServiceType: {
    [key: string]: number
  }
}

interface ServiceJob {
  id: string
  scheduledDate: string
  status: string
  completedAt?: string
  assignedToType: string
  contract: {
    serviceType?: string
  }
}

export default function ServicingDashboardPage() {
  const { data: session } = useSession()
  const [stats, setStats] = useState<DashboardStats>({
    jobsDueThisWeek: 0,
    overdueJobs: 0,
    completedJobsThisMonth: 0,
    totalActiveContracts: 0,
    vendorJobs: 0,
    internalJobs: 0,
    jobsByServiceType: {}
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardStats()
  }, [])

  const fetchDashboardStats = async () => {
    try {
      // Fetch real data from APIs
      const [contractsResponse, jobsResponse] = await Promise.all([
        fetch('/api/servicing/contracts'),
        fetch('/api/servicing/jobs')
      ])

      const contracts = contractsResponse.ok ? await contractsResponse.json() : []
      const jobs = jobsResponse.ok ? await jobsResponse.json() : []

      // Calculate stats from real data
      const now = new Date()
      const weekFromNow = new Date()
      weekFromNow.setDate(now.getDate() + 7)
      
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      
      const jobsDueThisWeek = jobs.filter((job: ServiceJob) => {
        const scheduledDate = new Date(job.scheduledDate)
        return scheduledDate >= now && scheduledDate <= weekFromNow && job.status === 'Scheduled'
      }).length

      const overdueJobs = jobs.filter((job: ServiceJob) => {
        const scheduledDate = new Date(job.scheduledDate)
        return scheduledDate < now && !['Completed', 'Endorsed'].includes(job.status)
      }).length

      const completedJobsThisMonth = jobs.filter((job: ServiceJob) => {
        return job.completedAt && new Date(job.completedAt) >= startOfMonth && 
               ['Completed', 'Endorsed'].includes(job.status)
      }).length

      const vendorJobs = jobs.filter((job: ServiceJob) => job.assignedToType === 'Vendor').length
      const internalJobs = jobs.filter((job: ServiceJob) => job.assignedToType === 'Staff').length

      // Group jobs by service type
      const jobsByServiceType = jobs.reduce((acc: {[key: string]: number}, job: ServiceJob) => {
        const serviceType = job.contract?.serviceType || 'Other'
        acc[serviceType] = (acc[serviceType] || 0) + 1
        return acc
      }, {})

      setStats({
        jobsDueThisWeek,
        overdueJobs,
        completedJobsThisMonth,
        totalActiveContracts: contracts.length,
        vendorJobs,
        internalJobs,
        jobsByServiceType
      })
      setLoading(false)
    } catch (error) {
      console.error('Error fetching dashboard stats:', error)
      // Set empty stats on error
      setStats({
        jobsDueThisWeek: 0,
        overdueJobs: 0,
        completedJobsThisMonth: 0,
        totalActiveContracts: 0,
        vendorJobs: 0,
        internalJobs: 0,
        jobsByServiceType: {}
      })
      setLoading(false)
    }
  }

  const userRole = session?.user?.role
  const canCreateContracts = ["SUPERADMIN", "PROJECT_MANAGER"].includes(userRole || "")

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
              Servicing & Maintenance
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Plan, track, and complete servicing jobs for clients
            </p>
          </div>
          <div className="flex items-center space-x-2">
            {canCreateContracts && (
              <Link href="/servicing/contracts/create">
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  New Contract
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Navigation */}
        <ServicingNavigation />

        <div className="mt-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Jobs Due This Week
                  </CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">
                    {stats.jobsDueThisWeek}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Scheduled for next 7 days
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Overdue Jobs
                  </CardTitle>
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">
                    {stats.overdueJobs}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Requires immediate attention
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Completed This Month
                  </CardTitle>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {stats.completedJobsThisMonth}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Successfully completed jobs
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Active Contracts
                  </CardTitle>
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {stats.totalActiveContracts}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Currently active service contracts
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Empty State or Additional Stats and Charts */}
            {stats.totalActiveContracts === 0 && stats.internalJobs + stats.vendorJobs === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Building2 className="h-16 w-16 text-gray-400 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    No Service Contracts Yet
                  </h3>
                  <p className="text-gray-500 text-center mb-6">
                    Get started by creating your first service contract to begin scheduling and managing maintenance jobs.
                  </p>
                  {canCreateContracts && (
                    <Link href="/servicing/contracts">
                      <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        Create First Contract
                      </Button>
                    </Link>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Vendor vs Internal Jobs */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Users className="mr-2 h-5 w-5" />
                      Job Assignment
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="w-4 h-4 bg-blue-500 rounded mr-2"></div>
                          <span>Internal Staff</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">{stats.internalJobs}</span>
                          <Badge variant="outline">
                            {stats.internalJobs + stats.vendorJobs > 0 
                              ? Math.round((stats.internalJobs / (stats.internalJobs + stats.vendorJobs)) * 100)
                              : 0}%
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="w-4 h-4 bg-purple-500 rounded mr-2"></div>
                          <span>External Vendors</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">{stats.vendorJobs}</span>
                          <Badge variant="outline">
                            {stats.internalJobs + stats.vendorJobs > 0 
                              ? Math.round((stats.vendorJobs / (stats.internalJobs + stats.vendorJobs)) * 100)
                              : 0}%
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Jobs by Service Type */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Wrench className="mr-2 h-5 w-5" />
                      Jobs by Service Type
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Object.entries(stats.jobsByServiceType).length > 0 ? (
                        Object.entries(stats.jobsByServiceType).map(([type, count]) => (
                          <div key={type} className="flex items-center justify-between">
                            <span className="text-sm font-medium">{type}</span>
                            <div className="flex items-center space-x-2">
                              <div className="w-24 h-2 bg-gray-200 rounded-full">
                                <div 
                                  className="h-2 bg-blue-500 rounded-full"
                                  style={{ 
                                    width: `${(count / Math.max(...Object.values(stats.jobsByServiceType))) * 100}%` 
                                  }}
                                ></div>
                              </div>
                              <span className="text-sm font-bold">{count}</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-4">
                          <p className="text-gray-500 text-sm">No jobs scheduled yet</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
        </div>
      </div>
    </MainLayout>
  )
}
