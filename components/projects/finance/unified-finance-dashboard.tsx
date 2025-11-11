
'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Plus,
  Edit,
  Download,
  FileText,
  BarChart3,
  Calculator,
  AlertTriangle,
  CheckCircle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  ChevronDown,
  ChevronRight,
  PackageCheck,
  Receipt,
  Target,
  Wallet
} from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { BudgetDialog } from './budget-dialog'
import { EnhancedSupplierInvoices } from './enhanced-supplier-invoices'
import { InvoiceReminderAlert } from '../invoice-reminder-alert'
import { ProgressClaimsManager } from '../progress-claims-manager'
import { BudgetDetailsView } from './budget-details-view'

interface UnifiedFinanceDashboardProps {
  projectId: string
  project: {
    id: string
    name: string
    projectNumber: string
    contractValue?: number | null
    estimatedBudget?: number | null
    customerId?: string
  }
}

interface FinanceData {
  contractValue: number
  totalBudget: number
  totalClaimed: number
  totalPaid: number
  totalExpenses: number
  totalPOCommitments: number
  netProfit: number
  profitMargin: number
  grossProfit: number
  grossMargin: number
  budgets: Budget[]
  invoices: Invoice[]
  purchaseOrders: PurchaseOrder[]
  supplierInvoices: SupplierInvoice[]
}

interface Budget {
  id: string
  category: string
  customCategoryId?: string | null
  budgetedAmount: number
  actualAmount: number
  description?: string
  customCategory?: {
    id: string
    name: string
    code: string
    color?: string
  }
}

interface Invoice {
  id: string
  invoiceNumber: string
  totalAmount: number
  amountPaid: number
  amountDue: number
  status: string
  issueDate: string
  dueDate: string
}

interface PurchaseOrder {
  id: string
  poNumber: string
  totalAmount: number
  status: string
  issueDate: string
  Supplier: {
    name: string
  }
}

interface SupplierInvoice {
  id: string
  invoiceNumber: string
  totalAmount: number
  status: string
  invoiceDate: string
  dueDate: string
  Supplier: {
    name: string
  }
}

const CATEGORY_LABELS: Record<string, string> = {
  'GENERAL': 'General',
  'MATERIALS': 'Materials',
  'LABOR': 'Labor',
  'EQUIPMENT': 'Equipment',
  'SUBCONTRACTOR': 'Subcontractor',
  'PERMITS': 'Permits',
  'TRANSPORTATION': 'Transportation',
  'OVERHEAD': 'Overhead',
  'CONTINGENCY': 'Contingency',
  'OTHER': 'Other',
}

