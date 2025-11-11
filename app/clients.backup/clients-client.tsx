
'use client'

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { 
  Building2, 
  Search, 
  MoreHorizontal, 
  UserPlus, 
  Mail, 
  Phone, 
  MapPin,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  ArrowUpDown,
  CreditCard,
  Users,
  Edit,
  Trash2,
  Plus,
  Eye,
  FolderOpen,
  FileText
} from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { format } from "date-fns"

interface Customer {
  id: string
  clientNumber?: string
  name: string
  email?: string | null
  phone?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  country: string
  postalCode?: string | null
  contactPerson?: string | null
  companyReg?: string | null
  website?: string | null
  notes?: string | null
  clientType: string
  // Bank Information
  bankName?: string | null
  bankAccountNumber?: string | null
  bankAccountName?: string | null
  bankSwiftCode?: string | null
  bankAddress?: string | null
  isActive: boolean
  createdAt: string
  // Xero fields
  isXeroSynced?: boolean
  xeroContactId?: string | null
  _count?: {
    Project: number
    ClientInvoice: number
    LegacyInvoice: number
  }
}

const customerSchema = z.object({
  name: z.string().min(1, "Customer name is required"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().default("Singapore"),
  postalCode: z.string().optional(),
  contactPerson: z.string().optional(),
  companyReg: z.string().optional(),
  website: z.string().optional(),
  notes: z.string().optional(),
  clientType: z.enum(["ENTERPRISE", "SME", "GOVERNMENT", "INDIVIDUAL"]).default("ENTERPRISE"),
  // Bank Information
  bankName: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  bankAccountName: z.string().optional(),
  bankSwiftCode: z.string().optional(),
  bankAddress: z.string().optional(),
})

type CustomerFormData = z.infer<typeof customerSchema>

export function ClientsClient() {
  const router = useRouter()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [filterType, setFilterType] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  
  const form = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      state: "",
      country: "Singapore",
      postalCode: "",
      contactPerson: "",
      companyReg: "",
      website: "",
      notes: "",
      clientType: "ENTERPRISE",
      bankName: "",
      bankAccountNumber: "",
      bankAccountName: "",
      bankSwiftCode: "",
      bankAddress: "",
    }
  })

  useEffect(() => {
    fetchCustomers()
  }, [])

  const fetchCustomers = async () => {
    try {
      setIsLoading(true)
      const response = await fetch("/api/clients")
      if (!response.ok) throw new Error("Failed to fetch customers")
      const data = await response.json()
      
      // Safely extract customers array from response
      const customersData = data.clients || data
      
      // Validate that we have an array
      if (!Array.isArray(customersData)) {
        console.warn("Expected customers list as array, got:", typeof customersData, customersData)
        setCustomers([])
        toast.error("Invalid customer data format received")
        return
      }
      
      setCustomers(customersData)
    } catch (error) {
      console.error("Error fetching customers:", error)
      toast.error("Failed to fetch customers")
      setCustomers([]) // Ensure customers is always an array even on error
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (data: CustomerFormData) => {
    try {
      const url = editingCustomer ? `/api/clients/${editingCustomer.id}` : "/api/clients"
      const method = editingCustomer ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!response.ok) throw new Error("Failed to save customer")

      toast.success(editingCustomer ? "Customer updated successfully" : "Customer created successfully")
      setIsDialogOpen(false)
      form.reset()
      setEditingCustomer(null)
      fetchCustomers()
    } catch (error) {
      console.error("Error saving customer:", error)
      toast.error("Failed to save customer")
    }
  }

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer)
    form.reset({
      name: customer.name,
      email: customer.email || "",
      phone: customer.phone || "",
      address: customer.address || "",
      city: customer.city || "",
      state: customer.state || "",
      country: customer.country,
      postalCode: customer.postalCode || "",
      contactPerson: customer.contactPerson || "",
      companyReg: customer.companyReg || "",
      website: customer.website || "",
      notes: customer.notes || "",
      clientType: customer.clientType as any,
      bankName: customer.bankName || "",
      bankAccountNumber: customer.bankAccountNumber || "",
      bankAccountName: customer.bankAccountName || "",
      bankSwiftCode: customer.bankSwiftCode || "",
      bankAddress: customer.bankAddress || "",
    })
    setIsDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this customer?")) return

    try {
      const response = await fetch(`/api/clients/${id}`, {
        method: "DELETE",
      })

      if (!response.ok) throw new Error("Failed to delete customer")

      toast.success("Customer deleted successfully")
      fetchCustomers()
    } catch (error) {
      console.error("Error deleting customer:", error)
      toast.error("Failed to delete customer")
    }
  }

  // Ensure customers is always an array before filtering
  const validCustomers = Array.isArray(customers) ? customers : []
  
  const filteredCustomers = validCustomers.filter((customer) => {
    if (!customer) return false
    
    const matchesSearch = 
      customer.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.clientNumber?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesType = filterType === "all" || customer.clientType === filterType
    const matchesStatus = 
      filterStatus === "all" || 
      (filterStatus === "active" && customer.isActive) ||
      (filterStatus === "inactive" && !customer.isActive)

    return matchesSearch && matchesType && matchesStatus
  })

  const getStatusBadge = (customer: Customer) => {
    if (!customer.isActive) {
      return <Badge variant="secondary" className="bg-gray-100 text-gray-800"><XCircle className="h-3 w-3 mr-1" />Inactive</Badge>
    }
    return <Badge variant="secondary" className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Active</Badge>
  }

  const getTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      ENTERPRISE: "bg-purple-100 text-purple-800",
      SME: "bg-blue-100 text-blue-800",
      GOVERNMENT: "bg-green-100 text-green-800",
      INDIVIDUAL: "bg-orange-100 text-orange-800",
    }
    const labels: Record<string, string> = {
      ENTERPRISE: "Enterprise",
      SME: "SME",
      GOVERNMENT: "Government",
      INDIVIDUAL: "Individual",
    }
    return (
      <Badge variant="secondary" className={colors[type] || "bg-gray-100 text-gray-800"}>
        {labels[type] || type}
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{validCustomers.length}</div>
            <p className="text-xs text-muted-foreground">
              {validCustomers.filter(c => c?.isXeroSynced).length} synced with Xero
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Customers</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {validCustomers.filter(c => c?.isActive).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Currently active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {validCustomers.reduce((sum, c) => sum + (c?._count?.Project || 0), 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Active projects
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Enterprise Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {validCustomers.filter(c => c?.clientType === "ENTERPRISE").length}
            </div>
            <p className="text-xs text-muted-foreground">
              Enterprise accounts
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Customers Directory</CardTitle>
              <CardDescription>
                Manage your customer relationships and information
              </CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => { setEditingCustomer(null); form.reset(); }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Customer
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingCustomer ? "Edit Customer" : "Add New Customer"}</DialogTitle>
                  <DialogDescription>
                    {editingCustomer ? "Update customer information" : "Enter the details of the new customer"}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <Label htmlFor="name">Customer Name *</Label>
                      <Input id="name" {...form.register("name")} />
                      {form.formState.errors.name && (
                        <p className="text-sm text-red-500 mt-1">{form.formState.errors.name.message}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" type="email" {...form.register("email")} />
                    </div>

                    <div>
                      <Label htmlFor="phone">Phone</Label>
                      <Input id="phone" {...form.register("phone")} />
                    </div>

                    <div>
                      <Label htmlFor="contactPerson">Contact Person</Label>
                      <Input id="contactPerson" {...form.register("contactPerson")} />
                    </div>

                    <div>
                      <Label htmlFor="companyReg">Company Registration</Label>
                      <Input id="companyReg" {...form.register("companyReg")} />
                    </div>

                    <div className="col-span-2">
                      <Label htmlFor="address">Address</Label>
                      <Input id="address" {...form.register("address")} />
                    </div>

                    <div>
                      <Label htmlFor="city">City</Label>
                      <Input id="city" {...form.register("city")} />
                    </div>

                    <div>
                      <Label htmlFor="state">State</Label>
                      <Input id="state" {...form.register("state")} />
                    </div>

                    <div>
                      <Label htmlFor="country">Country</Label>
                      <Input id="country" {...form.register("country")} />
                    </div>

                    <div>
                      <Label htmlFor="postalCode">Postal Code</Label>
                      <Input id="postalCode" {...form.register("postalCode")} />
                    </div>

                    <div>
                      <Label htmlFor="website">Website</Label>
                      <Input id="website" {...form.register("website")} />
                    </div>

                    <div>
                      <Label htmlFor="clientType">Customer Type</Label>
                      <Select
                        value={form.watch("clientType")}
                        onValueChange={(value) => form.setValue("clientType", value as any)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ENTERPRISE">Enterprise</SelectItem>
                          <SelectItem value="SME">SME</SelectItem>
                          <SelectItem value="GOVERNMENT">Government</SelectItem>
                          <SelectItem value="INDIVIDUAL">Individual</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="col-span-2">
                      <Label htmlFor="bankName">Bank Name</Label>
                      <Input id="bankName" {...form.register("bankName")} />
                    </div>

                    <div>
                      <Label htmlFor="bankAccountNumber">Account Number</Label>
                      <Input id="bankAccountNumber" {...form.register("bankAccountNumber")} />
                    </div>

                    <div>
                      <Label htmlFor="bankAccountName">Account Name</Label>
                      <Input id="bankAccountName" {...form.register("bankAccountName")} />
                    </div>

                    <div>
                      <Label htmlFor="bankSwiftCode">SWIFT Code</Label>
                      <Input id="bankSwiftCode" {...form.register("bankSwiftCode")} />
                    </div>

                    <div>
                      <Label htmlFor="bankAddress">Bank Address</Label>
                      <Input id="bankAddress" {...form.register("bankAddress")} />
                    </div>

                    <div className="col-span-2">
                      <Label htmlFor="notes">Notes</Label>
                      <Textarea id="notes" {...form.register("notes")} rows={3} />
                    </div>
                  </div>

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">
                      {editingCustomer ? "Update" : "Create"} Customer
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>

        <CardContent>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search by name, email, phone, or customer ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="ENTERPRISE">Enterprise</SelectItem>
                <SelectItem value="SME">SME</SelectItem>
                <SelectItem value="GOVERNMENT">Government</SelectItem>
                <SelectItem value="INDIVIDUAL">Individual</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Customers Table */}
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600" />
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                No customers found
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                {searchTerm || filterType !== "all" || filterStatus !== "all"
                  ? "Try adjusting your filters"
                  : "Get started by adding your first customer"}
              </p>
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer No</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Contact Person</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Xero Sync Status</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers.map((customer) => (
                    <TableRow 
                      key={customer.id}
                      className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                      onClick={() => router.push(`/clients/${customer.id}`)}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {customer.clientNumber || "N/A"}
                          {customer.isXeroSynced && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0">
                              Xero
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{customer.name}</div>
                          {customer.companyReg && (
                            <div className="text-xs text-gray-500">{customer.companyReg}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {customer.contactPerson || "-"}
                      </TableCell>
                      <TableCell>
                        {customer.email && (
                          <div className="flex items-center text-sm">
                            <Mail className="h-3 w-3 mr-2 text-gray-400" />
                            {customer.email}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {customer.phone && (
                          <div className="flex items-center text-sm">
                            <Phone className="h-3 w-3 mr-2 text-gray-400" />
                            {customer.phone}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {customer.address ? (
                          <div className="max-w-xs truncate">{customer.address}</div>
                        ) : "-"}
                      </TableCell>
                      <TableCell>{getTypeBadge(customer.clientType)}</TableCell>
                      <TableCell>
                        {customer.isXeroSynced ? (
                          <Badge variant="secondary" className="bg-green-100 text-green-800">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Synced
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-gray-100 text-gray-800">
                            <XCircle className="h-3 w-3 mr-1" />
                            Not Synced
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(customer)}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation()
                              router.push(`/clients/${customer.id}`)
                            }}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation()
                              handleEdit(customer)
                            }}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation()
                              router.push(`/projects?client=${customer.id}`)
                            }}>
                              <FolderOpen className="h-4 w-4 mr-2" />
                              View Projects
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDelete(customer.id)
                              }}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
