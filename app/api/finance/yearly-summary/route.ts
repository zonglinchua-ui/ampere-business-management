
/**
 * Yearly Summary API
 * Provides yearly aggregated revenue and expenses data for Y-o-Y comparison
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { startOfYear, endOfYear, format } from "date-fns"

export const dynamic = 'force-dynamic'

/**
 * GET /api/finance/yearly-summary
 * Returns yearly aggregated revenue and expenses
 * Query params:
 * - startYear: Start year (optional, defaults to earliest record)
 * - endYear: End year (optional, defaults to current year)
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
    const startYearParam = searchParams.get('startYear')
    const endYearParam = searchParams.get('endYear')
    
    const currentYear = new Date().getFullYear()
    
    // Find earliest records to determine data range
    const earliestCustomerInvoice = await prisma.customerInvoice.findFirst({
      orderBy: { issueDate: 'asc' },
      select: { issueDate: true }
    })
    
    const earliestSupplierInvoice = await prisma.supplierInvoice.findFirst({
      orderBy: { invoiceDate: 'asc' },
      select: { invoiceDate: true }
    })
    
    // Determine earliest year from data
    const earliestYear = Math.min(
      earliestCustomerInvoice?.issueDate ? new Date(earliestCustomerInvoice.issueDate).getFullYear() : currentYear,
      earliestSupplierInvoice?.invoiceDate ? new Date(earliestSupplierInvoice.invoiceDate).getFullYear() : currentYear
    )
    
    const startYear = startYearParam ? parseInt(startYearParam) : earliestYear
    const endYear = endYearParam ? parseInt(endYearParam) : currentYear

    console.log(`📊 Fetching yearly summary from ${startYear} to ${endYear}`)

    // Initialize yearly data structure
    const yearlyData: { [key: number]: { revenue: number, expenses: number, netProfit: number, growthRate: number | null } } = {}
    
    // Initialize all years in range
    for (let year = startYear; year <= endYear; year++) {
      yearlyData[year] = { revenue: 0, expenses: 0, netProfit: 0, growthRate: null }
    }

    // Fetch all customer invoices (revenue) in the year range
    const customerInvoices = await prisma.customerInvoice.findMany({
      where: {
        issueDate: {
          gte: startOfYear(new Date(startYear, 0, 1)),
          lte: endOfYear(new Date(endYear, 11, 31))
        }
      },
      select: {
        issueDate: true,
        totalAmount: true,
        status: true
      }
    })

    // Fetch all supplier invoices (expenses) in the year range
    const supplierInvoices = await prisma.supplierInvoice.findMany({
      where: {
        invoiceDate: {
          gte: startOfYear(new Date(startYear, 0, 1)),
          lte: endOfYear(new Date(endYear, 11, 31))
        }
      },
      select: {
        invoiceDate: true,
        totalAmount: true,
        status: true
      }
    })

    // Aggregate customer invoices by year (revenue)
    customerInvoices.forEach(invoice => {
      if (invoice.issueDate) {
        const year = new Date(invoice.issueDate).getFullYear()
        if (yearlyData[year]) {
          const amount = parseFloat(invoice.totalAmount.toString())
          yearlyData[year].revenue += amount
        }
      }
    })

    // Aggregate supplier invoices by year (expenses)
    supplierInvoices.forEach(invoice => {
      if (invoice.invoiceDate) {
        const year = new Date(invoice.invoiceDate).getFullYear()
        if (yearlyData[year]) {
          const amount = parseFloat(invoice.totalAmount.toString())
          yearlyData[year].expenses += amount
        }
      }
    })

    // Calculate net profit and growth rates for each year
    const years = Object.keys(yearlyData).map(Number).sort((a: any, b: any) => a - b)
    years.forEach((year: any, index: any) => {
      yearlyData[year].netProfit = yearlyData[year].revenue - yearlyData[year].expenses
      
      // Calculate Y-o-Y growth rate
      if (index > 0) {
        const previousYear = years[index - 1]
        const previousRevenue = yearlyData[previousYear].revenue
        
        if (previousRevenue > 0) {
          const growthRate = ((yearlyData[year].revenue - previousRevenue) / previousRevenue) * 100
          yearlyData[year].growthRate = parseFloat(growthRate.toFixed(2))
        }
      }
    })

    // Convert to array format for charts
    const chartData = years.map((year: any) => ({
      year: year.toString(),
      revenue: parseFloat(yearlyData[year].revenue.toFixed(2)),
      expenses: parseFloat(yearlyData[year].expenses.toFixed(2)),
      netProfit: parseFloat(yearlyData[year].netProfit.toFixed(2)),
      growthRate: yearlyData[year].growthRate
    }))

    // Calculate summary statistics
    const totalRevenue = chartData.reduce((sum: any, item: any) => sum + item.revenue, 0)
    const totalExpenses = chartData.reduce((sum: any, item: any) => sum + item.expenses, 0)
    const totalNetProfit = totalRevenue - totalExpenses
    const yearCount = chartData.length

    console.log(`✅ Yearly summary: ${yearCount} years, Revenue: ${totalRevenue}, Expenses: ${totalExpenses}`)

    return NextResponse.json({
      success: true,
      startYear,
      endYear,
      earliestYear,
      chartData,
      summary: {
        totalRevenue: parseFloat(totalRevenue.toFixed(2)),
        totalExpenses: parseFloat(totalExpenses.toFixed(2)),
        totalNetProfit: parseFloat(totalNetProfit.toFixed(2)),
        averageYearlyRevenue: yearCount > 0 ? parseFloat((totalRevenue / yearCount).toFixed(2)) : 0,
        averageYearlyExpenses: yearCount > 0 ? parseFloat((totalExpenses / yearCount).toFixed(2)) : 0,
        yearCount
      }
    })

  } catch (error: any) {
    console.error('❌ GET /api/finance/yearly-summary error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch yearly summary',
        message: error.message || 'An unexpected error occurred'
      },
      { status: 500 }
    )
  }
}
