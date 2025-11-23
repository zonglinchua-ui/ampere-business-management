
'use client'

import { useState, useEffect, Suspense } from "react"
import { useSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
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
  CreditCard,
  Building2,
  DollarSign,
  Calendar,
  ArrowLeft,
  Save,
  Send,
  Upload,
  FileText,
  User,
  Banknote
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

const paymentMethods = [
  { value: "BANK_TRANSFER", label: "Bank Transfer" },
  { value: "CHEQUE", label: "Cheque" },
  { value: "CASH", label: "Cash" },
  { value: "CREDIT_CARD", label: "Credit Card" },
  { value: "ONLINE", label: "Online Payment" }
]

const paymentTypes = [
  { value: "VENDOR_PAYMENT", label: "Vendor Payment" },
  { value: "CLIENT_PAYMENT", label: "Client Payment" },
  { value: "EXPENSE", label: "Business Expense" },
  { value: "REFUND", label: "Refund" }
]

function CreatePaymentContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session } = useSession()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Data for dropdowns
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [projects, setProjects] = useState<Project[]>([])

  // Form data
  const [paymentData, setPaymentData] = useState({
    type: "VENDOR_PAYMENT",
    entityId: "",
    projectId: "",
    amount: "",
    currency: "SGD",
    method: "BANK_TRANSFER",
    paymentDate: new Date().toISOString().split('T')[0],
    dueDate: "",
    reference: "",
    description: "",
    invoiceNumber: "",
    bankAccount: "",
    chequeNumber: "",
    notes: ""
  })

  const invoiceId = searchParams?.get('invoiceId')

  useEffect(() => {
    fetchDropdownData()
  }, [])

  useEffect(() => {
    if (invoiceId) {
      // TODO: Fetch invoice details and pre-populate form
      console.log('Pre-populating form with invoice ID:', invoiceId)
    }
  }, [invoiceId])

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

    } catch (error) {
      console.error('Error fetching dropdown data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (isDraft = false) => {
    setSaving(true)
    try {
      console.log('Creating payment:', { ...paymentData, isDraft })
      
      const payload = {
        ...paymentData,
        isDraft,
        type: paymentData.type,
        amount: paymentData.amount
      }

      console.log('Payload being sent:', payload)

      const response = await fetch('/api/finance/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        const result = await response.json()
        console.log('Payment created successfully:', result)
        if (isDraft) {
          alert('Payment saved as draft successfully!')
        } else {
          alert('Payment processed successfully!')
        }
        router.push(`/finance/payments`)
      } else {
        const error = await response.json()
        console.error('API Error:', error)
        alert(`Failed to create payment: ${error.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error creating payment:', error)
      alert('Failed to create payment. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const canSave = () => {
    return paymentData.entityId && paymentData.amount && parseFloat(paymentData.amount) > 0
  }

  const canProcess = () => {
    return canSave() && paymentData.reference && paymentData.description
  }

  const getSelectedEntity = () => {
    return vendors.find(vendor => vendor.id === paymentData.entityId)
  }

  const getSelectedProject = () => {
    return projects.find(project => project.id === paymentData.projectId)
  }

  return (
    <MainLayout>
      <div className="container mx-auto p-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Payments
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Create New Payment
              </h1>
              <p className="text-gray-600 dark:text-gray-300">
                Process a new financial transaction
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
          {/* Payment Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <CreditCard className="mr-2 h-5 w-5" />
                Payment Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Payment Type *</label>
                <Select 
                  value={paymentData.type} 
                  onValueChange={(value) => setPaymentData({...paymentData, type: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentTypes.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  {paymentData.type === 'CLIENT_PAYMENT' ? 'Client' : 'Vendor'} *
                </label>
                <Select 
                  value={paymentData.entityId} 
                  onValueChange={(value) => setPaymentData({...paymentData, entityId: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select entity" />
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
                  value={paymentData.projectId || "no-project"} 
                  onValueChange={(value) => setPaymentData({...paymentData, projectId: value === "no-project" ? "" : value})}
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

              {getSelectedEntity() && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">Selected Entity</h4>
                  <p className="text-sm text-blue-800">{getSelectedEntity()?.name}</p>
                  {getSelectedEntity()?.email && (
                    <p className="text-sm text-blue-600">{getSelectedEntity()?.email}</p>
                  )}
                  {getSelectedEntity()?.phone && (
                    <p className="text-sm text-blue-600">{getSelectedEntity()?.phone}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <DollarSign className="mr-2 h-5 w-5" />
                Payment Information
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
                    value={paymentData.amount}
                    onChange={(e) => setPaymentData({...paymentData, amount: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Currency</label>
                  <Select 
                    value={paymentData.currency} 
                    onValueChange={(value) => setPaymentData({...paymentData, currency: value})}
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
                <label className="block text-sm font-medium mb-2">Payment Method *</label>
                <Select 
                  value={paymentData.method} 
                  onValueChange={(value) => setPaymentData({...paymentData, method: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentMethods.map(method => (
                      <SelectItem key={method.value} value={method.value}>
                        {method.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Payment Date *</label>
                  <Input
                    type="date"
                    value={paymentData.paymentDate}
                    onChange={(e) => setPaymentData({...paymentData, paymentDate: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Due Date (Optional)</label>
                  <Input
                    type="date"
                    value={paymentData.dueDate}
                    onChange={(e) => setPaymentData({...paymentData, dueDate: e.target.value})}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Reference Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="mr-2 h-5 w-5" />
                Reference Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Reference Number *</label>
                <Input
                  placeholder="e.g., TXN-2024-001, REF-001"
                  value={paymentData.reference}
                  onChange={(e) => setPaymentData({...paymentData, reference: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Invoice Number (Optional)</label>
                <Input
                  placeholder="Related invoice number"
                  value={paymentData.invoiceNumber}
                  onChange={(e) => setPaymentData({...paymentData, invoiceNumber: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Description *</label>
                <Textarea
                  placeholder="Payment description or purpose"
                  value={paymentData.description}
                  onChange={(e) => setPaymentData({...paymentData, description: e.target.value})}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Payment Method Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Banknote className="mr-2 h-5 w-5" />
                Payment Method Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {paymentData.method === 'BANK_TRANSFER' && (
                <div>
                  <label className="block text-sm font-medium mb-2">Bank Account</label>
                  <Input
                    placeholder="Bank account details"
                    value={paymentData.bankAccount}
                    onChange={(e) => setPaymentData({...paymentData, bankAccount: e.target.value})}
                  />
                </div>
              )}

              {paymentData.method === 'CHEQUE' && (
                <div>
                  <label className="block text-sm font-medium mb-2">Cheque Number</label>
                  <Input
                    placeholder="Cheque number"
                    value={paymentData.chequeNumber}
                    onChange={(e) => setPaymentData({...paymentData, chequeNumber: e.target.value})}
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-2">Notes</label>
                <Textarea
                  placeholder="Additional notes or instructions"
                  value={paymentData.notes}
                  onChange={(e) => setPaymentData({...paymentData, notes: e.target.value})}
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Attachments</label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">
                    Click to upload or drag and drop receipts or supporting documents
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Summary Card */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Payment Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <div className="text-sm text-gray-500">Entity</div>
                <div className="font-medium">
                  {getSelectedEntity()?.name || 'Not selected'}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Amount</div>
                <div className="font-medium text-lg">
                  {paymentData.currency} {paymentData.amount || '0.00'}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Method</div>
                <div className="font-medium">
                  {paymentMethods.find(m => m.value === paymentData.method)?.label}
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
            disabled={saving || !canProcess()}
            className="bg-green-600 hover:bg-green-700"
          >
            {saving ? 'Processing...' : 'Process Payment'}
            <Send className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </MainLayout>
  )
}

export default function CreatePaymentPage() {
  return (
    <Suspense fallback={
      <MainLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
        </div>
      </MainLayout>
    }>
      <CreatePaymentContent />
    </Suspense>
  )
}
