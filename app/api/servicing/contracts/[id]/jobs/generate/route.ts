
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { v4 as uuidv4 } from 'uuid'

// POST /api/servicing/contracts/[id]/jobs/generate - Generate jobs for contract with custom dates
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = session.user?.role
    const canGenerate = ["SUPERADMIN", "ADMIN", "PROJECT_MANAGER"].includes(userRole || "")
    
    if (!canGenerate) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const contractId = params.id
    const data = await request.json()

    // Validate request data
    if (!data.scheduledDates || !Array.isArray(data.scheduledDates)) {
      return NextResponse.json({ 
        error: 'scheduledDates array is required' 
      }, { status: 400 })
    }

    // Get contract details
    const contract = await prisma.serviceContract.findUnique({
      where: { id: contractId },
      include: {
        Customer: true,
        Project: true,
        ServiceContractSupplier: {
          include: {
            supplier: true
          }
        }
      }
    })

    if (!contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
    }

    // Clear existing scheduled jobs for this contract if requested
    if (data.clearExisting) {
      await prisma.serviceJob.deleteMany({
        where: {
          contractId: contractId,
          status: 'Scheduled' // Only delete scheduled jobs, not completed ones
        }
      })
    }

    // Generate jobs for each scheduled date
    const jobs = []
    const now = new Date()

    for (const scheduledDate of data.scheduledDates) {
      // Validate date
      const jobDate = new Date(scheduledDate)
      if (isNaN(jobDate.getTime())) {
        return NextResponse.json({ 
          error: `Invalid date: ${scheduledDate}` 
        }, { status: 400 })
      }

      // Determine assignment based on contract suppliers or default to contract creator
      let assignedToType: 'Staff' | 'Supplier' = 'Staff'
      let assignedUserId: string | null = contract.createdById
      let assignedSupplierId: string | null = null

      if (data.assignToSupplier && (contract as any).ServiceContractSupplier?.length > 0) {
        assignedToType = 'Supplier'
        assignedUserId = null
        assignedSupplierId = (contract as any).ServiceContractSupplier[0].supplier.id // Assign to first supplier
      }

      const job = {
        id: uuidv4(),
        contractId: contractId,
        customerId: contract.customerId,
        projectId: contract.projectId,
        assignedToType: assignedToType,
        assignedToId: assignedUserId || assignedSupplierId || '', // Kept for backward compatibility
        assignedUserId: assignedUserId,
        assignedSupplierId: assignedSupplierId,
        scheduledDate: jobDate,
        status: 'Scheduled' as const,
        completionNotes: data.notes || null,
        createdAt: now,
        updatedAt: now
      }

      jobs.push(job)
    }

    // Create all jobs in database
    if (jobs.length > 0) {
      await prisma.serviceJob.createMany({
        data: jobs
      })
    }

    // Fetch the created jobs with relations for response
    const createdJobs = await prisma.serviceJob.findMany({
      where: {
        contractId: contractId,
        id: { in: jobs.map((job: any) => job.id) }
      },
      include: {
        ServiceContract: {
          select: {
            id: true,
            contractNo: true,
            serviceType: true,
            frequency: true
          }
        },
        Customer: {
          select: {
            id: true,
            name: true,
            customerNumber: true
          }
        },
        Project: {
          select: {
            id: true,
            projectNumber: true,
            name: true
          }
        },
        AssignedUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        AssignedSupplier: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        scheduledDate: 'asc'
      }
    })

    return NextResponse.json({
      message: `${jobs.length} jobs generated successfully`,
      jobsGenerated: jobs.length,
      jobs: createdJobs.map((job: any) => ({
        ...job,
        contract: job.ServiceContract,
        customer: job.Customer,
        project: job.Project,
        assignedUser: job.AssignedUser,
        assignedSupplier: job.AssignedSupplier,
        ServiceContract: undefined,
        Customer: undefined,
        Project: undefined,
        AssignedUser: undefined,
        AssignedSupplier: undefined
      }))
    })
  } catch (error) {
    console.error('Error generating jobs:', error)
    return NextResponse.json({ 
      error: 'Failed to generate jobs',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// GET /api/servicing/contracts/[id]/jobs/generate - Get suggested dates for job generation
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const contractId = params.id
    const url = new URL(request.url)
    const months = parseInt(url.searchParams.get('months') || '12')

    // Get contract details
    const contract = await prisma.serviceContract.findUnique({
      where: { id: contractId },
      select: {
        id: true,
        contractNo: true,
        frequency: true,
        startDate: true,
        endDate: true
      }
    })

    if (!contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
    }

    // Generate suggested dates based on frequency
    const suggestedDates = generateScheduledDates(
      new Date(contract.startDate),
      new Date(contract.endDate),
      contract.frequency,
      months
    )

    return NextResponse.json({
      contract: {
        id: contract.id,
        contractNo: contract.contractNo,
        frequency: contract.frequency,
        startDate: contract.startDate,
        endDate: contract.endDate
      },
      suggestedDates,
      totalSuggested: suggestedDates.length
    })
  } catch (error) {
    console.error('Error getting suggested dates:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Helper function to generate scheduled dates
function generateScheduledDates(
  startDate: Date,
  endDate: Date,
  frequency: string,
  maxMonths: number = 12
): string[] {
  const dates = []
  let currentDate = new Date(startDate)
  const actualEndDate = new Date(Math.min(
    endDate.getTime(),
    new Date(Date.now() + (maxMonths * 30 * 24 * 60 * 60 * 1000)).getTime()
  ))

  // Calculate interval in months
  let intervalMonths = 1
  switch (frequency) {
    case 'Monthly':
      intervalMonths = 1
      break
    case 'Quarterly':
      intervalMonths = 3
      break
    case 'BiAnnual':
      intervalMonths = 6
      break
    case 'Annual':
      intervalMonths = 12
      break
    case 'Custom':
      intervalMonths = 3 // Default to quarterly for custom
      break
  }

  // Generate dates
  while (currentDate <= actualEndDate) {
    dates.push(currentDate.toISOString())
    
    // Move to next scheduled date
    currentDate = new Date(currentDate)
    currentDate.setMonth(currentDate.getMonth() + intervalMonths)
    
    // Safety check to prevent infinite loop
    if (dates.length > 50) break
  }

  return dates
}
