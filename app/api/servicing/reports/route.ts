
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "Start date and end date are required" },
        { status: 400 }
      )
    }

    const dateFilter = {
      scheduledDate: {
        gte: new Date(startDate),
        lte: new Date(endDate)
      }
    }

    // Fetch all jobs in the date range
    const jobs = await prisma.serviceJob.findMany({
      where: dateFilter,
      include: {
        ServiceContract: {
          select: {
            serviceType: true,
            frequency: true
          }
        },
        Customer: {
          select: {
            name: true,
            customerNumber: true
          }
        },
        AssignedUser: {
          select: {
            firstName: true,
            lastName: true
          }
        },
        AssignedSupplier: {
          select: {
            name: true
          }
        }
      }
    })

    // Fetch contracts
    const contracts = await prisma.serviceContract.findMany({
      where: {
        OR: [
          {
            startDate: {
              gte: new Date(startDate),
              lte: new Date(endDate)
            }
          },
          {
            endDate: {
              gte: new Date(startDate)
            }
          }
        ]
      },
      include: {
        Customer: {
          select: {
            name: true,
            customerNumber: true
          }
        },
        ServiceJob: {
          select: {
            id: true,
            status: true
          }
        }
      }
    })

    // Calculate summary statistics
    const now = new Date()
    const summary = {
      totalJobs: jobs.length,
      completedJobs: jobs.filter(j => ['Completed', 'Endorsed'].includes(j.status)).length,
      scheduledJobs: jobs.filter(j => j.status === 'Scheduled').length,
      inProgressJobs: jobs.filter(j => j.status === 'InProgress').length,
      overdueJobs: jobs.filter(j => 
        new Date(j.scheduledDate) < now && 
        !['Completed', 'Endorsed'].includes(j.status)
      ).length,
      totalContracts: contracts.length,
      activeContracts: contracts.filter(c => c.status === 'Active').length
    }

    // Jobs by service type
    const serviceTypeMap = new Map<string, { count: number; completed: number; scheduled: number }>()
    jobs.forEach(job => {
      const serviceType = job.ServiceContract?.serviceType || 'Other'
      const current = serviceTypeMap.get(serviceType) || { count: 0, completed: 0, scheduled: 0 }
      current.count++
      if (['Completed', 'Endorsed'].includes(job.status)) current.completed++
      if (job.status === 'Scheduled') current.scheduled++
      serviceTypeMap.set(serviceType, current)
    })

    const jobsByServiceType = Array.from(serviceTypeMap.entries()).map(([serviceType, data]) => ({
      serviceType,
      ...data
    }))

    // Jobs by assignee
    const assigneeMap = new Map<string, {
      type: string;
      name: string;
      totalJobs: number;
      completedJobs: number;
      totalCompletionTime: number;
    }>()

    jobs.forEach(job => {
      let key: string
      let type: string
      let name: string

      if (job.assignedUserId && job.AssignedUser) {
        key = `staff-${job.assignedUserId}`
        type = 'Staff'
        name = `${job.AssignedUser.firstName} ${job.AssignedUser.lastName}`
      } else if (job.assignedSupplierId && job.AssignedSupplier) {
        key = `supplier-${job.assignedSupplierId}`
        type = 'Supplier'
        name = job.AssignedSupplier.name
      } else {
        return // Skip unassigned jobs
      }

      const current = assigneeMap.get(key) || {
        type,
        name,
        totalJobs: 0,
        completedJobs: 0,
        totalCompletionTime: 0
      }

      current.totalJobs++
      if (['Completed', 'Endorsed'].includes(job.status)) {
        current.completedJobs++
        if (job.completedAt) {
          const completionTime = Math.ceil(
            (new Date(job.completedAt).getTime() - new Date(job.scheduledDate).getTime()) / 
            (1000 * 60 * 60 * 24)
          )
          current.totalCompletionTime += completionTime
        }
      }

      assigneeMap.set(key, current)
    })

    const jobsByAssignee = Array.from(assigneeMap.values()).map(assignee => ({
      ...assignee,
      averageCompletionTime: assignee.completedJobs > 0
        ? assignee.totalCompletionTime / assignee.completedJobs
        : 0
    }))

    // Customer activity
    const customerMap = new Map<string, {
      customerName: string;
      customerNumber: string;
      totalJobs: number;
      completedJobs: number;
      activeContracts: number;
    }>()

    jobs.forEach(job => {
      const key = job.customerId
      const current = customerMap.get(key) || {
        customerName: job.Customer?.name || 'Unknown',
        customerNumber: job.Customer?.customerNumber || 'N/A',
        totalJobs: 0,
        completedJobs: 0,
        activeContracts: 0
      }

      current.totalJobs++
      if (['Completed', 'Endorsed'].includes(job.status)) {
        current.completedJobs++
      }

      customerMap.set(key, current)
    })

    // Add contract counts
    contracts.forEach(contract => {
      const key = contract.customerId
      const current = customerMap.get(key)
      if (current) {
        current.activeContracts++
      } else {
        customerMap.set(key, {
          customerName: contract.Customer?.name || 'Unknown',
          customerNumber: contract.Customer?.customerNumber || 'N/A',
          totalJobs: 0,
          completedJobs: 0,
          activeContracts: 1
        })
      }
    })

    const customerActivity = Array.from(customerMap.values())
      .sort((a: any, b: any) => b.totalJobs - a.totalJobs)

    // Monthly trends (simplified for now)
    const monthlyTrends: any[] = []

    const reportData = {
      summary,
      jobsByServiceType,
      jobsByAssignee,
      monthlyTrends,
      customerActivity
    }

    return NextResponse.json(reportData)

  } catch (error: any) {
    console.error('[SERVICING_REPORTS_API_ERROR]', error)
    return NextResponse.json(
      { error: "Failed to generate report", details: error.message },
      { status: 500 }
    )
  }
}
