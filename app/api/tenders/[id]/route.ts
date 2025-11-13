
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { archiveDeletedTender, logArchival } from '@/lib/nas-archival-service'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      console.error('[Tender API] Unauthorized access attempt')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params

    if (!id) {
      console.error('[Tender API] Tender ID is required')
      return NextResponse.json({ error: 'Tender ID is required' }, { status: 400 })
    }

    console.log(`[Tender API] Fetching tender with ID: ${id}`)

    const tender = await prisma.tender.findUnique({
      where: { id },
      include: {
        Customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            address: true,
            city: true,
            state: true,
            country: true,
            postalCode: true,
            contactPerson: true
          }
        },
        User_Tender_createdByIdToUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        User_Tender_assignedToIdToUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        User_Tender_salespersonIdToUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        TenderActivity: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 10
        },
        Quotation: {
          select: {
            id: true,
            quotationNumber: true,
            title: true,
            totalAmount: true,
            status: true,
            validUntil: true,
            createdAt: true
          },
          orderBy: {
            createdAt: 'desc'
          }
        },
        Document: {
          select: {
            id: true,
            filename: true,
            originalName: true,
            category: true,
            cloudStoragePath: true,
            description: true,
            createdAt: true
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    })

    if (!tender) {
      console.warn(`[Tender API] Tender not found with ID: ${id}`)
      return NextResponse.json(
        { error: 'Tender not found' },
        { status: 404 }
      )
    }

    console.log(`[Tender API] Successfully fetched tender: ${tender.tenderNumber}`)

    // Transform the data to match the frontend interface
    const transformedTender = {
      id: tender.id,
      title: tender.title,
      tenderNumber: tender.tenderNumber,
      description: tender.description,
      customerId: tender.customerId,
      client: tender.Customer,
      estimatedValue: tender.estimatedValue ? Number(tender.estimatedValue) : null,
      submissionDeadline: tender.submissionDeadline.toISOString(),
      openDate: tender.openDate.toISOString(),
      closeDate: tender.closeDate?.toISOString() || null,
      status: tender.status,
      priority: tender.priority,
      category: tender.category,
      contactPerson: tender.contactPerson,
      contactEmail: tender.contactEmail,
      contactPhone: tender.contactPhone,
      location: tender.location,
      requirements: tender.requirements,
      nasDocumentPath: tender.nasDocumentPath,
      isActive: tender.isActive,
      createdAt: tender.createdAt.toISOString(),
      updatedAt: tender.updatedAt.toISOString(),
      createdBy: tender.User_Tender_createdByIdToUser,
      assignedTo: tender.User_Tender_assignedToIdToUser,
      salesperson: tender.User_Tender_salespersonIdToUser,
      activities: tender.TenderActivity,
      quotations: tender.Quotation.map((q: any) => ({
        ...q,
        totalAmount: q.totalAmount ? Number(q.totalAmount) : null,
        validUntil: q.validUntil?.toISOString() || null,
        createdAt: q.createdAt.toISOString()
      })),
      documents: tender.Document
    }

    return NextResponse.json(transformedTender)
  } catch (error) {
    console.error('[Tender API] Error fetching tender:', error)
    return NextResponse.json(
      { error: 'Failed to fetch tender' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      console.error('[Tender API PUT] Unauthorized access attempt')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    const body = await request.json()

    console.log(`[Tender API PUT] User ${session.user?.email} updating tender: ${id}`)

    const {
      title,
      description,
      customerId,
      estimatedValue,
      submissionDeadline,
      closeDate,
      status,
      priority,
      requirements,
      contactPerson,
      contactEmail,
      contactPhone,
      location,
      category,
      nasDocumentPath,
      assignedToId,
      salespersonId
    } = body

    // Check if tender exists
    const existingTender = await prisma.tender.findUnique({
      where: { id }
    })

    if (!existingTender) {
      console.warn(`[Tender API PUT] Tender not found: ${id}`)
      return NextResponse.json(
        { error: 'Tender not found' },
        { status: 404 }
      )
    }

    // Update tender
    const tender = await prisma.tender.update({
      where: { id },
      data: {
        title,
        description,
        customerId,
        estimatedValue: estimatedValue ? parseFloat(estimatedValue.toString()) : null,
        submissionDeadline: submissionDeadline ? new Date(submissionDeadline) : undefined,
        closeDate: closeDate ? new Date(closeDate) : null,
        status,
        priority,
        requirements,
        contactPerson,
        contactEmail,
        contactPhone,
        location,
        category,
        nasDocumentPath,
        assignedToId,
        salespersonId,
        updatedAt: new Date()
      },
      include: {
        Customer: true
      }
    })

    // Log activity for status change
    if (existingTender.status !== status) {
      try {
        await prisma.tenderActivity.create({
          data: {
            id: `TA-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            tenderId: id,
            action: 'STATUS_CHANGED',
            description: `Tender status changed from ${existingTender.status} to ${status}`,
            oldValue: existingTender.status,
            newValue: status,
            userId: session.user?.id || '',
            userEmail: session.user?.email || 'Unknown'
          }
        })
        console.log(`[Tender API PUT] Logged status change activity for tender: ${tender.tenderNumber}`)
      } catch (activityError) {
        console.error('[Tender API PUT] Error logging activity:', activityError)
        // Don't fail the request if activity logging fails
      }
    }

    // Automatically create a task if the tender is newly assigned or reassigned
    if (assignedToId && existingTender.assignedToId !== assignedToId) {
      try {
        const { v4: uuidv4 } = await import('uuid')
        
        await prisma.task.create({
          data: {
            id: uuidv4(),
            title: `Review Tender: ${title}`,
            description: `You have been assigned to review and prepare submission for tender ${tender.tenderNumber}.\n\nDeadline: ${new Date(submissionDeadline).toLocaleDateString()}\n\nDescription: ${description || 'No description provided'}`,
            priority: priority === 'HIGH' ? 'HIGH' : priority === 'URGENT' ? 'HIGH' : 'MEDIUM',
            status: 'TODO',
            dueDate: submissionDeadline ? new Date(submissionDeadline) : null,
            assignerId: session.user?.id || '',
            assigneeId: assignedToId,
            customerId: customerId,
            tenderId: id,
            updatedAt: new Date()
          }
        })
        
        console.log(`[Tender API PUT] Auto-created task for assigned user: ${assignedToId}`)
        
        // Log activity for assignment
        await prisma.tenderActivity.create({
          data: {
            id: `TA-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            tenderId: id,
            action: 'ASSIGNED',
            description: existingTender.assignedToId 
              ? `Tender reassigned to a new user`
              : `Tender assigned to a user`,
            oldValue: existingTender.assignedToId || 'Unassigned',
            newValue: assignedToId,
            userId: session.user?.id || '',
            userEmail: session.user?.email || 'Unknown'
          }
        })
      } catch (taskError) {
        console.error('[Tender API PUT] Error creating automatic task:', taskError)
        // Don't fail the tender update if task creation fails
      }
    }

    console.log(`[Tender API PUT] Successfully updated tender: ${tender.tenderNumber}`)

    return NextResponse.json(tender)
  } catch (error) {
    console.error('[Tender API PUT] Error updating tender:', error)
    
    // Check for specific Prisma errors
    if (error && typeof error === 'object' && 'code' in error) {
      if (error.code === 'P2025') {
        return NextResponse.json(
          { error: 'Tender not found' },
          { status: 404 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Failed to update tender' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      console.error('[Tender API DELETE] Unauthorized access attempt')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params

    if (!id) {
      console.error('[Tender API DELETE] Tender ID is required')
      return NextResponse.json({ error: 'Tender ID is required' }, { status: 400 })
    }

    // Check if user has super admin role
    const userRole = session.user?.role
    if (userRole !== 'SUPERADMIN') {
      console.warn(`[Tender API DELETE] User ${session.user?.email} with role ${userRole} attempted to delete tender: ${id}`)
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    console.log(`[Tender API DELETE] Super Admin ${session.user?.email} deleting tender with ID: ${id}`)

    // Check if tender exists first
    const existingTender = await prisma.tender.findUnique({
      where: { id },
      select: {
        id: true,
        tenderNumber: true,
        title: true
      }
    })

    if (!existingTender) {
      console.warn(`[Tender API DELETE] Tender not found: ${id}`)
      return NextResponse.json(
        { error: 'Tender not found' },
        { status: 404 }
      )
    }

    console.log(`[Tender API DELETE] Found tender to delete: ${existingTender.tenderNumber} - ${existingTender.title}`)

    // Archive tender files to NAS DELETED folder (async, don't wait)
    archiveDeletedTender(existingTender.tenderNumber, existingTender.title)
      .then(result => {
        if (result.success) {
          console.log(`[DELETE Tender] ✅ Tender archived to: ${result.archivedPath}`)
          // Log archival
          logArchival('TENDER', id, `${existingTender.tenderNumber} - ${existingTender.title}`, result.archivedPath || '', session.user.id)
        } else {
          console.warn(`[DELETE Tender] ⚠️ Tender archival failed: ${result.error}`)
        }
      })
      .catch(error => {
        console.error('[DELETE Tender] ❌ Tender archival error:', error)
      })

    // Delete tender and related records (Prisma will handle cascade)
    await prisma.tender.delete({
      where: { id }
    })

    // Log the deletion action
    try {
      await prisma.auditLog.create({
        data: {
          id: `AL-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          action: 'TENDER_DELETED',
          entityType: 'TENDER',
          entityId: id,
          oldValues: {
            tenderNumber: existingTender.tenderNumber,
            title: existingTender.title
          },
          newValues: {},
          userId: session.user?.id || '',
          userEmail: session.user?.email || 'Unknown',
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'Unknown',
          userAgent: request.headers.get('user-agent') || 'Unknown'
        }
      })
      console.log(`[Tender API DELETE] Logged deletion audit for tender: ${existingTender.tenderNumber}`)
    } catch (auditError) {
      console.error('[Tender API DELETE] Error logging audit:', auditError)
      // Don't fail the request if audit logging fails
    }

    console.log(`[Tender API DELETE] Successfully deleted tender: ${existingTender.tenderNumber} by ${session.user?.email}`)

    return NextResponse.json({ 
      success: true, 
      id: id,
      message: 'Tender deleted successfully'
    })
  } catch (error) {
    console.error('[Tender API DELETE] Error deleting tender:', error)
    
    // Handle specific Prisma errors
    if (error && typeof error === 'object' && 'code' in error) {
      if (error.code === 'P2025') {
        return NextResponse.json(
          { error: 'Tender not found' },
          { status: 404 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Failed to delete tender' },
      { status: 500 }
    )
  }
}
