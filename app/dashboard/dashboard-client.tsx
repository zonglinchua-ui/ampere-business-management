
'use client'

import { useEffect, useState } from "react"
import { Session } from "next-auth"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { 
  Users, 
  FolderOpen, 
  FileText, 
  TrendingUp, 
  Clock, 
  AlertCircle,
  CheckCircle2,
  DollarSign,
  Building,
  Calendar,
  ArrowUpRight,
  Activity,
  RefreshCcw,
  Package
} from "lucide-react"
import Link from "next/link"
import { motion } from "framer-motion"
import { useRouter } from "next/navigation"
import dynamic from 'next/dynamic'

// Lazy load ProjectMap to avoid blocking dashboard render
const ProjectMap = dynamic(() => import('@/components/dashboard/ProjectMap'), { 
  ssr: false,
  loading: () => (
    <Card>
      <CardContent className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400">Loading map...</p>
        </div>
      </CardContent>
    </Card>
  )
})

import { ProjectInvoiceAlerts } from '@/components/dashboard/project-invoice-alerts'

interface DashboardClientProps {
  session: Session
}

interface DashboardSummary {
  success?: boolean
  activeProjects: number
  activeProjectValue: number
  totalActiveProjectValue: number
  projectValueYTD: number
  totalProjectValueYTD: number
  projectValueMTD: number
  totalProjectValueMTD: number
  projectCountYTD: number
  projectCountMTD: number
  outstandingTasks: number
  myTasks: Task[]
  outstandingTenders: number
  upcomingDeadlines: Deadline[]
  recentActivities: RecentActivity[]
  lastUpdated: string
  fromCache?: boolean
}

interface Task {
  id: string
  title: string
  dueDate: string | null
  priority: string
  status: string
}

interface RecentActivity {
  action: string
  user: string
  entity: string
  timeAgo: string
  timestamp: string
}

interface Deadline {
  id: string
  project: string
  dueDate: string
  status: string
  priority: string
}

interface ProjectLocation {
  id: string
  projectNumber: string
  name: string
  address?: string
  latitude?: number
  longitude?: number
  progress: number
  status: string
  manager?: {
    firstName?: string
    lastName?: string
    name?: string
  }
  customer?: {
    name: string
  }
}

