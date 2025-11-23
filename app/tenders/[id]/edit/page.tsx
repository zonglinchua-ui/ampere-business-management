
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
import { NASLinkInput } from "@/components/ui/nas-link"
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
  customerNumber: string | null
  email?: string | null
  contactPerson?: string | null
}

interface User {
  id: string
  firstName: string
  lastName: string
  email: string
}

interface TenderFormData {
  title: string
  description?: string
  customerId: string
  estimatedValue?: number
  submissionDeadline: Date
  openDate: Date
  closeDate?: Date
  status: 'OPEN' | 'SUBMITTED' | 'WON' | 'LOST' | 'EXPIRED'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  requirements?: string
  contactPerson?: string
  contactEmail?: string
  contactPhone?: string
  location?: string
  category: 'CONSTRUCTION' | 'ENGINEERING' | 'SUPPLY' | 'CONSULTING' | 'MAINTENANCE' | 'INSTALLATION' | 'GENERAL'
  nasDocumentPath?: string
  assignedToId?: string
  salespersonId?: string
}

export default function EditTenderPage() {
  const router = useRouter()
  const params = useParams()
  const tenderId = params?.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [openDateOpen, setOpenDateOpen] = useState(false)
  const [submissionDateOpen, setSubmissionDateOpen] = useState(false)
  const [closeDateOpen, setCloseDateOpen] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<TenderFormData>({
    defaultValues: {
      priority: 'MEDIUM',
      category: 'GENERAL',
      status: 'OPEN',
      openDate: new Date(),
      submissionDeadline: new Date()
    }
  })

  // Register required fields that are controlled by Select components
  register("customerId", { required: "Customer selection is required" })
  register("submissionDeadline", { required: "Submission deadline is required" })
  register("status", { required: "Status is required" })

  const openDate = watch('openDate')
  const submissionDeadline = watch('submissionDeadline')
  const closeDate = watch('closeDate')
  const selectedCustomerId = watch('customerId')
  const selectedStatus = watch('status')
  const selectedCategory = watch('category')
  const selectedPriority = watch('priority')
  const selectedAssignedToId = watch('assignedToId')

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log(`[Edit Tender] Fetching data for tender: ${tenderId}`)

        // Fetch tender details
        const tenderResponse = await fetch(`/api/tenders/${tenderId}`)
        if (!tenderResponse.ok) {
          if (tenderResponse.status === 404) {
            toast.error('Tender not found')
            router.push('/tenders')
            return
          }
          throw new Error('Failed to fetch tender')
        }
        const tender = await tenderResponse.json()
        console.log(`[Edit Tender] Successfully loaded tender: ${tender.tenderNumber}`)

        // Pre-fill form with tender data
        reset({
          title: tender.title,
          description: tender.description || '',
          customerId: tender.customerId,
          estimatedValue: tender.estimatedValue || undefined,
          submissionDeadline: new Date(tender.submissionDeadline),
          openDate: new Date(tender.openDate),
          closeDate: tender.closeDate ? new Date(tender.closeDate) : undefined,
          status: tender.status,
          priority: tender.priority,
          requirements: tender.requirements || '',
          contactPerson: tender.contactPerson || '',
          contactEmail: tender.contactEmail || '',
          contactPhone: tender.contactPhone || '',
          location: tender.location || '',
          category: tender.category,
          nasDocumentPath: tender.nasDocumentPath || '',
          assignedToId: tender.assignedTo?.id || undefined,
          salespersonId: tender.salesperson?.id || undefined
        })

        // Fetch customers
        const customersResponse = await fetch('/api/customers/list?limit=500')
        if (customersResponse.ok) {
          const customersData = await customersResponse.json()
          setCustomers(customersData.customers || [])
        }

        // Fetch users for assignment
        const usersResponse = await fetch('/api/users')
        if (usersResponse.ok) {
          const usersData = await usersResponse.json()
          setUsers(usersData)
        }

        setLoading(false)
      } catch (error) {
        console.error('[Edit Tender] Error fetching data:', error)
        toast.error('Failed to load tender data')
        router.push('/tenders')
      }
    }

    if (tenderId) {
      fetchData()
    }
  }, [tenderId, reset, router])

  const onSubmit = async (data: TenderFormData) => {
    setSaving(true)
    
    try {
      console.log(`[Edit Tender] Updating tender: ${tenderId}`)
      
      const response = await fetch(`/api/tenders/${tenderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          estimatedValue: data.estimatedValue ? parseFloat(data.estimatedValue.toString()) : null,
          submissionDeadline: data.submissionDeadline.toISOString(),
          openDate: data.openDate.toISOString(),
          closeDate: data.closeDate ? data.closeDate.toISOString() : null
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to update tender')
      }

      const updatedTender = await response.json()
      console.log(`[Edit Tender] Successfully updated tender: ${updatedTender.tenderNumber}`)
      
      toast.success('Tender updated successfully!')
      router.push(`/tenders/${tenderId}`)
    } catch (error) {
      console.error('[Edit Tender] Error updating tender:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update tender. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="p-6">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <Loader2 className="h-12 w-12 animate-spin text-red-600 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">Loading tender data...</p>
            </div>
          </div>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="p-6">
        <div className="mb-6">
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/tenders/${tenderId}`)}
              className="flex items-center"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Tender Details
            </Button>
          </div>
          <div className="mt-4">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Edit Tender</h1>
            <p className="text-gray-600 dark:text-gray-300 mt-2">
              Update the tender information
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Form */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Tender Information</CardTitle>
                  <CardDescription>
                    Update the basic details of the tender opportunity
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Title */}
                  <div className="space-y-2">
                    <Label htmlFor="title">Tender Title *</Label>
                    <Input
                      id="title"
                      {...register("title", { required: "Title is required" })}
                      placeholder="Enter tender title"
                    />
                    {errors.title && (
                      <p className="text-sm text-red-600 flex items-center">
                        <AlertCircle className="w-4 h-4 mr-1" />
                        {errors.title.message}
                      </p>
                    )}
                  </div>

                  {/* Description */}
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      {...register("description")}
                      placeholder="Enter tender description and overview"
                      rows={4}
                    />
                  </div>

                  {/* Customer */}
                  <div className="space-y-2">
                    <Label>Customer *</Label>
                    <Select 
                      value={selectedCustomerId}
                      onValueChange={(value) => setValue("customerId", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a customer" />
                      </SelectTrigger>
                      <SelectContent>
                        {customers.length === 0 ? (
                          <SelectItem value="no-customers" disabled>
                            No customers available
                          </SelectItem>
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
                    {errors.customerId && (
                      <p className="text-sm text-red-600 flex items-center">
                        <AlertCircle className="w-4 h-4 mr-1" />
                        Customer selection is required
                      </p>
                    )}
                  </div>

                  {/* Estimated Value */}
                  <div className="space-y-2">
                    <Label htmlFor="estimatedValue">Estimated Value ($)</Label>
                    <Input
                      id="estimatedValue"
                      type="number"
                      step="0.01"
                      {...register("estimatedValue", { 
                        min: { value: 0, message: "Value must be positive" }
                      })}
                      placeholder="Enter estimated project value"
                    />
                    {errors.estimatedValue && (
                      <p className="text-sm text-red-600 flex items-center">
                        <AlertCircle className="w-4 h-4 mr-1" />
                        {errors.estimatedValue.message}
                      </p>
                    )}
                  </div>

                  {/* Status */}
                  <div className="space-y-2">
                    <Label>Status *</Label>
                    <Select 
                      value={selectedStatus}
                      onValueChange={(value) => setValue("status", value as any)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="OPEN">Open</SelectItem>
                        <SelectItem value="SUBMITTED">Submitted</SelectItem>
                        <SelectItem value="WON">Won</SelectItem>
                        <SelectItem value="LOST">Lost</SelectItem>
                        <SelectItem value="EXPIRED">Expired</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.status && (
                      <p className="text-sm text-red-600 flex items-center">
                        <AlertCircle className="w-4 h-4 mr-1" />
                        Status is required
                      </p>
                    )}
                  </div>

                  {/* Category and Priority */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Select 
                        value={selectedCategory}
                        onValueChange={(value) => setValue("category", value as any)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="GENERAL">General</SelectItem>
                          <SelectItem value="CONSTRUCTION">Construction</SelectItem>
                          <SelectItem value="ENGINEERING">Engineering</SelectItem>
                          <SelectItem value="SUPPLY">Supply</SelectItem>
                          <SelectItem value="CONSULTING">Consulting</SelectItem>
                          <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                          <SelectItem value="INSTALLATION">Installation</SelectItem>
                          <SelectItem value="REINSTATEMENT">Reinstatement</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Priority</Label>
                      <Select 
                        value={selectedPriority}
                        onValueChange={(value) => setValue("priority", value as any)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="LOW">Low</SelectItem>
                          <SelectItem value="MEDIUM">Medium</SelectItem>
                          <SelectItem value="HIGH">High</SelectItem>
                          <SelectItem value="URGENT">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Location */}
                  <div className="space-y-2">
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      {...register("location")}
                      placeholder="Enter project location"
                    />
                  </div>

                  {/* Requirements */}
                  <div className="space-y-2">
                    <Label htmlFor="requirements">Requirements & Specifications</Label>
                    <Textarea
                      id="requirements"
                      {...register("requirements")}
                      placeholder="Enter detailed requirements and specifications"
                      rows={4}
                    />
                  </div>

                  {/* NAS Document Path */}
                  <NASLinkInput
                    value={watch("nasDocumentPath") || ""}
                    onChange={(value) => setValue("nasDocumentPath", value)}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Dates Card */}
              <Card>
                <CardHeader>
                  <CardTitle>Important Dates</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Open Date */}
                  <div className="space-y-2">
                    <Label>Open Date *</Label>
                    <Popover open={openDateOpen} onOpenChange={setOpenDateOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !openDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {openDate ? format(openDate, "PPP") : <span>Pick a date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={openDate}
                          onSelect={(date) => {
                            setValue("openDate", date || new Date())
                            setOpenDateOpen(false)
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Submission Deadline */}
                  <div className="space-y-2">
                    <Label>Submission Deadline *</Label>
                    <Popover open={submissionDateOpen} onOpenChange={setSubmissionDateOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !submissionDeadline && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {submissionDeadline ? format(submissionDeadline, "PPP") : <span>Pick a date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={submissionDeadline}
                          onSelect={(date) => {
                            setValue("submissionDeadline", date || new Date())
                            setSubmissionDateOpen(false)
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    {errors.submissionDeadline && (
                      <p className="text-sm text-red-600 flex items-center">
                        <AlertCircle className="w-4 h-4 mr-1" />
                        Submission deadline is required
                      </p>
                    )}
                  </div>

                  {/* Close Date */}
                  <div className="space-y-2">
                    <Label>Close Date (Optional)</Label>
                    <Popover open={closeDateOpen} onOpenChange={setCloseDateOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !closeDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {closeDate ? format(closeDate, "PPP") : <span>Pick a date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={closeDate}
                          onSelect={(date) => {
                            setValue("closeDate", date || undefined)
                            setCloseDateOpen(false)
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </CardContent>
              </Card>

              {/* Contact Information Card */}
              <Card>
                <CardHeader>
                  <CardTitle>Contact Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="contactPerson">Contact Person</Label>
                    <Input
                      id="contactPerson"
                      {...register("contactPerson")}
                      placeholder="Primary contact name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contactEmail">Contact Email</Label>
                    <Input
                      id="contactEmail"
                      type="email"
                      {...register("contactEmail")}
                      placeholder="contact@example.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contactPhone">Contact Phone</Label>
                    <Input
                      id="contactPhone"
                      {...register("contactPhone")}
                      placeholder="+65 1234 5678"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Assignment Card */}
              <Card>
                <CardHeader>
                  <CardTitle>Assignment</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Assigned To</Label>
                    <Select 
                      value={selectedAssignedToId || "unassigned"}
                      onValueChange={(value) => setValue("assignedToId", value === "unassigned" ? undefined : value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select team member" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.firstName} {user.lastName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <SalesPersonnelSelect
                      value={watch("salespersonId") || ""}
                      onValueChange={(value) => setValue("salespersonId", value || undefined)}
                      label="Sales Personnel"
                      placeholder="Select sales personnel"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Action Buttons */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex flex-col space-y-3">
                    <Button 
                      type="submit" 
                      disabled={isSubmitting || saving}
                      className="w-full bg-red-600 hover:bg-red-700"
                    >
                      {(isSubmitting || saving) ? (
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
                    
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => router.push(`/tenders/${tenderId}`)}
                      className="w-full"
                      disabled={isSubmitting || saving}
                    >
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </form>
      </div>
    </MainLayout>
  )
}
