
/**
 * Monthly Summary API
 * Provides monthly aggregated revenue and expenses data for YTD
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { startOfYear, endOfYear, startOfMonth, format } from "date-fns"

export const dynamic = 'force-dynamic'

/**
 * GET /api/finance/monthly-summary
 * Returns monthly aggregated revenue and expenses for the year
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const user = session.user as any
    const userRole = user?.role || 'UNKNOWN'
    const allowedRoles = ['SUPERADMIN', 'FINANCE', 'PROJECT_MANAGER']

    if (!allowedRoles.includes(userRole)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Insufficient permissions'
        },
        { status: 403 }
      )
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const yearParam = searchParams.get('year')
    const targetYear = yearParam ? parseInt(yearParam) : new Date().getFullYear()

    // Define date range for the year
    const startDate = startOfYear(new Date(targetYear, 0, 1))
    const endDate = endOfYear(new Date(targetYear, 11, 31))

    console.log(`📊 Fetching monthly summary for year ${targetYear}`)

    // Fetch customer invoices (revenue) for the year
    const customerInvoices = await prisma.customerInvoice.findMany({
      where: {
        issueDate: {
          gte: startDate,
          lte: endDate
        }
      },
      select: {
        issueDate: true,
        totalAmount: true,
        status: true
      }
    })

    // Fetch supplier invoices (expenses) for the year
    const supplierInvoices = await prisma.supplierInvoice.findMany({
      where: {
        invoiceDate: {
          gte: startDate,
          lte: endDate
        }
      },
      select: {
        invoiceDate: true,
        totalAmount: true,
        status: true
      }
    })

    // Initialize monthly data structure
    const monthlyData: { [key: string]: { revenue: number, expenses: number, netProfit: number } } = {}
    
    // Initialize all months for the year
    for (let month = 0; month < 12; month++) {
      const monthKey = format(new Date(targetYear, month, 1), 'MMM yyyy')
      monthlyData[monthKey] = { revenue: 0, expenses: 0, netProfit: 0 }
    }

    // Aggregate customer invoices by month (revenue)
    customerInvoices.forEach(invoice => {
      if (invoice.issueDate) {
        const monthKey = format(new Date(invoice.issueDate), 'MMM yyyy')
        if (monthlyData[monthKey]) {
          const amount = parseFloat(invoice.totalAmount.toString())
          monthlyData[monthKey].revenue += amount
        }
      }
    })

    // Aggregate supplier invoices by month (expenses)
    supplierInvoices.forEach(invoice => {
      if (invoice.invoiceDate) {
        const monthKey = format(new Date(invoice.invoiceDate), 'MMM yyyy')
        if (monthlyData[monthKey]) {
          const amount = parseFloat(invoice.totalAmount.toString())
          monthlyData[monthKey].expenses += amount
        }
      }
    })

    // Calculate net profit for each month
    Object.keys(monthlyData).forEach(month => {
      monthlyData[month].netProfit = monthlyData[month].revenue - monthlyData[month].expenses
    })

    // Convert to array format for charts
    const chartData = Object.entries(monthlyData).map(([month, data]) => ({
      month,
      revenue: parseFloat(data.revenue.toFixed(2)),
      expenses: parseFloat(data.expenses.toFixed(2)),
      netProfit: parseFloat(data.netProfit.toFixed(2))
    }))

    // Calculate summary statistics
    const totalRevenue = chartData.reduce((sum: any, item: any) => sum + item.revenue, 0)
    const totalExpenses = chartData.reduce((sum: any, item: any) => sum + item.expenses, 0)
    const totalNetProfit = totalRevenue - totalExpenses

    console.log(`✅ Monthly summary: ${chartData.length} months, Revenue: ${totalRevenue}, Expenses: ${totalExpenses}`)

    return NextResponse.json({
      success: true,
      year: targetYear,
      chartData,
      summary: {
        totalRevenue: parseFloat(totalRevenue.toFixed(2)),
        totalExpenses: parseFloat(totalExpenses.toFixed(2)),
        totalNetProfit: parseFloat(totalNetProfit.toFixed(2)),
        averageMonthlyRevenue: parseFloat((totalRevenue / 12).toFixed(2)),
        averageMonthlyExpenses: parseFloat((totalExpenses / 12).toFixed(2))
      }
    })

  } catch (error: any) {
    console.error('❌ GET /api/finance/monthly-summary error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch monthly summary',
        message: error.message || 'An unexpected error occurred'
      },
      { status: 500 }
    )
  }
}
