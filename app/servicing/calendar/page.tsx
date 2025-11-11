
'use client'

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { MainLayout } from "@/components/layout/main-layout"
import { ServicingNavigation } from "@/components/servicing/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  CheckCircle,
  AlertTriangle,
  User,
  Building2,
  Edit,
  X
} from "lucide-react"
import Link from "next/link"
import { format, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addMonths, isSameDay, isSameMonth, isToday, isPast } from "date-fns"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { toast } from "sonner"

interface ServiceJob {
  id: string
  scheduledDate: string
  status: string
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
  }
  project?: {
    id: string
    name: string
    projectNumber: string
  }
  assignedUser?: {
    id: string
    firstName: string
    lastName: string
  }
  assignedSupplier?: {
    id: string
    name: string
  }
}

type CalendarView = 'month' | 'week'

export default function ServicingCalendarPage() {
  const { data: session } = useSession()
  const [jobs, setJobs] = useState<ServiceJob[]>([])
  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<CalendarView>('month')
  const [selectedJob, setSelectedJob] = useState<ServiceJob | null>(null)
  const [isRescheduleDialogOpen, setIsRescheduleDialogOpen] = useState(false)
  const [newScheduledDate, setNewScheduledDate] = useState('')

  useEffect(() => {
    fetchJobs()
  }, [])

  const fetchJobs = async () => {
    try {
      const response = await fetch('/api/servicing/jobs')
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
      const updateData: any = { status: newStatus }
      
      // If marking as completed, set completed date
      if (newStatus === 'Completed') {
        updateData.completedAt = new Date().toISOString()
      }

      const response = await fetch(`/api/servicing/jobs/${jobId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      })

      if (response.ok) {
        fetchJobs() // Refresh jobs
        toast.success(`Job marked as ${newStatus}`)
      } else {
        toast.error('Failed to update job status')
      }
    } catch (error) {
      console.error('Error updating job status:', error)
      toast.error('Error updating job status')
    }
  }

  const handleReschedule = async () => {
    if (!selectedJob || !newScheduledDate) {
      toast.error('Please select a new date')
      return
    }

    try {
      const response = await fetch(`/api/servicing/jobs/${selectedJob.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          scheduledDate: newScheduledDate,
          status: 'Scheduled' // Reset to scheduled when rescheduling
        }),
      })

      if (response.ok) {
        fetchJobs() // Refresh jobs
        setIsRescheduleDialogOpen(false)
        setSelectedJob(null)
        setNewScheduledDate('')
        toast.success('Job rescheduled successfully')
      } else {
        toast.error('Failed to reschedule job')
      }
    } catch (error) {
      console.error('Error rescheduling job:', error)
      toast.error('Error rescheduling job')
    }
  }

  const getJobsForDate = (date: Date) => {
    return jobs.filter(job => 
      isSameDay(new Date(job.scheduledDate), date)
    )
  }

  const getStatusColor = (status: string, scheduledDate: string) => {
    const isOverdue = isPast(new Date(scheduledDate)) && !['Completed', 'Endorsed'].includes(status)
    
    if (isOverdue) return 'bg-red-100 text-red-800 border-red-200'
    
    switch (status) {
      case 'Scheduled': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'InProgress': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'Completed': return 'bg-green-100 text-green-800 border-green-200'
      case 'Endorsed': return 'bg-purple-100 text-purple-800 border-purple-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStatusIcon = (status: string, scheduledDate: string) => {
    const isOverdue = isPast(new Date(scheduledDate)) && !['Completed', 'Endorsed'].includes(status)
    
    if (isOverdue) return <AlertTriangle className="h-3 w-3" />
    
    switch (status) {
      case 'Scheduled': return <Clock className="h-3 w-3" />
      case 'InProgress': return <Clock className="h-3 w-3" />
      case 'Completed':
      case 'Endorsed': return <CheckCircle className="h-3 w-3" />
      default: return <Clock className="h-3 w-3" />
    }
  }

  const renderCalendarDays = () => {
    const start = startOfWeek(startOfMonth(currentDate))
    const end = endOfWeek(endOfMonth(currentDate))
    const days = []
    let day = start

    while (day <= end) {
      const dayJobs = getJobsForDate(day)
      const isCurrentMonth = isSameMonth(day, currentDate)
      const isCurrentDay = isToday(day)
      
      days.push(
        <div
          key={day.toISOString()}
          className={`
            min-h-32 p-2 border border-gray-200
            ${!isCurrentMonth ? 'bg-gray-50 text-gray-400' : 'bg-white'}
            ${isCurrentDay ? 'bg-blue-50 border-blue-300' : ''}
          `}
        >
          <div className={`text-sm font-medium mb-2 ${isCurrentDay ? 'text-blue-600' : ''}`}>
            {format(day, 'd')}
          </div>
          
          <div className="space-y-1">
            {dayJobs.slice(0, 3).map(job => {
              const isOverdue = isPast(new Date(job.scheduledDate)) && !['Completed', 'Endorsed'].includes(job.status)
              
              return (
                <div
                  key={job.id}
                  className={`
                    text-xs p-1 rounded cursor-pointer border
                    ${getStatusColor(job.status, job.scheduledDate)}
                    hover:opacity-80 transition-opacity
                  `}
                  onClick={() => setSelectedJob(job)}
                >
                  <div className="flex items-center space-x-1">
                    {getStatusIcon(job.status, job.scheduledDate)}
                    <span className="truncate">
                      {job.contract.contractNo}
                    </span>
                  </div>
                  <div className="truncate text-gray-600">
                    {job.customer.name}
                  </div>
                </div>
              )
            })}
            
            {dayJobs.length > 3 && (
              <div className="text-xs text-gray-500 p-1">
                +{dayJobs.length - 3} more
              </div>
            )}
          </div>
        </div>
      )
      day = addDays(day, 1)
    }

    return days
  }

  const renderWeekView = () => {
    const weekStart = startOfWeek(currentDate)
    const days = []

    for (let i = 0; i < 7; i++) {
      const day = addDays(weekStart, i)
      const dayJobs = getJobsForDate(day)
      const isCurrentDay = isToday(day)

      days.push(
        <div key={day.toISOString()} className="flex-1 border-r border-gray-200 last:border-r-0">
          <div className={`p-3 border-b border-gray-200 ${isCurrentDay ? 'bg-blue-50' : 'bg-gray-50'}`}>
            <div className={`text-sm font-medium ${isCurrentDay ? 'text-blue-600' : 'text-gray-900'}`}>
              {format(day, 'EEE d')}
            </div>
          </div>
          
          <div className="p-2 min-h-96 space-y-2">
            {dayJobs.map(job => (
              <div
                key={job.id}
                className={`
                  text-xs p-2 rounded cursor-pointer border
                  ${getStatusColor(job.status, job.scheduledDate)}
                  hover:opacity-80 transition-opacity
                `}
                onClick={() => setSelectedJob(job)}
              >
                <div className="flex items-center space-x-1 mb-1">
                  {getStatusIcon(job.status, job.scheduledDate)}
                  <span className="font-medium">{format(new Date(job.scheduledDate), 'HH:mm')}</span>
                </div>
                <div className="font-medium truncate">{job.contract.contractNo}</div>
                <div className="truncate text-gray-600">{job.customer.name}</div>
                <div className="truncate text-gray-500">{job.contract.serviceType}</div>
              </div>
            ))}
          </div>
        </div>
      )
    }

    return days
  }

  const userRole = session?.user?.role
  const canManage = ["SUPERADMIN", "PROJECT_MANAGER", "ADMIN"].includes(userRole || "")
  const userId = session?.user?.id

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
              Service Calendar
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              View and manage scheduled service jobs
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Select value={view} onValueChange={(value) => setView(value as CalendarView)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Month</SelectItem>
                <SelectItem value="week">Week</SelectItem>
              </SelectContent>
            </Select>
            {canManage && (
              <Link href="/servicing/jobs/create">
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  New Job
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Navigation */}
        <ServicingNavigation />

        <div className="mt-6">
          {/* Calendar Navigation */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentDate(addMonths(currentDate, -1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                {format(currentDate, 'MMMM yyyy')}
              </h2>
              
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentDate(addMonths(currentDate, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            
            <Button
              variant="outline"
              onClick={() => setCurrentDate(new Date())}
            >
              Today
            </Button>
          </div>

          {/* Calendar */}
          <Card>
            <CardContent className="p-0">
              {view === 'month' ? (
                <>
                  {/* Calendar Header */}
                  <div className="grid grid-cols-7 border-b border-gray-200">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                      <div key={day} className="p-3 text-center font-medium text-gray-500 border-r border-gray-200 last:border-r-0">
                        {day}
                      </div>
                    ))}
                  </div>
                  
                  {/* Calendar Days */}
                  <div className="grid grid-cols-7">
                    {renderCalendarDays()}
                  </div>
                </>
              ) : (
                <>
                  {/* Week Header */}
                  <div className="border-b border-gray-200 p-4">
                    <h3 className="text-lg font-medium">
                      {format(startOfWeek(currentDate), 'MMM d')} - {format(endOfWeek(currentDate), 'MMM d, yyyy')}
                    </h3>
                  </div>
                  
                  {/* Week View */}
                  <div className="flex">
                    {renderWeekView()}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Legend */}
          <Card className="mt-4">
            <CardContent className="p-4">
              <h3 className="font-medium mb-3">Legend</h3>
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-blue-100 border border-blue-200 rounded"></div>
                  <span className="text-sm">Scheduled</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-yellow-100 border border-yellow-200 rounded"></div>
                  <span className="text-sm">In Progress</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-green-100 border border-green-200 rounded"></div>
                  <span className="text-sm">Completed</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-red-100 border border-red-200 rounded"></div>
                  <span className="text-sm">Overdue</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Job Details Dialog */}
        <Dialog open={!!selectedJob} onOpenChange={() => setSelectedJob(null)}>
          <DialogContent className="max-w-2xl">
            {selectedJob && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center justify-between">
                    <span>Service Job Details</span>
                    <Badge className={getStatusColor(selectedJob.status, selectedJob.scheduledDate)}>
                      {selectedJob.status}
                    </Badge>
                  </DialogTitle>
                  <DialogDescription>
                    Contract: {selectedJob.contract.contractNo}
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Customer</Label>
                      <p className="font-medium">{selectedJob.customer.name}</p>
                      <p className="text-sm text-gray-500">{selectedJob.customer.customerNumber}</p>
                    </div>
                    
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Service Type</Label>
                      <p className="font-medium">{selectedJob.contract.serviceType}</p>
                      <p className="text-sm text-gray-500">Frequency: {selectedJob.contract.frequency}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Scheduled Date</Label>
                      <p className="font-medium">{format(new Date(selectedJob.scheduledDate), 'PPP')}</p>
                      <p className="text-sm text-gray-500">{format(new Date(selectedJob.scheduledDate), 'p')}</p>
                    </div>
                    
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Assigned To</Label>
                      {selectedJob.assignedUser ? (
                        <>
                          <p className="font-medium flex items-center">
                            <User className="mr-1 h-4 w-4" />
                            {selectedJob.assignedUser.firstName} {selectedJob.assignedUser.lastName}
                          </p>
                          <p className="text-sm text-gray-500">Internal Staff</p>
                        </>
                      ) : selectedJob.assignedSupplier ? (
                        <>
                          <p className="font-medium flex items-center">
                            <Building2 className="mr-1 h-4 w-4" />
                            {selectedJob.assignedSupplier.name}
                          </p>
                          <p className="text-sm text-gray-500">External Supplier</p>
                        </>
                      ) : (
                        <p className="text-gray-500">Unassigned</p>
                      )}
                    </div>
                  </div>

                  {selectedJob.project && (
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Project</Label>
                      <p className="font-medium">{selectedJob.project.name}</p>
                      <p className="text-sm text-gray-500">{selectedJob.project.projectNumber}</p>
                    </div>
                  )}

                  {selectedJob.completedAt && (
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Completed At</Label>
                      <p className="font-medium">{format(new Date(selectedJob.completedAt), 'PPP p')}</p>
                    </div>
                  )}
                  
                  {/* Action Buttons */}
                  {(canManage || selectedJob.assignedUser?.id === userId) && (
                    <div className="flex items-center space-x-2 pt-4 border-t">
                      {selectedJob.status === 'Scheduled' && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => handleStatusUpdate(selectedJob.id, 'InProgress')}
                          >
                            Start Job
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setNewScheduledDate(format(new Date(selectedJob.scheduledDate), 'yyyy-MM-dd\'T\'HH:mm'))
                              setIsRescheduleDialogOpen(true)
                            }}
                          >
                            <Edit className="mr-1 h-3 w-3" />
                            Reschedule
                          </Button>
                        </>
                      )}
                      
                      {selectedJob.status === 'InProgress' && (
                        <Button
                          size="sm"
                          onClick={() => handleStatusUpdate(selectedJob.id, 'Completed')}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="mr-1 h-3 w-3" />
                          Mark Complete
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Reschedule Dialog */}
        <Dialog open={isRescheduleDialogOpen} onOpenChange={setIsRescheduleDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reschedule Job</DialogTitle>
              <DialogDescription>
                Select a new date and time for this service job
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="newDate">New Scheduled Date & Time</Label>
                <Input
                  id="newDate"
                  type="datetime-local"
                  value={newScheduledDate}
                  onChange={(e) => setNewScheduledDate(e.target.value)}
                />
              </div>
              
              <div className="flex items-center justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsRescheduleDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleReschedule}>
                  Reschedule
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  )
}
