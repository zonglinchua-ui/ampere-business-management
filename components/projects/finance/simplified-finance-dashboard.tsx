'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Receipt,
  TrendingUp,
  FileText,
  PackageCheck,
  DollarSign,
  Target,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { toast } from 'sonner'
import { InvoiceReminderAlert } from '../invoice-reminder-alert'
import ProcurementManagement from '../procurement/procurement-management'

interface SimplifiedFinanceDashboardProps {
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
}

interface BudgetSummary {
  contractValue: number
  totalBudget: number
  totalActualCost: number
  estimatedProfit: number
  actualProfit: number
  profitMargin: number
  totalSuppliers: number
  suppliersWithQuotation: number
  suppliersWithPO: number
}

interface SupplierBudgetItem {
  id: string
  supplierName: string
  tradeType: string
  quotedAmount: number
  actualCost: number
  variance: number | null
  status: string
  quotationReference: string | null
  poIssued: boolean
  needsReview: boolean
  isApproved: boolean
  Supplier: {
    id: string
    name: string
  }
}

export function SimplifiedFinanceDashboard({ projectId, project }: SimplifiedFinanceDashboardProps) {
  const { data: session } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [financeData, setFinanceData] = useState<FinanceData | null>(null)
  const [budgetSummary, setBudgetSummary] = useState<BudgetSummary | null>(null)
  const [budgetItems, setBudgetItems] = useState<SupplierBudgetItem[]>([])
  const [showProcurement, setShowProcurement] = useState(false)

  const canEdit = session?.user?.role === 'ADMIN' || session?.user?.role === 'PROJECT_MANAGER'

  useEffect(() => {
    fetchFinanceData()
    fetchBudgetData()
  }, [projectId])

  const fetchFinanceData = async () => {
    try {
      setLoading(true)
      
      // Fetch all data in parallel for better performance
      const [budgetResponse, invoicesResponse, poResponse, supplierInvoicesResponse] = await Promise.all([
        fetch(`/api/projects/${projectId}/budget`),
        fetch(`/api/projects/${projectId}/invoices`),
        fetch(`/api/projects/${projectId}/purchase-orders`),
        fetch(`/api/projects/${projectId}/supplier-invoices`)
      ])

      const budgetData = budgetResponse.ok ? await budgetResponse.json() : {}
      const invoicesData = invoicesResponse.ok ? await invoicesResponse.json() : { invoices: [] }
      const poData = poResponse.ok ? await poResponse.json() : { purchaseOrders: [] }
      const supplierInvoicesData = supplierInvoicesResponse.ok ? await supplierInvoicesResponse.json() : { supplierInvoices: [] }

      // Calculate totals
      const contractValue = project.contractValue ? parseFloat(project.contractValue.toString()) : 0
      const totalBudget = project.estimatedBudget ? parseFloat(project.estimatedBudget.toString()) : budgetData.summary?.totalBudget || 0
      
      // Revenue calculations (from customer invoices)
      const totalClaimed = invoicesData.invoices?.reduce((sum: number, inv: any) => sum + parseFloat(inv.totalAmount.toString()), 0) || 0
      const totalPaid = invoicesData.invoices?.reduce((sum: number, inv: any) => sum + parseFloat(inv.amountPaid?.toString() || '0'), 0) || 0
      
      // Expense calculations (from supplier invoices)
      const totalExpenses = supplierInvoicesData.supplierInvoices?.reduce((sum: number, inv: any) => {
        // Only count PAID or PARTIALLY_PAID supplier invoices as actual expenses
        if (['PAID', 'PARTIALLY_PAID'].includes(inv.status)) {
          return sum + parseFloat(inv.totalAmount.toString())
        }
        return sum
      }, 0) || 0
      
      // PO commitments (not yet invoiced)
      const totalPOCommitments = poData.purchaseOrders?.reduce((sum: number, po: any) => {
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
        grossMargin
      })
    } catch (error) {
      console.error('Error fetching finance data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchBudgetData = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/budget/supplier-items`)
      if (response.ok) {
        const data = await response.json()
        setBudgetSummary(data.summary || null)
        setBudgetItems(data.budgetItems || [])
      }
    } catch (error) {
      console.error('Failed to fetch budget data:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Loading financial data...</p>
        </div>
      </div>
    )
  }

  if (!financeData) {
    return (
      <div className="text-center p-8">
        <p className="text-gray-600">Unable to load financial data</p>
      </div>
    )
  }

  const outstandingClaims = (financeData?.totalClaimed || 0) - (financeData?.totalPaid || 0)

  return (
    <div className="space-y-6">
      {/* Invoice Reminder Alert */}
      <InvoiceReminderAlert projectId={projectId} />
      
      {/* Financial Overview - Consolidated */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
                ${(financeData?.contractValue || 0).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center p-2 bg-blue-50 rounded">
              <span className="text-xs">Total Claims</span>
              <span className="text-sm font-semibold text-blue-600">
                ${(financeData?.totalClaimed || 0).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center p-2 bg-green-50 rounded">
              <span className="text-xs">Payments Received</span>
              <span className="text-sm font-semibold text-green-600">
                ${(financeData?.totalPaid || 0).toLocaleString()}
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

        {/* PROFITABILITY & EXPENSES */}
        <Card className="border-2 border-purple-200">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center text-sm font-semibold text-purple-700">
              <TrendingUp className="mr-2 h-4 w-4" />
              PROFITABILITY & EXPENSES
            </CardTitle>
            <CardDescription className="text-xs">Project margins & costs</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between items-center p-2 bg-blue-50 rounded border border-blue-200">
              <span className="text-xs font-medium">Total Budget</span>
              <span className="text-sm font-bold text-blue-700">
                ${(financeData?.totalBudget || 0).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center p-2 bg-orange-50 rounded">
              <span className="text-xs">PO Commitments</span>
              <span className="text-sm font-semibold text-orange-600">
                ${(financeData?.totalPOCommitments || 0).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center p-2 bg-red-50 rounded">
              <span className="text-xs">Actual Expenses</span>
              <span className="text-sm font-semibold text-red-600">
                ${(financeData?.totalExpenses || 0).toLocaleString()}
              </span>
            </div>
            <div className="p-3 bg-purple-50 rounded border border-purple-200 text-center mt-2">
              <div className="text-xs text-gray-600">Gross Profit</div>
              <div className={`text-lg font-bold mt-1 ${(financeData?.grossProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${(financeData?.grossProfit || 0).toLocaleString()}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                Margin: {(financeData?.grossMargin || 0).toFixed(1)}%
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Supplier Budget - Full Module Embedded */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex items-center text-base">
                <Target className="mr-2 h-4 w-4" />
                Supplier Budget
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Track supplier quotations, costs, and profit/loss
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {budgetSummary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <div className="p-3 bg-blue-50 rounded border border-blue-200">
                <div className="text-xs text-gray-600 mb-1">Total Budget</div>
                <div className="text-lg font-bold text-blue-700">
                  ${(budgetSummary?.totalBudget || 0).toLocaleString()}
                </div>
              </div>
              <div className="p-3 bg-green-50 rounded border border-green-200">
                <div className="text-xs text-gray-600 mb-1">Actual Cost</div>
                <div className="text-lg font-bold text-green-700">
                  ${(budgetSummary?.totalActualCost || 0).toLocaleString()}
                </div>
              </div>
              <div className="p-3 bg-purple-50 rounded border border-purple-200">
                <div className="text-xs text-gray-600 mb-1">Estimated Profit</div>
                <div className={`text-lg font-bold ${(budgetSummary?.estimatedProfit || 0) >= 0 ? 'text-purple-700' : 'text-red-700'}`}>
                  ${(budgetSummary?.estimatedProfit || 0).toLocaleString()}
                </div>
              </div>
              <div className="p-3 bg-orange-50 rounded border border-orange-200">
                <div className="text-xs text-gray-600 mb-1">Suppliers</div>
                <div className="text-lg font-bold text-orange-700">
                  {budgetSummary.totalSuppliers}
                </div>
                <div className="text-xs text-gray-500">
                  {budgetSummary.suppliersWithQuotation} with quotes
                </div>
              </div>
            </div>
          )}

          {/* Budget Items Table */}
          <div className="text-sm text-gray-600 mb-3">
            Detailed supplier budget items and quotations
          </div>
          
          {budgetItems.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Target className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No budget items yet</p>
              <p className="text-xs mt-1">Upload quotations or add manual entries to get started</p>
            </div>
          ) : (
            <div className="space-y-2">
              {budgetItems.map((item) => (
                <div key={item.id} className="border rounded-lg p-3 hover:bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium text-sm">{item.Supplier.name}</div>
                      <div className="text-xs text-gray-500">{item.tradeType}</div>
                      {item.quotationReference && (
                        <div className="text-xs text-gray-400 mt-1">
                          Ref: {item.quotationReference}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold">
                        ${(item?.quotedAmount || 0).toLocaleString()}
                      </div>
                      {item.actualCost > 0 && (
                        <div className="text-xs text-gray-500">
                          Actual: ${(item?.actualCost || 0).toLocaleString()}
                        </div>
                      )}
                      <div className="flex gap-1 mt-1">
                        {item.poIssued && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                            PO Issued
                          </span>
                        )}
                        {item.needsReview && (
                          <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
                            Review
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="flex gap-2 flex-wrap">
        {canEdit && (
          <>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => router.push(`/finance/customer-invoices/new?projectId=${projectId}`)}
            >
              <FileText className="mr-1 h-3 w-3" />
              Record Claim
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => router.push(`/finance/purchase-orders/new?projectId=${projectId}`)}
            >
              <PackageCheck className="mr-1 h-3 w-3" />
              Issue PO
            </Button>
          </>
        )}
      </div>

      {/* Procurement Documents Section - Collapsible for Performance */}
      <Card className="border-2 border-blue-200">
        <CardHeader className="cursor-pointer" onClick={() => setShowProcurement(!showProcurement)}>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center">
                <FileText className="mr-2 h-4 w-4" />
                Procurement Documents
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                AI-powered document management for quotations, POs, invoices & VOs
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm">
              {showProcurement ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>
        {showProcurement && (
          <CardContent className="p-0">
            <div className="border-t">
              <ProcurementManagement projectId={projectId} />
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  )
}
