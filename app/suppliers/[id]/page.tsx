
'use client'

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { MainLayout } from "@/components/layout/main-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  MapPin,
  Globe,
  FileText,
  Users,
  Edit,
  Activity,
  CreditCard,
  Calendar,
  CheckCircle,
  XCircle,
  DollarSign,
  Clock,
  FolderOpen,
  AlertCircle,
  Trash2,
  ShieldCheck,
  ShieldAlert,
  UploadCloud,
  AlertTriangle
} from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

interface Supplier {
  id: string
  supplierNumber?: string
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
  // Xero fields
  isXeroSynced?: boolean
  xeroContactId?: string | null
}

interface ActivityItem {
  id: string
  type: 'project' | 'purchase_order' | 'payment' | 'general'
  action: string
  description: string
  date: string
  entityId?: string
  entityName?: string
}

interface Project {
  id: string
  name: string
  status: string
  progress: number
  estimatedBudget: number
  actualCost: number
  startDate: string
  endDate?: string
}

interface PurchaseOrder {
  id: string
  orderNumber: string
  title: string
  amount: number
  totalAmount: number
  status: string
  issueDate: string
  dueDate: string
  paidDate?: string
}

interface ComplianceDocument {
  id: string
  name: string
  type: string
  fileUrl?: string | null
  verificationStatus: string
  verificationNotes?: string | null
  expiresAt?: string | null
  createdAt: string
}

interface ComplianceRiskProfile {
  complianceRiskScore: number
  financialRiskScore: number
  deliveryRiskScore: number
  overallRiskScore: number
  riskLevel: "LOW" | "MEDIUM" | "HIGH"
  riskEvaluatedAt: string
}

const supplierSchema = z.object({
  name: z.string().min(1, "Supplier name is required"),
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
  supplierType: z.enum(["SUPPLIER", "CONTRACTOR", "CONSULTANT", "SERVICE_PROVIDER"]).default("SUPPLIER"),
  paymentTerms: z.enum(["NET_15", "NET_30", "NET_60", "NET_90", "IMMEDIATE", "CUSTOM"]).default("NET_30"),
  contractDetails: z.string().optional(),
  bankName: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  bankAccountName: z.string().optional(),
  bankSwiftCode: z.string().optional(),
  bankAddress: z.string().optional(),
})

type SupplierFormData = z.infer<typeof supplierSchema>

