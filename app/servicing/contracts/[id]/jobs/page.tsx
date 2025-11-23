
'use client'

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter, useParams } from "next/navigation"
import { MainLayout } from "@/components/layout/main-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { 
  ArrowLeft,
  Calendar,
  Plus,
  Trash2,
  Save,
  Loader2,
  RefreshCw,
  Clock,
  CheckCircle,
  AlertTriangle
} from "lucide-react"
import Link from "next/link"
import { format, addDays, addMonths } from "date-fns"
import { toast } from "sonner"

interface ServiceContract {
  id: string
  contractNo: string
  title: string
  frequency: string
  startDate: string
  endDate: string
  customer: {
    name: string
    customerNumber: string
  }
  project?: {
    name: string
    projectNumber: string
  }
}

interface ServiceJob {
  id: string
  scheduledDate: string
  status: string
  assignedUser?: {
    firstName: string
    lastName: string
  }
  assignedSupplier?: {
    name: string
  }
}

interface SuggestedDate {
  date: string
  isExisting: boolean
}

export default function ContractJobsManagementPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const params = useParams()
  const contractId = params.id as string
  
  const [contract, setContract] = useState<ServiceContract | null>(null)
  const [existingJobs, setExistingJobs] = useState<ServiceJob[]>([])
  const [suggestedDates, setSuggestedDates] = useState<string[]>([])
  const [selectedDates, setSelectedDates] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [assignToSupplier, setAssignToSupplier] = useState(false)
  const [clearExisting, setClearExisting] = useState(false)
  const [notes, setNotes] = useState('')
  const [customDate, setCustomDate] = useState('')

  useEffect(() => {
    if (contractId) {
      fetchContractData()
      fetchExistingJobs()
      fetchSuggestedDates()
    }
  }, [contractId])

  const fetchContractData = async () => {
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
    }
  }

  const fetchExistingJobs = async () => {
    try {
      const response = await fetch(`/api/servicing/jobs?contractId=${contractId}`)
      if (response.ok) {
        const data = await response.json()
        setExistingJobs(data)
      }
    } catch (error) {
      console.error('Error fetching existing jobs:', error)
    }
  }

  const fetchSuggestedDates = async () => {
    try {
      const response = await fetch(`/api/servicing/contracts/${contractId}/jobs/generate?months=12`)
      if (response.ok) {
        const data = await response.json()
        setSuggestedDates(data.suggestedDates || [])
        // Pre-select future dates that don't already have jobs
        const existingDates = new Set(existingJobs.map(job => 
          new Date(job.scheduledDate).toISOString().split('T')[0]
        ))
        const futureDates = data.suggestedDates.filter((dateStr: string) => {
          const date = new Date(dateStr)
          const dateKey = date.toISOString().split('T')[0]
          return date > new Date() && !existingDates.has(dateKey)
        })
        setSelectedDates(futureDates.slice(0, 4)) // Pre-select next 4 dates
      }
    } catch (error) {
      console.error('Error fetching suggested dates:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDateToggle = (dateStr: string) => {
    setSelectedDates(prev => {
      if (prev.includes(dateStr)) {
        return prev.filter(d => d !== dateStr)
      } else {
        return [...prev, dateStr].sort()
      }
    })
  }

  const addCustomDate = () => {
    if (!customDate) {
      toast.error('Please select a date')
      return
    }

    const customDateTime = new Date(customDate + 'T09:00:00').toISOString()
    if (selectedDates.includes(customDateTime)) {
      toast.error('Date already selected')
      return
    }

    setSelectedDates(prev => [...prev, customDateTime].sort())
    setCustomDate('')
  }

  const removeSelectedDate = (dateStr: string) => {
    setSelectedDates(prev => prev.filter(d => d !== dateStr))
  }

  const generateJobs = async () => {
    if (selectedDates.length === 0) {
      toast.error('Please select at least one date')
      return
    }

    setGenerating(true)

    try {
      const response = await fetch(`/api/servicing/contracts/${contractId}/jobs/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          scheduledDates: selectedDates,
          assignToSupplier,
          clearExisting,
          notes: notes.trim() || null
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to generate jobs')
      }

      const data = await response.json()
      toast.success(`${data.jobsGenerated} jobs generated successfully!`)
      
      // Refresh data
      await fetchExistingJobs()
      await fetchSuggestedDates()
      
      // Reset form
      setSelectedDates([])
      setNotes('')
      setClearExisting(false)
    } catch (error) {
      console.error('Error generating jobs:', error)
      toast.error(`Failed to generate jobs: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setGenerating(false)
    }
  }

  const getJobStatusIcon = (status: string, scheduledDate: string) => {
    const isPast = new Date(scheduledDate) < new Date()
    const isOverdue = isPast && !['Completed', 'Endorsed'].includes(status)
    
    if (isOverdue) return <AlertTriangle className="h-4 w-4 text-red-500" />
    
    switch (status) {
      case 'Completed':
      case 'Endorsed': return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'InProgress': return <Clock className="h-4 w-4 text-yellow-500" />
      default: return <Clock className="h-4 w-4 text-blue-500" />
    }
  }

  const getJobStatusColor = (status: string, scheduledDate: string) => {
    const isPast = new Date(scheduledDate) < new Date()
    const isOverdue = isPast && !['Completed', 'Endorsed'].includes(status)
    
    if (isOverdue) return 'bg-red-100 text-red-800'
    
    switch (status) {
      case 'Scheduled': return 'bg-blue-100 text-blue-800'
      case 'InProgress': return 'bg-yellow-100 text-yellow-800'
      case 'Completed': return 'bg-green-100 text-green-800'
      case 'Endorsed': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const userRole = session?.user?.role
  const canManage = ["SUPERADMIN", "PROJECT_MANAGER", "ADMIN"].includes(userRole || "")

  if (!canManage) {
    return (
      <MainLayout>
        <div className="container mx-auto p-6">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Access Denied
              </h3>
              <p className="text-gray-500 text-center mb-6">
                You don't have permission to manage service jobs.
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

  if (loading || !contract) {
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
          <div className="flex items-center space-x-4">
            <Link href={`/servicing/contracts/${contractId}`}>
              <Button variant="outline" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Job Schedule Management
              </h1>
              <p className="text-gray-600 dark:text-gray-300">
                Contract: {contract.contractNo} - {contract.title}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Schedule Generator */}
          <div className="lg:col-span-2 space-y-6">
            {/* Existing Jobs */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Calendar className="mr-2 h-5 w-5" />
                  Current Schedule ({existingJobs.length} jobs)
                </CardTitle>
                <CardDescription>
                  Existing jobs for this contract
                </CardDescription>
              </CardHeader>
              <CardContent>
                {existingJobs.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Scheduled Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Assigned To</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {existingJobs.map((job) => (
                          <TableRow key={job.id}>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                {getJobStatusIcon(job.status, job.scheduledDate)}
                                <div>
                                  <p className="font-medium">{format(new Date(job.scheduledDate), 'MMM dd, yyyy')}</p>
                                  <p className="text-sm text-gray-500">{format(new Date(job.scheduledDate), 'EEEE, p')}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={getJobStatusColor(job.status, job.scheduledDate)}>
                                {job.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {job.assignedUser ? (
                                <div>
                                  <p className="font-medium">{job.assignedUser.firstName} {job.assignedUser.lastName}</p>
                                  <p className="text-sm text-gray-500">Internal Staff</p>
                                </div>
                              ) : job.assignedSupplier ? (
                                <div>
                                  <p className="font-medium">{job.assignedSupplier.name}</p>
                                  <p className="text-sm text-gray-500">External Supplier</p>
                                </div>
                              ) : (
                                <span className="text-gray-400">Unassigned</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Link href={`/servicing/jobs/${job.id}`}>
                                <Button variant="outline" size="sm">
                                  View
                                </Button>
                              </Link>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No jobs scheduled yet</p>
                    <p className="text-sm text-gray-400">Use the schedule generator to create jobs</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Schedule Generator */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Plus className="mr-2 h-5 w-5" />
                  Generate Schedule
                </CardTitle>
                <CardDescription>
                  Create service jobs with automatic or custom dates
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Suggested Dates */}
                <div>
                  <Label className="text-sm font-medium mb-3 block">
                    Suggested Dates (Based on {contract.frequency} frequency)
                  </Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                    {suggestedDates.map((dateStr) => {
                      const date = new Date(dateStr)
                      const isPast = date < new Date()
                      const isSelected = selectedDates.includes(dateStr)
                      const hasExistingJob = existingJobs.some(job => 
                        new Date(job.scheduledDate).toDateString() === date.toDateString()
                      )

                      return (
                        <div
                          key={dateStr}
                          className={`
                            p-3 rounded-lg border cursor-pointer transition-all
                            ${isSelected 
                              ? 'bg-blue-50 border-blue-300 text-blue-800' 
                              : hasExistingJob
                              ? 'bg-gray-50 border-gray-200 text-gray-500 cursor-not-allowed'
                              : isPast
                              ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed'
                              : 'bg-white border-gray-200 hover:border-gray-300'
                            }
                          `}
                          onClick={() => {
                            if (!isPast && !hasExistingJob) {
                              handleDateToggle(dateStr)
                            }
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{format(date, 'MMM dd, yyyy')}</p>
                              <p className="text-sm opacity-75">{format(date, 'EEEE')}</p>
                            </div>
                            <div className="text-right">
                              {hasExistingJob && <Badge variant="outline" className="text-[10px] px-1 py-0">Exists</Badge>}
                              {isPast && !hasExistingJob && <Badge variant="secondary" className="text-xs">Past</Badge>}
                              {isSelected && <Badge className="text-xs">Selected</Badge>}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Custom Date Addition */}
                <div className="border-t pt-4">
                  <Label htmlFor="customDate" className="text-sm font-medium mb-2 block">
                    Add Custom Date
                  </Label>
                  <div className="flex items-center space-x-2">
                    <Input
                      id="customDate"
                      type="date"
                      value={customDate}
                      onChange={(e) => setCustomDate(e.target.value)}
                      min={format(new Date(), 'yyyy-MM-dd')}
                    />
                    <Button type="button" variant="outline" onClick={addCustomDate}>
                      Add
                    </Button>
                  </div>
                </div>

                {/* Selected Dates Summary */}
                {selectedDates.length > 0 && (
                  <div>
                    <Label className="text-sm font-medium mb-2 block">
                      Selected Dates ({selectedDates.length})
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {selectedDates.map((dateStr) => (
                        <Badge
                          key={dateStr}
                          variant="secondary"
                          className="flex items-center space-x-1"
                        >
                          <span>{format(new Date(dateStr), 'MMM dd')}</span>
                          <button
                            type="button"
                            onClick={() => removeSelectedDate(dateStr)}
                            className="ml-1 hover:text-red-600"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Generation Options */}
          <div className="space-y-6">
            {/* Contract Info */}
            <Card>
              <CardHeader>
                <CardTitle>Contract Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-gray-500">Customer</p>
                  <p className="font-medium">{contract.customer.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Frequency</p>
                  <p className="font-medium">{contract.frequency}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Contract Period</p>
                  <p className="text-sm">
                    {format(new Date(contract.startDate), 'MMM dd, yyyy')} - {format(new Date(contract.endDate), 'MMM dd, yyyy')}
                  </p>
                </div>
                {contract.project && (
                  <div>
                    <p className="text-sm text-gray-500">Project</p>
                    <p className="font-medium">{contract.project.name}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Generation Options */}
            <Card>
              <CardHeader>
                <CardTitle>Generation Options</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Assignment Options */}
                <div className="flex items-center justify-between">
                  <Label htmlFor="assignToSupplier">Assign to Supplier</Label>
                  <Switch
                    id="assignToSupplier"
                    checked={assignToSupplier}
                    onCheckedChange={setAssignToSupplier}
                  />
                </div>
                <p className="text-sm text-gray-500">
                  Jobs will be assigned to external suppliers instead of internal staff
                </p>

                <div className="flex items-center justify-between">
                  <Label htmlFor="clearExisting">Clear Scheduled Jobs</Label>
                  <Switch
                    id="clearExisting"
                    checked={clearExisting}
                    onCheckedChange={setClearExisting}
                  />
                </div>
                <p className="text-sm text-gray-500">
                  Remove existing scheduled jobs before generating new ones
                </p>

                {/* Notes */}
                <div>
                  <Label htmlFor="notes">Initial Notes (Optional)</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add any initial notes or instructions for these jobs..."
                    rows={3}
                  />
                </div>

                {/* Generate Button */}
                <Button 
                  onClick={generateJobs} 
                  disabled={generating || selectedDates.length === 0}
                  className="w-full bg-red-600 hover:bg-red-700"
                >
                  {generating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating Jobs...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Generate {selectedDates.length} Jobs
                    </>
                  )}
                </Button>

                {/* Refresh Suggestions */}
                <Button 
                  variant="outline" 
                  onClick={fetchSuggestedDates}
                  className="w-full"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh Suggestions
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  )
}
