
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { v4 as uuidv4 } from 'uuid'


// GET /api/servicing/jobs - List all service jobs with filters
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = session.user?.role
    const userId = session.user?.id
    const canViewAll = ["SUPERADMIN", "ADMIN", "PROJECT_MANAGER", "FINANCE"].includes(userRole || "")

    const url = new URL(request.url)
    const customerId = url.searchParams.get('customerId')
    const projectId = url.searchParams.get('projectId')
    const status = url.searchParams.get('status')
    const assignedTo = url.searchParams.get('assignedTo')
    const assignedToType = url.searchParams.get('assignedToType')
    const serviceType = url.searchParams.get('serviceType')
    const dateFrom = url.searchParams.get('dateFrom')
    const dateTo = url.searchParams.get('dateTo')

    const whereClause: any = {}

    // If not admin/manager, show only jobs assigned to current user
    if (!canViewAll) {
      whereClause.OR = [
        { assignedToType: 'Staff', assignedUserId: userId },
        { assignedToType: 'Supplier', assignedSupplierId: userId }
      ]
    }

    if (customerId) whereClause.customerId = customerId
    if (projectId) whereClause.projectId = projectId
    if (status) whereClause.status = status
    if (assignedTo) {
      // Support both old and new fields for filtering
      whereClause.OR = whereClause.OR || []
      whereClause.OR.push({ assignedUserId: assignedTo })
      whereClause.OR.push({ assignedSupplierId: assignedTo })
    }
    if (assignedToType) whereClause.assignedToType = assignedToType
    
    // Filter by service type through the contract relation
    if (serviceType) {
      whereClause.ServiceContract = {
        serviceType: serviceType
      }
    }
    
    if (dateFrom || dateTo) {
      whereClause.scheduledDate = {}
      if (dateFrom) whereClause.scheduledDate.gte = new Date(dateFrom)
      if (dateTo) whereClause.scheduledDate.lte = new Date(dateTo)
    }

    const jobs = await prisma.serviceJob.findMany({
      where: whereClause,
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
            customerNumber: true,
            email: true,
            phone: true,
            contactPerson: true
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
        AssignedUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true
          }
        },
        AssignedSupplier: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            contactPerson: true
          }
        },
        _count: {
          select: {
            ServiceJobSheet: true,
            SupplierReport: true,
            ServiceInvoice: true
          }
        }
      },
      orderBy: {
        scheduledDate: 'asc'
      }
    })

    // Normalize the response to match frontend expectations
    const normalizedJobs = jobs.map((job: any) => ({
      ...job,
      contract: job.ServiceContract,
      customer: job.Customer,
      project: job.Project,
      assignedUser: job.AssignedUser,
      assignedSupplier: job.AssignedSupplier,
      // Normalize count field names to camelCase
      _count: {
        jobSheets: job._count.ServiceJobSheet,
        vendorReports: job._count.SupplierReport,
        invoices: job._count.ServiceInvoice
      },
      // Remove the capitalized versions to avoid confusion
      ServiceContract: undefined,
      Customer: undefined,
      Project: undefined,
      AssignedUser: undefined,
      AssignedSupplier: undefined
    }))

    return NextResponse.json(normalizedJobs)
  } catch (error) {
    console.error('Error fetching service jobs:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/servicing/jobs - Create new service job
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = session.user?.role
    const canCreate = ["SUPERADMIN", "ADMIN", "PROJECT_MANAGER"].includes(userRole || "")
    
    if (!canCreate) {
      return NextResponse.json({ error: 'Insufficient permissions to create jobs' }, { status: 403 })
    }

    const data = await request.json()

    // Validate required fields
    if (!data.contractId || !data.customerId || !data.assignedToType || !data.assignedToId || !data.scheduledDate) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Verify the assigned user/vendor exists
    if (data.assignedToType === 'Staff') {
      const user = await prisma.user.findUnique({ where: { id: data.assignedToId } })
      if (!user) {
        return NextResponse.json({ error: 'Assigned user not found' }, { status: 404 })
      }
    } else if (data.assignedToType === 'Vendor') {
      const vendor = await prisma.supplier.findUnique({ where: { id: data.assignedToId } })
      if (!vendor) {
        return NextResponse.json({ error: 'Assigned vendor not found' }, { status: 404 })
      }
    }

    const job = await prisma.serviceJob.create({
      data: {
        id: uuidv4(),
        contractId: data.contractId,
        customerId: data.customerId,
        projectId: data.projectId || null,
        assignedToType: data.assignedToType,
        assignedToId: data.assignedToId, // Kept for backward compatibility
        assignedUserId: data.assignedToType === 'Staff' ? data.assignedToId : null,
        assignedSupplierId: data.assignedToType === 'Supplier' ? data.assignedToId : null,
        scheduledDate: new Date(data.scheduledDate),
        status: data.status || 'Scheduled',
        completionNotes: data.completionNotes || null,
        updatedAt: new Date()
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
        }
      }
    })

    // Fetch assigned user or supplier based on assignedToType
    let assignedTo = null
    const assignedId = data.assignedToType === 'Staff' ? job.assignedUserId : job.assignedSupplierId
    if (data.assignedToType === 'Staff' && assignedId) {
      assignedTo = await prisma.user.findUnique({
        where: { id: assignedId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true
        }
      })
    } else if (data.assignedToType === 'Supplier' && assignedId) {
      assignedTo = await prisma.supplier.findUnique({
        where: { id: assignedId },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          contactPerson: true,
          address: true
        }
      })
    }

    return NextResponse.json({
      ...job,
      assignedTo,
      assignedToType: data.assignedToType
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating service job:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
