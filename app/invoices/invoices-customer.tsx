
'use client'

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  Plus, 
  Search, 
  Filter, 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  FileText, 
  DollarSign, 
  Calendar, 
  Building, 
  FolderOpen,
  Clock,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Receipt,
  Eye
} from "lucide-react"
import { toast } from "sonner"
import { motion } from "framer-motion"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

interface Invoice {
  id: string
  invoiceNumber: string
  title: string
  description?: string | null
  amount: number
  tax?: number | null
  totalAmount: number
  status: "DRAFT" | "SENT" | "PAID" | "OVERDUE" | "CANCELLED"
  issueDate: string
  dueDate: string
  paidDate?: string | null
  notes?: string | null
  termsConditions?: string | null
  createdAt: string
  client: {
    id: string
    name: string
    contactPerson?: string | null
  }
  project?: {
    id: string
    name: string
  } | null
}

interface Client {
  id: string
  name: string
  contactPerson?: string | null
}

interface Project {
  id: string
  name: string
  client: {
    id: string
    name: string
  }
}

const invoiceSchema = z.object({
  title: z.string().min(1, "Invoice title is required"),
  description: z.string().optional(),
  amount: z.number().min(0, "Amount must be positive").or(z.string().transform(val => parseFloat(val))),
  tax: z.number().min(0).optional().or(z.string().transform(val => val ? parseFloat(val) : 0)),
  status: z.enum(["DRAFT", "SENT", "PAID", "OVERDUE", "CANCELLED"]).default("DRAFT"),
  issueDate: z.string().optional(),
  dueDate: z.string().min(1, "Due date is required"),
  clientId: z.string().min(1, "Customer is required"),
  projectId: z.string().optional(),
  notes: z.string().optional(),
  termsConditions: z.string().optional(),
})

type InvoiceFormData = z.infer<typeof invoiceSchema>

const statusConfig = {
  DRAFT: { color: "bg-gray-100 text-gray-800", label: "Draft", icon: <Edit className="h-3 w-3" /> },
  SENT: { color: "bg-blue-100 text-blue-800", label: "Sent", icon: <FileText className="h-3 w-3" /> },
  PAID: { color: "bg-green-100 text-green-800", label: "Paid", icon: <CheckCircle2 className="h-3 w-3" /> },
  OVERDUE: { color: "bg-red-100 text-red-800", label: "Overdue", icon: <AlertTriangle className="h-3 w-3" /> },
  CANCELLED: { color: "bg-red-100 text-red-800", label: "Cancelled", icon: <Trash2 className="h-3 w-3" /> },
}

