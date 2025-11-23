
'use client'

import { useState, useEffect, Suspense } from "react"
import { useSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { MainLayout } from "@/components/layout/main-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { getDefaultPOTerms } from "@/lib/po-default-terms"
import { toast } from "sonner"
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
  ArrowRight,
  Save,
  Plus,
  Trash2,
  Calculator,
  FileText,
  Upload,
  Eye,
  ChevronLeft,
  ChevronRight,
  Building2,
  User,
  Calendar,
  DollarSign,
  Package,
  Percent,
  Hash,
  Type,
  Truck
} from "lucide-react"
import { format } from "date-fns"

interface Supplier {
  id: string
  name: string
  email?: string
  phone?: string
  supplierNumber?: string
  contactPerson?: string
  isActive?: boolean
}

interface Project {
  id: string
  projectNumber: string
  name: string
  status: string
}

interface POItem {
  id: string
  serialNumber: string
  description: string
  category: string
  quantity: number
  unit: string
  unitPrice: number
  discount: number
  taxRate: number
  subtotal: number
  discountAmount: number
  taxAmount: number
  totalPrice: number
  notes: string
  order: number
}

const itemCategories = [
  { value: "MATERIALS", label: "Materials" },
  { value: "SERVICES", label: "Services" },
  { value: "SUBCONTRACTORS", label: "Subcontractors" },
  { value: "MISCELLANEOUS", label: "Miscellaneous" }
]

const currencies = [
  { value: "SGD", label: "Singapore Dollar (SGD)" },
  { value: "USD", label: "US Dollar (USD)" },
  { value: "EUR", label: "Euro (EUR)" },
  { value: "MYR", label: "Malaysian Ringgit (MYR)" }
]

const units = [
  "pcs", "units", "hours", "days", "sqm", "m", "kg", "lots", "set", "package", "nos."
]

function CreatePurchaseOrderContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session } = useSession() || {}
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [supplierDropdownOpen, setSupplierDropdownOpen] = useState(false)

  // Data for dropdowns
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [projects, setProjects] = useState<Project[]>([])

  // Form data
  const [poData, setPOData] = useState({
    supplierId: "",
    projectId: "", // Will be set from URL in useEffect
    deliveryDate: "", // Will be set after component mounts to avoid hydration issues
    deliveryAddress: "",
    currency: "SGD",
    terms: getDefaultPOTerms(), // Load default standard terms
    notes: "",
    // PO-level discount and tax
    discountPercentage: 0,
    taxPercentage: 0 // Tax is calculated at item level (each item has 9% GST), not PO level
  })

  // Set projectId from URL on mount (run once)
  useEffect(() => {
    const urlProjectId = searchParams?.get('projectId')
    if (urlProjectId) {
      setPOData(prevData => ({
        ...prevData,
        projectId: urlProjectId
      }))
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Set default delivery date after component mounts to avoid hydration issues
  useEffect(() => {
    const date = new Date()
    date.setDate(date.getDate() + 30)
    const defaultDeliveryDate = date.toISOString().split('T')[0]
    setPOData(prevData => ({
      ...prevData,
      deliveryDate: defaultDeliveryDate
    }))
  }, [])

  const [poItems, setPOItems] = useState<POItem[]>([
    {
      id: "initial_item_1",
      serialNumber: "",
      description: "",
      category: "MATERIALS",
      quantity: 1,
      unit: "pcs",
      unitPrice: 0,
      discount: 0,
      taxRate: 9,
      subtotal: 0,
      discountAmount: 0,
      taxAmount: 0,
      totalPrice: 0,
      notes: "",
      order: 1
    }
  ])

  const [calculations, setCalculations] = useState({
    subtotal: 0,
    totalDiscount: 0,
    totalTax: 0,
    grandTotal: 0
  })

  const steps = [
    { 
      number: 1, 
      title: "Basic Information", 
      description: "Supplier and project details",
      icon: Building2 
    },
    { 
      number: 2, 
      title: "Items", 
      description: "Add purchase order items",
      icon: Package 
    },
    { 
      number: 3, 
      title: "Review & Create", 
      description: "Final review and submit",
      icon: Eye 
    }
  ]

  useEffect(() => {
    fetchDropdownData()
  }, [])

  useEffect(() => {
    calculateTotals()
  }, [poItems, poData.discountPercentage, poData.taxPercentage])

  const fetchDropdownData = async () => {
    try {
      // Fetch suppliers - use pageSize parameter (API expects pageSize, not limit)
      // includeInactive=true to show all suppliers (active and inactive) in dropdown
      console.log('Fetching suppliers...')
      const suppliersResponse = await fetch('/api/suppliers?pageSize=10000&includeInactive=true')
      console.log('Suppliers response status:', suppliersResponse.status)
      if (suppliersResponse.ok) {
        const suppliersData = await suppliersResponse.json()
        console.log('Suppliers data:', suppliersData)
        // API returns { data: [...], page, pageSize, totalRecords, totalPages }
        console.log('Number of suppliers fetched:', suppliersData.data?.length || 0)
        console.log('Total suppliers in database:', suppliersData.totalRecords || 0)
        setSuppliers(suppliersData.data || [])
      } else {
        console.error('Failed to fetch suppliers:', await suppliersResponse.text())
      }

      // Fetch projects
      console.log('Fetching projects...')
      const projectsResponse = await fetch('/api/projects?limit=1000')
      console.log('Projects response status:', projectsResponse.status)
      if (projectsResponse.ok) {
        const projectsData = await projectsResponse.json()
        console.log('Number of projects:', projectsData.projects?.length || 0)
        setProjects(projectsData.projects || [])
      } else {
        console.error('Failed to fetch projects:', await projectsResponse.text())
      }

    } catch (error) {
      console.error('Error fetching dropdown data:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateItemTotals = (item: POItem) => {
    const subtotal = item.quantity * item.unitPrice
    const discountAmount = (subtotal * item.discount) / 100
    const discountedAmount = subtotal - discountAmount
    const taxAmount = (discountedAmount * item.taxRate) / 100
    const totalPrice = discountedAmount + taxAmount

    return {
      ...item,
      subtotal: Number(subtotal.toFixed(2)),
      discountAmount: Number(discountAmount.toFixed(2)),
      taxAmount: Number(taxAmount.toFixed(2)),
      totalPrice: Number(totalPrice.toFixed(2))
    }
  }

  const calculateTotals = () => {
    const itemTotals = poItems.reduce(
      (acc, item) => {
        const calculatedItem = calculateItemTotals(item)
        return {
          subtotal: acc.subtotal + calculatedItem.subtotal,
          totalDiscount: acc.totalDiscount + calculatedItem.discountAmount,
          totalTax: acc.totalTax + calculatedItem.taxAmount,
          grandTotal: acc.grandTotal + calculatedItem.totalPrice
        }
      },
      { subtotal: 0, totalDiscount: 0, totalTax: 0, grandTotal: 0 }
    )

    // Apply PO-level discount (tax is already calculated at item level, so we don't add PO-level tax)
    const subtotalAfterItemDiscounts = itemTotals.subtotal - itemTotals.totalDiscount
    const poLevelDiscount = (subtotalAfterItemDiscounts * poData.discountPercentage) / 100
    const finalSubtotal = subtotalAfterItemDiscounts - poLevelDiscount
    
    // Tax is already included in itemTotals.totalTax from individual items (each at 9% GST)
    // We do NOT add PO-level tax on top to avoid double taxation
    const finalTotal = finalSubtotal + itemTotals.totalTax

    setCalculations({
      subtotal: Number(itemTotals.subtotal.toFixed(2)),
      totalDiscount: Number((itemTotals.totalDiscount + poLevelDiscount).toFixed(2)),
      totalTax: Number(itemTotals.totalTax.toFixed(2)), // Only use item-level tax
      grandTotal: Number(finalTotal.toFixed(2))
    })
  }

  const updatePOItem = (id: string, field: keyof POItem, value: any) => {
    setPOItems(items => 
      items.map(item => 
        item.id === id ? { ...item, [field]: value } : item
      )
    )
  }

  const addPOItem = () => {
    const newItem: POItem = {
      id: `item_${poItems.length + 1}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      serialNumber: "",
      description: "",
      category: "MATERIALS",
      quantity: 1,
      unit: "pcs",
      unitPrice: 0,
      discount: 0,
      taxRate: 9,
      subtotal: 0,
      discountAmount: 0,
      taxAmount: 0,
      totalPrice: 0,
      notes: "",
      order: poItems.length + 1
    }
    setPOItems([...poItems, newItem])
  }

  const removePOItem = (id: string) => {
    if (poItems.length > 1) {
      setPOItems(items => items.filter(item => item.id !== id))
    }
  }

  const handleSubmit = async (isDraft = false) => {
    setSaving(true)
    try {
      console.log('Starting PO creation...')
      console.log('PO Data:', poData)
      console.log('PO Items:', poItems)
      console.log('Calculations:', calculations)
      
      const selectedSupplier = suppliers.find(s => s.id === poData.supplierId)
      console.log('Selected Supplier:', selectedSupplier)
      
      if (!selectedSupplier) {
        toast.error('Please select a supplier')
        setSaving(false)
        return
      }
      
      const payload = {
        ...poData,
        supplierCode: selectedSupplier?.supplierNumber || selectedSupplier?.name?.substring(0, 3).toUpperCase() || 'SUP',
        items: poItems.map(calculateItemTotals),
        subtotal: calculations.subtotal,
        taxAmount: calculations.totalTax,
        totalAmount: calculations.grandTotal,
        // Include PO-level discount and tax
        discountPercentage: poData.discountPercentage || 0,
        taxPercentage: poData.taxPercentage || 0,
        status: isDraft ? 'DRAFT' : 'DRAFT' // Default to DRAFT, can be changed later
      }

      console.log('Payload being sent:', payload)

      const response = await fetch('/api/finance/purchase-orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        const result = await response.json()
        console.log('Purchase Order created successfully:', result)
        if (isDraft) {
          toast.success('Purchase Order saved as draft successfully!')
        } else {
          toast.success('Purchase Order created successfully!')
        }
        router.push(`/finance/purchase-orders`)
      } else {
        const error = await response.json()
        console.error('API Error:', error)
        toast.error(`Failed to create purchase order: ${error.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error creating purchase order:', error)
      toast.error('Failed to create purchase order. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const canProceedToNext = () => {
    switch (currentStep) {
      case 1:
        return poData.supplierId && poData.deliveryDate
      case 2:
        return poItems.some(item => 
          item.description.trim() && item.quantity > 0 && item.unitPrice > 0
        )
      case 3:
        return true
      default:
        return false
    }
  }

  const canSaveDraft = () => {
    return poData.supplierId
  }

  const nextStep = () => {
    if (currentStep < steps.length && canProceedToNext()) {
      setCurrentStep(currentStep + 1)
    }
  }

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const getSelectedSupplier = () => {
    return suppliers.find(supplier => supplier.id === poData.supplierId)
  }

  const getSelectedProject = () => {
    return projects.find(project => project.id === poData.projectId)
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
      <div className="container mx-auto p-6 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Purchase Orders
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Create New Purchase Order
              </h1>
              <p className="text-gray-600 dark:text-gray-300">
                Step-by-step purchase order creation wizard
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" onClick={() => handleSubmit(true)} disabled={saving || !canSaveDraft()}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Saving...' : 'Save Draft'}
            </Button>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center mb-8">
          {steps.map((step, index) => (
            <div key={step.number} className="flex items-center">
              <div className={`
                flex items-center justify-center w-10 h-10 rounded-full border-2 
                ${currentStep === step.number 
                  ? 'bg-blue-600 text-white border-blue-600' 
                  : currentStep > step.number 
                    ? 'bg-green-600 text-white border-green-600'
                    : 'bg-gray-100 text-gray-400 border-gray-300'
                }
              `}>
                <step.icon className="w-5 h-5" />
              </div>
              {index < steps.length - 1 && (
                <div className={`
                  w-24 h-0.5 mx-4 
                  ${currentStep > step.number ? 'bg-green-600' : 'bg-gray-300'}
                `} />
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-center mb-6">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {steps[currentStep - 1]?.title}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {steps[currentStep - 1]?.description}
            </p>
          </div>
        </div>

        {/* Step 1: Basic Information */}
        {currentStep === 1 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Building2 className="mr-2 h-5 w-5" />
                  Supplier Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Supplier *</label>
                  <Popover open={supplierDropdownOpen} onOpenChange={setSupplierDropdownOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={supplierDropdownOpen}
                        className="w-full justify-between"
                      >
                        {poData.supplierId
                          ? suppliers.find((supplier) => supplier.id === poData.supplierId)?.name
                          : "Select supplier..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0">
                      <Command>
                        <CommandInput placeholder="Search suppliers..." />
                        <CommandList>
                          <CommandEmpty>No suppliers found.</CommandEmpty>
                          <CommandGroup>
                            {suppliers.map((supplier) => (
                              <CommandItem
                                key={supplier.id}
                                value={`${supplier.name} ${supplier.supplierNumber || ''}`}
                                onSelect={() => {
                                  setPOData({...poData, supplierId: supplier.id})
                                  setSupplierDropdownOpen(false)
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    poData.supplierId === supplier.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="flex flex-col flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{supplier.name}</span>
                                    {supplier.isActive === false && (
                                      <Badge variant="secondary" className="text-xs">Inactive</Badge>
                                    )}
                                  </div>
                                  {supplier.supplierNumber && (
                                    <span className="text-xs text-gray-500">({supplier.supplierNumber})</span>
                                  )}
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Project (Optional)</label>
                  <Select 
                    value={poData.projectId || "no-project"} 
                    onValueChange={(value) => setPOData({...poData, projectId: value === "no-project" ? "" : value})}
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

                {getSelectedSupplier() && (
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                    <h4 className="font-medium text-blue-900 mb-2">Selected Supplier</h4>
                    <p className="text-sm text-blue-800 font-medium">{getSelectedSupplier()?.name}</p>
                    {getSelectedSupplier()?.supplierNumber && (
                      <p className="text-xs text-blue-700">Supplier No: {getSelectedSupplier()?.supplierNumber}</p>
                    )}
                    {getSelectedSupplier()?.contactPerson && (
                      <p className="text-xs text-blue-700">Contact: {getSelectedSupplier()?.contactPerson}</p>
                    )}
                    {getSelectedSupplier()?.email && (
                      <p className="text-sm text-blue-600">{getSelectedSupplier()?.email}</p>
                    )}
                    {getSelectedSupplier()?.phone && (
                      <p className="text-sm text-blue-600">{getSelectedSupplier()?.phone}</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Calendar className="mr-2 h-5 w-5" />
                  Order Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Expected Delivery Date *</label>
                  <Input
                    type="date"
                    value={poData.deliveryDate}
                    onChange={(e) => setPOData({...poData, deliveryDate: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Delivery Address</label>
                  <Textarea
                    placeholder="Enter delivery address (if applicable)..."
                    value={poData.deliveryAddress}
                    onChange={(e) => setPOData({...poData, deliveryAddress: e.target.value})}
                    rows={2}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Currency</label>
                  <Select 
                    value={poData.currency} 
                    onValueChange={(value) => setPOData({...poData, currency: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {currencies.map(currency => (
                        <SelectItem key={currency.value} value={currency.value}>
                          {currency.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Terms and Conditions
                    <span className="ml-2 text-xs text-green-600">(Standard Ampere Engineering T&C pre-loaded - editable)</span>
                  </label>
                  <Textarea
                    placeholder="Standard terms and conditions are pre-loaded. You may edit them if needed for this specific PO."
                    value={poData.terms}
                    onChange={(e) => setPOData({...poData, terms: e.target.value})}
                    rows={10}
                    className="font-mono text-xs"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    These are Ampere Engineering's standard Purchase Order Terms & Conditions. Edit as needed for supplier-specific requirements.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Notes</label>
                  <Textarea
                    placeholder="Additional notes or special instructions..."
                    value={poData.notes}
                    onChange={(e) => setPOData({...poData, notes: e.target.value})}
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 2: Items */}
        {currentStep === 2 && (
          <div className="space-y-6">
            {/* Quotation Upload Section */}
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader>
                <CardTitle className="flex items-center text-blue-900">
                  <Upload className="mr-2 h-5 w-5" />
                  Upload Quotation (Optional)
                </CardTitle>
                <CardDescription className="text-blue-700">
                  Upload a supplier quotation PDF to automatically extract items and populate the PO
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-center w-full">
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-blue-300 border-dashed rounded-lg cursor-pointer bg-white hover:bg-blue-100 transition-colors">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Upload className="w-10 h-10 mb-3 text-blue-500" />
                        <p className="mb-2 text-sm text-gray-700">
                          <span className="font-semibold">Click to upload</span> or drag and drop
                        </p>
                        <p className="text-xs text-gray-500">PDF, PNG, JPG up to 10MB</p>
                      </div>
                      <input 
                        type="file" 
                        className="hidden" 
                        accept=".pdf,.png,.jpg,.jpeg"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            toast.info('Quotation processing feature coming soon! For now, please manually enter items below.')
                            // TODO: Implement quotation processing with AI
                          }
                        }}
                      />
                    </label>
                  </div>
                  <div className="text-xs text-blue-600 bg-white p-3 rounded">
                    <strong>Note:</strong> Upload your supplier's quotation and we'll automatically extract:
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>Item descriptions and serial numbers</li>
                      <li>Quantities and units</li>
                      <li>Unit prices and totals</li>
                      <li>Any discounts or special terms</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Manual Items Entry */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Package className="mr-2 h-5 w-5" />
                    Purchase Order Items
                  </div>
                  <Button onClick={addPOItem} size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Item
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                {poItems.map((item, index) => (
                  <Card key={item.id} className="p-4 bg-gray-50">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium">Item #{index + 1}</h4>
                      {poItems.length > 1 && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => removePOItem(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">S/N (Serial Number)</label>
                        <Input
                          placeholder="e.g., 001, ABC-001"
                          value={item.serialNumber}
                          onChange={(e) => updatePOItem(item.id, 'serialNumber', e.target.value)}
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium mb-1">Description *</label>
                        <Input
                          placeholder="Item description"
                          value={item.description}
                          onChange={(e) => updatePOItem(item.id, 'description', e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1">Category</label>
                        <Select 
                          value={item.category} 
                          onValueChange={(value) => updatePOItem(item.id, 'category', value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {itemCategories.map(category => (
                              <SelectItem key={category.value} value={category.value}>
                                {category.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1">Quantity *</label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.quantity}
                          onChange={(e) => updatePOItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1">Unit</label>
                        <Select 
                          value={item.unit} 
                          onValueChange={(value) => updatePOItem(item.id, 'unit', value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {units.map(unit => (
                              <SelectItem key={unit} value={unit}>
                                {unit}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1">Unit Price *</label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(e) => updatePOItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1">Discount (%)</label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={item.discount}
                          onChange={(e) => updatePOItem(item.id, 'discount', parseFloat(e.target.value) || 0)}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1">Tax Rate (%)</label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.taxRate}
                          onChange={(e) => updatePOItem(item.id, 'taxRate', parseFloat(e.target.value) || 0)}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1">Total Price</label>
                        <div className="flex items-center h-10 px-3 bg-gray-100 border rounded-md">
                          <span className="font-medium">
                            {poData.currency} {calculateItemTotals(item).totalPrice.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium mb-1">Notes</label>
                        <Input
                          placeholder="Item notes or specifications"
                          value={item.notes}
                          onChange={(e) => updatePOItem(item.id, 'notes', e.target.value)}
                        />
                      </div>
                    </div>
                  </Card>
                ))}

                {/* PO-Level Adjustments */}
                <Card className="bg-blue-50 border-blue-200">
                  <CardHeader>
                    <CardTitle className="text-blue-900">Purchase Order Level Adjustments</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1 text-blue-900">
                          Additional Discount (%)
                        </label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={poData.discountPercentage}
                          onChange={(e) => setPOData({...poData, discountPercentage: parseFloat(e.target.value) || 0})}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1 text-blue-900">
                          Additional Tax (%)
                        </label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={poData.taxPercentage}
                          onChange={(e) => setPOData({...poData, taxPercentage: parseFloat(e.target.value) || 0})}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Totals */}
                <div className="border-t pt-4">
                  <div className="flex justify-end">
                    <div className="w-80 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Subtotal:</span>
                        <span>{poData.currency} {calculations.subtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Total Discount:</span>
                        <span>-{poData.currency} {calculations.totalDiscount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Total Tax:</span>
                        <span>{poData.currency} {calculations.totalTax.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-lg font-bold border-t pt-2">
                        <span>Grand Total:</span>
                        <span>{poData.currency} {calculations.grandTotal.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          </div>
        )}

        {/* Step 3: Review */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Review Purchase Order</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-medium mb-2">Supplier Information</h3>
                    <div className="text-sm space-y-1">
                      <p><strong>Supplier:</strong> {getSelectedSupplier()?.name}</p>
                      {getSelectedSupplier()?.supplierNumber && (
                        <p className="text-xs text-gray-600">Supplier No: {getSelectedSupplier()?.supplierNumber}</p>
                      )}
                      {getSelectedSupplier()?.contactPerson && (
                        <p className="text-xs text-gray-600">Contact: {getSelectedSupplier()?.contactPerson}</p>
                      )}
                      {getSelectedSupplier()?.email && <p><strong>Email:</strong> {getSelectedSupplier()?.email}</p>}
                      {getSelectedSupplier()?.phone && <p><strong>Phone:</strong> {getSelectedSupplier()?.phone}</p>}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-medium mb-2">Order Details</h3>
                    <div className="text-sm space-y-1">
                      <p><strong>Expected Delivery:</strong> {format(new Date(poData.deliveryDate), 'PPP')}</p>
                      <p><strong>Currency:</strong> {poData.currency}</p>
                      {getSelectedProject() && <p><strong>Project:</strong> {getSelectedProject()?.name}</p>}
                    </div>
                  </div>
                </div>

                {poData.terms && (
                  <div className="mt-4">
                    <h3 className="font-medium mb-2">Payment Terms</h3>
                    <p className="text-sm text-gray-600">{poData.terms}</p>
                  </div>
                )}

                {poData.notes && (
                  <div className="mt-4">
                    <h3 className="font-medium mb-2">Notes</h3>
                    <p className="text-sm text-gray-600">{poData.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Items Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>S/N</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Unit Price</TableHead>
                      <TableHead>Discount</TableHead>
                      <TableHead>Tax</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {poItems.map(item => {
                      const calculated = calculateItemTotals(item)
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="text-gray-600">
                            {item.serialNumber || '-'}
                          </TableCell>
                          <TableCell>{item.description}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {itemCategories.find(c => c.value === item.category)?.label}
                            </Badge>
                          </TableCell>
                          <TableCell>{item.quantity} {item.unit}</TableCell>
                          <TableCell>{poData.currency} {item.unitPrice.toFixed(2)}</TableCell>
                          <TableCell>{item.discount}%</TableCell>
                          <TableCell>{item.taxRate}%</TableCell>
                          <TableCell className="text-right font-medium">
                            {poData.currency} {calculated.totalPrice.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>

                <div className="flex justify-end mt-6">
                  <div className="w-80 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Subtotal:</span>
                      <span>{poData.currency} {calculations.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Total Discount:</span>
                      <span>-{poData.currency} {calculations.totalDiscount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Total Tax:</span>
                      <span>{poData.currency} {calculations.totalTax.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold border-t pt-2">
                      <span>Grand Total:</span>
                      <span>{poData.currency} {calculations.grandTotal.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between items-center mt-8">
          <div>
            {currentStep > 1 && (
              <Button variant="outline" onClick={prevStep}>
                <ChevronLeft className="mr-2 h-4 w-4" />
                Previous
              </Button>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            {currentStep < steps.length ? (
              <Button 
                onClick={nextStep} 
                disabled={!canProceedToNext()}
              >
                Next
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button 
                onClick={() => handleSubmit(false)}
                disabled={saving || !canProceedToNext()}
                className="bg-green-600 hover:bg-green-700"
              >
                {saving ? 'Creating...' : 'Create Purchase Order'}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  )
}

export default function CreatePurchaseOrderPage() {
  return (
    <Suspense fallback={
      <MainLayout>
        <div className="container mx-auto p-6">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
          </div>
        </div>
      </MainLayout>
    }>
      <CreatePurchaseOrderContent />
    </Suspense>
  )
}
