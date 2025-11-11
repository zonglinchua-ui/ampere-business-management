
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { v4 as uuidv4 } from 'uuid'
import { generateJobCompletionHTML } from '@/lib/document-templates'


export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch service job with all related data
    const serviceJob = await prisma.serviceJob.findUnique({
      where: { id: params.id },
      include: {
        ServiceContract: {
          include: {
            Customer: true
          }
        }
      }
    })

    if (!serviceJob) {
      return NextResponse.json({ error: 'Service job not found' }, { status: 404 })
    }

    // Only allow export for completed jobs
    if (serviceJob.status !== 'Completed') {
      return NextResponse.json({ error: 'Job completion certificate can only be generated for completed jobs' }, { status: 400 })
    }

    // Fetch assigned user if applicable
    let technician = { firstName: 'Assigned', lastName: 'Technician', email: '' }
    if (serviceJob.assignedToType === 'Staff') {
      const assignedUser = await prisma.user.findUnique({
        where: { id: serviceJob.assignedToId },
        select: {
          firstName: true,
          lastName: true,
          email: true
        }
      })
      if (assignedUser && assignedUser.firstName && assignedUser.lastName) {
        technician = {
          firstName: assignedUser.firstName,
          lastName: assignedUser.lastName,
          email: assignedUser.email
        }
      }
    }

    // Format data for template
    const certificateNumber = `CERT-${serviceJob.id}-${new Date().getFullYear()}`
    
    const formattedJob = {
      ...serviceJob,
      certificateNumber,
      jobNumber: serviceJob.id,
      client: (serviceJob as any).ServiceContract.Customer,
      technician,
      completedDate: serviceJob.completedAt || serviceJob.updatedAt,
      workPerformed: serviceJob.completionNotes || 'Service maintenance and inspection completed as per contract requirements.',
      materialsUsed: 'Standard maintenance materials as required.',
      duration: null,
      serviceType: 'Maintenance Service'
    }

    // Generate professional HTML document with letterhead
    const htmlContent = generateJobCompletionHTML(formattedJob)
    
    return new NextResponse(htmlContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/html',
        'Content-Disposition': `inline; filename="${certificateNumber}.html"`,
      },
    })

  } catch (error) {
    console.error('Error generating completion certificate:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