export function DashboardClient({ session }: DashboardClientProps) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [projectsWithLocation, setProjectsWithLocation] = useState<ProjectLocation[]>([])
  const router = useRouter()

  const userRole = session.user?.role
  
  // Fetch project location data for the map
  const fetchProjectLocations = async () => {
    try {
      const response = await fetch('/api/projects/map', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      if (!response.ok) {
        console.error('Failed to fetch project locations')
        return
      }

      const data = await response.json()
      
      if (data.success) {
        // Use projects with coordinates for the map
        const mapProjects = data.projectsWithCoordinates || data.projects.filter((p: any) => p.latitude && p.longitude)
        setProjectsWithLocation(mapProjects)
        
        console.log('Project locations loaded:', {
          total: data.stats?.total || data.count,
          withCoordinates: data.stats?.withCoordinates || mapProjects.length,
          needingGeocoding: data.stats?.needingGeocoding || 0,
        })
      }
    } catch (error) {
      console.error('Error fetching project locations:', error)
      // Don't set error state for map data - it's not critical
    }
  }

  // Fetch dashboard summary from new API endpoint
  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch('/api/dashboard/summary', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || errorData.message || 'Failed to fetch dashboard summary')
      }

      const data = await response.json()
      
      // Validate response has success flag
      if (data.success === false) {
        throw new Error(data.message || data.error || 'Failed to fetch dashboard summary')
      }
      
      setSummary(data)
      setLoading(false)
      
      console.log('Dashboard data loaded successfully:', {
        activeProjects: data.activeProjects,
        outstandingTasks: data.outstandingTasks,
        outstandingTenders: data.outstandingTenders,
        fromCache: data.fromCache
      })
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to load dashboard data'
      setError(errorMessage)
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
    fetchProjectLocations()
  }, [])

  // Auto-refresh every 2 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      fetchDashboardData()
      fetchProjectLocations()
    }, 2 * 60 * 1000) // 2 minutes

    return () => clearInterval(interval)
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'IN_PROGRESS':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case 'PLANNING':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      case 'ON_HOLD':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
      case 'TODO':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
      case 'IN_REVIEW':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      case 'HIGH':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
      case 'MEDIUM':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case 'LOW':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-SG', {
      style: 'currency',
      currency: 'SGD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  if (loading && !summary) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !summary) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Error Loading Dashboard</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">{error || 'Failed to load dashboard data'}</p>
            <Button onClick={fetchDashboardData} variant="outline">
              <RefreshCcw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Defensive array normalization - ensure all arrays are actually arrays
  const safeMyTasks = Array.isArray(summary.myTasks) ? summary.myTasks : []
  const safeUpcomingDeadlines = Array.isArray(summary.upcomingDeadlines) ? summary.upcomingDeadlines : []
  const safeRecentActivities = Array.isArray(summary.recentActivities) ? summary.recentActivities : []

  // Log warning if data types are incorrect
  if (!Array.isArray(summary.myTasks)) {
    console.warn('[Dashboard] myTasks is not an array:', typeof summary.myTasks, summary.myTasks)
  }
  if (!Array.isArray(summary.upcomingDeadlines)) {
    console.warn('[Dashboard] upcomingDeadlines is not an array:', typeof summary.upcomingDeadlines, summary.upcomingDeadlines)
  }
  if (!Array.isArray(summary.recentActivities)) {
    console.warn('[Dashboard] recentActivities is not an array:', typeof summary.recentActivities, summary.recentActivities)
  }

  return (
    <div className="p-6 space-y-6">
      {/* Welcome header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Welcome back, {session.user?.firstName || session.user?.name}
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Here's your project, task, and tender overview.
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <Button
            onClick={fetchDashboardData}
            disabled={loading}
            variant="outline"
            size="sm"
            className="flex items-center space-x-2"
          >
            <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
          </Button>
          <div className="flex items-center space-x-2">
            <Calendar className="h-5 w-5 text-gray-400" />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {new Date().toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </span>
          </div>
        </div>
      </div>

      {/* Invoice Reminders */}
      <ProjectInvoiceAlerts />

      {/* Key metrics - Projects, Tenders, Tasks */}
      <div className={`grid grid-cols-1 md:grid-cols-2 ${userRole === 'SUPERADMIN' ? 'lg:grid-cols-3' : 'lg:grid-cols-3'} gap-6`}>
        {/* 1. Active Projects */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card 
            className="hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => router.push('/projects')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
              <FolderOpen className="h-5 w-5 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{summary.activeProjects.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Currently ongoing projects
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* 2. Total Active Project Value - Only for Superadmin */}
        {userRole === 'SUPERADMIN' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Active Project Value</CardTitle>
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-emerald-600">
                  {formatCurrency(summary.totalActiveProjectValue || summary.activeProjectValue)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {summary.activeProjects} active {summary.activeProjects === 1 ? 'project' : 'projects'}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* 3. Total Project Value (YTD) - Only for Superadmin */}
        {userRole === 'SUPERADMIN' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Project Value (YTD)</CardTitle>
                <DollarSign className="h-5 w-5 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">
                  {formatCurrency(summary.totalProjectValueYTD || summary.projectValueYTD)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {summary.projectCountYTD} {summary.projectCountYTD === 1 ? 'project' : 'projects'} started this year
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* 4. Total Project Value (MTD) - Only for Superadmin */}
        {userRole === 'SUPERADMIN' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Project Value (MTD)</CardTitle>
                <DollarSign className="h-5 w-5 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-purple-600">
                  {formatCurrency(summary.totalProjectValueMTD || summary.projectValueMTD)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {summary.projectCountMTD} {summary.projectCountMTD === 1 ? 'project' : 'projects'} started this month
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* 5. Outstanding Tasks */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card 
            className="hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => router.push('/tasks')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Outstanding Tasks</CardTitle>
              <CheckCircle2 className="h-5 w-5 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-600">{summary.outstandingTasks.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Assigned to you, not yet completed
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* 6. Outstanding Tenders */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <Card 
            className="hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => router.push('/tenders')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Outstanding Tenders</CardTitle>
              <FileText className="h-5 w-5 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">{summary.outstandingTenders.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Open tenders pending submission
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Project Map */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <ProjectMap projects={projectsWithLocation} />
      </motion.div>

      {/* 3-Column Layout for Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* My Outstanding Tasks (Detailed) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-orange-600" />
                My Tasks
              </CardTitle>
              <CardDescription>Top 5 tasks assigned to you</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {safeMyTasks.length > 0 ? (
                  safeMyTasks.map((task, index) => (
                    <motion.div
                      key={task.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 + index * 0.05 }}
                      className="border rounded-lg p-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-medium text-sm flex-1">{task.title}</h4>
                        <Badge className={getPriorityColor(task.priority)} variant="outline">
                          {task.priority}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center text-gray-600 dark:text-gray-400">
                          <Calendar className="h-3 w-3 mr-1" />
                          {task.dueDate 
                            ? new Date(task.dueDate).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric'
                              })
                            : 'No due date'}
                        </div>
                        <Badge className={getStatusColor(task.status)} variant="outline">
                          {task.status.replace('_', ' ')}
                        </Badge>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No outstanding tasks</p>
                  </div>
                )}
              </div>
              {safeMyTasks.length > 0 && (
                <div className="mt-4">
                  <Link href="/tasks">
                    <Button variant="outline" size="sm" className="w-full">
                      View all my tasks
                      <ArrowUpRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Project Deadlines */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-red-600" />
                Project Deadlines
              </CardTitle>
              <CardDescription>Projects due in next 30 days</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {safeUpcomingDeadlines.length > 0 ? (
                  safeUpcomingDeadlines.map((deadline, index) => (
                    <motion.div
                      key={deadline.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.55 + index * 0.05 }}
                    >
                      <Link
                        href={`/projects/${deadline.id}`}
                        className="block border rounded-lg p-3 hover:bg-gray-50 dark:hover:bg-gray-800 hover:shadow-md transition-all"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-medium text-sm flex-1">{deadline.project}</h4>
                          <Badge className={getPriorityColor(deadline.priority)} variant="outline">
                            {deadline.priority}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center text-gray-600 dark:text-gray-400">
                            <Calendar className="h-3 w-3 mr-1" />
                            {new Date(deadline.dueDate).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </div>
                          <Badge className={getStatusColor(deadline.status)} variant="outline">
                            {deadline.status.replace('_', ' ')}
                          </Badge>
                        </div>
                      </Link>
                    </motion.div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No upcoming deadlines</p>
                  </div>
                )}
              </div>
              {safeUpcomingDeadlines.length > 0 && (
                <div className="mt-4">
                  <Link href="/projects">
                    <Button variant="outline" size="sm" className="w-full">
                      View all projects
                      <ArrowUpRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Activities */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-blue-600" />
                Recent Activities
              </CardTitle>
              <CardDescription>Latest updates across the system</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {safeRecentActivities.length > 0 ? (
                  safeRecentActivities.map((activity, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.6 + index * 0.05 }}
                      className="border-l-2 border-blue-500 pl-3 py-2"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            <span className="text-blue-600 dark:text-blue-400">{activity.action}</span>
                            {' • '}
                            {activity.entity}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            by {activity.user} • {activity.timeAgo}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <Activity className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No recent activities</p>
                  </div>
                )}
              </div>
              {safeRecentActivities.length > 0 && (
                <div className="mt-4">
                  <Link href="/settings/system-logs">
                    <Button variant="outline" size="sm" className="w-full">
                      View all activities
                      <ArrowUpRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="flex flex-wrap gap-4 justify-center"
      >
        <Link href="/projects">
          <Button className="bg-green-600 hover:bg-green-700">
            <FolderOpen className="mr-2 h-4 w-4" />
            Manage Projects
          </Button>
        </Link>
        <Link href="/tenders">
          <Button className="bg-red-600 hover:bg-red-700">
            <FileText className="mr-2 h-4 w-4" />
            Manage Tenders
          </Button>
        </Link>
        <Link href="/tasks">
          <Button className="bg-orange-600 hover:bg-orange-700">
            <CheckCircle2 className="mr-2 h-4 w-4" />
            View My Tasks
          </Button>
        </Link>
      </motion.div>

      {/* Last Updated Info */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="text-center text-xs text-gray-500 dark:text-gray-400"
      >
        Last updated: {new Date(summary.lastUpdated).toLocaleString()}
      </motion.div>
    </div>
  )
}
