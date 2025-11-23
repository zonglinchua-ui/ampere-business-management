

'use client'

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { MainLayout } from "@/components/layout/main-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { 
  Upload,
  Building2,
  DollarSign,
  Calendar,
  ArrowLeft,
  Save,
  FileText,
  User,
  Package,
  AlertTriangle
} from "lucide-react"
import { format } from "date-fns"

interface Vendor {
  id: string
  name: string
  email?: string
  phone?: string
}

interface Project {
  id: string
  projectNumber: string
  name: string
}

interface PurchaseOrder {
  id: string
  poNumber: string
  vendor?: {
    id: string
    name: string
  }
  totalAmount: number
  currency: string
}

const statusOptions = [
  { value: "RECEIVED", label: "Received" },
  { value: "UNDER_REVIEW", label: "Under Review" },
  { value: "APPROVED", label: "Approved" },
  { value: "DISPUTED", label: "Disputed" }
]

export default function UploadVendorInvoicePage() {
  const router = useRouter()
  const { data: session } = useSession()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)

  // Data for dropdowns
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])

  // Form data
  const [invoiceData, setInvoiceData] = useState({
    supplierId: "",
    projectId: "",
    purchaseOrderId: "",
    amount: "",
    currency: "SGD",
    status: "RECEIVED",
    dueDate: "",
    receivedDate: new Date().toISOString().split('T')[0],
    description: "",
    paymentTerms: "",
    notes: "",
    vendorInvoiceNumber: ""
  })

  const userRole = session?.user?.role
  const canAccessFinance = ["SUPERADMIN", "FINANCE"].includes(userRole || "")

  useEffect(() => {
    if (canAccessFinance) {
      fetchDropdownData()
    }
  }, [canAccessFinance])

  const fetchDropdownData = async () => {
    try {
      // Fetch vendors
      const vendorsResponse = await fetch('/api/vendors?limit=1000')
      if (vendorsResponse.ok) {
        const vendorsData = await vendorsResponse.json()
        setVendors(vendorsData.vendors || [])
      }

      // Fetch projects
      const projectsResponse = await fetch('/api/projects?limit=1000')
      if (projectsResponse.ok) {
        const projectsData = await projectsResponse.json()
        setProjects(projectsData.projects || [])
      }

      // Fetch purchase orders
      const poResponse = await fetch('/api/finance/purchase-orders?limit=1000')
      if (poResponse.ok) {
        const poData = await poResponse.json()
        // API returns array directly, not wrapped in purchaseOrders property
        setPurchaseOrders(Array.isArray(poData) ? poData : [])
      }

    } catch (error) {
      console.error('Error fetching dropdown data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setUploadedFile(file)
      // Pre-populate invoice number from filename if possible
      const filename = file.name.replace(/\.[^/.]+$/, "")
      if (!invoiceData.vendorInvoiceNumber) {
        setInvoiceData(prev => ({ ...prev, vendorInvoiceNumber: filename }))
      }
    }
  }

  const handleSubmit = async (isDraft = false) => {
    setSaving(true)
    try {
      const payload = {
        supplierId: invoiceData.supplierId,
        projectId: invoiceData.projectId || null,
        purchaseOrderId: invoiceData.purchaseOrderId || null,
        amount: parseFloat(invoiceData.amount),
        currency: invoiceData.currency,
        status: isDraft ? 'RECEIVED' : invoiceData.status,
        dueDate: invoiceData.dueDate || null,
        receivedDate: invoiceData.receivedDate,
        description: invoiceData.description,
        paymentTerms: invoiceData.paymentTerms,
        notes: invoiceData.notes,
        vendorInvoiceNumber: invoiceData.vendorInvoiceNumber
      }

      console.log('Creating vendor invoice:', payload)

      const response = await fetch('/api/finance/vendor-invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        const result = await response.json()
        console.log('Vendor invoice created successfully:', result)
        alert(`Vendor invoice ${isDraft ? 'saved as draft' : 'uploaded'} successfully!`)
        router.push('/finance/vendor-invoices')
      } else {
        const error = await response.json()
        console.error('API Error:', error)
        alert(`Failed to create vendor invoice: ${error.error || 'Unknown error'}`)
      }

    } catch (error) {
      console.error('Error creating vendor invoice:', error)
      alert('Failed to create vendor invoice. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const canSave = () => {
    return invoiceData.supplierId && invoiceData.amount && parseFloat(invoiceData.amount) > 0
  }

  const getSelectedVendor = () => {
    return vendors.find(vendor => vendor.id === invoiceData.supplierId)
  }

  const getSelectedProject = () => {
    return projects.find(project => project.id === invoiceData.projectId)
  }

  if (!canAccessFinance) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <AlertTriangle className="mx-auto h-12 w-12 text-yellow-600 mb-4" />
            <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
            <p className="text-gray-600 mt-2">You don't have permission to upload vendor invoices.</p>
          </div>
        </div>
      </MainLayout>
    )
  }

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
      <div className="container mx-auto p-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Vendor Invoices
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Upload Vendor Invoice
              </h1>
              <p className="text-gray-600 dark:text-gray-300">
                Upload and process vendor bills and invoices
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" onClick={() => handleSubmit(true)} disabled={saving || !canSave()}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Saving...' : 'Save Draft'}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* File Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Upload className="mr-2 h-5 w-5" />
                Invoice Document
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Upload Invoice File *</label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <input
                    type="file"
                    id="invoice-upload"
                    className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    onChange={handleFileUpload}
                  />
                  <label htmlFor="invoice-upload" className="cursor-pointer">
                    <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500 mb-2">
                      Click to upload or drag and drop
                    </p>
                    <p className="text-xs text-gray-400">
                      PDF, DOC, DOCX, JPG, PNG up to 10MB
                    </p>
                  </label>
                </div>
                {uploadedFile && (
                  <div className="mt-2 p-2 bg-green-50 rounded-lg">
                    <p className="text-sm text-green-800">
                      <FileText className="inline h-4 w-4 mr-1" />
                      {uploadedFile.name}
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Vendor Invoice Number</label>
                <Input
                  placeholder="Vendor's invoice number"
                  value={invoiceData.vendorInvoiceNumber}
                  onChange={(e) => setInvoiceData({...invoiceData, vendorInvoiceNumber: e.target.value})}
                />
              </div>
            </CardContent>
          </Card>

          {/* Vendor Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Building2 className="mr-2 h-5 w-5" />
                Vendor Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Vendor *</label>
                <Select 
                  value={invoiceData.supplierId} 
                  onValueChange={(value) => setInvoiceData({...invoiceData, supplierId: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map(vendor => (
                      <SelectItem key={vendor.id} value={vendor.id}>
                        {vendor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Project (Optional)</label>
                <Select 
                  value={invoiceData.projectId || "no-project"} 
                  onValueChange={(value) => setInvoiceData({...invoiceData, projectId: value === "no-project" ? "" : value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select project (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no-project">No Project</SelectItem>
                    {projects.map(project => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                        <span className="text-gray-500 ml-2">({project.projectNumber})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Purchase Order (Optional)</label>
                <Select 
                  value={invoiceData.purchaseOrderId || "no-po"} 
                  onValueChange={(value) => setInvoiceData({...invoiceData, purchaseOrderId: value === "no-po" ? "" : value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select purchase order (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no-po">No Purchase Order</SelectItem>
                    {purchaseOrders
                      .filter(po => !invoiceData.supplierId || po.vendor?.id === invoiceData.supplierId)
                      .map(po => (
                        <SelectItem key={po.id} value={po.id}>
                          {po.poNumber}
                          <span className="text-gray-500 ml-2">
                            ({po.currency} {po.totalAmount.toFixed(2)})
                          </span>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">
                  {invoiceData.supplierId 
                    ? "Showing POs for selected vendor" 
                    : "Select a vendor first to filter POs"}
                </p>
              </div>

              {getSelectedVendor() && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">Selected Vendor</h4>
                  <p className="text-sm text-blue-800">{getSelectedVendor()?.name}</p>
                  {getSelectedVendor()?.email && (
                    <p className="text-sm text-blue-600">{getSelectedVendor()?.email}</p>
                  )}
                  {getSelectedVendor()?.phone && (
                    <p className="text-sm text-blue-600">{getSelectedVendor()?.phone}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Invoice Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <DollarSign className="mr-2 h-5 w-5" />
                Invoice Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Amount *</label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={invoiceData.amount}
                    onChange={(e) => setInvoiceData({...invoiceData, amount: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Currency</label>
                  <Select 
                    value={invoiceData.currency} 
                    onValueChange={(value) => setInvoiceData({...invoiceData, currency: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SGD">Singapore Dollar (SGD)</SelectItem>
                      <SelectItem value="USD">US Dollar (USD)</SelectItem>
                      <SelectItem value="EUR">Euro (EUR)</SelectItem>
                      <SelectItem value="MYR">Malaysian Ringgit (MYR)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Status</label>
                <Select 
                  value={invoiceData.status} 
                  onValueChange={(value) => setInvoiceData({...invoiceData, status: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Received Date *</label>
                  <Input
                    type="date"
                    value={invoiceData.receivedDate}
                    onChange={(e) => setInvoiceData({...invoiceData, receivedDate: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Due Date (Optional)</label>
                  <Input
                    type="date"
                    value={invoiceData.dueDate}
                    onChange={(e) => setInvoiceData({...invoiceData, dueDate: e.target.value})}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Additional Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="mr-2 h-5 w-5" />
                Additional Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <Textarea
                  placeholder="Invoice description or purpose"
                  value={invoiceData.description}
                  onChange={(e) => setInvoiceData({...invoiceData, description: e.target.value})}
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Payment Terms</label>
                <Input
                  placeholder="e.g., Net 30 days"
                  value={invoiceData.paymentTerms}
                  onChange={(e) => setInvoiceData({...invoiceData, paymentTerms: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Notes</label>
                <Textarea
                  placeholder="Internal notes or comments"
                  value={invoiceData.notes}
                  onChange={(e) => setInvoiceData({...invoiceData, notes: e.target.value})}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Summary Card */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Invoice Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <div className="text-sm text-gray-500">Vendor</div>
                <div className="font-medium">
                  {getSelectedVendor()?.name || 'Not selected'}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Amount</div>
                <div className="font-medium text-lg">
                  {invoiceData.currency} {invoiceData.amount || '0.00'}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Status</div>
                <div className="font-medium">
                  {statusOptions.find(s => s.value === invoiceData.status)?.label}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-end items-center mt-8 space-x-4">
          <Button variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button 
            onClick={() => handleSubmit(false)}
            disabled={saving || !canSave()}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {saving ? 'Uploading...' : 'Upload Invoice'}
            <Upload className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </MainLayout>
  )
}