export function InvoicesClient() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [selectedClientId, setSelectedClientId] = useState("")

  const form = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceSchema) as any,
    defaultValues: {
      title: "",
      description: "",
      amount: 0,
      tax: 0,
      status: "DRAFT",
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: "",
      clientId: "",
      projectId: "",
      notes: "",
      termsConditions: "",
    },
  })

  const fetchInvoices = async () => {
    try {
      const params = new URLSearchParams()
      if (searchTerm) params.append("search", searchTerm)
      if (statusFilter) params.append("status", statusFilter)

      const response = await fetch(`/api/invoices?${params.toString()}`)
      
      if (!response.ok) {
        throw new Error("Failed to fetch invoices")
      }

      const data = await response.json()
      setInvoices(data.invoices || [])
    } catch (error) {
      console.error("Error fetching invoices:", error)
      toast.error("Failed to load invoices")
      setInvoices([])
    } finally {
      setLoading(false)
    }
  }

  const fetchClients = async () => {
    try {
      const response = await fetch("/api/clients/list")
      if (!response.ok) {
        throw new Error("Failed to fetch clients")
      }
      const data = await response.json()
      setClients(data || [])
    } catch (error) {
      console.error("Error fetching clients:", error)
      toast.error("Failed to load clients")
    }
  }

  const fetchProjects = async (clientId?: string) => {
    try {
      const params = new URLSearchParams()
      if (clientId) params.append("clientId", clientId)

      const response = await fetch(`/api/projects/list?${params.toString()}`)
      if (!response.ok) {
        throw new Error("Failed to fetch projects")
      }
      const data = await response.json()
      setProjects(data || [])
    } catch (error) {
      console.error("Error fetching projects:", error)
      toast.error("Failed to load projects")
    }
  }

  useEffect(() => {
    fetchClients()
    fetchProjects()
  }, [])

  useEffect(() => {
    fetchInvoices()
  }, [searchTerm, statusFilter])

  useEffect(() => {
    if (selectedClientId) {
      fetchProjects(selectedClientId)
      form.setValue("projectId", "") // Reset project when client changes
    } else {
      setProjects([])
    }
  }, [selectedClientId])

  const handleSubmit = async (data: InvoiceFormData) => {
    try {
      const cleanedData = {
        ...data,
        amount: Number(data.amount),
        tax: Number(data.tax) || null,
        description: data.description || null,
        issueDate: data.issueDate || null,
        projectId: data.projectId || null,
        notes: data.notes || null,
        termsConditions: data.termsConditions || null,
      }

      const url = editingInvoice ? `/api/invoices/${editingInvoice.id}` : "/api/invoices"
      const method = editingInvoice ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(cleanedData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to save invoice")
      }

      toast.success(editingInvoice ? "Invoice updated successfully" : "Invoice created successfully")
      setIsDialogOpen(false)
      setEditingInvoice(null)
      form.reset()
      fetchInvoices()
    } catch (error) {
      console.error("Error saving invoice:", error)
      toast.error(error instanceof Error ? error.message : "Failed to save invoice")
    }
  }

  const handleEdit = (invoice: Invoice) => {
    setEditingInvoice(invoice)
    setSelectedClientId(invoice.client.id)
    
    form.reset({
      title: invoice.title,
      description: invoice.description || "",
      amount: invoice.amount,
      tax: invoice.tax || 0,
      status: invoice.status,
      issueDate: invoice.issueDate ? new Date(invoice.issueDate).toISOString().split('T')[0] : "",
      dueDate: new Date(invoice.dueDate).toISOString().split('T')[0],
      clientId: invoice.client.id,
      projectId: invoice.project?.id || "",
      notes: invoice.notes || "",
      termsConditions: invoice.termsConditions || "",
    })
    setIsDialogOpen(true)
  }

  const handleDelete = async (invoiceId: string) => {
    if (!confirm("Are you sure you want to delete this invoice?")) {
      return
    }

    setIsDeleting(invoiceId)
    try {
      const response = await fetch(`/api/invoices/${invoiceId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete invoice")
      }

      toast.success("Invoice deleted successfully")
      fetchInvoices()
    } catch (error) {
      console.error("Error deleting invoice:", error)
      toast.error("Failed to delete invoice")
    } finally {
      setIsDeleting(null)
    }
  }

  const handleAddNew = () => {
    setEditingInvoice(null)
    setSelectedClientId("")
    form.reset()
    setIsDialogOpen(true)
  }

  const getDaysUntilDue = (dueDate: string) => {
    const now = new Date()
    const due = new Date(dueDate)
    const diffTime = due.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  const getInvoiceStats = () => {
    const total = invoices.reduce((sum, inv) => sum + inv.totalAmount, 0)
    const paid = invoices.filter(inv => inv.status === "PAID").reduce((sum, inv) => sum + inv.totalAmount, 0)
    const pending = invoices.filter(inv => inv.status === "SENT").reduce((sum, inv) => sum + inv.totalAmount, 0)
    const overdue = invoices.filter(inv => inv.status === "OVERDUE").reduce((sum, inv) => sum + inv.totalAmount, 0)

    return { total, paid, pending, overdue }
  }

  const stats = getInvoiceStats()

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-64 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Invoices</h1>
          <p className="text-gray-600 dark:text-gray-300">
            Manage billing and track payments
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleAddNew} className="bg-red-600 hover:bg-red-700">
              <Plus className="mr-2 h-4 w-4" />
              Create Invoice
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingInvoice ? "Edit Invoice" : "Create New Invoice"}
              </DialogTitle>
              <DialogDescription>
                {editingInvoice ? "Update invoice information and status." : "Generate a new invoice for your client."}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="title">Invoice Title *</Label>
                  <Input
                    id="title"
                    {...form.register("title")}
                    placeholder="Professional Services - December 2024"
                  />
                  {form.formState.errors.title && (
                    <p className="text-sm text-red-600">{form.formState.errors.title.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="clientId">Client *</Label>
                  <Select
                    value={form.watch("clientId")}
                    onValueChange={(value) => {
                      form.setValue("clientId", value)
                      setSelectedClientId(value)
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                          {client.contactPerson && ` (${client.contactPerson})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.formState.errors.clientId && (
                    <p className="text-sm text-red-600">{form.formState.errors.clientId.message}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="projectId">Project (Optional)</Label>
                  <Select
                    value={form.watch("projectId") || "no-project"}
                    onValueChange={(value) => form.setValue("projectId", value === "no-project" ? "" : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select project" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no-project">No Project</SelectItem>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  {...form.register("description")}
                  placeholder="Service description, deliverables, etc..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="amount">Amount ($) *</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    {...form.register("amount", { valueAsNumber: true })}
                    placeholder="5000.00"
                  />
                  {form.formState.errors.amount && (
                    <p className="text-sm text-red-600">{form.formState.errors.amount.message}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="tax">Tax/GST ($)</Label>
                  <Input
                    id="tax"
                    type="number"
                    step="0.01"
                    {...form.register("tax", { valueAsNumber: true })}
                    placeholder="350.00"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={form.watch("status")}
                    onValueChange={(value) => form.setValue("status", value as any)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(statusConfig).map(([status, config]) => (
                        <SelectItem key={status} value={status}>
                          <div className="flex items-center space-x-2">
                            {config.icon}
                            <span>{config.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="issueDate">Issue Date</Label>
                  <Input
                    id="issueDate"
                    type="date"
                    {...form.register("issueDate")}
                  />
                </div>
                <div>
                  <Label htmlFor="dueDate">Due Date *</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    {...form.register("dueDate")}
                  />
                  {form.formState.errors.dueDate && (
                    <p className="text-sm text-red-600">{form.formState.errors.dueDate.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    {...form.register("notes")}
                    placeholder="Internal notes..."
                    rows={2}
                  />
                </div>
                <div>
                  <Label htmlFor="termsConditions">Terms & Conditions</Label>
                  <Textarea
                    id="termsConditions"
                    {...form.register("termsConditions")}
                    placeholder="Payment terms, late fees, etc..."
                    rows={2}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsDialogOpen(false)
                    setEditingInvoice(null)
                    form.reset()
                    setSelectedClientId("")
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" className="bg-red-600 hover:bg-red-700">
                  {editingInvoice ? "Update Invoice" : "Create Invoice"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and Filter */}
      <div className="flex items-center space-x-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search invoices..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter || "all-status"} onValueChange={(value) => setStatusFilter(value === "all-status" ? "" : value)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all-status">All Status</SelectItem>
            {Object.entries(statusConfig).map(([status, config]) => (
              <SelectItem key={status} value={status}>
                {config.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Financial Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Receipt className="h-4 w-4 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">Total Revenue</p>
                <p className="text-xl font-bold">${stats.total.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <div>
                <p className="text-sm text-gray-600">Paid</p>
                <p className="text-xl font-bold">${stats.paid.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-orange-600" />
              <div>
                <p className="text-sm text-gray-600">Pending</p>
                <p className="text-xl font-bold">${stats.pending.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <div>
                <p className="text-sm text-gray-600">Overdue</p>
                <p className="text-xl font-bold">${stats.overdue.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Invoice Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {invoices?.map((invoice, index) => (
          <motion.div
            key={invoice.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <FileText className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium text-gray-600">{invoice.invoiceNumber}</span>
                    </div>
                    <CardTitle className="text-lg line-clamp-1 mb-1">{invoice.title}</CardTitle>
                    <div className="flex items-center space-x-2">
                      <Building className="h-4 w-4 text-gray-400" />
                      <CardDescription className="line-clamp-1">
                        {invoice.client.name}
                      </CardDescription>
                    </div>
                    {invoice.project && (
                      <div className="flex items-center space-x-2 mt-1">
                        <FolderOpen className="h-4 w-4 text-gray-400" />
                        <span className="text-xs text-gray-500 line-clamp-1">{invoice.project.name}</span>
                      </div>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEdit(invoice)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleDelete(invoice.id)}
                        disabled={isDeleting === invoice.id}
                        className="text-red-600"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Badge className={statusConfig[invoice.status].color}>
                    <div className="flex items-center space-x-1">
                      {statusConfig[invoice.status].icon}
                      <span>{statusConfig[invoice.status].label}</span>
                    </div>
                  </Badge>
                  <div className="text-right">
                    <div className="text-lg font-bold">${invoice.totalAmount.toLocaleString()}</div>
                    <div className="text-xs text-gray-500">
                      {invoice.tax ? `$${invoice.amount.toLocaleString()} + $${invoice.tax.toLocaleString()} tax` : `$${invoice.amount.toLocaleString()}`}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Issue Date:</span>
                    <span>{new Date(invoice.issueDate).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Due Date:</span>
                    <div className="flex items-center space-x-2">
                      <span>{new Date(invoice.dueDate).toLocaleDateString()}</span>
                      {(() => {
                        const days = getDaysUntilDue(invoice.dueDate)
                        if (invoice.status !== "PAID" && days < 0) {
                          return <Badge className="bg-red-100 text-red-800 text-xs">Overdue</Badge>
                        } else if (invoice.status !== "PAID" && days <= 3) {
                          return <Badge className="bg-orange-100 text-orange-800 text-xs">Due Soon</Badge>
                        }
                        return null
                      })()}
                    </div>
                  </div>
                  {invoice.paidDate && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Paid Date:</span>
                      <span className="text-green-600 font-medium">{new Date(invoice.paidDate).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>

                {invoice.description && (
                  <p className="text-sm text-gray-600 line-clamp-2 border-t pt-3">
                    {invoice.description}
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {invoices?.length === 0 && !loading && (
        <div className="text-center py-12">
          <FileText className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">No invoices found</h3>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            {searchTerm || statusFilter ? "Try adjusting your search or filters." : "Get started by creating your first invoice."}
          </p>
          {!searchTerm && !statusFilter && (
            <Button onClick={handleAddNew} className="mt-4 bg-red-600 hover:bg-red-700">
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Invoice
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
