
'use client'

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
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
  Copy,
  Layers
} from "lucide-react"
import { format } from "date-fns"
import { ItemAutocomplete } from "@/components/quotations/item-autocomplete"
import { toast } from "sonner"
import { CustomerCombobox } from "@/components/quotations/customer-combobox"
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd'

interface Customer {
  id: string
  customerNumber?: string
  name: string
  customerType: string
}

interface Tender {
  id: string
  tenderNumber: string
  title: string
  customerId: string
}

interface User {
  id: string
  firstName: string
  lastName: string
  role: string
}

interface LineItem {
  id: string
  type: 'item' | 'subtitle' // Added type for subtitles
  description: string
  category: string
  quantity: number
  unit: string
  unitPrice: number
  discount?: number
  taxRate?: number
  subtotal: number
  discountAmount?: number
  taxAmount?: number
  totalPrice: number
  notes: string
  order: number
}

const itemCategories = [
  { value: "MATERIALS", label: "Materials" },
  { value: "SERVICES", label: "Services" },
  { value: "SUBCONTRACTORS", label: "Subcontractors" },
  { value: "MISCELLANEOUS", label: "Miscellaneous" },
  { value: "SUBTITLE", label: "Section Header" }
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

export default function EditQuotationPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { data: session } = useSession()
  
  const quotationId = params.id
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Data for dropdowns
  const [customers, setCustomers] = useState<Customer[]>([])
  const [tenders, setTenders] = useState<Tender[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [itemsLibrary, setItemsLibrary] = useState<any[]>([])

  // Get default validity date (30 days from now)
  const getDefaultValidityDate = () => {
    const date = new Date()
    date.setDate(date.getDate() + 30)
    return date.toISOString().split('T')[0]
  }

  // Form data
  const [quotationData, setQuotationData] = useState({
    customerId: "",
    tenderId: "no-tender",
    title: "",
    description: "",
    clientReference: "",
    salespersonId: session?.user?.id || "",
    validUntil: getDefaultValidityDate(),
    currency: "SGD",
    terms: "",
    notes: "",
    templateType: "standard",
    // Quotation-level discount and tax
    discountPercentage: 0,
    taxPercentage: 9 // Default 9% GST
  })

  const [lineItems, setLineItems] = useState<LineItem[]>([
    {
      id: "1",
      type: "subtitle",
      description: "Main Section",
      category: "SUBTITLE",
      quantity: 0,
      unit: "",
      unitPrice: 0,
      discount: 0,
      taxRate: 0,
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
      id: 1, 
      title: "Details", 
      description: "Basic quotation information",
      icon: FileText 
    },
    { 
      id: 2, 
      title: "Line Items", 
      description: "Products and services",
      icon: Package 
    },
    { 
      id: 3, 
      title: "Terms", 
      description: "Terms and conditions",
      icon: FileText 
    },
    { 
      id: 4, 
      title: "Review", 
      description: "Final review and submit",
      icon: Eye 
    }
  ]

  useEffect(() => {
    fetchDropdownData()
    fetchQuotationData()
  }, [])

  const fetchQuotationData = async () => {
    try {
      console.log('Fetching quotation data for ID:', quotationId)
      const response = await fetch(`/api/quotations/${quotationId}`)
      if (response.ok) {
        const quotation = await response.json()
        console.log('Fetched quotation data:', quotation)
        
        // Set quotation data - handle API response format
        const customerId = quotation.customerId || (quotation.customer ? quotation.customer.id : "")
        const tenderId = quotation.tenderId || (quotation.tender ? quotation.tender.id : "no-tender")
        const salespersonId = quotation.salespersonId || (quotation.salesperson ? quotation.salesperson.id : session?.user?.id || "")
        
        console.log('Setting quotation data with IDs:', { customerId, tenderId, salespersonId })
        
        setQuotationData({
          customerId: customerId,
          tenderId: tenderId, 
          title: quotation.title || "",
          description: quotation.description || "",
          clientReference: quotation.clientReference || "",
          salespersonId: salespersonId,
          validUntil: quotation.validUntil ? new Date(quotation.validUntil).toISOString().split('T')[0] : getDefaultValidityDate(),
          currency: quotation.currency || "SGD",
          terms: quotation.terms || "",
          notes: quotation.notes || "",
          templateType: quotation.templateType || "standard",
          discountPercentage: quotation.discountPercentage || 0,
          taxPercentage: quotation.taxPercentage || 9
        })

        // Set line items - API returns 'items' but we use 'lineItems' in frontend
        const itemsData = quotation.lineItems || quotation.items || []
        if (itemsData.length > 0) {
          const mappedLineItems = itemsData.map((item: any, index: number) => ({
            id: item.id || `temp-${index}`,
            type: 'item', // Default to 'item' since DB doesn't store type
            description: item.description || '',
            category: item.category || 'MATERIALS',
            quantity: Number(item.quantity) || 0,
            unit: item.unit || 'pcs',
            unitPrice: Number(item.unitPrice) || 0,
            discount: Number(item.discount) || 0,
            taxRate: Number(item.taxRate) || 0,
            subtotal: Number(item.subtotal) || 0,
            discountAmount: Number(item.discountAmount) || 0,
            taxAmount: Number(item.taxAmount) || 0,
            totalPrice: Number(item.totalPrice) || 0,
            notes: item.notes || '',
            order: item.order || (index + 1)
          }))
          setLineItems(mappedLineItems)
          console.log('Loaded line items:', mappedLineItems)
        } else {
          // Keep default subtitle if no items
          console.log('No items found, keeping default subtitle')
        }
      } else {
        console.error('Failed to fetch quotation')
        router.push('/quotations')
      }
    } catch (error) {
      console.error('Error fetching quotation:', error)
      router.push('/quotations')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Set default salesperson to current user when session is available
    if (session?.user?.id && !quotationData.salespersonId) {
      setQuotationData(prev => ({
        ...prev,
        salespersonId: session.user?.id || ""
      }))
    }
  }, [session])

  useEffect(() => {
    calculateTotals()
  }, [lineItems, quotationData.discountPercentage, quotationData.taxPercentage])

  const fetchDropdownData = async () => {
    try {
      // Fetch customers
      const customersResponse = await fetch('/api/customers?pageSize=1000')
      if (customersResponse.ok) {
        const customersData = await customersResponse.json()
        // API returns { data: [], page, pageSize, ... }
        setCustomers(customersData.data || [])
      }

      // Fetch tenders
      const tendersResponse = await fetch('/api/tenders?pageSize=1000')
      if (tendersResponse.ok) {
        const tendersData = await tendersResponse.json()
        // API returns { success: true, data: [...] }
        setTenders(tendersData.data || [])
      }

      // Fetch users
      const usersResponse = await fetch('/api/users')
      if (usersResponse.ok) {
        const usersData = await usersResponse.json()
        setUsers(Array.isArray(usersData) ? usersData : [])
      }

      // Fetch items library
      const itemsResponse = await fetch('/api/quotation-items-library?limit=100')
      if (itemsResponse.ok) {
        const itemsData = await itemsResponse.json()
        setItemsLibrary(Array.isArray(itemsData) ? itemsData : [])
      }

    } catch (error) {
      console.error('Error fetching dropdown data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Helper function to safely convert to number and format
  const toNumber = (value: any): number => {
    const num = Number(value)
    return isNaN(num) ? 0 : num
  }

  const formatPrice = (value: any): string => {
    return toNumber(value).toFixed(2)
  }

  const calculateLineItem = (item: LineItem): LineItem => {
    if (item.type === 'subtitle') {
      return {
        ...item,
        discount: 0,
        taxRate: 0,
        subtotal: 0,
        discountAmount: 0,
        taxAmount: 0,
        totalPrice: 0
      }
    }
    
    const qty = toNumber(item.quantity)
    const price = toNumber(item.unitPrice)
    const discount = toNumber(item.discount || 0)
    const taxRate = toNumber(item.taxRate || 0)
    
    const subtotal = qty * price
    const discountAmount = (subtotal * discount) / 100
    const subtotalAfterDiscount = subtotal - discountAmount
    const taxAmount = (subtotalAfterDiscount * taxRate) / 100
    const totalPrice = subtotalAfterDiscount + taxAmount

    return {
      ...item,
      quantity: qty,
      unitPrice: price,
      discount,
      taxRate,
      subtotal,
      discountAmount,
      taxAmount,
      totalPrice
    }
  }

  const calculateTotals = () => {
    const calculatedItems = lineItems.map(calculateLineItem)
    
    // Only calculate for items, not subtitles
    const itemsOnly = calculatedItems.filter(item => item.type === 'item')
    const subtotal = itemsOnly.reduce((sum, item) => sum + item.subtotal, 0)
    
    // Apply quotation-level discount and tax
    const discountAmount = (subtotal * quotationData.discountPercentage) / 100
    const discountedSubtotal = subtotal - discountAmount
    const taxAmount = (discountedSubtotal * quotationData.taxPercentage) / 100
    const grandTotal = discountedSubtotal + taxAmount

    setCalculations({
      subtotal,
      totalDiscount: discountAmount,
      totalTax: taxAmount,
      grandTotal
    })
  }

  const updateLineItem = (id: string, updates: Partial<LineItem>) => {
    setLineItems(items => 
      items.map(item => 
        item.id === id ? { ...item, ...updates } : item
      )
    )
  }

  const addLineItem = (type: 'item' | 'subtitle' = 'item') => {
    const newItem: LineItem = {
      id: Date.now().toString(),
      type,
      description: type === 'subtitle' ? 'New Section Title' : '',
      category: "MATERIALS",
      quantity: type === 'subtitle' ? 0 : 1,
      unit: "pcs",
      unitPrice: 0,
      discount: 0,
      taxRate: 0,
      subtotal: 0,
      discountAmount: 0,
      taxAmount: 0,
      totalPrice: 0,
      notes: "",
      order: lineItems.length + 1
    }
    setLineItems([...lineItems, newItem])
  }

  const fillFromLibrary = (libraryItem: any, itemId: string) => {
    updateLineItem(itemId, {
      description: libraryItem.description,
      category: libraryItem.category,
      unit: libraryItem.unit,
      unitPrice: libraryItem.lastUnitPrice || libraryItem.averageUnitPrice
    })
  }

  const removeLineItem = (id: string) => {
    if (lineItems.length > 1) {
      setLineItems(items => items.filter(item => item.id !== id))
    }
  }

  const duplicateLineItem = (id: string) => {
    const itemToDuplicate = lineItems.find(item => item.id === id)
    if (itemToDuplicate) {
      const newItem: LineItem = {
        ...itemToDuplicate,
        id: Date.now().toString(),
        order: lineItems.length + 1
      }
      setLineItems([...lineItems, newItem])
      toast.success('Item duplicated')
    }
  }

  const addMultipleRows = (count: number) => {
    const newItems: LineItem[] = []
    for (let i = 0; i < count; i++) {
      newItems.push({
        id: `${Date.now()}-${i}`,
        type: 'item',
        description: '',
        category: "MATERIALS",
        quantity: 1,
        unit: "pcs",
        unitPrice: 0,
        subtotal: 0,
        totalPrice: 0,
        notes: "",
        order: lineItems.length + i + 1
      })
    }
    setLineItems([...lineItems, ...newItems])
    toast.success(`Added ${count} rows`)
  }

  const handleKeyDown = (e: React.KeyboardEvent, itemId: string, fieldName: string) => {
    // Ctrl+Enter to add new row
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault()
      addLineItem('item')
      toast.success('New row added (Ctrl+Enter)')
    }
    
    // Auto-add row when tabbing from last field of last item
    if (e.key === 'Tab' && !e.shiftKey) {
      const currentIndex = lineItems.findIndex(item => item.id === itemId)
      const isLastItem = currentIndex === lineItems.length - 1
      const isLastField = fieldName === 'notes'
      
      if (isLastItem && isLastField) {
        setTimeout(() => {
          addLineItem('item')
        }, 100)
      }
    }
  }

    const onDragEnd = (result: any) => {
    if (!result.destination) return

    const items = Array.from(lineItems)
    const [reorderedItem] = items.splice(result.source.index, 1)
    items.splice(result.destination.index, 0, reorderedItem)

    const updatedItems = items.map((item, index) => ({ ...item, order: index + 1 }))
    setLineItems(updatedItems)
    toast.success('Items reordered')
  }

  const handleSubmit = async (isDraft = false) => {
    if (saving) return // Prevent double submissions
    
    setSaving(true)
    try {
      // Basic validation
      if (!quotationData.title?.trim()) {
        alert('Please enter a quotation title')
        return
      }
      
      if (!quotationData.customerId) {
        alert('Please select a customer')
        return
      }

      const payload = {
        title: quotationData.title,
        description: quotationData.description,
        clientReference: quotationData.clientReference,
        customerId: quotationData.customerId,
        tenderId: quotationData.tenderId === "no-tender" ? null : quotationData.tenderId,
        salespersonId: quotationData.salespersonId,
        validUntil: quotationData.validUntil,
        currency: quotationData.currency,
        terms: quotationData.terms,
        notes: quotationData.notes,
        templateType: quotationData.templateType,
        lineItems: lineItems.map(calculateLineItem),
        subtotal: calculations.subtotal,
        taxAmount: calculations.totalTax,
        discountAmount: calculations.totalDiscount,
        totalAmount: calculations.grandTotal,
        status: isDraft ? 'DRAFT' : 'DRAFT' // Default to DRAFT, can be changed later
      }

      console.log('Submitting quotation update:', payload) // Debug log

      const response = await fetch(`/api/quotations/${quotationId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        const result = await response.json()
        console.log('Quotation updated successfully:', result) // Debug log
        if (isDraft) {
          toast.success('Quotation saved as draft successfully!')
          // Don't redirect for draft saves, stay on the page
        } else {
          toast.success('Quotation updated successfully!')
          router.push(`/quotations/${quotationId}`)
        }
      } else {
        // Try to parse error response
        let errorMessage = 'Unknown error'
        try {
          const contentType = response.headers.get('content-type')
          if (contentType && contentType.includes('application/json')) {
            const error = await response.json()
            errorMessage = error.error || error.message || `Server returned ${response.status}`
          } else {
            const textError = await response.text()
            errorMessage = textError || `Server returned ${response.status}`
          }
        } catch (parseError) {
          console.error('Error parsing error response:', parseError)
          errorMessage = `Server returned ${response.status}`
        }
        
        console.error('Server error:', errorMessage, 'Status:', response.status) // Debug log
        alert(`Failed to update quotation: ${errorMessage}`)
      }
    } catch (error) {
      console.error('Error updating quotation:', error)
      alert('Failed to update quotation. Please check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }



  const canProceedToNext = () => {
    let canProceed = false
    switch (currentStep) {
      case 1:
        canProceed = !!(quotationData.customerId && quotationData.title && quotationData.validUntil)
        break
      case 2:
        // More lenient validation - allow proceeding if there's at least one line item
        canProceed = lineItems.length > 0
        break
      case 3:
        canProceed = true
        break
      case 4:
        canProceed = true
        break
      default:
        canProceed = true
    }
    console.log(`Can proceed to next (step ${currentStep}):`, canProceed, {
      customerId: quotationData.customerId,
      title: quotationData.title,
      validUntil: quotationData.validUntil,
      lineItemsCount: lineItems.length
    })
    return canProceed
  }

  const canSaveDraft = () => {
    // Very lenient validation for draft saving - only require basic info if available
    // In edit mode, we should always be able to save unless there's a critical error
    const canSave = !loading && !!quotationData.title?.trim()
    console.log('Can save draft:', canSave, {
      loading,
      title: quotationData.title,
      customerId: quotationData.customerId
    })
    return canSave
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
            <Button 
              variant="outline" 
              onClick={() => router.push('/quotations')}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Quotations
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Edit Quotation
              </h1>
              <p className="text-gray-600 dark:text-gray-300">
                Update quotation details and line items
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button 
              variant="outline" 
              onClick={() => {
                console.log('Save Draft button clicked')
                handleSubmit(true)
              }} 
              disabled={saving || !canSaveDraft()}
            >
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Saving...' : 'Save Draft'}
            </Button>
          </div>
        </div>

        {/* Progress Steps */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex justify-between items-center">
              {steps.map((step, index) => (
                <div 
                  key={step.id}
                  className={`flex items-center ${index < steps.length - 1 ? 'flex-1' : ''}`}
                >
                  <div className="flex flex-col items-center">
                    <div 
                      className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        step.id === currentStep 
                          ? 'bg-red-600 text-white' 
                          : step.id < currentStep
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      <step.icon className="h-5 w-5" />
                    </div>
                    <div className="text-center mt-2">
                      <p className="font-medium text-sm">{step.title}</p>
                      <p className="text-xs text-gray-500">{step.description}</p>
                    </div>
                  </div>
                  {index < steps.length - 1 && (
                    <div 
                      className={`flex-1 h-1 mx-4 ${
                        step.id < currentStep ? 'bg-green-600' : 'bg-gray-200'
                      }`} 
                    />
                  )}
</div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Step Content */}
        {currentStep === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="mr-2 h-5 w-5" />
                Quotation Details
              </CardTitle>
              <CardDescription>
                Enter the basic information for this quotation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Customer *
                  </label>
                  <CustomerCombobox
                    value={quotationData.customerId}
                    customers={customers}
                    onSelect={(customerId) => setQuotationData({...quotationData, customerId})}
                    placeholder="Type to search customers..."
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Linked Tender (Optional)
                  </label>
                  <Select 
                    value={quotationData.tenderId} 
                    onValueChange={(value) => setQuotationData({...quotationData, tenderId: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select tender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no-tender">No tender</SelectItem>
                      {tenders.length === 0 ? (
                        <SelectItem value="no-tenders" disabled>No tenders available</SelectItem>
                      ) : (
                        tenders.map((tender) => (
                          <SelectItem key={tender.id} value={tender.id}>
                            {tender.tenderNumber} - {tender.title}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Project Title *
                  </label>
                  <Input 
                    placeholder="Enter quotation title"
                    value={quotationData.title}
                    onChange={(e) => setQuotationData({...quotationData, title: e.target.value})}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Salesperson
                  </label>
                  <Select 
                    value={quotationData.salespersonId} 
                    onValueChange={(value) => setQuotationData({...quotationData, salespersonId: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select salesperson" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.filter(user => ['SUPERADMIN', 'PROJECT_MANAGER'].includes(user.role)).map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          <div className="flex items-center space-x-2">
                            <User className="h-4 w-4" />
                            <span>{user.firstName} {user.lastName}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Valid Until *
                  </label>
                  <Input 
                    type="date"
                    value={quotationData.validUntil}
                    onChange={(e) => setQuotationData({...quotationData, validUntil: e.target.value})}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Currency
                  </label>
                  <Select 
                    value={quotationData.currency} 
                    onValueChange={(value) => setQuotationData({...quotationData, currency: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      {currencies.map((currency) => (
                        <SelectItem key={currency.value} value={currency.value}>
                          <div className="flex items-center space-x-2">
                            <DollarSign className="h-4 w-4" />
                            <span>{currency.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Client Reference
                </label>
                <Input 
                  placeholder="Customer's reference number (if any)"
                  value={quotationData.clientReference}
                  onChange={(e) => setQuotationData({...quotationData, clientReference: e.target.value})}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Description
                </label>
                <Textarea 
                  placeholder="Brief description of the quotation"
                  value={quotationData.description}
                  onChange={(e) => setQuotationData({...quotationData, description: e.target.value})}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === 2 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-lg">
                <div className="flex items-center">
                  <Package className="mr-2 h-4 w-4" />
                  Line Items
                </div>
                <div className="flex space-x-1">
                  <Button onClick={() => addLineItem('subtitle')} size="sm" variant="outline" className="h-6 text-xs px-2">
                    <Hash className="mr-1 h-2 w-2" />
                    Section
                  </Button>
                  <Button onClick={() => addLineItem('item')} size="sm" className="h-6 text-xs px-2">
                    <Plus className="mr-1 h-2 w-2" />
                    Item
                  </Button>
                </div>
              </CardTitle>
              <CardDescription className="text-xs">
                Add products, services, and section dividers
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <DragDropContext onDragEnd={onDragEnd}>
                  <Droppable droppableId="line-items">
                    {(provided) => (
                      <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-1">
                        {lineItems.map((item, index) => (
                          <Draggable key={item.id} draggableId={item.id} index={index}>
                            {(provided) => (
                                              <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} className={`border rounded-md p-2 ${item.type === 'subtitle' ? 'bg-gray-50 dark:bg-gray-800 border-dashed' : 'bg-white'}`}>
                              <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center space-x-1">
                        <Badge variant={item.type === 'subtitle' ? 'secondary' : 'outline'} className="text-[10px] h-4 px-1">
                          {item.type === 'subtitle' ? (
                            <>
                              <Type className="mr-0.5 h-2 w-2" />
                              Section
                            </>
                          ) : (
                            `#${index + 1}`
                          )}
                        </Badge>
                        {item.type === 'item' && itemsLibrary.length > 0 && (
                          <Select onValueChange={(value) => {
                            if (value === "custom") return
                            const libraryItem = itemsLibrary.find(lib => lib.description === value)
                            if (libraryItem) {
                              fillFromLibrary(libraryItem, item.id)
                            }
                          }}>
                            <SelectTrigger className="w-20 h-5 text-[10px] px-1">
                              <SelectValue placeholder="Fill" />
                            </SelectTrigger>
                            <SelectContent className="max-h-60">
                              <SelectItem value="custom" className="text-xs">Custom Item</SelectItem>
                              {itemsLibrary.slice(0, 30).map((libItem, idx) => (
                                <SelectItem key={idx} value={libItem.description} className="text-xs">
                                  <div className="flex flex-col py-1">
                                    <span className="font-medium text-xs leading-tight">{libItem.description.substring(0, 40)}...</span>
                                    <span className="text-[10px] text-gray-500">
                                      ${libItem.averageUnitPrice.toFixed(2)} • {libItem.category} • {libItem.usageCount} uses
                                    </span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                      <div className="flex items-center space-x-0.5">
                        <Button onClick={() => addLineItem('item')} size="sm" variant="ghost" className="h-4 w-4 p-0">
                          <Plus className="h-2 w-2" />
                        </Button>
                        <Button onClick={() => addLineItem('subtitle')} size="sm" variant="ghost" className="h-4 w-4 p-0" title="Add section">
                          <Hash className="h-2 w-2" />
                        </Button>
                        <Button onClick={() => duplicateLineItem(item.id)} size="sm" variant="ghost" className="h-4 w-4 p-0" title="Duplicate row">
                          <Copy className="h-2 w-2" />
                        </Button>
                        {lineItems.length > 1 && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="h-4 w-4 p-0"
                            onClick={() => removeLineItem(item.id)}
                          >
                            <Trash2 className="h-2 w-2" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {item.type === 'subtitle' ? (
                      // Subtitle form - compact version
                      <div className="space-y-1">
                        <div>
                          <label className="text-[10px] font-medium mb-0.5 block text-gray-600">Section Title *</label>
                          <Input 
                            placeholder="e.g., Level 4 Office, Level 2 Pantry Area"
                            value={item.description}
                            onChange={(e) => updateLineItem(item.id, { description: e.target.value })}
                            className="text-xs font-semibold h-6 px-2"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-medium mb-0.5 block text-gray-600">Notes</label>
                          <Textarea 
                            placeholder="Section notes"
                            value={item.notes}
                            onChange={(e) => updateLineItem(item.id, { notes: e.target.value })}
                            rows={1}
                            className="text-[10px] resize-none h-5 px-2 py-1"
                          />
                        </div>
                      </div>
                    ) : (
                      // Item form - ultra-compact layout
                      <div className="space-y-1">
                        <div>
                          <label className="text-[10px] font-medium mb-0.5 block text-gray-600">Description *</label>
                          <Input 
                            value={item.description}
                            onChange={(e) => updateLineItem(item.id, { description: e.target.value })}
                            onKeyDown={(e) => handleKeyDown(e, item.id, 'description')}
                            placeholder="Enter item description..."
                            className="text-xs h-6 px-2"
                          />
                        </div>

                        <div className="grid grid-cols-4 gap-1">
                          <div>
                            <label className="text-[10px] font-medium mb-0.5 block text-gray-600">Qty *</label>
                            <Input 
                              type="number"
                              placeholder="0"
                              value={item.quantity}
                              onChange={(e) => updateLineItem(item.id, { quantity: Number(e.target.value) })}
                              onKeyDown={(e) => handleKeyDown(e, item.id, 'quantity')}
                              className="text-xs h-6 px-1"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-medium mb-0.5 block text-gray-600">Unit</label>
                            <Select 
                              value={item.unit || "pcs"} 
                              onValueChange={(value) => updateLineItem(item.id, { unit: value })}
                            >
                              <SelectTrigger className="h-6 text-xs px-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {units.map((unit) => (
                                  <SelectItem key={unit} value={unit} className="text-xs">
                                    {unit}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <label className="text-[10px] font-medium mb-0.5 block text-gray-600">Price *</label>
                            <Input 
                              type="number"
                              placeholder="0.00"
                              step="0.01"
                              value={item.unitPrice}
                              onChange={(e) => updateLineItem(item.id, { unitPrice: Number(e.target.value) })}
                              onKeyDown={(e) => handleKeyDown(e, item.id, 'unitPrice')}
                              className="text-xs h-6 px-1"
                            />
                          </div>

                          <div className="flex items-end">
                            <div className="text-[10px] font-bold text-green-600 bg-gray-50 rounded px-1 py-1 w-full text-center">
                              {quotationData.currency} {formatPrice(calculateLineItem(item).totalPrice)}
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-medium mb-0.5 block text-gray-600">Notes</label>
                          <Textarea 
                            placeholder="Item notes"
                            value={item.notes}
                            onChange={(e) => updateLineItem(item.id, { notes: e.target.value })}
                            onKeyDown={(e) => handleKeyDown(e, item.id, 'notes')}
                            rows={1}
                            className="text-[10px] resize-none h-5 px-2 py-1"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                          )}
                        </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>

              {/* Bulk Add Buttons */}
              <div className="flex items-center space-x-2 mt-4">
                <Button 
                  onClick={() => addMultipleRows(5)} 
                  size="sm" 
                  variant="outline"
                  className="h-7 text-xs"
                >
                  <Layers className="h-3 w-3 mr-1" />
                  Add 5 Rows
                </Button>
                <Button 
                  onClick={() => addMultipleRows(10)} 
                  size="sm" 
                  variant="outline"
                  className="h-7 text-xs"
                >
                  <Layers className="h-3 w-3 mr-1" />
                  Add 10 Rows
                </Button>
                <div className="text-[10px] text-muted-foreground ml-2">
                  💡 Tip: Press <kbd className="px-1 py-0.5 bg-muted rounded text-[9px]">Ctrl+Enter</kbd> to add row, <kbd className="px-1 py-0.5 bg-muted rounded text-[9px]">Tab</kbd> from last field auto-adds
                </div>
              </div>

              {/* Financial Summary - Compact version */}
              <div className="mt-3 border-t pt-3">
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-3">
                  <h3 className="text-sm font-bold mb-2 flex items-center text-gray-800 dark:text-white">
                    <Calculator className="mr-2 h-4 w-4 text-blue-600" />
                    Financial Summary
                  </h3>
                  
                  {/* Discount and Tax Controls - Compact */}
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="bg-white dark:bg-gray-800 rounded p-2 border">
                      <label className="text-[10px] font-medium text-gray-600 dark:text-gray-400 mb-1 block">
                        Discount (%)
                      </label>
                      <Input 
                        type="number"
                        placeholder="0"
                        min="0"
                        max="100"
                        step="0.01"
                        value={quotationData.discountPercentage}
                        onChange={(e) => setQuotationData({...quotationData, discountPercentage: Number(e.target.value)})}
                        className="h-6 text-xs"
                      />
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded p-2 border">
                      <label className="text-[10px] font-medium text-gray-600 dark:text-gray-400 mb-1 block">
                        Tax (%)
                      </label>
                      <Input 
                        type="number"
                        placeholder="9"
                        min="0"
                        max="100"
                        step="0.01"
                        value={quotationData.taxPercentage}
                        onChange={(e) => setQuotationData({...quotationData, taxPercentage: Number(e.target.value)})}
                        className="h-6 text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    <div className="bg-white dark:bg-gray-800 rounded p-2 border">
                      <p className="text-[10px] font-medium text-gray-600 dark:text-gray-400 mb-0.5">Subtotal</p>
                      <p className="text-sm font-bold text-gray-800 dark:text-white">
                        {quotationData.currency} {formatPrice(calculations.subtotal)}
                      </p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded p-2 border">
                      <p className="text-[10px] font-medium text-gray-600 dark:text-gray-400 mb-0.5">
                        Discount ({quotationData.discountPercentage}%)
                      </p>
                      <p className="text-sm font-bold text-orange-600">
                        -{quotationData.currency} {calculations.totalDiscount.toFixed(2)}
                      </p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded p-2 border">
                      <p className="text-[10px] font-medium text-gray-600 dark:text-gray-400 mb-0.5">
                        Tax ({quotationData.taxPercentage}%)
                      </p>
                      <p className="text-sm font-bold text-blue-600">
                        {quotationData.currency} {calculations.totalTax.toFixed(2)}
                      </p>
                    </div>
                    <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded p-2">
                      <p className="text-[10px] font-medium text-white/90 mb-0.5">Grand Total</p>
                      <p className="text-3xl font-bold text-white">
                        {quotationData.currency} {calculations.grandTotal.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === 3 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="mr-2 h-5 w-5" />
                Terms & Conditions
              </CardTitle>
              <CardDescription>
                Set terms and conditions for this quotation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  <strong>Note:</strong> Company logos and letterhead are managed in Settings and will be automatically included in PDF exports.
                  Accreditation logos will appear at the bottom of the quotation.
                </p>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Terms & Conditions
                </label>
                <Textarea 
                  placeholder="Enter terms and conditions for this quotation"
                  value={quotationData.terms}
                  onChange={(e) => setQuotationData({...quotationData, terms: e.target.value})}
                  rows={8}
                />
                <p className="text-sm text-gray-500 mt-1">
                  Standard terms will be used if left empty
                </p>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Internal Notes
                </label>
                <Textarea 
                  placeholder="Internal notes (not visible to client)"
                  value={quotationData.notes}
                  onChange={(e) => setQuotationData({...quotationData, notes: e.target.value})}
                  rows={4}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Template Type
                </label>
                <Select 
                  value={quotationData.templateType} 
                  onValueChange={(value) => setQuotationData({...quotationData, templateType: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard Template</SelectItem>
                    <SelectItem value="detailed">Detailed Template</SelectItem>
                    <SelectItem value="summary">Summary Template</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === 4 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Eye className="mr-2 h-5 w-5" />
                Review & Submit
              </CardTitle>
              <CardDescription>
                Review all information before submitting
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Summary Information */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="font-semibold">Quotation Details</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Customer:</span>
                      <span className="font-medium">
                        {customers.find(c => c.id === quotationData.customerId)?.name || 'Not selected'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Title:</span>
                      <span className="font-medium">{quotationData.title || 'Not specified'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Valid Until:</span>
                      <span className="font-medium">
                        {quotationData.validUntil ? format(new Date(quotationData.validUntil), 'MMM dd, yyyy') : 'Not set'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Currency:</span>
                      <span className="font-medium">{quotationData.currency}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold">Financial Summary</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Items:</span>
                      <span className="font-medium">{lineItems.length} item(s)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Subtotal:</span>
                      <span className="font-medium">
                        {quotationData.currency} {formatPrice(calculations.subtotal)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Tax:</span>
                      <span className="font-medium">
                        {quotationData.currency} {calculations.totalTax.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="font-semibold">Grand Total:</span>
                      <span className="font-bold text-green-600">
                        {quotationData.currency} {calculations.grandTotal.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Line Items Preview */}
              <div>
                <h3 className="font-semibold mb-2 text-sm">Line Items</h3>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="h-8">
                        <TableHead className="text-xs">Description</TableHead>
                        <TableHead className="text-xs">Qty</TableHead>
                        <TableHead className="text-xs">Unit Price</TableHead>
                        <TableHead className="text-right text-xs">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lineItems.map((item) => {
                        const calculated = calculateLineItem(item)
                        
                        if (item.type === 'subtitle') {
                          return (
                            <TableRow key={item.id} className="bg-gray-50 dark:bg-gray-800 h-8">
                              <TableCell colSpan={4} className="py-2">
                                <div className="font-semibold text-sm">
                                  {item.description}
                                </div>
                                {item.notes && (
                                  <div className="text-xs text-gray-600 mt-1">
                                    {item.notes}
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          )
                        }
                        
                        return (
                          <TableRow key={item.id} className="h-8">
                            <TableCell className="py-2">
                              <div>
                                <p className="font-medium text-xs">{item.description}</p>
                                {item.notes && (
                                  <p className="text-xs text-gray-500">{item.notes}</p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="py-2 text-xs">{item.quantity} {item.unit}</TableCell>
                            <TableCell className="py-2 text-xs">{quotationData.currency} {formatPrice(item.unitPrice)}</TableCell>
                            <TableCell className="text-right font-medium py-2 text-xs">
                              {quotationData.currency} {formatPrice(calculated.totalPrice)}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Navigation */}
        <div className="flex justify-between items-center mt-6">
          <Button 
            variant="outline"
            onClick={() => {
              console.log('Previous button clicked, current step:', currentStep)
              setCurrentStep(Math.max(1, currentStep - 1))
            }}
            disabled={currentStep === 1}
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Previous
          </Button>

          <div className="flex space-x-2">
            {currentStep < 4 ? (
              <Button 
                onClick={() => {
                  console.log('Next button clicked, current step:', currentStep)
                  setCurrentStep(currentStep + 1)
                }}
                disabled={!canProceedToNext()}
              >
                Next
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button 
                onClick={() => {
                  console.log('Update Quotation button clicked')
                  handleSubmit(false)
                }}
                disabled={saving || !canProceedToNext()}
                className="bg-green-600 hover:bg-green-700"
              >
                {saving ? 'Updating...' : 'Update Quotation'}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  )
}
