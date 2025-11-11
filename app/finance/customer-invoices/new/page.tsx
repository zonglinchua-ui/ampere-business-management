
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { 
  FileText,
  Building2,
  DollarSign,
  Calendar,
  ArrowLeft,
  Save,
  Send,
  Plus,
  Trash2,
  Eye,
  User,
  Package,
  Percent
} from "lucide-react"
import { format } from "date-fns"

interface Client {
  id: string
  name: string
  companyName: string
  email?: string
  contactPerson?: string
}

interface Project {
  id: string
  projectNumber: string
  name: string
}

interface InvoiceItem {
  id: string
  description: string
  quantity: number
  unit: string
  unitPrice: number
  discount: number
  taxRate: number
  subtotal: number
  discountAmount: number
  taxAmount: number
  totalPrice: number
}

const units = [
  "hours", "days", "pcs", "units", "sqm", "m", "kg", "lots", "set", "package", "nos."
]

export default function CreateClientInvoicePage() {
  const router = useRouter()
  const { data: session } = useSession()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Data for dropdowns
  const [clients, setClients] = useState<Client[]>([])
  const [projects, setProjects] = useState<Project[]>([])

  // Get default due date (30 days from now)
  const getDefaultDueDate = () => {
    const date = new Date()
    date.setDate(date.getDate() + 30)
    return date.toISOString().split('T')[0]
  }

  // Get projectId from URL query parameters
  const getProjectIdFromUrl = () => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search)
      return searchParams.get('projectId') || ""
    }
    return ""
  }

  // Form data
  const [invoiceData, setInvoiceData] = useState({
    clientId: "",
    projectId: getProjectIdFromUrl(),
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: getDefaultDueDate(),
    currency: "SGD",
    paymentTerms: "Net 30 days",
    description: "",
    notes: "",
    // Invoice-level discount and tax
    discountPercentage: 0,
    taxPercentage: 9 // Default 9% GST
  })

  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([
    {
      id: "1",
      description: "",
      quantity: 1,
      unit: "hours",
      unitPrice: 0,
      discount: 0,
      taxRate: 9,
      subtotal: 0,
      discountAmount: 0,
      taxAmount: 0,
      totalPrice: 0
    }
  ])

  const [calculations, setCalculations] = useState({
    subtotal: 0,
    totalDiscount: 0,
    totalTax: 0,
    grandTotal: 0
  })

  useEffect(() => {
    fetchDropdownData()
  }, [])

  useEffect(() => {
    calculateTotals()
  }, [invoiceItems, invoiceData.discountPercentage, invoiceData.taxPercentage])

  // Auto-populate client when project is pre-selected
  useEffect(() => {
    if (invoiceData.projectId && projects.length > 0) {
      fetchProjectDetails(invoiceData.projectId)
    }
  }, [invoiceData.projectId, projects.length])

  const fetchDropdownData = async () => {
    try {
      // Fetch clients
      const clientsResponse = await fetch('/api/customers?limit=1000')
      if (clientsResponse.ok) {
        const clientsData = await clientsResponse.json()
        setClients(clientsData.customers || [])
      }

      // Fetch projects
      const projectsResponse = await fetch('/api/projects?limit=1000')
      if (projectsResponse.ok) {
        const projectsData = await projectsResponse.json()
        setProjects(projectsData.projects || [])
      }

    } catch (error) {
      console.error('Error fetching dropdown data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchProjectDetails = async (projectId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}`)
      if (response.ok) {
        const projectData = await response.json()
        if (projectData.customerId) {
          setInvoiceData(prev => ({
            ...prev,
            clientId: projectData.customerId,
            description: `Progress claim for ${projectData.name}`
          }))
        }
      }
    } catch (error) {
      console.error('Error fetching project details:', error)
    }
  }

  const calculateItemTotals = (item: InvoiceItem) => {
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
    const itemTotals = invoiceItems.reduce(
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

    // Apply invoice-level discount and tax
    const subtotalAfterItemDiscounts = itemTotals.subtotal - itemTotals.totalDiscount
    const invoiceLevelDiscount = (subtotalAfterItemDiscounts * invoiceData.discountPercentage) / 100
    const finalSubtotal = subtotalAfterItemDiscounts - invoiceLevelDiscount
    const invoiceLevelTax = (finalSubtotal * invoiceData.taxPercentage) / 100
    const finalTotal = finalSubtotal + invoiceLevelTax

    setCalculations({
      subtotal: Number(itemTotals.subtotal.toFixed(2)),
      totalDiscount: Number((itemTotals.totalDiscount + invoiceLevelDiscount).toFixed(2)),
      totalTax: Number((itemTotals.totalTax + invoiceLevelTax).toFixed(2)),
      grandTotal: Number(finalTotal.toFixed(2))
    })
  }

  const updateInvoiceItem = (id: string, field: keyof InvoiceItem, value: any) => {
    setInvoiceItems(items => 
      items.map(item => 
        item.id === id ? { ...item, [field]: value } : item
      )
    )
  }

  const addInvoiceItem = () => {
    const newItem: InvoiceItem = {
      id: Date.now().toString(),
      description: "",
      quantity: 1,
      unit: "hours",
      unitPrice: 0,
      discount: 0,
      taxRate: 9,
      subtotal: 0,
      discountAmount: 0,
      taxAmount: 0,
      totalPrice: 0
    }
    setInvoiceItems([...invoiceItems, newItem])
  }

  const removeInvoiceItem = (id: string) => {
    if (invoiceItems.length > 1) {
      setInvoiceItems(items => items.filter(item => item.id !== id))
    }
  }

  const handleSubmit = async (isDraft = false) => {
    setSaving(true)
    try {
      const payload = {
        clientId: invoiceData.clientId,
        projectId: invoiceData.projectId,
        description: invoiceData.description,
        amount: calculations.subtotal,
        taxAmount: calculations.totalTax,
        status: isDraft ? 'DRAFT' : 'SENT',
        issueDate: invoiceData.issueDate,
        dueDate: invoiceData.dueDate,
        notes: invoiceData.notes,
        paymentTerms: invoiceData.paymentTerms,
        currency: invoiceData.currency,
        items: invoiceItems.map(calculateItemTotals)
      }

      console.log('Creating invoice:', payload)

      const response = await fetch('/api/invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        const result = await response.json()
        console.log('Invoice created successfully:', result)
        alert(`Invoice ${isDraft ? 'saved as draft' : 'created and sent'} successfully!`)
        router.push('/finance/client-invoices')
      } else {
        const error = await response.json()
        console.error('API Error:', error)
        alert(`Failed to create invoice: ${error.error || 'Unknown error'}`)
      }

    } catch (error) {
      console.error('Error creating invoice:', error)
      alert('Failed to create invoice. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const canSave = () => {
    return invoiceData.clientId && invoiceItems.some(item => 
      item.description.trim() && item.quantity > 0 && item.unitPrice > 0
    )
  }

  const getSelectedClient = () => {
    return clients.find(client => client.id === invoiceData.clientId)
  }

  const getSelectedProject = () => {
    return projects.find(project => project.id === invoiceData.projectId)
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
              Back to Invoices
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Create New Invoice
              </h1>
              <p className="text-gray-600 dark:text-gray-300">
                Generate and send invoice to client
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Client Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Building2 className="mr-2 h-5 w-5" />
                Client Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Client *</label>
                <Select 
                  value={invoiceData.clientId} 
                  onValueChange={(value) => setInvoiceData({...invoiceData, clientId: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map(client => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.companyName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {clients.length === 0 && (
                  <p className="text-sm text-gray-500 mt-2">No clients available. Create clients first.</p>
                )}
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

              {getSelectedClient() && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">Selected Client</h4>
                  <p className="text-sm text-blue-800">{getSelectedClient()?.companyName}</p>
                  {getSelectedClient()?.email && (
                    <p className="text-sm text-blue-600">{getSelectedClient()?.email}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Invoice Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Calendar className="mr-2 h-5 w-5" />
                Invoice Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Issue Date *</label>
                  <Input
                    type="date"
                    value={invoiceData.issueDate}
                    onChange={(e) => setInvoiceData({...invoiceData, issueDate: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Due Date *</label>
                  <Input
                    type="date"
                    value={invoiceData.dueDate}
                    onChange={(e) => setInvoiceData({...invoiceData, dueDate: e.target.value})}
                  />
                </div>
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

              <div>
                <label className="block text-sm font-medium mb-2">Payment Terms</label>
                <Input
                  placeholder="e.g., Net 30 days"
                  value={invoiceData.paymentTerms}
                  onChange={(e) => setInvoiceData({...invoiceData, paymentTerms: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <Textarea
                  placeholder="Invoice description..."
                  value={invoiceData.description}
                  onChange={(e) => setInvoiceData({...invoiceData, description: e.target.value})}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Invoice Items */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center">
                <Package className="mr-2 h-5 w-5" />
                Invoice Items
              </div>
              <Button onClick={addInvoiceItem} size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Add Item
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {invoiceItems.map((item, index) => (
                <Card key={item.id} className="p-4 bg-gray-50">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium">Item #{index + 1}</h4>
                    {invoiceItems.length > 1 && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => removeInvoiceItem(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium mb-1">Description *</label>
                      <Input
                        placeholder="Item description"
                        value={item.description}
                        onChange={(e) => updateInvoiceItem(item.id, 'description', e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">Quantity *</label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.quantity}
                        onChange={(e) => updateInvoiceItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">Unit</label>
                      <Select 
                        value={item.unit} 
                        onValueChange={(value) => updateInvoiceItem(item.id, 'unit', value)}
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
                        onChange={(e) => updateInvoiceItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
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
                        onChange={(e) => updateInvoiceItem(item.id, 'discount', parseFloat(e.target.value) || 0)}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">Tax Rate (%)</label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.taxRate}
                        onChange={(e) => updateInvoiceItem(item.id, 'taxRate', parseFloat(e.target.value) || 0)}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">Total Price</label>
                      <div className="flex items-center h-10 px-3 bg-gray-100 border rounded-md">
                        <span className="font-medium">
                          {invoiceData.currency} {calculateItemTotals(item).totalPrice.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}

              {/* Totals */}
              <div className="border-t pt-4">
                <div className="flex justify-end">
                  <div className="w-80 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Subtotal:</span>
                      <span>{invoiceData.currency} {calculations.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Total Discount:</span>
                      <span>-{invoiceData.currency} {calculations.totalDiscount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Total Tax:</span>
                      <span>{invoiceData.currency} {calculations.totalTax.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold border-t pt-2">
                      <span>Grand Total:</span>
                      <span>{invoiceData.currency} {calculations.grandTotal.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Additional Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Additional notes for the client..."
              value={invoiceData.notes}
              onChange={(e) => setInvoiceData({...invoiceData, notes: e.target.value})}
              rows={4}
            />
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-end items-center space-x-4">
          <Button variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button 
            onClick={() => handleSubmit(false)}
            disabled={saving || !canSave()}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {saving ? 'Creating...' : 'Create & Send Invoice'}
            <Send className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </MainLayout>
  )
}