export function UnifiedFinanceDashboard({ projectId, project }: UnifiedFinanceDashboardProps) {
  const { data: session } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [financeData, setFinanceData] = useState<FinanceData | null>(null)
  const [showBudgetDialog, setShowBudgetDialog] = useState(false)
  const [selectedBudget, setSelectedBudget] = useState<Budget | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  const userRole = session?.user?.role
  const canEdit = ['PROJECT_MANAGER', 'FINANCE', 'SUPERADMIN'].includes(userRole || '')

  useEffect(() => {
    fetchFinanceData()
  }, [projectId])

  const fetchFinanceData = async () => {
    try {
      setLoading(true)
      
      // Fetch budget data
      const budgetResponse = await fetch(`/api/projects/${projectId}/budget`)
      if (!budgetResponse.ok) throw new Error('Failed to fetch budget data')
      const budgetData = await budgetResponse.json()

      // Fetch customer invoices (claims/revenue)
      const invoicesResponse = await fetch(`/api/projects/${projectId}/invoices`)
      const invoicesData = invoicesResponse.ok ? await invoicesResponse.json() : { invoices: [] }

      // Fetch purchase orders (commitments)
      const poResponse = await fetch(`/api/projects/${projectId}/purchase-orders`)
      const poData = poResponse.ok ? await poResponse.json() : { purchaseOrders: [] }

      // Fetch supplier invoices (actual expenses)
      const supplierInvoicesResponse = await fetch(`/api/projects/${projectId}/supplier-invoices`)
      const supplierInvoicesData = supplierInvoicesResponse.ok ? await supplierInvoicesResponse.json() : { supplierInvoices: [] }

      // Calculate totals
      const contractValue = project.contractValue ? parseFloat(project.contractValue.toString()) : 0
      const totalBudget = project.estimatedBudget ? parseFloat(project.estimatedBudget.toString()) : budgetData.summary?.totalBudget || 0
      
      // Revenue calculations (from customer invoices)
      const totalClaimed = invoicesData.invoices?.reduce((sum: number, inv: Invoice) => sum + parseFloat(inv.totalAmount.toString()), 0) || 0
      const totalPaid = invoicesData.invoices?.reduce((sum: number, inv: Invoice) => sum + parseFloat(inv.amountPaid?.toString() || '0'), 0) || 0
      
      // Expense calculations (from supplier invoices)
      const totalExpenses = supplierInvoicesData.supplierInvoices?.reduce((sum: number, inv: SupplierInvoice) => {
        // Only count PAID or PARTIALLY_PAID supplier invoices as actual expenses
        if (['PAID', 'PARTIALLY_PAID'].includes(inv.status)) {
          return sum + parseFloat(inv.totalAmount.toString())
        }
        return sum
      }, 0) || 0
      
      // PO commitments (not yet invoiced)
      const totalPOCommitments = poData.purchaseOrders?.reduce((sum: number, po: PurchaseOrder) => {
        // Only count APPROVED or SENT POs as commitments
        if (['APPROVED', 'SENT'].includes(po.status)) {
          return sum + parseFloat(po.totalAmount.toString())
        }
        return sum
      }, 0) || 0
      
      // Profit calculations
      // Gross Profit = Contract Value - Total Expenses (project-level)
      const grossProfit = contractValue - totalExpenses
      const grossMargin = contractValue > 0 ? (grossProfit / contractValue) * 100 : 0
      
      // Net Profit = Amount Received - Expenses Paid (cash flow)
      const netProfit = totalPaid - totalExpenses
      const profitMargin = totalPaid > 0 ? (netProfit / totalPaid) * 100 : 0

      setFinanceData({
        contractValue,
        totalBudget,
        totalClaimed,
        totalPaid,
        totalExpenses,
        totalPOCommitments,
        netProfit,
        profitMargin,
        grossProfit,
        grossMargin,
        budgets: budgetData.budgets || [],
        invoices: invoicesData.invoices || [],
        purchaseOrders: poData.purchaseOrders || [],
        supplierInvoices: supplierInvoicesData.supplierInvoices || []
      })
    } catch (error) {
      console.error('Error fetching finance data:', error)
      toast.error('Failed to load finance data')
    } finally {
      setLoading(false)
    }
  }

  const handleBudgetSaved = () => {
    setShowBudgetDialog(false)
    setSelectedBudget(null)
    fetchFinanceData()
    toast.success('Budget updated successfully')
  }

  const toggleCategory = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId)
    } else {
      newExpanded.add(categoryId)
    }
    setExpandedCategories(newExpanded)
  }

  const getCategoryLabel = (category: string, customCategory?: { name: string }) => {
    if (customCategory) return customCategory.name
    return CATEGORY_LABELS[category] || category
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; className: string }> = {
      DRAFT: { label: 'Draft', className: 'bg-gray-100 text-gray-800' },
      SENT: { label: 'Sent', className: 'bg-blue-100 text-blue-800' },
      APPROVED: { label: 'Approved', className: 'bg-green-100 text-green-800' },
      PARTIALLY_PAID: { label: 'Partial', className: 'bg-yellow-100 text-yellow-800' },
      PAID: { label: 'Paid', className: 'bg-green-100 text-green-800' },
      OVERDUE: { label: 'Overdue', className: 'bg-red-100 text-red-800' },
      CANCELLED: { label: 'Cancelled', className: 'bg-gray-100 text-gray-800' },
    }
    const variant = variants[status] || { label: status, className: 'bg-gray-100 text-gray-800' }
    return <Badge className={variant.className}>{variant.label}</Badge>
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!financeData) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex items-center justify-center h-32">
            <p className="text-gray-500">Failed to load finance data</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const remainingBudget = financeData.totalBudget - financeData.totalExpenses - financeData.totalPOCommitments
  const outstandingClaims = financeData.totalClaimed - financeData.totalPaid

  return (
    <div className="space-y-4">
      {/* Invoice Reminder Alert */}
      <InvoiceReminderAlert projectId={projectId} />
      
      {/* Financial Overview - Separated Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* CONTRACT & INCOME */}
        <Card className="border-2 border-green-200">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center text-sm font-semibold text-green-700">
              <Receipt className="mr-2 h-4 w-4" />
              CONTRACT & INCOME
            </CardTitle>
            <CardDescription className="text-xs">Client-facing revenue</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between items-center p-2 bg-green-50 rounded border border-green-200">
              <span className="text-xs font-medium">Contract Value</span>
              <span className="text-sm font-bold text-green-700">
                ${financeData.contractValue.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center p-2 bg-blue-50 rounded">
              <span className="text-xs">Total Claims</span>
              <span className="text-sm font-semibold text-blue-600">
                ${financeData.totalClaimed.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center p-2 bg-green-50 rounded">
              <span className="text-xs">Total Received</span>
              <span className="text-sm font-semibold text-green-600">
                ${financeData.totalPaid.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center p-2 bg-yellow-50 rounded border border-yellow-200">
              <span className="text-xs">Outstanding</span>
              <span className="text-sm font-semibold text-yellow-600">
                ${outstandingClaims.toLocaleString()}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* BUDGET & EXPENSES */}
        <Card className="border-2 border-blue-200">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center text-sm font-semibold text-blue-700">
              <Wallet className="mr-2 h-4 w-4" />
              BUDGET & EXPENSES
            </CardTitle>
            <CardDescription className="text-xs">Internal spending limits</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between items-center p-2 bg-blue-50 rounded border border-blue-200">
              <span className="text-xs font-medium">Total Budget</span>
              <span className="text-sm font-bold text-blue-700">
                ${financeData.totalBudget.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center p-2 bg-orange-50 rounded">
              <span className="text-xs">PO Issued</span>
              <span className="text-sm font-semibold text-orange-600">
                ${financeData.totalPOCommitments.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center p-2 bg-red-50 rounded">
              <span className="text-xs">Actual Spend</span>
              <span className="text-sm font-semibold text-red-600">
                ${financeData.totalExpenses.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center p-2 bg-blue-50 rounded border border-blue-200">
              <span className="text-xs">Remaining</span>
              <span className={`text-sm font-semibold ${remainingBudget >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                ${remainingBudget.toLocaleString()}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* PROFITABILITY */}
        <Card className="border-2 border-purple-200">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center text-sm font-semibold text-purple-700">
              <TrendingUp className="mr-2 h-4 w-4" />
              PROFITABILITY
            </CardTitle>
            <CardDescription className="text-xs">Project margins & profit</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between items-center p-2 bg-purple-50 rounded border border-purple-200">
              <span className="text-xs font-medium">Gross Profit</span>
              <span className={`text-sm font-bold ${financeData.grossProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                ${financeData.grossProfit.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center p-2 bg-purple-50 rounded">
              <span className="text-xs">Gross Margin</span>
              <span className={`text-sm font-semibold ${financeData.grossMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {financeData.grossMargin.toFixed(1)}%
              </span>
            </div>
            <div className="p-3 bg-gray-50 rounded border text-center mt-3">
              <div className="text-xs text-gray-600">Net Profit (Cash Flow)</div>
              <div className={`text-lg font-bold mt-1 ${financeData.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${financeData.netProfit.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                Payments received minus expenses paid
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Budget Categories - Updated Layout */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex items-center text-base">
                <DollarSign className="mr-2 h-4 w-4" />
                Budget Categories
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Budget: ${financeData.totalBudget.toLocaleString()} | Spent: ${financeData.totalExpenses.toLocaleString()} | Remaining: ${remainingBudget.toLocaleString()}
              </CardDescription>
            </div>
            {canEdit && (
              <Button onClick={() => setShowBudgetDialog(true)} size="sm">
                <Plus className="mr-1 h-3 w-3" />
                Add Category
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {financeData.budgets.length === 0 ? (
            <div className="text-center py-6 text-gray-500">
              <DollarSign className="h-8 w-8 mx-auto mb-1 opacity-50" />
              <p className="text-xs">No budget categories defined</p>
              {canEdit && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-3"
                  onClick={() => setShowBudgetDialog(true)}
                >
                  <Plus className="mr-1 h-3 w-3" />
                  Add First Category
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {financeData.budgets.map((budget) => {
                const spent = parseFloat(budget.actualAmount.toString())
                const budgeted = parseFloat(budget.budgetedAmount.toString())
                const remaining = budgeted - spent
                const percentage = budgeted > 0 ? (spent / budgeted) * 100 : 0
                const isOverBudget = spent > budgeted
                const isExpanded = expandedCategories.has(budget.id)

                return (
                  <div key={budget.id} className="border rounded-lg p-3 hover:shadow-sm transition-shadow bg-white">
                    <div 
                      className="flex justify-between items-center cursor-pointer"
                      onClick={() => toggleCategory(budget.id)}
                    >
                      <div className="flex items-center space-x-2">
                        {isExpanded ? (
                          <ChevronDown className="h-3 w-3 text-gray-500" />
                        ) : (
                          <ChevronRight className="h-3 w-3 text-gray-500" />
                        )}
                        <span className="text-sm font-medium">
                          {getCategoryLabel(budget.category, budget.customCategory)}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-medium text-gray-700">
                          Budget: ${budgeted.toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-600">
                          Spent: ${spent.toLocaleString()} | Remaining: <span className={isOverBudget ? 'text-red-600 font-semibold' : 'text-green-600 font-semibold'}>${Math.abs(remaining).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-2">
                      <Progress 
                        value={Math.min(percentage, 100)}
                        className={`h-2 ${isOverBudget ? '[&>div]:bg-red-500' : '[&>div]:bg-blue-500'}`}
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>{percentage.toFixed(0)}% used</span>
                        {isOverBudget && <span className="text-red-600 font-semibold">Over budget!</span>}
                      </div>
                    </div>
                    {isExpanded && budget.description && (
                      <div className="mt-2 pt-2 border-t text-xs text-gray-600 bg-gray-50 p-2 rounded">
                        <span className="font-medium">Notes: </span>{budget.description}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions - Compact */}
      <div className="flex gap-2 flex-wrap">
        {canEdit && (
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => router.push(`/finance/customer-invoices/new?projectId=${projectId}`)}
          >
            <FileText className="mr-1 h-3 w-3" />
            Record Claim
          </Button>
        )}
        {canEdit && (
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => router.push(`/finance/purchase-orders/create?projectId=${projectId}`)}
          >
            <PackageCheck className="mr-1 h-3 w-3" />
            Issue PO
          </Button>
        )}
        <Button variant="outline" size="sm">
          <Download className="mr-1 h-3 w-3" />
          Export
        </Button>
      </div>

      {/* Detailed Tabs - Compact */}
      <Tabs defaultValue="overview" className="space-y-3">
        <TabsList className="grid w-full grid-cols-6 h-9">
          <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
          <TabsTrigger value="budget" className="text-xs">Budget</TabsTrigger>
          <TabsTrigger value="claims" className="text-xs">Claims</TabsTrigger>
          <TabsTrigger value="pos" className="text-xs">POs</TabsTrigger>
          <TabsTrigger value="expenses" className="text-xs">Expenses</TabsTrigger>
          <TabsTrigger value="reports" className="text-xs">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-3 m-0">
          {/* Financial Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Revenue Overview */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-base">
                  <ArrowDownRight className="mr-2 h-4 w-4 text-green-600" />
                  Revenue Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between items-center p-2 rounded bg-gray-50">
                  <span className="text-xs text-gray-600">Contract Value</span>
                  <span className="text-sm font-semibold">${financeData.contractValue.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center p-2 rounded bg-blue-50">
                  <span className="text-xs text-gray-600">Total Claims</span>
                  <span className="text-sm font-semibold text-blue-600">${financeData.totalClaimed.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center p-2 rounded bg-green-50">
                  <span className="text-xs text-gray-600">Payments Received</span>
                  <span className="text-sm font-semibold text-green-600">${financeData.totalPaid.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center p-2 rounded bg-yellow-50 border border-yellow-200">
                  <span className="text-xs text-gray-600 font-medium">Outstanding</span>
                  <span className="text-sm font-semibold text-yellow-600">${(financeData.totalClaimed - financeData.totalPaid).toLocaleString()}</span>
                </div>
              </CardContent>
            </Card>

            {/* Expense Overview */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-base">
                  <ArrowUpRight className="mr-2 h-4 w-4 text-red-600" />
                  Expense Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between items-center p-2 rounded bg-gray-50">
                  <span className="text-xs text-gray-600">Total Budget</span>
                  <span className="text-sm font-semibold">${financeData.totalBudget.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center p-2 rounded bg-orange-50">
                  <span className="text-xs text-gray-600">PO Commitments</span>
                  <span className="text-sm font-semibold text-orange-600">${financeData.totalPOCommitments.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center p-2 rounded bg-red-50">
                  <span className="text-xs text-gray-600">Actual Expenses</span>
                  <span className="text-sm font-semibold text-red-600">${financeData.totalExpenses.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center p-2 rounded bg-blue-50 border border-blue-200">
                  <span className="text-xs text-gray-600 font-medium">Remaining Budget</span>
                  <span className={`text-sm font-semibold ${(financeData.totalBudget - financeData.totalExpenses - financeData.totalPOCommitments) >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                    ${(financeData.totalBudget - financeData.totalExpenses - financeData.totalPOCommitments).toLocaleString()}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="claims" className="m-0">
          <ProgressClaimsManager
            projectId={projectId}
            quotationId={undefined}
            customerId={project.customerId || ''}
          />
        </TabsContent>

        <TabsContent value="pos" className="m-0 p-6">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Purchase Orders</h2>
                <p className="text-sm text-muted-foreground">
                  Manage purchase orders for this project
                </p>
              </div>
              <Button onClick={() => router.push(`/finance/purchase-orders/create?projectId=${projectId}`)}>
                <Plus className="h-4 w-4 mr-2" />
                Issue New PO
              </Button>
            </div>

            {financeData.purchaseOrders.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <PackageCheck className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Purchase Orders Yet</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Create your first purchase order to track project expenses
                  </p>
                  <Button onClick={() => router.push(`/finance/purchase-orders/create?projectId=${projectId}`)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Issue Purchase Order
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="text-xs">
                          <TableHead className="text-xs">PO #</TableHead>
                          <TableHead className="text-xs">Supplier</TableHead>
                          <TableHead className="text-xs">Issue Date</TableHead>
                          <TableHead className="text-xs">Amount</TableHead>
                          <TableHead className="text-xs">Status</TableHead>
                          <TableHead className="text-xs w-20">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {financeData.purchaseOrders.map((po) => (
                          <TableRow 
                            key={po.id} 
                            className="text-xs cursor-pointer hover:bg-gray-50 transition-colors"
                            onClick={() => router.push(`/finance/purchase-orders/${po.id}?returnUrl=/projects/${projectId}`)}
                          >
                            <TableCell className="font-medium text-xs text-blue-600 hover:underline">{po.poNumber}</TableCell>
                            <TableCell className="text-xs">{po.Supplier.name}</TableCell>
                            <TableCell className="text-xs">{po.issueDate ? format(new Date(po.issueDate), 'MMM dd, yyyy') : 'N/A'}</TableCell>
                            <TableCell className="text-xs">${parseFloat(po.totalAmount.toString()).toLocaleString()}</TableCell>
                            <TableCell className="text-xs">{getStatusBadge(po.status)}</TableCell>
                            <TableCell className="text-xs">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  router.push(`/finance/purchase-orders/${po.id}?returnUrl=/projects/${projectId}`)
                                }}
                              >
                                <Edit className="h-3 w-3 mr-1" />
                                Edit
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="expenses" className="m-0">
          <EnhancedSupplierInvoices projectId={projectId} project={project} />
        </TabsContent>

        <TabsContent value="budget" className="m-0">
          <BudgetDetailsView projectId={projectId} project={project} />
        </TabsContent>

        <TabsContent value="reports" className="m-0">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Financial Reports</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-gray-500">Reports view</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      {showBudgetDialog && (
        <BudgetDialog
          projectId={projectId}
          budget={selectedBudget}
          onSaved={handleBudgetSaved}
          onCancel={() => {
            setShowBudgetDialog(false)
            setSelectedBudget(null)
          }}
        />
      )}
    </div>
  )
}
