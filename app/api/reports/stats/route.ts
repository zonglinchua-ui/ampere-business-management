
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get date ranges for calculations
    const now = new Date()
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
    const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
    const lastQuarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 - 3, 1)
    const lastQuarterEnd = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 0)

    // Calculate total revenue
    const totalRevenue = await prisma.customerInvoice.aggregate({
      where: {
        status: { in: ["PAID"] }
      },
      _sum: {
        totalAmount: true
      }
    })

    // Calculate current month revenue
    const currentMonthRevenue = await prisma.customerInvoice.aggregate({
      where: {
        status: { in: ["PAID"] },
        paidDate: {
          gte: currentMonthStart,
          lte: now
        }
      },
      _sum: {
        totalAmount: true
      }
    })

    // Calculate last month revenue
    const lastMonthRevenue = await prisma.customerInvoice.aggregate({
      where: {
        status: { in: ["PAID"] },
        paidDate: {
          gte: lastMonthStart,
          lte: lastMonthEnd
        }
      },
      _sum: {
        totalAmount: true
      }
    })

    // Calculate monthly growth
    const currentRevenue = Number(currentMonthRevenue._sum?.totalAmount || 0)
    const lastRevenue = Number(lastMonthRevenue._sum?.totalAmount || 0)
    const monthlyGrowth = lastRevenue > 0 ? ((currentRevenue - lastRevenue) / lastRevenue) * 100 : 0

    // Count active projects
    const activeProjects = await prisma.project.count({
      where: {
        status: { in: ["PLANNING", "IN_PROGRESS"] },
        isActive: true
      }
    })

    // Count new projects this month
    const newProjects = await prisma.project.count({
      where: {
        createdAt: {
          gte: currentMonthStart,
          lte: now
        },
        isActive: true
      }
    })

    // Count pending invoices
    const pendingInvoices = await prisma.customerInvoice.count({
      where: {
        status: { in: ["SENT", "DRAFT"] }
      }
    })

    // Calculate pending invoice value
    const pendingValue = await prisma.customerInvoice.aggregate({
      where: {
        status: { in: ["SENT", "DRAFT"] }
      },
      _sum: {
        totalAmount: true
      }
    })

    // Count active clients
    const activeClients = await prisma.customer.count({
      where: {
        isActive: true
      }
    })

    // Count clients from current quarter
    const currentQuarterClients = await prisma.customer.count({
      where: {
        createdAt: {
          gte: quarterStart,
          lte: now
        },
        isActive: true
      }
    })

    // Count clients from last quarter
    const lastQuarterClients = await prisma.customer.count({
      where: {
        createdAt: {
          gte: lastQuarterStart,
          lte: lastQuarterEnd
        },
        isActive: true
      }
    })

    const clientGrowth = currentQuarterClients - lastQuarterClients

    return NextResponse.json({
      totalRevenue: Number(totalRevenue._sum?.totalAmount || 0),
      monthlyGrowth,
      activeProjects,
      newProjects,
      pendingInvoices,
      pendingValue: Number(pendingValue._sum?.totalAmount || 0),
      activeClients,
      clientGrowth
    })
  } catch (error) {
    console.error("GET /api/reports/stats error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export const dynamic = "force-dynamic"
