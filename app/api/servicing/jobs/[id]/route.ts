
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET /api/servicing/jobs/[id] - Get single service job
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = session.user?.role
    const userId = session.user?.id
    const canViewAll = ["SUPERADMIN", "ADMIN", "PROJECT_MANAGER", "FINANCE"].includes(userRole || "")

    const job = await prisma.serviceJob.findUnique({
      where: { id: params.id },
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
        ServiceJobSheet: {
          orderBy: {
            generatedAt: 'desc'
          }
        },
        SupplierReport: {
          orderBy: {
            uploadedAt: 'desc'
          },
          include: {
            Supplier: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        },
        ServiceInvoice: {
          orderBy: {
            createdAt: 'desc'
          }
        },
        _count: {
          select: {
            ServiceJobSheet: true,
            SupplierReport: true,
            ServiceInvoice: true
          }
        }
      }
    })

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // Check permissions: admins can view all, others can only view their assigned jobs
    if (!canViewAll && job.assignedUserId !== userId) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Normalize the response to match frontend expectations
    const normalizedJob = {
      ...job,
      contract: job.ServiceContract,
      client: job.Customer ? {
        ...job.Customer,
        clientNumber: job.Customer.customerNumber // Map customerNumber to clientNumber
      } : null,
      customer: job.Customer,
      project: job.Project,
      assignedUser: job.AssignedUser,
      assignedVendor: job.AssignedSupplier, // Frontend expects "assignedVendor"
      assignedSupplier: job.AssignedSupplier,
      jobSheets: job.ServiceJobSheet || [],
      invoices: job.ServiceInvoice || [],
      vendorReports: job.SupplierReport || [],
      // Remove the capitalized versions to avoid confusion
      ServiceContract: undefined,
      Customer: undefined,
      Project: undefined,
      AssignedUser: undefined,
      AssignedSupplier: undefined,
      ServiceJobSheet: undefined,
      ServiceInvoice: undefined,
      SupplierReport: undefined
    }

    return NextResponse.json(normalizedJob)
  } catch (error: any) {
    console.error('Error fetching service job:', error)
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      meta: error.meta,
      stack: error.stack
    })
    return NextResponse.json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 })
  }
}

// PUT /api/servicing/jobs/[id] - Update service job
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = session.user?.role
    const userId = session.user?.id
    const canUpdateAll = ["SUPERADMIN", "ADMIN", "PROJECT_MANAGER"].includes(userRole || "")

    // First check if job exists and get current data
    const existingJob = await prisma.serviceJob.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        assignedUserId: true,
        assignedSupplierId: true
      }
    })

    if (!existingJob) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // Check permissions: admins can update all, others can only update their assigned jobs
    if (!canUpdateAll && existingJob.assignedUserId !== userId) {
      return NextResponse.json({ error: 'Insufficient permissions to update this job' }, { status: 403 })
    }

    const data = await request.json()

    // Prepare update data
    const updateData: any = {
      updatedAt: new Date()
    }

    if (data.status) updateData.status = data.status
    if (data.completionNotes !== undefined) updateData.completionNotes = data.completionNotes
    if (data.scheduledDate) updateData.scheduledDate = new Date(data.scheduledDate)
    if (data.completedAt) updateData.completedAt = new Date(data.completedAt)
    
    // If marking as completed and no explicit completedAt provided, set it to now
    if (data.status === 'Completed' && !data.completedAt && !updateData.completedAt) {
      updateData.completedAt = new Date()
    }
    
    // If changing status from completed to something else, clear completedAt
    if (data.status && data.status !== 'Completed' && data.status !== 'Endorsed') {
      updateData.completedAt = null
    }

    const updatedJob = await prisma.serviceJob.update({
      where: { id: params.id },
      data: updateData,
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
        }
      }
    })

    // Normalize the response
    const normalizedJob = {
      ...updatedJob,
      contract: updatedJob.ServiceContract,
      client: updatedJob.Customer ? {
        ...updatedJob.Customer,
        clientNumber: updatedJob.Customer.customerNumber // Map customerNumber to clientNumber
      } : null,
      customer: updatedJob.Customer,
      project: updatedJob.Project,
      assignedUser: updatedJob.AssignedUser,
      assignedVendor: updatedJob.AssignedSupplier, // Frontend expects "assignedVendor"
      assignedSupplier: updatedJob.AssignedSupplier,
      // Remove the capitalized versions
      ServiceContract: undefined,
      Customer: undefined,
      Project: undefined,
      AssignedUser: undefined,
      AssignedSupplier: undefined
    }

    return NextResponse.json(normalizedJob)
  } catch (error) {
    console.error('Error updating service job:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/servicing/jobs/[id] - Delete service job
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = session.user?.role
    const canDelete = ["SUPERADMIN", "ADMIN"].includes(userRole || "")
    
    if (!canDelete) {
      return NextResponse.json({ error: 'Insufficient permissions to delete jobs' }, { status: 403 })
    }

    // Check if job exists
    const existingJob = await prisma.serviceJob.findUnique({
      where: { id: params.id },
      select: { id: true }
    })

    if (!existingJob) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    await prisma.serviceJob.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ message: 'Job deleted successfully' })
  } catch (error) {
    console.error('Error deleting service job:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
