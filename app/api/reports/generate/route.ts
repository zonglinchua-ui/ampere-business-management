import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import * as XLSX from 'xlsx'
import { generateEnhancedReportPDF } from "@/lib/report-pdf-generator-enhanced"

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { reportId, filters = {}, format = 'excel' } = body

    let reportData: any[] = []
    let reportName = "Report"
    let headers: string[] = []
    let summary: any = null
    let chartData: any = null

    // Parse date range if provided
    const dateRange = filters.dateRange ? {
      from: new Date(filters.dateRange.from),
      to: new Date(filters.dateRange.to)
    } : {
      from: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1),
      to: new Date()
    }

    switch (reportId) {
      case 'revenue-analysis':
        reportName = "Revenue Analysis"
        headers = ["Date", "Client", "Project", "Invoice Number", "Amount", "Status", "Payment Date"]
        
        const revenueData = await prisma.customerInvoice.findMany({
          where: {
            issueDate: {
              gte: dateRange.from,
              lte: dateRange.to
            },
            ...(filters.clientFilter && filters.clientFilter !== 'all' ? {
              Customer: {
                customerType: filters.clientFilter === 'enterprise' ? 'ENTERPRISE' : 
                           filters.clientFilter === 'government' ? 'GOVERNMENT' : undefined
              }
            } : {})
          },
          include: {
            Customer: {
              select: { name: true }
            },
            Project: {
              select: { name: true }
            }
          },
          orderBy: {
            issueDate: 'desc'
          }
        })

        const totalRevenue = revenueData.reduce((sum, inv) => sum + Number(inv.totalAmount || 0), 0)
        const paidRevenue = revenueData.filter(inv => inv.status === 'PAID').reduce((sum, inv) => sum + Number(inv.totalAmount || 0), 0)
        const unpaidRevenue = totalRevenue - paidRevenue

        reportData = revenueData.map((invoice: any) => ({
          Date: invoice.issueDate ? new Date(invoice.issueDate).toLocaleDateString() : 'N/A',
          Client: invoice.Customer?.name || 'N/A',
          Project: invoice.Project?.name || 'N/A',
          "Invoice Number": invoice.invoiceNumber,
          Amount: Number(invoice.totalAmount || 0),
          Status: invoice.status,
          "Payment Date": invoice.paidDate ? new Date(invoice.paidDate).toLocaleDateString() : 'N/A'
        }))

        summary = {
          title: 'Revenue Summary',
          metrics: [
            { label: 'Total Revenue', value: totalRevenue, format: 'currency' },
            { label: 'Paid Revenue', value: paidRevenue, format: 'currency' },
            { label: 'Unpaid Revenue', value: unpaidRevenue, format: 'currency' },
            { label: 'Total Invoices', value: revenueData.length, format: 'number' },
            { label: 'Average Invoice Value', value: revenueData.length > 0 ? totalRevenue / revenueData.length : 0, format: 'currency' },
            { label: 'Collection Rate', value: totalRevenue > 0 ? (paidRevenue / totalRevenue) * 100 : 0, format: 'percentage' }
          ]
        }

        // Group revenue by client for chart
        const revenueByClient = revenueData.reduce((acc: any, inv) => {
          const clientName = inv.Customer?.name || 'Unknown'
          if (!acc[clientName]) acc[clientName] = 0
          acc[clientName] += Number(inv.totalAmount || 0)
          return acc
        }, {})

        chartData = {
          title: 'Revenue by Client (Top 10)',
          data: Object.entries(revenueByClient)
            .map(([label, value]) => ({ label, value: value as number }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10)
        }
        break

      case 'invoice-aging':
        reportName = "Invoice Aging Report"
        headers = ["Invoice Number", "Client", "Issue Date", "Due Date", "Amount", "Days Outstanding", "Status", "Age Group"]
        
        const invoiceData = await prisma.customerInvoice.findMany({
          where: {
            issueDate: {
              gte: dateRange.from,
              lte: dateRange.to
            },
            ...(filters.statusFilter && filters.statusFilter !== 'all' ? {
              status: filters.statusFilter.toUpperCase() as any
            } : {})
          },
          include: {
            Customer: {
              select: { name: true }
            }
          },
          orderBy: {
            dueDate: 'asc'
          }
        })

        reportData = invoiceData.map((invoice: any) => {
          const today = new Date()
          const dueDate = invoice.dueDate ? new Date(invoice.dueDate) : today
          const daysOutstanding = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
          let ageGroup = "Current"
          
          if (daysOutstanding > 0) {
            if (daysOutstanding <= 30) ageGroup = "1-30 days"
            else if (daysOutstanding <= 60) ageGroup = "31-60 days"
            else if (daysOutstanding <= 90) ageGroup = "61-90 days"
            else ageGroup = "90+ days"
          }

          return {
            "Invoice Number": invoice.invoiceNumber,
            Client: invoice.Customer?.name || 'N/A',
            "Issue Date": invoice.issueDate ? new Date(invoice.issueDate).toLocaleDateString() : 'N/A',
            "Due Date": invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : 'N/A',
            Amount: Number(invoice.totalAmount || 0),
            "Days Outstanding": daysOutstanding,
            Status: invoice.status,
            "Age Group": ageGroup
          }
        })

        const agingTotals = {
          current: reportData.filter(r => r["Age Group"] === "Current").reduce((sum, r) => sum + r.Amount, 0),
          '1-30': reportData.filter(r => r["Age Group"] === "1-30 days").reduce((sum, r) => sum + r.Amount, 0),
          '31-60': reportData.filter(r => r["Age Group"] === "31-60 days").reduce((sum, r) => sum + r.Amount, 0),
          '61-90': reportData.filter(r => r["Age Group"] === "61-90 days").reduce((sum, r) => sum + r.Amount, 0),
          '90+': reportData.filter(r => r["Age Group"] === "90+ days").reduce((sum, r) => sum + r.Amount, 0)
        }

        summary = {
          title: 'Aging Summary',
          metrics: [
            { label: 'Current', value: agingTotals.current, format: 'currency' },
            { label: '1-30 Days', value: agingTotals['1-30'], format: 'currency' },
            { label: '31-60 Days', value: agingTotals['31-60'], format: 'currency' },
            { label: '61-90 Days', value: agingTotals['61-90'], format: 'currency' },
            { label: '90+ Days', value: agingTotals['90+'], format: 'currency' },
            { label: 'Total Outstanding', value: Object.values(agingTotals).reduce((a, b) => a + b, 0), format: 'currency' }
          ]
        }

        chartData = {
          title: 'Outstanding by Age Group',
          data: [
            { label: 'Current', value: agingTotals.current },
            { label: '1-30 days', value: agingTotals['1-30'] },
            { label: '31-60 days', value: agingTotals['31-60'] },
            { label: '61-90 days', value: agingTotals['61-90'] },
            { label: '90+ days', value: agingTotals['90+'] }
          ]
        }
        break

      case 'profit-loss':
        reportName = "Profit & Loss Statement"
        headers = ["Category", "Description", "Amount"]
        
        // Calculate revenue
        const plRevenue = await prisma.customerInvoice.aggregate({
          where: {
            status: 'PAID',
            paidDate: {
              gte: dateRange.from,
              lte: dateRange.to
            }
          },
          _sum: { totalAmount: true }
        })

        // Calculate expenses (supplier invoices)
        const plExpenses = await prisma.supplierInvoice.aggregate({
          where: {
            status: 'PAID',
            paidDate: {
              gte: dateRange.from,
              lte: dateRange.to
            }
          },
          _sum: { totalAmount: true }
        })

        const revenue = Number(plRevenue._sum.totalAmount || 0)
        const expenses = Number(plExpenses._sum.totalAmount || 0)
        const netProfit = revenue - expenses
        const profitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0

        reportData = [
          { Category: "Revenue", Description: "Customer Invoices (Paid)", Amount: revenue },
          { Category: "Expenses", Description: "Supplier Invoices (Paid)", Amount: expenses },
          { Category: "Net Profit", Description: "Revenue - Expenses", Amount: netProfit },
          { Category: "Profit Margin", Description: "Net Profit / Revenue", Amount: `${profitMargin.toFixed(2)}%` }
        ]

        summary = {
          title: 'Profit & Loss Summary',
          metrics: [
            { label: 'Total Revenue', value: revenue, format: 'currency' },
            { label: 'Total Expenses', value: expenses, format: 'currency' },
            { label: 'Net Profit', value: netProfit, format: 'currency' },
            { label: 'Profit Margin', value: profitMargin, format: 'percentage' }
          ]
        }

        chartData = {
          title: 'Revenue vs Expenses',
          data: [
            { label: 'Revenue', value: revenue },
            { label: 'Expenses', value: expenses },
            { label: 'Net Profit', value: Math.max(0, netProfit) }
          ]
        }
        break

      case 'cash-flow':
        reportName = "Cash Flow Analysis"
        headers = ["Date", "Description", "Inflow", "Outflow", "Net Cash Flow"]
        
        // Get all payments
        const allPayments = await prisma.payment.findMany({
          where: {
            paymentDate: {
              gte: dateRange.from,
              lte: dateRange.to
            }
          },
          include: {
            CustomerInvoice: {
              select: { invoiceNumber: true }
            },
            SupplierInvoice: {
              select: { invoiceNumber: true }
            }
          },
          orderBy: { paymentDate: 'asc' }
        })

        const cashFlowData = allPayments.map(p => {
          const isInflow = !!p.customerInvoiceId
          return {
            date: new Date(p.paymentDate),
            description: isInflow 
              ? `Payment Received - ${p.CustomerInvoice?.invoiceNumber || 'N/A'}`
              : `Payment Sent - ${p.SupplierInvoice?.invoiceNumber || 'N/A'}`,
            inflow: isInflow ? Number(p.amount || 0) : 0,
            outflow: !isInflow ? Number(p.amount || 0) : 0
          }
        }).sort((a, b) => a.date.getTime() - b.date.getTime())

        let runningBalance = 0
        reportData = cashFlowData.map(item => {
          const netFlow = item.inflow - item.outflow
          runningBalance += netFlow
          return {
            Date: item.date.toLocaleDateString(),
            Description: item.description,
            Inflow: item.inflow,
            Outflow: item.outflow,
            "Net Cash Flow": netFlow
          }
        })

        const totalInflow = cashFlowData.reduce((sum, item) => sum + item.inflow, 0)
        const totalOutflow = cashFlowData.reduce((sum, item) => sum + item.outflow, 0)
        const netCashFlow = totalInflow - totalOutflow

        summary = {
          title: 'Cash Flow Summary',
          metrics: [
            { label: 'Total Inflow', value: totalInflow, format: 'currency' },
            { label: 'Total Outflow', value: totalOutflow, format: 'currency' },
            { label: 'Net Cash Flow', value: netCashFlow, format: 'currency' },
            { label: 'Cash Flow Ratio', value: totalOutflow > 0 ? (totalInflow / totalOutflow) * 100 : 0, format: 'percentage' }
          ]
        }

        chartData = {
          title: 'Cash Flow Breakdown',
          data: [
            { label: 'Total Inflow', value: totalInflow },
            { label: 'Total Outflow', value: totalOutflow }
          ]
        }
        break

      case 'project-progress':
        reportName = "Project Progress Summary"
        headers = ["Project Number", "Project Name", "Client", "Manager", "Status", "Priority", "Progress %", "Start Date", "End Date", "Budget"]
        
        const projectData = await prisma.project.findMany({
          where: {
            isActive: true,
            ...(filters.projectStatus && filters.projectStatus !== 'all' ? {
              status: filters.projectStatus.toUpperCase()
            } : {})
          },
          include: {
            Customer: {
              select: { name: true }
            },
            User_Project_managerIdToUser: {
              select: { name: true, firstName: true, lastName: true }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        })

        reportData = projectData.map((project: any) => ({
          "Project Number": project.projectNumber,
          "Project Name": project.name,
          Client: project.Customer?.name || 'N/A',
          Manager: project.User_Project_managerIdToUser?.firstName && project.User_Project_managerIdToUser?.lastName 
            ? `${project.User_Project_managerIdToUser.firstName} ${project.User_Project_managerIdToUser.lastName}`
            : project.User_Project_managerIdToUser?.name || 'Unassigned',
          Status: project.status,
          Priority: project.priority,
          "Progress %": project.progress || 0,
          "Start Date": project.startDate ? new Date(project.startDate).toLocaleDateString() : 'N/A',
          "End Date": project.endDate ? new Date(project.endDate).toLocaleDateString() : 'N/A',
          Budget: project.estimatedBudget ? Number(project.estimatedBudget) : 0
        }))

        const avgProgress = reportData.reduce((sum, p) => sum + (p["Progress %"] || 0), 0) / Math.max(reportData.length, 1)
        const completedProjects = reportData.filter(p => p.Status === 'COMPLETED').length
        const inProgressProjects = reportData.filter(p => p.Status === 'IN_PROGRESS').length

        summary = {
          title: 'Project Summary',
          metrics: [
            { label: 'Total Projects', value: reportData.length, format: 'number' },
            { label: 'Completed', value: completedProjects, format: 'number' },
            { label: 'In Progress', value: inProgressProjects, format: 'number' },
            { label: 'Average Progress', value: avgProgress, format: 'percentage' }
          ]
        }

        const statusCount = reportData.reduce((acc: any, p) => {
          acc[p.Status] = (acc[p.Status] || 0) + 1
          return acc
        }, {})

        chartData = {
          title: 'Projects by Status',
          data: Object.entries(statusCount).map(([label, value]) => ({ label, value: value as number }))
        }
        break

      case 'budget-analysis':
        reportName = "Budget vs Actual Analysis"
        headers = ["Project", "Budgeted Amount", "Actual Cost", "Variance", "Variance %", "Status"]
        
        const budgetProjects = await prisma.project.findMany({
          where: {
            isActive: true,
            estimatedBudget: { not: null },
            createdAt: {
              gte: dateRange.from,
              lte: dateRange.to
            }
          },
          include: {
            SupplierInvoice: {
              where: { status: 'PAID' }
            }
          }
        })

        reportData = budgetProjects.map(project => {
          const budgeted = Number(project.estimatedBudget || 0)
          const actual = project.SupplierInvoice?.reduce((sum, inv) => sum + Number(inv.totalAmount || 0), 0) || 0
          const variance = budgeted - actual
          const variancePercent = budgeted > 0 ? (variance / budgeted) * 100 : 0

          return {
            Project: project.name,
            "Budgeted Amount": budgeted,
            "Actual Cost": actual,
            Variance: variance,
            "Variance %": variancePercent,
            Status: variancePercent >= 0 ? 'Under Budget' : 'Over Budget'
          }
        })

        const totalBudgeted = reportData.reduce((sum, p) => sum + p["Budgeted Amount"], 0)
        const totalActual = reportData.reduce((sum, p) => sum + p["Actual Cost"], 0)
        const totalVariance = totalBudgeted - totalActual

        summary = {
          title: 'Budget Summary',
          metrics: [
            { label: 'Total Budgeted', value: totalBudgeted, format: 'currency' },
            { label: 'Total Actual', value: totalActual, format: 'currency' },
            { label: 'Total Variance', value: totalVariance, format: 'currency' },
            { label: 'Variance %', value: totalBudgeted > 0 ? (totalVariance / totalBudgeted) * 100 : 0, format: 'percentage' }
          ]
        }
        break

      case 'client-revenue':
        reportName = "Customer Revenue Analysis"
        headers = ["Customer Name", "Contact Person", "Total Revenue", "Project Count", "Average Project Value", "Last Invoice Date", "Status"]
        
        const clientRevenueData = await prisma.customer.findMany({
          where: {
            isActive: filters.includeInactive !== 'true' ? true : undefined
          },
          include: {
            CustomerInvoice: {
              where: {
                status: 'PAID',
                paidDate: {
                  gte: dateRange.from,
                  lte: dateRange.to
                }
              }
            },
            Project: {
              where: {
                isActive: true
              }
            }
          }
        })

        reportData = clientRevenueData
          .map(customer => {
            const totalRevenue = customer.CustomerInvoice.reduce((sum: number, inv: any) => sum + Number(inv.totalAmount || 0), 0)
            const projectCount = customer.Project.length
            const avgProjectValue = projectCount > 0 ? totalRevenue / projectCount : 0
            const lastInvoiceDate = customer.CustomerInvoice.length > 0 
              ? customer.CustomerInvoice.sort((a: any, b: any) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime())[0].issueDate
              : null

            return {
              "Customer Name": customer.name,
              "Contact Person": customer.contactPerson || 'N/A',
              "Total Revenue": totalRevenue,
              "Project Count": projectCount,
              "Average Project Value": avgProjectValue,
              "Last Invoice Date": lastInvoiceDate ? new Date(lastInvoiceDate).toLocaleDateString() : 'N/A',
              Status: customer.isActive ? 'Active' : 'Inactive'
            }
          })
          .sort((a: any, b: any) => b["Total Revenue"] - a["Total Revenue"])
          .slice(0, filters.topN || 10)

        const totalClientRevenue = reportData.reduce((sum, c) => sum + c["Total Revenue"], 0)
        const totalProjects = reportData.reduce((sum, c) => sum + c["Project Count"], 0)

        summary = {
          title: 'Customer Revenue Summary',
          metrics: [
            { label: 'Total Customers', value: reportData.length, format: 'number' },
            { label: 'Total Revenue', value: totalClientRevenue, format: 'currency' },
            { label: 'Total Projects', value: totalProjects, format: 'number' },
            { label: 'Avg Revenue per Customer', value: reportData.length > 0 ? totalClientRevenue / reportData.length : 0, format: 'currency' }
          ]
        }

        chartData = {
          title: `Top ${Math.min(10, reportData.length)} Customers by Revenue`,
          data: reportData.slice(0, 10).map(c => ({ label: c["Customer Name"], value: c["Total Revenue"] }))
        }
        break

      case 'quotation-conversion':
        reportName = "Quotation Conversion Report"
        headers = ["Quotation Number", "Client", "Date Created", "Total Amount", "Status", "Converted to Project", "Conversion Date", "Days to Convert"]
        
        const quotationData = await prisma.quotation.findMany({
          where: {
            createdAt: {
              gte: dateRange.from,
              lte: dateRange.to
            }
          },
          include: {
            Customer: {
              select: { name: true }
            },
            Project: {
              select: {
                name: true,
                createdAt: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        })

        reportData = quotationData.map(quotation => {
          const hasProject = !!quotation.Project
          const conversionDate = hasProject ? quotation.Project?.createdAt : null
          const daysToConvert = hasProject && conversionDate 
            ? Math.floor((new Date(conversionDate).getTime() - new Date(quotation.createdAt).getTime()) / (1000 * 60 * 60 * 24))
            : null

          return {
            "Quotation Number": quotation.quotationNumber,
            Client: quotation.Customer?.name || 'N/A',
            "Date Created": new Date(quotation.createdAt).toLocaleDateString(),
            "Total Amount": Number(quotation.totalAmount || 0),
            Status: quotation.status,
            "Converted to Project": hasProject ? 'Yes' : 'No',
            "Conversion Date": conversionDate ? new Date(conversionDate).toLocaleDateString() : 'N/A',
            "Days to Convert": daysToConvert !== null ? daysToConvert : 'N/A'
          }
        })

        const convertedCount = reportData.filter(q => q["Converted to Project"] === 'Yes').length
        const conversionRate = reportData.length > 0 ? (convertedCount / reportData.length) * 100 : 0
        const totalQuotationValue = reportData.reduce((sum, q) => sum + q["Total Amount"], 0)
        const convertedValue = reportData.filter(q => q["Converted to Project"] === 'Yes').reduce((sum, q) => sum + q["Total Amount"], 0)

        summary = {
          title: 'Quotation Conversion Summary',
          metrics: [
            { label: 'Total Quotations', value: reportData.length, format: 'number' },
            { label: 'Converted', value: convertedCount, format: 'number' },
            { label: 'Conversion Rate', value: conversionRate, format: 'percentage' },
            { label: 'Total Quotation Value', value: totalQuotationValue, format: 'currency' },
            { label: 'Converted Value', value: convertedValue, format: 'currency' },
            { label: 'Value Conversion Rate', value: totalQuotationValue > 0 ? (convertedValue / totalQuotationValue) * 100 : 0, format: 'percentage' }
          ]
        }
        break

      case 'vendor-performance':
        reportName = "Vendor Performance Report"
        headers = ["Vendor Name", "Total Orders", "Total Value", "Average Order Value", "Paid Orders", "Performance Rating"]
        
        const vendorData = await prisma.supplier.findMany({
          where: {
            isActive: filters.includeInactive !== 'true' ? true : undefined
          },
          include: {
            SupplierInvoice: {
              where: {
                invoiceDate: {
                  gte: dateRange.from,
                  lte: dateRange.to
                }
              }
            }
          }
        })

        reportData = vendorData
          .filter(vendor => vendor.SupplierInvoice && vendor.SupplierInvoice.length > 0)
          .map(vendor => {
            const totalOrders = vendor.SupplierInvoice?.length || 0
            const totalValue = vendor.SupplierInvoice?.reduce((sum: number, inv: any) => sum + Number(inv.totalAmount || 0), 0) || 0
            const avgOrderValue = totalOrders > 0 ? totalValue / totalOrders : 0
            
            // Performance rating based on payment status
            const paidOrders = vendor.SupplierInvoice?.filter((inv: any) => inv.status === 'PAID').length || 0
            const performanceRating = totalOrders > 0 ? (paidOrders / totalOrders) * 100 : 0

            return {
              "Vendor Name": vendor.name,
              "Total Orders": totalOrders,
              "Total Value": totalValue,
              "Average Order Value": avgOrderValue,
              "Paid Orders": `${paidOrders}/${totalOrders}`,
              "Performance Rating": `${performanceRating.toFixed(1)}%`
            }
          })
          .sort((a, b) => b["Total Value"] - a["Total Value"])
          .slice(0, filters.topN || 20)

        const totalVendorValue = reportData.reduce((sum, v) => sum + v["Total Value"], 0)

        summary = {
          title: 'Vendor Performance Summary',
          metrics: [
            { label: 'Total Vendors', value: reportData.length, format: 'number' },
            { label: 'Total Value', value: totalVendorValue, format: 'currency' },
            { label: 'Avg Value per Vendor', value: reportData.length > 0 ? totalVendorValue / reportData.length : 0, format: 'currency' }
          ]
        }

        chartData = {
          title: `Top ${Math.min(10, reportData.length)} Vendors by Value`,
          data: reportData.slice(0, 10).map(v => ({ label: v["Vendor Name"], value: v["Total Value"] }))
        }
        break

      default:
        return NextResponse.json({ error: "Invalid report ID" }, { status: 400 })
    }

    // Generate report based on format
    if (format === 'pdf') {
      // Generate beautiful PDF using enhanced report generator
      const pdfBuffer = await generateEnhancedReportPDF(
        reportName,
        {
          data: reportData,
          headers,
          dateRange,
          generatedBy: session.user?.email || session.user?.name || 'Unknown',
          filters,
          summary,
          chartData
        },
        reportId
      )

      return new Response(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${reportName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf"`
        }
      })
    } else {
      // Generate Excel (with improvements)
      const wb = XLSX.utils.book_new()
      
      // Add metadata sheet
      const metadataSheet = XLSX.utils.json_to_sheet([
        { Property: "Report Name", Value: reportName },
        { Property: "Generated Date", Value: new Date().toLocaleString() },
        { Property: "Generated By", Value: session.user?.email || session.user?.name || 'Unknown' },
        { Property: "Date Range", Value: `${dateRange.from.toLocaleDateString()} to ${dateRange.to.toLocaleDateString()}` },
        { Property: "Total Records", Value: reportData.length },
        { Property: "Filters Applied", Value: JSON.stringify(filters) }
      ])
      XLSX.utils.book_append_sheet(wb, metadataSheet, "Report Info")

      // Add summary sheet if available
      if (summary && summary.metrics) {
        const summarySheet = XLSX.utils.json_to_sheet(
          summary.metrics.map((metric: any) => ({
            Metric: metric.label,
            Value: metric.format === 'currency' ? Number(metric.value).toFixed(2) :
                   metric.format === 'percentage' ? `${Number(metric.value).toFixed(2)}%` :
                   metric.value
          }))
        )
        XLSX.utils.book_append_sheet(wb, summarySheet, "Summary")
      }

      // Add main data sheet
      const dataSheet = XLSX.utils.json_to_sheet(reportData)
      XLSX.utils.book_append_sheet(wb, dataSheet, "Data")

      // Generate Excel file
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' })

      // Return as downloadable file
      return new Response(excelBuffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${reportName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx"`
        }
      })
    }

  } catch (error) {
    console.error("POST /api/reports/generate error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export const dynamic = "force-dynamic"
