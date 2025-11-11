
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { v4 as uuidv4 } from 'uuid'
import { createSuccessResponse, createErrorResponse, ensureArray } from '@/lib/api-response'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        createErrorResponse('Unauthorized', { code: 'AUTH_REQUIRED' }),
        { status: 401 }
      )
    }

    const tenders = await prisma.tender.findMany({
      include: {
        Customer: {
          select: {
            id: true,
            name: true,
            email: true
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
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Transform the data to match the frontend interface
    const transformedTenders = ensureArray(tenders).map(tender => ({
      id: tender.id,
      title: tender.title,
      tenderNumber: tender.tenderNumber,
      description: tender.description,
      clientName: tender.Customer?.name || 'Unknown',
      customerId: tender.customerId,
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
      assignedTo: tender.User_Tender_assignedToIdToUser ? `${tender.User_Tender_assignedToIdToUser.firstName} ${tender.User_Tender_assignedToIdToUser.lastName}` : null,
      salesperson: tender.User_Tender_salespersonIdToUser ? `${tender.User_Tender_salespersonIdToUser.firstName} ${tender.User_Tender_salespersonIdToUser.lastName}` : null,
      salespersonId: tender.salespersonId
    }))

    return NextResponse.json(
      createSuccessResponse(transformedTenders, {
        message: `${transformedTenders.length} tender(s) retrieved`,
        meta: { totalCount: transformedTenders.length }
      })
    )
  } catch (error) {
    console.error('Error fetching tenders:', error)
    return NextResponse.json(
      createErrorResponse('Failed to fetch tenders', {
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      }),
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ 
        error: 'You must be logged in to create tenders',
        field: 'auth' 
      }, { status: 401 })
    }

    // Parse request body
    let body
    try {
      body = await request.json()
    } catch (parseError) {
      console.error('[Tender Create] JSON parse error:', parseError)
      return NextResponse.json({ 
        error: 'Invalid request format. Please check your input.',
        field: 'body' 
      }, { status: 400 })
    }

    const {
      title,
      description,
      customerId,
      estimatedValue,
      submissionDeadline,
      openDate,
      closeDate,
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

    // Log received data for debugging
    console.log('[Tender Create] Received data:', {
      title: title?.substring(0, 50) + '...',
      customerId,
      hasEstimatedValue: !!estimatedValue,
      hasSubmissionDeadline: !!submissionDeadline,
      hasOpenDate: !!openDate,
      priority,
      category
    })

    // Detailed validation with specific error messages
    const validationErrors: Record<string, string> = {}

    if (!title || title.trim() === '') {
      validationErrors.title = 'Tender title is required'
    }

    if (!customerId || customerId.trim() === '' || customerId === 'no-customers') {
      validationErrors.customerId = 'Customer selection is required'
    }

    if (!submissionDeadline) {
      validationErrors.submissionDeadline = 'Submission deadline is required'
    }

    if (!openDate) {
      validationErrors.openDate = 'Open date is required'
    }

    // Validate estimatedValue if provided
    if (estimatedValue !== null && estimatedValue !== undefined && estimatedValue !== '') {
      const numValue = parseFloat(estimatedValue.toString())
      if (isNaN(numValue) || numValue < 0) {
        validationErrors.estimatedValue = 'Estimated value must be a positive number'
      }
    }

    // Validate email format if provided
    if (contactEmail && contactEmail.trim() !== '') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(contactEmail)) {
        validationErrors.contactEmail = 'Please enter a valid email address'
      }
    }

    // Return validation errors if any
    if (Object.keys(validationErrors).length > 0) {
      console.error('[Tender Create] Validation errors:', {
        userId: session.user.id,
        userEmail: session.user.email,
        errors: validationErrors,
        receivedData: {
          title: title?.substring(0, 50),
          customerId,
          hasSubmissionDeadline: !!submissionDeadline,
          hasOpenDate: !!openDate
        }
      })

      return NextResponse.json({ 
        error: 'Validation failed. Please check your input.',
        validationErrors,
        field: Object.keys(validationErrors)[0] // First field with error
      }, { status: 400 })
    }

    // Verify client exists
    const clientExists = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, name: true }
    })

    if (!clientExists) {
      console.error('[Tender Create] Customer not found:', {
        userId: session.user.id,
        customerId
      })
      return NextResponse.json({ 
        error: 'Selected client does not exist',
        field: 'customerId' 
      }, { status: 400 })
    }

    // Verify assigned user exists if provided
    if (assignedToId) {
      const assignedUserExists = await prisma.user.findUnique({
        where: { id: assignedToId },
        select: { id: true }
      })

      if (!assignedUserExists) {
        console.error('[Tender Create] Assigned user not found:', {
          userId: session.user.id,
          assignedToId
        })
        return NextResponse.json({ 
          error: 'Selected assigned user does not exist',
          field: 'assignedToId' 
        }, { status: 400 })
      }
    }

    // Verify salesperson exists if provided
    if (salespersonId) {
      const salespersonExists = await prisma.user.findUnique({
        where: { id: salespersonId },
        select: { id: true }
      })

      if (!salespersonExists) {
        console.error('[Tender Create] Salesperson not found:', {
          userId: session.user.id,
          salespersonId
        })
        return NextResponse.json({ 
          error: 'Selected salesperson does not exist',
          field: 'salespersonId' 
        }, { status: 400 })
      }
    }

    // Generate tender number
    const lastTender = await prisma.tender.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { tenderNumber: true }
    })

    let nextNumber = 1
    if (lastTender?.tenderNumber) {
      const match = lastTender.tenderNumber.match(/TND-\d{4}-(\d+)/)
      if (match) {
        nextNumber = parseInt(match[1]) + 1
      }
    }

    const currentYear = new Date().getFullYear()
    const tenderNumber = `TND-${currentYear}-${nextNumber.toString().padStart(3, '0')}`

    console.log('[Tender Create] Creating tender:', {
      userId: session.user.id,
      userEmail: session.user.email,
      tenderNumber,
      title: title.substring(0, 50),
      customerId,
      clientName: clientExists.name
    })

    // Create tender
    const tender = await prisma.tender.create({
      data: {
        id: uuidv4(),
        title: title.trim(),
        tenderNumber,
        description: description?.trim() || null,
        customerId,
        estimatedValue: estimatedValue ? parseFloat(estimatedValue.toString()) : null,
        submissionDeadline: new Date(submissionDeadline),
        openDate: new Date(openDate),
        closeDate: closeDate ? new Date(closeDate) : null,
        priority: priority || 'MEDIUM',
        requirements: requirements?.trim() || null,
        contactPerson: contactPerson?.trim() || null,
        contactEmail: contactEmail?.trim() || null,
        contactPhone: contactPhone?.trim() || null,
        location: location?.trim() || null,
        category: category || 'GENERAL',
        nasDocumentPath: nasDocumentPath?.trim() || null,
        assignedToId: assignedToId || null,
        salespersonId: salespersonId || null,
        createdById: session.user.id,
        updatedAt: new Date()
      },
      include: {
        Customer: {
          select: {
            id: true,
            name: true,
            email: true
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
        }
      }
    })

    console.log('[Tender Create] Tender created successfully:', {
      tenderId: tender.id,
      tenderNumber: tender.tenderNumber,
      userId: session.user.id
    })

    // Automatically create a task if the tender is assigned to a user
    if (assignedToId) {
      try {
        await prisma.task.create({
          data: {
            id: uuidv4(),
            title: `Review Tender: ${title}`,
            description: `You have been assigned to review and prepare submission for tender ${tender.tenderNumber}.\n\nDeadline: ${new Date(submissionDeadline).toLocaleDateString()}\n\nDescription: ${description || 'No description provided'}`,
            priority: priority === 'HIGH' ? 'HIGH' : priority === 'URGENT' ? 'HIGH' : 'MEDIUM',
            status: 'TODO',
            dueDate: new Date(submissionDeadline),
            assignerId: session.user.id,
            assigneeId: assignedToId,
            customerId: customerId,
            tenderId: tender.id,
            updatedAt: new Date()
          }
        })
        
        console.log('[Tender Create] Auto-created task for assigned user:', {
          tenderId: tender.id,
          assignedToId
        })
      } catch (taskError) {
        console.error('[Tender Create] Error creating automatic task:', taskError)
        // Don't fail the tender creation if task creation fails
      }
    }

    return NextResponse.json(
      createSuccessResponse(tender, {
        message: `Tender ${tender.tenderNumber} created successfully`
      }),
      { status: 201 }
    )
  } catch (error: any) {
    console.error('[Tender Create] Unexpected error:', {
      error: error.message,
      stack: error.stack,
      userId: (await getServerSession(authOptions))?.user?.id
    })

    // Handle Prisma-specific errors
    if (error.code === 'P2002') {
      return NextResponse.json(
        createErrorResponse('A tender with this information already exists', {
          code: 'DUPLICATE_ENTRY',
          details: { field: 'duplicate' }
        }),
        { status: 409 }
      )
    }

    if (error.code === 'P2003') {
      return NextResponse.json(
        createErrorResponse('Invalid reference. Please check your selections.', {
          code: 'INVALID_REFERENCE',
          details: { field: 'reference' }
        }),
        { status: 400 }
      )
    }

    return NextResponse.json(
      createErrorResponse('An unexpected error occurred while creating the tender. Please try again.', {
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      }),
      { status: 500 }
    )
  }
}
