
'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  FileText,
  Upload,
  DollarSign,
  CheckCircle,
  XCircle,
  ArrowLeft,
  RefreshCw,
  AlertTriangle,
  Building2,
  Calendar,
  TrendingDown,
  TrendingUp
} from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import Link from 'next/link'

interface UnsyncedInvoice {
  id: string
  invoiceNumber: string
  type: 'CUSTOMER' | 'SUPPLIER'
  party: {
    id: string
    name: string
    email: string | null
    number: string | null
  }
  project: {
    id: string
    name: string
    projectNumber: string
  } | null
  subtotal: number
  taxAmount: number | null
  totalAmount: number
  currency: string
  issueDate: string
  dueDate: string
  description: string | null
  status: string
  createdAt: string
  items: any[]
}

const formatCurrency = (amount: number, currency: string = 'SGD') => {
  return new Intl.NumberFormat('en-SG', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount)
}

export default function UnsyncedInvoicesPage() {
  const router = useRouter()
  const { data: session } = useSession() || {}
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [invoices, setInvoices] = useState<UnsyncedInvoice[]>([])
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set())
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [summary, setSummary] = useState({ 
    totalInvoices: 0, 
    totalAmount: 0, 
    currency: 'SGD',
    customerInvoices: { count: 0, amount: 0 },
    supplierInvoices: { count: 0, amount: 0 }
  })

  const userRole = session?.user?.role
  const isSuperAdmin = userRole === 'SUPERADMIN'
  const canView = ['SUPERADMIN', 'FINANCE', 'PROJECT_MANAGER'].includes(userRole || '')

  useEffect(() => {
    if (canView) {
      fetchInvoices()
    } else {
      setLoading(false)
    }
  }, [canView])

  const fetchInvoices = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/finance/unsynced-invoices')
      
      if (!response.ok) {
        throw new Error('Failed to fetch unsynced invoices')
      }

      const data = await response.json()
      
      if (data.success) {
        setInvoices(data.invoices || [])
        setSummary(data.summary || { 
          totalInvoices: 0, 
          totalAmount: 0, 
          currency: 'SGD',
          customerInvoices: { count: 0, amount: 0 },
          supplierInvoices: { count: 0, amount: 0 }
        })
        console.log(`✅ Loaded ${data.invoices?.length || 0} unsynced invoices`)
      } else {
        throw new Error(data.error || 'Unknown error')
      }
    } catch (error: any) {
      console.error('Failed to fetch unsynced invoices:', error)
      toast.error('Failed to load unsynced invoices', {
        description: error.message
      })
      setInvoices([])
    } finally {
      setLoading(false)
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedInvoices(new Set(invoices.map(inv => inv.id)))
    } else {
      setSelectedInvoices(new Set())
    }
  }

  const handleSelectInvoice = (invoiceId: string, checked: boolean) => {
    const newSelected = new Set(selectedInvoices)
    if (checked) {
      newSelected.add(invoiceId)
    } else {
      newSelected.delete(invoiceId)
    }
    setSelectedInvoices(newSelected)
  }

  const handleBatchSync = async () => {
    if (selectedInvoices.size === 0) {
      toast.error('Please select at least one invoice to sync')
      return
    }

    try {
      setSyncing(true)
      
      // Determine the invoice type for the selected invoices
      const selectedInvoiceObjects = invoices.filter(inv => selectedInvoices.has(inv.id))
      const hasCustomer = selectedInvoiceObjects.some(inv => inv.type === 'CUSTOMER')
      const hasSupplier = selectedInvoiceObjects.some(inv => inv.type === 'SUPPLIER')
      const invoiceType = (hasCustomer && hasSupplier) ? 'MIXED' : (hasCustomer ? 'CUSTOMER' : 'SUPPLIER')

      const response = await fetch('/api/finance/unsynced-invoices/batch-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invoiceIds: Array.from(selectedInvoices),
          invoiceType
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to sync invoices')
      }

      toast.success(data.message, {
        description: data.results.failed.length > 0
          ? `${data.results.failed.length} invoice(s) failed to sync`
          : 'All invoices synced successfully'
      })

      // Refresh the list
      setSelectedInvoices(new Set())
      await fetchInvoices()
    } catch (error: any) {
      console.error('Failed to batch sync:', error)
      toast.error('Failed to sync invoices to Xero', {
        description: error.message
      })
    } finally {
      setSyncing(false)
      setShowConfirmDialog(false)
    }
  }

  const handleInvoiceClick = (invoice: UnsyncedInvoice) => {
    if (invoice.type === 'CUSTOMER') {
      router.push(`/finance/customer-invoices/${invoice.id}`)
    } else {
      router.push(`/finance/supplier-invoices/${invoice.id}`)
    }
  }

  if (!canView) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <AlertTriangle className="mx-auto h-12 w-12 text-yellow-600 mb-4" />
            <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
            <p className="text-gray-600 mt-2">You don't have permission to access unsynced invoices.</p>
          </div>
        </div>
      </MainLayout>
    )
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="p-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded mb-4"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </MainLayout>
    )
  }

  const selectedTotal = invoices
    .filter(inv => selectedInvoices.has(inv.id))
    .reduce((sum, inv) => sum + inv.totalAmount, 0)

  return (
    <MainLayout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <Link href="/finance">
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Finance
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Unsynced Invoices</h1>
              <p className="text-gray-600">Project-related invoices awaiting sync to Xero</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Button 
              variant="outline" 
              size="sm"
              onClick={fetchInvoices}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {isSuperAdmin && selectedInvoices.size > 0 && (
              <Button 
                onClick={() => setShowConfirmDialog(true)}
                disabled={syncing}
              >
                <Upload className="h-4 w-4 mr-2" />
                {syncing ? 'Syncing...' : `Sync ${selectedInvoices.size} to Xero`}
              </Button>
            )}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <FileText className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Invoices</p>
                  <p className="text-2xl font-bold">{summary.totalInvoices}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <DollarSign className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Value</p>
                  <p className="text-2xl font-bold">{formatCurrency(summary.totalAmount)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-8 w-8 text-emerald-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Customer Invoices</p>
                  <p className="text-2xl font-bold">{summary.customerInvoices.count}</p>
                  <p className="text-xs text-gray-500">{formatCurrency(summary.customerInvoices.amount)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <TrendingDown className="h-8 w-8 text-orange-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Supplier Invoices</p>
                  <p className="text-2xl font-bold">{summary.supplierInvoices.count}</p>
                  <p className="text-xs text-gray-500">{formatCurrency(summary.supplierInvoices.amount)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Info Banner */}
        {isSuperAdmin && invoices.length > 0 && (
          <Card className="mb-6 border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="h-5 w-5 text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-900">Manual Review Required</p>
                  <p className="text-sm text-blue-700 mt-1">
                    These invoices are automatically tagged to their projects and are awaiting sync to Xero. 
                    Customer invoices include those generated from progress claims. Supplier invoices include those submitted for project expenses.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Invoices Table */}
        <Card>
          <CardHeader>
            <CardTitle>Unsynced Invoices ({invoices.length})</CardTitle>
            <CardDescription>
              Project-related invoices awaiting sync to Xero
            </CardDescription>
          </CardHeader>
          <CardContent>
            {invoices.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Unsynced Invoices</h3>
                <p className="text-gray-500">
                  All project-related invoices have been synced to Xero. Great job!
                </p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {isSuperAdmin && (
                        <TableHead className="w-12">
                          <Checkbox
                            checked={selectedInvoices.size === invoices.length && invoices.length > 0}
                            onCheckedChange={handleSelectAll}
                          />
                        </TableHead>
                      )}
                      <TableHead>Type</TableHead>
                      <TableHead>Invoice Number</TableHead>
                      <TableHead>Party</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Issue Date</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((invoice) => (
                      <TableRow 
                        key={invoice.id}
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => handleInvoiceClick(invoice)}
                      >
                        {isSuperAdmin && (
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedInvoices.has(invoice.id)}
                              onCheckedChange={(checked) => 
                                handleSelectInvoice(invoice.id, checked as boolean)
                              }
                            />
                          </TableCell>
                        )}
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className={invoice.type === 'CUSTOMER' ? 'bg-green-100 text-green-700 border-green-300' : 'bg-orange-100 text-orange-700 border-orange-300'}
                          >
                            {invoice.type === 'CUSTOMER' ? (
                              <>
                                <TrendingUp className="h-3 w-3 mr-1" />
                                Customer
                              </>
                            ) : (
                              <>
                                <TrendingDown className="h-3 w-3 mr-1" />
                                Supplier
                              </>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex items-center space-x-2">
                            <FileText className="h-4 w-4 text-gray-400" />
                            <span>{invoice.invoiceNumber}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{invoice.party.name}</div>
                            {invoice.party.number && (
                              <div className="text-xs text-gray-500">
                                {invoice.party.number}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {invoice.project ? (
                            <div>
                              <div className="text-sm font-medium">{invoice.project.name}</div>
                              <div className="text-xs text-gray-500">
                                {invoice.project.projectNumber}
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(invoice.totalAmount, invoice.currency)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Calendar className="h-3 w-3 text-gray-400" />
                            <span>{format(new Date(invoice.issueDate), 'dd MMM yyyy')}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {format(new Date(invoice.dueDate), 'dd MMM yyyy')}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-yellow-100 text-yellow-700 border-yellow-300">
                            Pending Sync
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Confirmation Dialog */}
        <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Batch Sync to Xero</AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <p>You are about to sync {selectedInvoices.size} invoice(s) to Xero.</p>
                <p className="font-semibold">Total Amount: {formatCurrency(selectedTotal)}</p>
                <p className="text-yellow-700">
                  ⚠️ This action will push these invoices to Xero. Please ensure all details and project tags are correct.
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={syncing}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleBatchSync} disabled={syncing}>
                {syncing ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Confirm Sync
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MainLayout>
  )
}
