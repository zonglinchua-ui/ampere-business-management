
'use client'

import { useState, useEffect } from "react"
import { MainLayout } from "@/components/layout/main-layout"
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

interface Vendor {
  id: string
  vendorNumber?: string
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
  supplierType: string
  paymentTerms: string
  contractDetails?: string | null
  // Bank Information
  bankName?: string | null
  bankAccountNumber?: string | null
  bankAccountName?: string | null
  bankSwiftCode?: string | null
  bankAddress?: string | null
  isActive: boolean
  isApproved: boolean
  createdAt: string
}

const vendorSchema = z.object({
  name: z.string().min(1, "Vendor name is required"),
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
  supplierType: z.string().default("SUPPLIER"),
  paymentTerms: z.string().default("NET_30"),
  contractDetails: z.string().optional(),
  // Bank Information
  bankName: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  bankAccountName: z.string().optional(),
  bankSwiftCode: z.string().optional(),
  bankAddress: z.string().optional(),
})

type VendorFormData = z.infer<typeof vendorSchema>

export default function VendorsPage() {
  const router = useRouter()
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterType, setFilterType] = useState("all")
  const [sortField, setSortField] = useState<keyof Vendor>("name")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)

  const form = useForm<VendorFormData>({
    resolver: zodResolver(vendorSchema) as any,
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
      supplierType: "SUPPLIER",
      paymentTerms: "NET_30",
      contractDetails: "",
      bankName: "",
      bankAccountNumber: "",
      bankAccountName: "",
      bankSwiftCode: "",
      bankAddress: "",
    },
  })

  const fetchVendors = async () => {
    try {
      const response = await fetch('/api/vendors')
      if (!response.ok) {
        throw new Error('Failed to fetch vendors')
      }
      const data = await response.json()
      setVendors(data.vendors || [])
      setLoading(false)
    } catch (error) {
      console.error("Error fetching vendors:", error)
      toast.error("Failed to load vendors")
      setVendors([])
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchVendors()
  }, [searchTerm])

  const handleSubmit = async (data: VendorFormData) => {
    try {
      const cleanedData = {
        ...data,
        email: data.email || null,
        phone: data.phone || null,
        address: data.address || null,
        city: data.city || null,
        state: data.state || null,
        postalCode: data.postalCode || null,
        contactPerson: data.contactPerson || null,
        companyReg: data.companyReg || null,
        website: data.website || null,
        notes: data.notes || null,
        contractDetails: data.contractDetails || null,
        bankName: data.bankName || null,
        bankAccountNumber: data.bankAccountNumber || null,
        bankAccountName: data.bankAccountName || null,
        bankSwiftCode: data.bankSwiftCode || null,
        bankAddress: data.bankAddress || null,
      }

      // Make actual API call to create/update vendor
      const url = editingVendor ? `/api/suppliers/${editingVendor.id}` : '/api/suppliers'
      const method = editingVendor ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(cleanedData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save vendor')
      }

      const savedVendor = await response.json()
      console.log("Vendor saved successfully:", savedVendor)

      toast.success(editingVendor ? "Vendor updated successfully" : "Vendor created successfully")
      setIsDialogOpen(false)
      setEditingVendor(null)
      form.reset()
      fetchVendors()
    } catch (error) {
      console.error("Error saving vendor:", error)
      toast.error("Failed to save vendor")
    }
  }

  const handleSort = (field: keyof Vendor) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  const filteredAndSortedVendors = vendors
    .filter((vendor) => {
      const matchesSearch = vendor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           vendor.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           vendor.contactPerson?.toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesStatus = filterStatus === "all" || 
                           (filterStatus === "approved" && vendor.isApproved) ||
                           (filterStatus === "pending" && !vendor.isApproved) ||
                           (filterStatus === "active" && vendor.isActive) ||
                           (filterStatus === "inactive" && !vendor.isActive)
      
      const matchesType = filterType === "all" || vendor.supplierType === filterType
      
      return matchesSearch && matchesStatus && matchesType
    })
    .sort((a, b) => {
      const aValue = a[sortField]
      const bValue = b[sortField]
      
      if (aValue === null || aValue === undefined) return 1
      if (bValue === null || bValue === undefined) return -1
      
      let comparison = 0
      if (typeof aValue === "string" && typeof bValue === "string") {
        comparison = aValue.localeCompare(bValue)
      } else if (typeof aValue === "number" && typeof bValue === "number") {
        comparison = aValue - bValue
      } else {
        comparison = String(aValue).localeCompare(String(bValue))
      }
      
      return sortDirection === "asc" ? comparison : -comparison
    })

  const handleEdit = (vendor: Vendor) => {
    setEditingVendor(vendor)
    form.reset({
      name: vendor.name,
      email: vendor.email || "",
      phone: vendor.phone || "",
      address: vendor.address || "",
      city: vendor.city || "",
      state: vendor.state || "",
      country: vendor.country,
      postalCode: vendor.postalCode || "",
      contactPerson: vendor.contactPerson || "",
      companyReg: vendor.companyReg || "",
      website: vendor.website || "",
      notes: vendor.notes || "",
      supplierType: vendor.supplierType,
      paymentTerms: vendor.paymentTerms,
      contractDetails: vendor.contractDetails || "",
      bankName: vendor.bankName || "",
      bankAccountNumber: vendor.bankAccountNumber || "",
      bankAccountName: vendor.bankAccountName || "",
      bankSwiftCode: vendor.bankSwiftCode || "",
      bankAddress: vendor.bankAddress || "",
    })
    setIsDialogOpen(true)
  }

  const handleDelete = async (supplierId: string) => {
    if (!confirm("Are you sure you want to delete this vendor?")) {
      return
    }

    setIsDeleting(supplierId)
    try {
      const response = await fetch(`/api/suppliers/${supplierId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete vendor')
      }

      toast.success("Vendor deleted successfully")
      fetchVendors()
    } catch (error) {
      console.error("Error deleting vendor:", error)
      toast.error("Failed to delete vendor")
    } finally {
      setIsDeleting(null)
    }
  }

  const handleAddNew = () => {
    setEditingVendor(null)
    form.reset()
    setIsDialogOpen(true)
  }

  const handleVendorClick = (supplierId: string) => {
    router.push(`/vendors/${supplierId}`)
  }

  const getVendorTypeColor = (type: string) => {
    switch (type) {
      case "SUPPLIER":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
      case "CONTRACTOR":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
      case "CONSULTANT":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
      case "SERVICE_PROVIDER":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
    }
  }

  const getVendorTypeDisplay = (type: string) => {
    switch (type) {
      case "SUPPLIER":
        return "Supplier"
      case "CONTRACTOR":
        return "Contractor"
      case "CONSULTANT":
        return "Consultant"
      case "SERVICE_PROVIDER":
        return "Service Provider"
      default:
        return type
    }
  }

  const getPaymentTermsDisplay = (terms: string) => {
    switch (terms) {
      case "NET_15":
        return "Net 15 days"
      case "NET_30":
        return "Net 30 days"
      case "NET_60":
        return "Net 60 days"
      case "NET_90":
        return "Net 90 days"
      case "IMMEDIATE":
        return "Immediate"
      default:
        return terms
    }
  }

  const statsData = [
    {
      title: "Total Vendors",
      value: vendors.length,
      description: "Registered vendors",
      icon: Building2
    },
    {
      title: "Active Vendors",
      value: vendors.filter(v => v.isActive).length,
      description: "Currently active",
      icon: CheckCircle
    },
    {
      title: "Approved Vendors", 
      value: vendors.filter(v => v.isApproved).length,
      description: "Approved for projects",
      icon: CheckCircle
    },
    {
      title: "Pending Approval",
      value: vendors.filter(v => !v.isApproved).length,
      description: "Awaiting approval",
      icon: Clock
    }
  ]

  if (loading) {
    return (
      <MainLayout>
        <div className="p-6">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Vendor Management</h1>
            <p className="text-gray-600 dark:text-gray-300">
              Manage suppliers, contractors, consultants and service providers
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleAddNew} className="bg-red-600 hover:bg-red-700">
                <Plus className="mr-2 h-4 w-4" />
                Add Vendor
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingVendor ? "Edit Vendor" : "Add New Vendor"}
                </DialogTitle>
                <DialogDescription>
                  {editingVendor ? "Update vendor information." : "Create a new vendor profile."}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                {/* Basic Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Basic Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name">Vendor Name *</Label>
                      <Input
                        id="name"
                        {...form.register("name")}
                        placeholder="ABC Supplier Pte Ltd"
                      />
                      {form.formState.errors.name && (
                        <p className="text-sm text-red-600">{form.formState.errors.name.message}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="supplierType">Vendor Type</Label>
                      <Select value={form.watch("supplierType")} onValueChange={(value) => form.setValue("supplierType", value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select vendor type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="SUPPLIER">Supplier</SelectItem>
                          <SelectItem value="CONTRACTOR">Contractor</SelectItem>
                          <SelectItem value="CONSULTANT">Consultant</SelectItem>
                          <SelectItem value="SERVICE_PROVIDER">Service Provider</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="contactPerson">Contact Person</Label>
                      <Input
                        id="contactPerson"
                        {...form.register("contactPerson")}
                        placeholder="John Doe"
                      />
                    </div>
                    <div>
                      <Label htmlFor="companyReg">Company Registration</Label>
                      <Input
                        id="companyReg"
                        {...form.register("companyReg")}
                        placeholder="UEN201234567A"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        {...form.register("email")}
                        placeholder="contact@vendor.com"
                      />
                      {form.formState.errors.email && (
                        <p className="text-sm text-red-600">{form.formState.errors.email.message}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        {...form.register("phone")}
                        placeholder="+65 1234 5678"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="website">Website</Label>
                      <Input
                        id="website"
                        {...form.register("website")}
                        placeholder="https://vendor.com"
                      />
                    </div>
                    <div>
                      <Label htmlFor="paymentTerms">Payment Terms</Label>
                      <Select value={form.watch("paymentTerms")} onValueChange={(value) => form.setValue("paymentTerms", value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select payment terms" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NET_15">Net 15 days</SelectItem>
                          <SelectItem value="NET_30">Net 30 days</SelectItem>
                          <SelectItem value="NET_60">Net 60 days</SelectItem>
                          <SelectItem value="NET_90">Net 90 days</SelectItem>
                          <SelectItem value="IMMEDIATE">Immediate</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Address Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Address Information</h3>
                  <div>
                    <Label htmlFor="address">Address</Label>
                    <Input
                      id="address"
                      {...form.register("address")}
                      placeholder="123 Business Street"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        {...form.register("city")}
                        placeholder="Singapore"
                      />
                    </div>
                    <div>
                      <Label htmlFor="state">State</Label>
                      <Input
                        id="state"
                        {...form.register("state")}
                        placeholder="Singapore"
                      />
                    </div>
                    <div>
                      <Label htmlFor="postalCode">Postal Code</Label>
                      <Input
                        id="postalCode"
                        {...form.register("postalCode")}
                        placeholder="123456"
                      />
                    </div>
                  </div>
                </div>

                {/* Bank Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium flex items-center">
                    <CreditCard className="mr-2 h-5 w-5" />
                    Bank Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="bankName">Bank Name</Label>
                      <Input
                        id="bankName"
                        {...form.register("bankName")}
                        placeholder="DBS Bank Ltd"
                      />
                    </div>
                    <div>
                      <Label htmlFor="bankAccountName">Account Name</Label>
                      <Input
                        id="bankAccountName"
                        {...form.register("bankAccountName")}
                        placeholder="ABC Vendor Pte Ltd"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="bankAccountNumber">Account Number</Label>
                      <Input
                        id="bankAccountNumber"
                        {...form.register("bankAccountNumber")}
                        placeholder="123-456789-001"
                      />
                    </div>
                    <div>
                      <Label htmlFor="bankSwiftCode">SWIFT Code</Label>
                      <Input
                        id="bankSwiftCode"
                        {...form.register("bankSwiftCode")}
                        placeholder="DBSSSGSG"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="bankAddress">Bank Address</Label>
                    <Input
                      id="bankAddress"
                      {...form.register("bankAddress")}
                      placeholder="12 Marina Boulevard, Singapore 018982"
                    />
                  </div>
                </div>

                {/* Contract Details */}
                <div>
                  <Label htmlFor="contractDetails">Contract Details</Label>
                  <Textarea
                    id="contractDetails"
                    {...form.register("contractDetails")}
                    placeholder="Contract terms and conditions..."
                    rows={2}
                  />
                </div>

                {/* Notes */}
                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    {...form.register("notes")}
                    placeholder="Additional information about the vendor..."
                    rows={3}
                  />
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsDialogOpen(false)
                      setEditingVendor(null)
                      form.reset()
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="bg-red-600 hover:bg-red-700">
                    {editingVendor ? "Update Vendor" : "Create Vendor"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {statsData.map((stat, index) => (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">{stat.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters and Search */}
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
              <div>
                <CardTitle>Vendors Directory</CardTitle>
                <CardDescription>Search and manage your vendor relationships</CardDescription>
              </div>
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    placeholder="Search vendors..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-64"
                  />
                </div>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="SUPPLIER">Supplier</SelectItem>
                    <SelectItem value="CONTRACTOR">Contractor</SelectItem>
                    <SelectItem value="CONSULTANT">Consultant</SelectItem>
                    <SelectItem value="SERVICE_PROVIDER">Service Provider</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="pending">Pending Approval</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Table */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="cursor-pointer" onClick={() => handleSort("vendorNumber")}>
                      <div className="flex items-center">
                        Vendor #
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                      </div>
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSort("name")}>
                      <div className="flex items-center">
                        Vendor Name
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                      </div>
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSort("contactPerson")}>
                      <div className="flex items-center">
                        Contact Person
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                      </div>
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSort("email")}>
                      <div className="flex items-center">
                        Email
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                      </div>
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSort("supplierType")}>
                      <div className="flex items-center">
                        Type
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                      </div>
                    </TableHead>
                    <TableHead>Payment Terms</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Bank Info</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedVendors.map((vendor) => (
                    <TableRow 
                      key={vendor.id} 
                      className="hover:bg-muted/50 cursor-pointer"
                      onClick={() => handleVendorClick(vendor.id)}
                    >
                      <TableCell>
                        <div className="font-mono text-sm font-medium text-green-600">
                          {vendor.vendorNumber || 'AE-V-???'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                            <Building2 className="h-4 w-4 text-red-600" />
                          </div>
                          <div>
                            <div className="font-medium">{vendor.name}</div>
                            {vendor.companyReg && (
                              <div className="text-sm text-muted-foreground">{vendor.companyReg}</div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {vendor.contactPerson && (
                          <div className="flex items-center space-x-2">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span>{vendor.contactPerson}</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {vendor.email && (
                          <div className="flex items-center space-x-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{vendor.email}</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={getVendorTypeColor(vendor.supplierType)}>
                          {getVendorTypeDisplay(vendor.supplierType)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{getPaymentTermsDisplay(vendor.paymentTerms)}</span>
                      </TableCell>
                      <TableCell>
                        {(vendor.city || vendor.country) && (
                          <div className="flex items-center space-x-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">
                              {[vendor.city, vendor.country].filter(Boolean).join(", ")}
                            </span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {vendor.bankName ? (
                          <div className="flex items-center space-x-2">
                            <CreditCard className="h-4 w-4 text-green-600" />
                            <span className="text-sm text-green-600">Available</span>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2">
                            <CreditCard className="h-4 w-4 text-gray-400" />
                            <span className="text-sm text-muted-foreground">Not Set</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {vendor.isApproved ? (
                            <Badge variant="outline" className="text-green-600 border-green-600">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Approved
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                              <Clock className="w-3 h-3 mr-1" />
                              Pending
                            </Badge>
                          )}
                          {!vendor.isActive && (
                            <Badge variant="outline" className="text-red-600 border-red-600">
                              <XCircle className="w-3 h-3 mr-1" />
                              Inactive
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(vendor)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit Vendor
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleVendorClick(vendor.id)}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <FolderOpen className="mr-2 h-4 w-4" />
                              View Projects
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {!vendor.isApproved && (
                              <DropdownMenuItem className="text-green-600">
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Approve Vendor
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem 
                              onClick={() => handleDelete(vendor.id)}
                              disabled={isDeleting === vendor.id}
                              className="text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
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

            {filteredAndSortedVendors.length === 0 && !loading && (
              <div className="text-center py-12">
                <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No vendors found</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  {searchTerm || filterType !== "all" || filterStatus !== "all" 
                    ? "Try adjusting your search criteria or add a new vendor."
                    : "Get started by adding your first vendor."
                  }
                </p>
                {!searchTerm && filterType === "all" && filterStatus === "all" && (
                  <Button onClick={handleAddNew} className="mt-4 bg-red-600 hover:bg-red-700">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Your First Vendor
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}
