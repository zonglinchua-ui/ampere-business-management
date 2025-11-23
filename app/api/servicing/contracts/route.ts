
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { v4 as uuidv4 } from 'uuid'


// GET /api/servicing/contracts - List all service contracts
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = session.user?.role
    const canView = ["SUPERADMIN", "ADMIN", "PROJECT_MANAGER", "FINANCE"].includes(userRole || "")
    
    if (!canView) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const url = new URL(request.url)
    const customerId = url.searchParams.get('customerId')
    const projectId = url.searchParams.get('projectId')
    const serviceType = url.searchParams.get('serviceType')
    const status = url.searchParams.get('status')

    const whereClause: any = {}
    if (customerId) whereClause.customerId = customerId
    if (projectId) whereClause.projectId = projectId
    if (serviceType) whereClause.serviceType = serviceType

    const contracts = await prisma.serviceContract.findMany({
      where: whereClause,
      include: {
        Customer: {
          select: {
            id: true,
            name: true,
            customerNumber: true,
            email: true,
            phone: true
          }
        },
        Project: {
          select: {
            id: true,
            projectNumber: true,
            name: true,
            status: true
          }
        },
        User_ServiceContract_createdByIdToUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        ServiceContractSupplier: {
          include: {
            supplier: {
              select: {
                id: true,
                name: true,
                supplierNumber: true,
                email: true,
                phone: true
              }
            }
          }
        },
        _count: {
          select: {
            ServiceJob: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Transform to match frontend expectations (camelCase)
    const transformedContracts = contracts.map((contract: any) => ({
      ...contract,
      customer: contract.Customer,
      project: contract.Project,
      createdBy: contract.User_ServiceContract_createdByIdToUser,
      suppliers: contract.ServiceContractSupplier || [],
      _count: {
        jobs: contract._count.ServiceJob
      }
    }))

    return NextResponse.json(transformedContracts)
  } catch (error) {
    console.error('Error fetching service contracts:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/servicing/contracts - Create new service contract
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = session.user?.role
    const canCreate = ["SUPERADMIN", "ADMIN", "PROJECT_MANAGER"].includes(userRole || "")
    
    if (!canCreate) {
      return NextResponse.json({ error: 'Insufficient permissions to create contracts' }, { status: 403 })
    }

    const data = await request.json()
    
    console.log('[Create Contract API] Received data:', {
      ...data,
      supplierIds: data.supplierIds ? `[${data.supplierIds.length} suppliers]` : 'none'
    })

    // Validate required fields
    if (!data.title || !data.title.trim()) {
      console.error('[Create Contract API] Missing title')
      return NextResponse.json({ error: 'Contract title is required' }, { status: 400 })
    }

    if (!data.customerId) {
      console.error('[Create Contract API] Missing customerId')
      return NextResponse.json({ error: 'Customer is required' }, { status: 400 })
    }

    if (!data.serviceType || !data.frequency) {
      console.error('[Create Contract API] Missing serviceType or frequency')
      return NextResponse.json({ error: 'Service type and frequency are required' }, { status: 400 })
    }

    if (!data.startDate || !data.endDate) {
      console.error('[Create Contract API] Missing dates')
      return NextResponse.json({ error: 'Start and end dates are required' }, { status: 400 })
    }

    // Validate end date is after start date
    const startDate = new Date(data.startDate)
    const endDate = new Date(data.endDate)
    if (endDate <= startDate) {
      console.error('[Create Contract API] Invalid date range')
      return NextResponse.json({ error: 'End date must be after start date' }, { status: 400 })
    }

    // Generate contract number with format CS-YY-MM-XXXX
    // Get the last contract to determine the next running number
    const lastContract = await prisma.serviceContract.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { contractNo: true }
    })

    let newRunningNo = 1
    if (lastContract?.contractNo) {
      // Extract running number from last contract (CS-YY-MM-XXXX format)
      const match = lastContract.contractNo.match(/CS-\d{2}-\d{2}-(\d+)/)
      if (match) {
        newRunningNo = parseInt(match[1], 10) + 1
      }
    }

    const now = new Date()
    const year = now.getFullYear().toString().slice(-2)
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const runningNo = String(newRunningNo).padStart(4, '0')
    const contractNo = `CS-${year}-${month}-${runningNo}`

    console.log('[Create Contract API] Generated contract number:', contractNo)

    const contract = await prisma.$transaction(async (tx: any) => {
      // Create the contract
      const newContract = await tx.serviceContract.create({
        data: {
          contractNo,
          title: data.title.trim(),
          customerId: data.customerId,
          projectId: data.projectId || null,
          serviceType: data.serviceType,
          frequency: data.frequency,
          startDate,
          endDate,
          status: 'Active',
          filePath: data.filePath || null,
          createdById: session.user?.id || ''
        },
        include: {
          Customer: {
            select: {
              id: true,
              name: true,
              customerNumber: true,
              email: true,
              phone: true
            }
          },
          Project: {
            select: {
              id: true,
              projectNumber: true,
              name: true,
              status: true
            }
          },
          User_ServiceContract_createdByIdToUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          ServiceContractSupplier: {
            include: {
              supplier: {
                select: {
                  id: true,
                  name: true,
                  supplierNumber: true,
                  email: true,
                  phone: true
                }
              }
            }
          }
        }
      })

      // Link suppliers if provided
      if (data.supplierIds && Array.isArray(data.supplierIds) && data.supplierIds.length > 0) {
        console.log('[Create Contract API] Linking suppliers:', data.supplierIds)
        await tx.serviceContractSupplier.createMany({
          data: data.supplierIds.map((supplierId: string) => ({
            contractId: newContract.id,
            supplierId
          }))
        })
      }

      // Generate initial scheduled jobs based on frequency
      await generateInitialJobs(tx, newContract)

      // Fetch the complete contract with suppliers
      const completeContract = await tx.serviceContract.findUnique({
        where: { id: newContract.id },
        include: {
          Customer: {
            select: {
              id: true,
              name: true,
              customerNumber: true,
              email: true,
              phone: true
            }
          },
          Project: {
            select: {
              id: true,
              projectNumber: true,
              name: true,
              status: true
            }
          },
          User_ServiceContract_createdByIdToUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          ServiceContractSupplier: {
            include: {
              supplier: {
                select: {
                  id: true,
                  name: true,
                  supplierNumber: true,
                  email: true,
                  phone: true
                }
              }
            }
          }
        }
      })

      return completeContract
    })

    // Transform to match frontend expectations (camelCase)
    const transformedContract = contract ? {
      ...contract,
      customer: contract.Customer,
      project: contract.Project,
      createdBy: contract.User_ServiceContract_createdByIdToUser,
      suppliers: contract.ServiceContractSupplier || [],
      _count: {
        jobs: 0 // New contract, no jobs yet
      }
    } : null

    console.log('[Create Contract API] Contract created successfully:', contract?.id)
    return NextResponse.json(transformedContract, { status: 201 })
  } catch (error: any) {
    console.error('[Create Contract API] Error creating service contract:', {
      message: error.message,
      stack: error.stack,
      code: error.code
    })
    return NextResponse.json({ 
      error: 'Failed to create contract. Please try again.',
      details: error.message 
    }, { status: 500 })
  }
}

// Helper function to generate initial scheduled jobs
async function generateInitialJobs(tx: any, contract: any) {
  const jobs = []
  const startDate = new Date(contract.startDate)
  const endDate = new Date(contract.endDate)
  let currentDate = new Date(startDate)

  // Calculate job intervals based on frequency
  let intervalMonths = 1
  switch (contract.frequency) {
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
      // For custom frequency, generate one job per year for now
      intervalMonths = 12
      break
  }

  // Generate jobs until end date
  const now = new Date()
  while (currentDate <= endDate) {
    jobs.push({
      id: uuidv4(), // Generate unique ID for each job
      contractId: contract.id,
      customerId: contract.customerId,
      projectId: contract.projectId,
      assignedToType: 'Staff', // Default to staff, can be changed later
      assignedToId: contract.createdById, // Kept for backward compatibility
      assignedUserId: contract.createdById, // Assign to contract creator initially (new field)
      assignedSupplierId: null, // Not assigned to supplier initially
      scheduledDate: new Date(currentDate),
      status: 'Scheduled',
      updatedAt: now // Provide updatedAt field
    })

    // Move to next scheduled date
    currentDate.setMonth(currentDate.getMonth() + intervalMonths)
  }

  // Create all jobs
  if (jobs.length > 0) {
    await tx.serviceJob.createMany({
      data: jobs
    })
  }
}
