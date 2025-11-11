import { v4 as uuidv4 } from 'uuid'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'


// POST /api/servicing/jobs/[id]/vendor-reports - Upload vendor report
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
    const userId = session.user?.id

    // Get the job to check if it's assigned to a vendor
    const job = await prisma.serviceJob.findUnique({
      where: { id: params.id },
      include: {
        Customer: {
          select: {
            customerNumber: true,
            name: true
          }
        },
        Project: {
          select: {
            projectNumber: true
          }
        },
        AssignedSupplier: {
          select: {
            id: true,
            name: true,
            supplierNumber: true
          }
        }
      }
    })

    if (!job) {
      return NextResponse.json({ error: 'Service job not found' }, { status: 404 })
    }

    // Check permissions - only assigned supplier or admins can upload
    const canUpload = (
      ["SUPERADMIN", "ADMIN", "PROJECT_MANAGER"].includes(userRole || "") ||
      (job.assignedToType === 'Supplier' && job.assignedToId === userId)
    )

    if (!canUpload) {
      return NextResponse.json({ error: 'Insufficient permissions to upload vendor reports' }, { status: 403 })
    }

    const data = await request.json()
    
    if (!data.supplierId || !data.fileName) {
      return NextResponse.json({ error: 'Missing required fields: supplierId, fileName' }, { status: 400 })
    }

    // Generate file path following NAS structure
    const clientCode = job.Customer.customerNumber || job.Customer.name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
    const projectCode = job.Project?.projectNumber || 'NO_PROJECT'
    const supplierCode = job.AssignedSupplier?.supplierNumber || job.AssignedSupplier?.name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
    const filePath = `/NAS/Ampere/Clients/${clientCode}/Projects/${projectCode}/Servicing/Jobs/${job.id}/SupplierReports/${supplierCode}_${job.id}_${data.fileName}`

    const supplierReport = await prisma.supplierReport.create({
      data: {
        id: uuidv4(),
        jobId: params.id,
        supplierId: data.supplierId,
        filePath,
      },
      include: {
        Supplier: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        }
      }
    })

    return NextResponse.json(supplierReport, { status: 201 })

  } catch (error) {
    console.error('Error uploading vendor report:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET /api/servicing/jobs/[id]/vendor-reports - List vendor reports for a job
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

    // Get the job to check permissions
    const job = await prisma.serviceJob.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        assignedToType: true,
        assignedToId: true
      }
    })

    if (!job) {
      return NextResponse.json({ error: 'Service job not found' }, { status: 404 })
    }

    // Check permissions
    const canView = (
      ["SUPERADMIN", "ADMIN", "PROJECT_MANAGER", "FINANCE"].includes(userRole || "") ||
      (job.assignedToType === 'Staff' && job.assignedToId === userId) ||
      (job.assignedToType === 'Supplier' && job.assignedToId === userId)
    )

    if (!canView) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const supplierReports = await prisma.supplierReport.findMany({
      where: { jobId: params.id },
      include: {
        Supplier: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            contactPerson: true
          }
        }
      },
      orderBy: { uploadedAt: 'desc' }
    })

    return NextResponse.json(supplierReports)

  } catch (error) {
    console.error('Error fetching vendor reports:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