export default function SupplierDetailPage() {
  const params = useParams()
  const router = useRouter()
  const supplierId = params.id as string
  const { formatCurrency } = useCurrencyFormat()
  const { data: session } = useSession() || {}
  
  const [loading, setLoading] = useState(true)
  const [supplier, setSupplier] = useState<Supplier | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [activitiesLoading, setActivitiesLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [complianceDocs, setComplianceDocs] = useState<ComplianceDocument[]>([])
  const [complianceRisk, setComplianceRisk] = useState<ComplianceRiskProfile | null>(null)
  const [complianceLoading, setComplianceLoading] = useState(false)
  const [newComplianceDoc, setNewComplianceDoc] = useState({
    name: "",
    type: "INSURANCE",
    expiresAt: "",
    fileUrl: "",
    verificationStatus: "PENDING"
  })
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const form = useForm<SupplierFormData>({
    resolver: zodResolver(supplierSchema),
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
    }
  })

  useEffect(() => {
    const fetchSupplierData = async () => {
      try {
        setLoading(true)
        
        // Fetch supplier details
        const supplierResponse = await fetch(`/api/suppliers/${supplierId}`)
        
        if (!supplierResponse.ok) {
          if (supplierResponse.status === 404) {
            throw new Error('Supplier not found. This record may have been removed or does not exist.')
          }
          console.error(`Failed to fetch supplier: ${supplierResponse.status} ${supplierResponse.statusText}`)
          throw new Error('Failed to fetch supplier details')
        }
        
        const supplierData = await supplierResponse.json()
        
        // Validate supplier data structure
        if (!supplierData || typeof supplierData !== 'object' || !supplierData.id) {
          console.error('Invalid supplier data received:', supplierData)
          throw new Error('Invalid supplier data received')
        }
        
        setSupplier(supplierData)

        // Fetch purchase orders for this supplier
        try {
          const purchaseOrdersResponse = await fetch(`/api/finance/purchase-orders?supplierId=${supplierId}`)
          if (purchaseOrdersResponse.ok) {
            const purchaseOrdersData = await purchaseOrdersResponse.json()
            setPurchaseOrders(purchaseOrdersData || [])
          } else {
            console.warn(`Purchase orders fetch failed: ${purchaseOrdersResponse.status} ${purchaseOrdersResponse.statusText}`)
            setPurchaseOrders([])
          }
        } catch (poError) {
          console.warn('Error fetching purchase orders:', poError)
          setPurchaseOrders([])
        }

        setLoading(false)
      } catch (error) {
        console.error('Error fetching supplier data:', error)
        const errorMessage = error instanceof Error ? error.message : 'Failed to load supplier data'
        setError(errorMessage)
        setSupplier(null)
        setLoading(false)
        
        // Log error to system logs
        try {
          await fetch('/api/logs/error', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'VIEW_SUPPLIER_DETAILS',
              message: errorMessage,
              module: 'Suppliers',
              endpoint: `/suppliers/${supplierId}`,
              errorCode: '404',
              metadata: { supplierId }
            })
          })
        } catch (logError) {
          console.error('Failed to log error:', logError)
        }
        
        toast.error(errorMessage)
      }
    }

    if (supplierId && typeof supplierId === 'string') {
      fetchSupplierData()
    } else {
      console.error('Invalid supplierId:', supplierId)
      setError('Invalid supplier ID')
      setLoading(false)
    }
  }, [supplierId])

  const loadCompliance = async () => {
    try {
      setComplianceLoading(true)
      const response = await fetch(`/api/suppliers/${supplierId}/compliance`)
      if (response.ok) {
        const data = await response.json()
        setComplianceDocs(data.documents || [])
        setComplianceRisk(data.risk || null)
      }
    } catch (err) {
      console.error("Failed to load compliance data", err)
    } finally {
      setComplianceLoading(false)
    }
  }

  useEffect(() => {
    if (supplierId) {
      loadCompliance()
    }
  }, [supplierId])

  const handleCreateComplianceDoc = async () => {
    try {
      setComplianceLoading(true)
      const payload = {
        ...newComplianceDoc,
        expiresAt: newComplianceDoc.expiresAt ? new Date(newComplianceDoc.expiresAt).toISOString() : null,
        fileUrl: newComplianceDoc.fileUrl || null
      }

      const response = await fetch(`/api/suppliers/${supplierId}/compliance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        throw new Error("Unable to save compliance document")
      }

      const data = await response.json()
      setComplianceDocs(data.documents || [])
      setComplianceRisk(data.risk || null)
      setNewComplianceDoc({
        name: "",
        type: "INSURANCE",
        expiresAt: "",
        fileUrl: "",
        verificationStatus: "PENDING"
      })
      toast.success("Compliance document saved")
    } catch (err) {
      console.error(err)
      toast.error("Failed to save compliance document")
    } finally {
      setComplianceLoading(false)
    }
  }

  const handleUpdateVerification = async (documentId: string, verificationStatus: string) => {
    try {
      setComplianceLoading(true)
      const response = await fetch(`/api/suppliers/${supplierId}/compliance`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId, verificationStatus })
      })

      if (!response.ok) {
        throw new Error("Unable to update compliance status")
      }

      const data = await response.json()
      setComplianceDocs(data.documents || [])
      setComplianceRisk(data.risk || null)
      toast.success("Compliance status updated")
    } catch (err) {
      console.error(err)
      toast.error("Failed to update compliance status")
    } finally {
      setComplianceLoading(false)
    }
  }

  const handleDeleteComplianceDoc = async (documentId: string) => {
    try {
      setComplianceLoading(true)
      const response = await fetch(`/api/suppliers/${supplierId}/compliance`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId })
      })

      if (!response.ok) {
        throw new Error("Unable to delete compliance document")
      }

      const data = await response.json()
      setComplianceDocs(data.documents || [])
      setComplianceRisk(data.risk || null)
      toast.success("Compliance document removed")
    } catch (err) {
      console.error(err)
      toast.error("Failed to delete compliance document")
    } finally {
      setComplianceLoading(false)
    }
  }

  const riskColor = (level?: string) => {
    switch (level) {
      case "HIGH":
        return "text-red-600"
      case "LOW":
        return "text-green-600"
      default:
        return "text-amber-600"
    }
  }

  const handleOpenEdit = () => {
    if (supplier) {
      form.reset({
        name: supplier.name,
        email: supplier.email || "",
        phone: supplier.phone || "",
        address: supplier.address || "",
        city: supplier.city || "",
        state: supplier.state || "",
        country: supplier.country || "Singapore",
        postalCode: supplier.postalCode || "",
        contactPerson: supplier.contactPerson || "",
        companyReg: supplier.companyReg || "",
        website: supplier.website || "",
        notes: supplier.notes || "",
        supplierType: (supplier.supplierType as any) || "SUPPLIER",
        paymentTerms: (supplier.paymentTerms as any) || "NET_30",
        contractDetails: supplier.contractDetails || "",
        bankName: supplier.bankName || "",
        bankAccountNumber: supplier.bankAccountNumber || "",
        bankAccountName: supplier.bankAccountName || "",
        bankSwiftCode: supplier.bankSwiftCode || "",
        bankAddress: supplier.bankAddress || "",
      })
      setIsEditDialogOpen(true)
    }
  }

  const handleSubmitEdit = async (data: SupplierFormData) => {
    try {
      const response = await fetch(`/api/suppliers/${supplierId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw new Error("Failed to update supplier")
      }

      const updatedSupplier = await response.json()
      setSupplier(updatedSupplier)
      toast.success("✅ Supplier updated successfully")
      setIsEditDialogOpen(false)
      
      // Refresh the page data
      window.location.reload()
    } catch (error) {
      console.error("Error updating supplier:", error)
      toast.error("❌ Update failed. Please try again or check your connection.")
    }
  }

  const handleDeleteSupplier = async () => {
    try {
      setDeleteLoading(true)
      
      const response = await fetch(`/api/suppliers/${supplierId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hard: false, // Soft delete by default
          reason: "Deleted by Super Admin"
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to delete supplier")
      }

      toast.success("✅ Supplier deleted successfully")
      setIsDeleteDialogOpen(false)
      
      // Redirect to suppliers list
      router.push('/contacts?tab=suppliers')
    } catch (error) {
      console.error("Error deleting supplier:", error)
      const errorMsg = error instanceof Error ? error.message : "Delete failed"
      toast.error(`❌ ${errorMsg}`)
    } finally {
      setDeleteLoading(false)
    }
  }

  const getSupplierTypeDisplay = (type?: string) => {
    if (!type) return "Supplier"
    switch (type) {
      case "MATERIALS":
        return "Materials"
      case "SERVICES":
        return "Services"
      case "EQUIPMENT":
        return "Equipment"
      case "SUBCONTRACTOR":
        return "Subcontractor"
      case "CONSULTANT":
        return "Consultant"
      default:
        return type
    }
  }

  const getPaymentTermsDisplay = (terms?: string) => {
    if (!terms) return "Not specified"
    switch (terms) {
      case "NET_30":
        return "Net 30 Days"
      case "NET_60":
        return "Net 60 Days"
      case "NET_90":
        return "Net 90 Days"
      case "IMMEDIATE":
        return "Immediate"
      case "ON_DELIVERY":
        return "On Delivery"
      case "CUSTOM":
        return "Custom Terms"
      default:
        return terms
    }
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </MainLayout>
    )
  }

  if (error || !supplier) {
    return (
      <MainLayout>
        <div className="p-6">
          <div className="text-center py-12">
            <Building2 className="mx-auto h-16 w-16 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-red-600 mb-2">
              {error ? 'Error Loading Supplier' : 'Supplier Not Found'}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {error || 'This supplier no longer exists or was removed from the system.'}
            </p>
            <Button onClick={() => router.push('/contacts')} className="mt-4">
              Back to Suppliers
            </Button>
          </div>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="p-6">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => router.push('/contacts')}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Suppliers
              </Button>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{supplier.name}</h1>
                  {supplier.isXeroSynced && (
                    <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Xero Synced
                    </Badge>
                  )}
                  {supplier.isApproved ? (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Approved
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                      <XCircle className="w-3 h-3 mr-1" />
                      Pending Approval
                    </Badge>
                  )}
                </div>
                <p className="text-gray-600 dark:text-gray-300 mt-1">
                  {getSupplierTypeDisplay(supplier.supplierType)} • Member since {format(new Date(supplier.createdAt), 'MMM d, yyyy')}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                className="bg-red-600 hover:bg-red-700"
                onClick={handleOpenEdit}
              >
                <Edit className="mr-2 h-4 w-4" />
                Edit Supplier
              </Button>
              {session?.user?.role === 'SUPERADMIN' && (
                <Button 
                  variant="destructive"
                  onClick={() => setIsDeleteDialogOpen(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Purchase Value</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(purchaseOrders.reduce((sum, po) => sum + (po?.totalAmount || 0), 0))}</div>
              <p className="text-xs text-muted-foreground">Across all transactions for this supplier</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Amount Paid</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(purchaseOrders.filter(po => po?.status === "PAID").reduce((sum, po) => sum + (po?.totalAmount || 0), 0))}</div>
              <p className="text-xs text-muted-foreground">Completed payments</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Outstanding Payables</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{formatCurrency(purchaseOrders.filter(po => po?.status && po.status !== "PAID" && po.status !== "CANCELLED").reduce((sum, po) => sum + (po?.totalAmount || 0), 0))}</div>
              <p className="text-xs text-muted-foreground">Awaiting payment</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Purchase Orders</CardTitle>
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{purchaseOrders.length}</div>
              <p className="text-xs text-muted-foreground">All purchase orders</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabbed Content */}
        <Tabs defaultValue="overview" className="space-y-6" onValueChange={(value) => {
          if (value === 'activity' && activities.length === 0 && !activitiesLoading) {
            // fetchActivities() - Uncomment when API is ready
          }
        }}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="projects">Projects</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="compliance">Compliance</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Contact Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Building2 className="mr-2 h-5 w-5" />
                    Contact Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {supplier.supplierNumber && (
                    <div className="flex items-center space-x-3">
                      <FileText className="h-4 w-4 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Supplier Number</p>
                        <p className="font-medium">{supplier.supplierNumber}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center space-x-3">
                    <Mail className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Email</p>
                      <p className="font-medium">{supplier.email || 'Not provided'}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Phone</p>
                      <p className="font-medium">{supplier.phone || 'Not provided'}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <MapPin className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Address</p>
                      <p className="font-medium">
                        {supplier.address ? (
                          <>
                            {supplier.address}
                            {supplier.city && `, ${supplier.city}`}
                            {supplier.state && `, ${supplier.state}`}
                            {supplier.postalCode && ` ${supplier.postalCode}`}
                            <br />
                            {supplier.country}
                          </>
                        ) : (
                          'Not provided'
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Users className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Contact Person</p>
                      <p className="font-medium">{supplier.contactPerson || 'Not provided'}</p>
                    </div>
                  </div>
                  {supplier.website && (
                    <div className="flex items-center space-x-3">
                      <Globe className="h-4 w-4 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Website</p>
                        <a 
                          href={supplier.website} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="font-medium text-blue-600 hover:text-blue-500"
                        >
                          {supplier.website}
                        </a>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Company Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <FileText className="mr-2 h-5 w-5" />
                    Company Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <FileText className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Company Registration</p>
                      <p className="font-medium">{supplier.companyReg || 'Not provided'}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Added On</p>
                      <p className="font-medium">{format(new Date(supplier.createdAt), 'PPP')}</p>
                    </div>
                  </div>
                  {supplier.xeroContactId && (
                    <div className="flex items-center space-x-3">
                      <CheckCircle className="h-4 w-4 text-purple-600" />
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Xero Contact ID</p>
                        <p className="font-medium text-purple-600">{supplier.xeroContactId}</p>
                      </div>
                    </div>
                  )}
                  {supplier.notes && (
                    <div className="space-y-2">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Notes</p>
                      <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
                        <p className="text-sm whitespace-pre-wrap">{supplier.notes}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="projects" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Supplier Projects</CardTitle>
                <CardDescription>All projects associated with this supplier</CardDescription>
              </CardHeader>
              <CardContent>
                {projects && projects.length > 0 ? (
                  <div className="space-y-4">
                    {projects.map((project) => (
                      <div key={project.id} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium">{project.name}</h4>
                          <Badge variant="outline" className={
                            project.status === "COMPLETED" ? "bg-green-100 text-green-800" :
                            project.status === "IN_PROGRESS" ? "bg-blue-100 text-blue-800" :
                            "bg-gray-100 text-gray-800"
                          }>
                            {project.status.replace('_', ' ')}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-gray-600 dark:text-gray-400">Budget</p>
                            <p className="font-medium">{formatCurrency(project.estimatedBudget || 0)}</p>
                          </div>
                          <div>
                            <p className="text-gray-600 dark:text-gray-400">Actual Cost</p>
                            <p className="font-medium">{formatCurrency(project.actualCost || 0)}</p>
                          </div>
                          <div>
                            <p className="text-gray-600 dark:text-gray-400">Start Date</p>
                            <p className="font-medium">{project.startDate ? new Date(project.startDate).toLocaleDateString() : 'Not set'}</p>
                          </div>
                          <div>
                            <p className="text-gray-600 dark:text-gray-400">End Date</p>
                            <p className="font-medium">{project.endDate ? new Date(project.endDate).toLocaleDateString() : "TBD"}</p>
                          </div>
                        </div>
                        {project.status === "IN_PROGRESS" && (
                          <div className="mt-3">
                            <div className="flex justify-between text-sm mb-1">
                              <span>Progress</span>
                              <span>{project.progress || 0}%</span>
                            </div>
                            <Progress value={project.progress || 0} className="h-2" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <FolderOpen className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">No Projects Yet</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      This supplier doesn't have any projects yet. Projects will appear here once they are created.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invoices" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Supplier Invoices</CardTitle>
                <CardDescription>All purchase orders and invoices for this supplier</CardDescription>
              </CardHeader>
              <CardContent>
                {purchaseOrders && purchaseOrders.length > 0 ? (
                  <div className="space-y-4">
                    {purchaseOrders.map((order) => (
                      <div key={order.id} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h4 className="font-medium">{order.orderNumber}</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400">{order.title}</p>
                          </div>
                          <Badge variant="outline" className={
                            order.status === "PAID" ? "bg-green-100 text-green-800" :
                            order.status === "SENT" ? "bg-blue-100 text-blue-800" :
                            order.status === "OVERDUE" ? "bg-red-100 text-red-800" :
                            "bg-gray-100 text-gray-800"
                          }>
                            {order.status}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-gray-600 dark:text-gray-400">Amount</p>
                            <p className="font-medium">{formatCurrency(order.totalAmount || 0)}</p>
                          </div>
                          <div>
                            <p className="text-gray-600 dark:text-gray-400">Issue Date</p>
                            <p className="font-medium">{order.issueDate ? new Date(order.issueDate).toLocaleDateString() : 'Not set'}</p>
                          </div>
                          <div>
                            <p className="text-gray-600 dark:text-gray-400">Due Date</p>
                            <p className="font-medium">{order.dueDate ? new Date(order.dueDate).toLocaleDateString() : 'Not set'}</p>
                          </div>
                          <div>
                            <p className="text-gray-600 dark:text-gray-400">Paid Date</p>
                            <p className="font-medium">{order.paidDate ? new Date(order.paidDate).toLocaleDateString() : "-"}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">No Invoices Yet</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      This supplier doesn't have any purchase orders yet. Orders will appear here once they are created.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="compliance" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <ShieldCheck className="mr-2 h-5 w-5" />
                    Risk Overview
                  </CardTitle>
                  <CardDescription>Automated risk profile based on compliance records</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {complianceRisk ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">Overall</p>
                        <span className={`font-semibold ${riskColor(complianceRisk.riskLevel)}`}>
                          {complianceRisk.overallRiskScore} ({complianceRisk.riskLevel})
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span>Compliance</span>
                        <span className="font-medium">{complianceRisk.complianceRiskScore}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span>Financial</span>
                        <span className="font-medium">{complianceRisk.financialRiskScore}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span>Delivery</span>
                        <span className="font-medium">{complianceRisk.deliveryRiskScore}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Last evaluated {complianceRisk.riskEvaluatedAt ? format(new Date(complianceRisk.riskEvaluatedAt), 'PPpp') : 'recently'}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No risk signals yet.</p>
                  )}
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center">
                      <ShieldAlert className="mr-2 h-5 w-5" />
                      Compliance Documents
                    </CardTitle>
                    <CardDescription>Track expirations and verification</CardDescription>
                  </div>
                  {complianceLoading && <Badge variant="outline">Refreshing...</Badge>}
                </CardHeader>
                <CardContent>
                  {complianceDocs.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">
                      No compliance documents uploaded yet.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {complianceDocs.map((doc) => {
                        const expiresSoon = doc.expiresAt ? (new Date(doc.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24) <= 30 : false
                        return (
                          <div key={doc.id} className="border rounded-lg p-4">
                            <div className="flex items-start justify-between">
                              <div className="space-y-1">
                                <p className="font-semibold">{doc.name}</p>
                                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                                  <Badge variant="outline">{doc.type}</Badge>
                                  <Badge variant={doc.verificationStatus === 'VERIFIED' ? 'default' : 'secondary'}>{doc.verificationStatus}</Badge>
                                  {doc.expiresAt && (
                                    <span className="flex items-center space-x-1">
                                      <Calendar className="h-4 w-4" />
                                      <span>
                                        Expires {format(new Date(doc.expiresAt), 'PP')}
                                        {expiresSoon && <span className="ml-2 inline-flex items-center text-amber-600"><AlertTriangle className="h-4 w-4 mr-1" />Soon</span>}
                                      </span>
                                    </span>
                                  )}
                                </div>
                                {doc.fileUrl && (
                                  <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="text-blue-600 text-sm underline">
                                    View document
                                  </a>
                                )}
                              </div>
                              <div className="flex items-center space-x-2">
                                <Select onValueChange={(value) => handleUpdateVerification(doc.id, value)} defaultValue={doc.verificationStatus}>
                                  <SelectTrigger className="w-[140px]">
                                    <SelectValue placeholder="Status" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {['PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED'].map((status) => (
                                      <SelectItem key={status} value={status}>{status}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Button variant="ghost" size="icon" onClick={() => handleDeleteComplianceDoc(doc.id)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <UploadCloud className="mr-2 h-5 w-5" />
                  Add Compliance Document
                </CardTitle>
                <CardDescription>Upload metadata and track renewal dates</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Name</Label>
                    <Input
                      value={newComplianceDoc.name}
                      onChange={(e) => setNewComplianceDoc({ ...newComplianceDoc, name: e.target.value })}
                      placeholder="E.g. Insurance Certificate"
                    />
                  </div>
                  <div>
                    <Label>Type</Label>
                    <Select
                      onValueChange={(value) => setNewComplianceDoc({ ...newComplianceDoc, type: value })}
                      defaultValue={newComplianceDoc.type}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Document type" />
                      </SelectTrigger>
                      <SelectContent>
                        {['INSURANCE', 'LICENSE', 'SAFETY', 'CERTIFICATION', 'FINANCIAL', 'CUSTOM'].map((type) => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Expiry Date</Label>
                    <Input
                      type="date"
                      value={newComplianceDoc.expiresAt}
                      onChange={(e) => setNewComplianceDoc({ ...newComplianceDoc, expiresAt: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Verification Status</Label>
                    <Select
                      onValueChange={(value) => setNewComplianceDoc({ ...newComplianceDoc, verificationStatus: value })}
                      defaultValue={newComplianceDoc.verificationStatus}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        {['PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED'].map((status) => (
                          <SelectItem key={status} value={status}>{status}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2">
                    <Label>Document URL (optional)</Label>
                    <Input
                      type="url"
                      value={newComplianceDoc.fileUrl}
                      onChange={(e) => setNewComplianceDoc({ ...newComplianceDoc, fileUrl: e.target.value })}
                      placeholder="https://"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleCreateComplianceDoc} disabled={complianceLoading || !newComplianceDoc.name}>
                    Save Document
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Activity Timeline
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {/* fetchActivities() - Uncomment when API is ready */}}
                    disabled={activitiesLoading}
                  >
                    {activitiesLoading ? 'Loading...' : 'Refresh'}
                  </Button>
                </CardTitle>
                <CardDescription>Complete activity history for this supplier</CardDescription>
              </CardHeader>
              <CardContent>
                {activitiesLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Loading activities...</p>
                  </div>
                ) : activities.length > 0 ? (
                  <div className="space-y-6">
                    {activities.map((activity) => (
                      <div key={activity.id} className="flex items-start space-x-4">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center bg-blue-100">
                          <Activity className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{activity.description}</p>
                          {activity.entityName && (
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              Related to: {activity.entityName}
                            </p>
                          )}
                          <p className="text-xs text-gray-500">
                            {new Date(activity.date).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Activity className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">No Activities Found</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      No activities have been recorded for this supplier yet. Activities will appear here as you work with projects, purchase orders, and other supplier-related tasks.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Edit Supplier Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Supplier</DialogTitle>
              <DialogDescription>
                Update supplier information
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(handleSubmitEdit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="name">Supplier Name *</Label>
                  <Input id="name" {...form.register("name")} />
                  {form.formState.errors.name && (
                    <p className="text-sm text-red-500 mt-1">{form.formState.errors.name.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" {...form.register("email")} />
                  {form.formState.errors.email && (
                    <p className="text-sm text-red-500 mt-1">{form.formState.errors.email.message}</p>
                  )}
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
                  <Label htmlFor="supplierType">Supplier Type</Label>
                  <Select
                    value={form.watch("supplierType")}
                    onValueChange={(value) => form.setValue("supplierType", value as any)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SUPPLIER">Supplier</SelectItem>
                      <SelectItem value="CONTRACTOR">Contractor</SelectItem>
                      <SelectItem value="CONSULTANT">Consultant</SelectItem>
                      <SelectItem value="SERVICE_PROVIDER">Service Provider</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="paymentTerms">Payment Terms</Label>
                  <Select
                    value={form.watch("paymentTerms")}
                    onValueChange={(value) => form.setValue("paymentTerms", value as any)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NET_15">Net 15</SelectItem>
                      <SelectItem value="NET_30">Net 30</SelectItem>
                      <SelectItem value="NET_60">Net 60</SelectItem>
                      <SelectItem value="NET_90">Net 90</SelectItem>
                      <SelectItem value="IMMEDIATE">Immediate</SelectItem>
                      <SelectItem value="CUSTOM">Custom</SelectItem>
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
                  <Label htmlFor="contractDetails">Contract Details</Label>
                  <Textarea id="contractDetails" {...form.register("contractDetails")} rows={2} />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea id="notes" {...form.register("notes")} rows={3} />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-red-600 hover:bg-red-700">
                  Update Supplier
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Supplier</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this supplier? This action will soft-delete the supplier record, making it inactive but preserving the data for audit purposes.
                {supplier?.isXeroSynced && (
                  <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-md border border-yellow-200 dark:border-yellow-800">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium">
                      ⚠️ Xero Synced Contact
                    </p>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                      This supplier is synced with Xero. Deleting it here will not affect the Xero record. The contact will remain in Xero and may be re-synced in future sync operations.
                    </p>
                  </div>
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsDeleteDialogOpen(false)}
                disabled={deleteLoading}
              >
                Cancel
              </Button>
              <Button 
                type="button" 
                variant="destructive"
                onClick={handleDeleteSupplier}
                disabled={deleteLoading}
              >
                {deleteLoading ? "Deleting..." : "Delete Supplier"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  )
}
