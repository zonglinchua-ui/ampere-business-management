import { v4 as uuidv4 } from 'uuid'

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { downloadFile, deleteFile, uploadFile } from "@/lib/s3"
import { z } from "zod"
import { generateDocumentNumber, DOCUMENT_TYPE_CODES } from "@/lib/document-numbering"

const updateDocumentSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED']).optional(),
  templateData: z.record(z.any()).optional(),
  rejectionReason: z.string().optional(),
})

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string; docId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const document = await prisma.projectDocument.findFirst({
      where: {
        id: params.docId,
        projectId: params.id,
        isActive: true,
      },
      include: {
        User_ProjectDocument_createdByIdToUser: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        User_ProjectDocument_approvedByIdToUser: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        User_ProjectDocument_submittedByIdToUser: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        ProjectDocument: {
          select: {
            id: true,
            version: true,
            title: true,
          },
        },
        other_ProjectDocument: {
          select: {
            id: true,
            version: true,
            status: true,
            createdAt: true,
            User_ProjectDocument_createdByIdToUser: {
              select: {
                name: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: {
            version: 'desc',
          },
        },
        ProjectDocumentActivity: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 20,
        },
      },
    })

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    return NextResponse.json(document)
  } catch (error) {
    console.error("Error fetching project document:", error)
    return NextResponse.json(
      { error: "Failed to fetch project document" },
      { status: 500 }
    )
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string; docId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const document = await prisma.projectDocument.findFirst({
      where: {
        id: params.docId,
        projectId: params.id,
        isActive: true,
      },
    })

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    // Check permissions
    const hasPermission = 
      ['SUPERADMIN', 'PROJECT_MANAGER', 'ADMIN'].includes(session.user.role as string) ||
      document.createdById === session.user.id

    if (!hasPermission) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const formData = await req.formData()
    const file = formData.get("file") as File | null

    // Get form fields
    const title = formData.get("title") as string || document.title
    const description = formData.get("description") as string || document.description
    const status = formData.get("status") as string || document.status
    const templateDataStr = formData.get("templateData") as string
    const rejectionReason = formData.get("rejectionReason") as string || null

    let templateData = document.templateData
    if (templateDataStr) {
      try {
        templateData = JSON.parse(templateDataStr)
      } catch {
        // Keep existing template data if parsing fails
      }
    }

    // Check if this is a content update to an approved document that should create new version
    const isContentUpdate = title !== document.title || 
                            description !== document.description || 
                            (file && file.size > 0) ||
                            (templateDataStr && templateDataStr !== JSON.stringify(document.templateData))
    
    const shouldCreateNewVersion = isContentUpdate && document.status === 'APPROVED'

    if (shouldCreateNewVersion) {
      // Create a new version instead of updating the existing one
      const newVersion = document.version + 1
      
      // Mark all existing versions as not latest
      await prisma.projectDocument.updateMany({
        where: {
          projectId: params.id,
          documentType: document.documentType,
        },
        data: { isLatestVersion: false },
      })

      // Handle file upload for new version
      let cloudStoragePath = null
      let filename = null
      let originalName = null
      let mimetype = null
      let size = null

      if (file && file.size > 0) {
        const buffer = Buffer.from(await file.arrayBuffer())
        cloudStoragePath = await uploadFile(buffer, file.name)
        filename = file.name
        originalName = file.name
        mimetype = file.type
        size = file.size
      }

      // Generate document number for new version
      const project = await prisma.project.findUnique({
        where: { id: params.id },
        select: { projectNumber: true }
      })
      
      if (!project) {
        throw new Error('Project not found')
      }

      // Get next sequence number
      const typeCode = DOCUMENT_TYPE_CODES[document.documentType]
      const prefix = `${project.projectNumber}/${typeCode}/`
      
      const existingDocuments = await prisma.projectDocument.findMany({
        where: {
          projectId: params.id,
          documentType: document.documentType,
          documentNumber: {
            not: ""
          }
        },
        select: {
          documentNumber: true
        }
      })
      
      let maxSequence = 0
      for (const doc of existingDocuments) {
        if (doc.documentNumber && doc.documentNumber.startsWith(prefix)) {
          const parts = doc.documentNumber.split('/')
          if (parts.length === 3) {
            const sequence = parseInt(parts[2], 10)
            if (!isNaN(sequence) && sequence > maxSequence) {
              maxSequence = sequence
            }
          }
        }
      }
      
      const sequenceNumber = maxSequence + 1
      const documentNumber = generateDocumentNumber(project.projectNumber, document.documentType, sequenceNumber)

      // Create new version
      const newDocument = await prisma.projectDocument.create({
        data: {
          id: uuidv4(),
          projectId: params.id,
          documentNumber,
          documentType: document.documentType,
          title,
          description,
          category: document.category,
          version: newVersion,
          cloudStoragePath,
          filename,
          originalName,
          mimetype,
          size,
          templateType: document.templateType,
          templateData: templateData as any,
          requiresApproval: document.requiresApproval,
          parentDocumentId: document.parentDocumentId || document.id,
          createdById: session.user.id,
          isLatestVersion: true,
          status: 'DRAFT', // New version starts as draft
          updatedAt: new Date(),
        },
        include: {
          User_ProjectDocument_createdByIdToUser: {
            select: {
              id: true,
              name: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      })

      // Log activity
      await prisma.projectDocumentActivity.create({
        data: {
          id: uuidv4(),
          documentId: newDocument.id,
          action: "CREATE_VERSION",
          description: `New version ${newVersion} created for "${title}"`,
          userId: session.user.id,
          userEmail: session.user.email!,
        },
      })

      return NextResponse.json(newDocument)
    }

    // Regular update (status changes, minor edits to draft documents)
    let updateData: any = {
      title,
      description,
      status: status as any,
      templateData: templateData as any,
      updatedAt: new Date(),
    }

    // Handle approval/rejection
    if (status === 'APPROVED') {
      updateData.approvedById = session.user.id
      updateData.approvedAt = new Date()
      updateData.rejectedAt = null
      updateData.rejectionReason = null
    } else if (status === 'REJECTED') {
      updateData.rejectedAt = new Date()
      updateData.rejectionReason = rejectionReason
      updateData.approvedAt = null
      updateData.approvedById = null
    } else if (status === 'SUBMITTED') {
      updateData.submittedById = session.user.id
      updateData.submittedAt = new Date()
    }

    if (file && file.size > 0) {
      // Delete old file if exists
      if (document.cloudStoragePath) {
        try {
          await deleteFile(document.cloudStoragePath)
        } catch (error) {
          console.error("Error deleting old file:", error)
        }
      }

      // Upload new file
      const buffer = Buffer.from(await file.arrayBuffer())
      const cloudStoragePath = await uploadFile(buffer, file.name)
      
      updateData = {
        ...updateData,
        cloudStoragePath,
        filename: file.name,
        originalName: file.name,
        mimetype: file.type,
        size: file.size,
      }
    }

    const updatedDocument = await prisma.projectDocument.update({
      where: { id: params.docId },
      data: updateData,
      include: {
        User_ProjectDocument_createdByIdToUser: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        User_ProjectDocument_approvedByIdToUser: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    })

    // Log activity
    await prisma.projectDocumentActivity.create({
      data: {
        id: uuidv4(),
        documentId: params.docId,
        action: "UPDATE",
        description: `Document "${title}" updated`,
        oldValue: document.status,
        newValue: status,
        userId: session.user.id,
        userEmail: session.user.email!,
      },
    })

    return NextResponse.json(updatedDocument)
  } catch (error) {
    console.error("Error updating project document:", error)
    return NextResponse.json(
      { error: "Failed to update project document" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; docId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const document = await prisma.projectDocument.findFirst({
      where: {
        id: params.docId,
        projectId: params.id,
        isActive: true,
      },
    })

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    // Check permissions
    const isSuperAdmin = session.user.role === 'SUPERADMIN'
    const hasBasicPermission = 
      ['SUPERADMIN', 'PROJECT_MANAGER', 'ADMIN'].includes(session.user.role as string) ||
      document.createdById === session.user.id

    if (!hasBasicPermission) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    // Superadmins can delete any document, others can only delete draft documents
    if (!isSuperAdmin && document.status !== 'DRAFT') {
      return NextResponse.json(
        { error: "Only draft documents can be deleted. Contact a superadmin to delete approved/submitted documents." },
        { status: 400 }
      )
    }

    // Soft delete the document
    await prisma.projectDocument.update({
      where: { id: params.docId },
      data: { 
        isActive: false,
        isLatestVersion: false,
      },
    })

    // If this was the latest version, find and mark the previous version as latest
    if (document.isLatestVersion && document.parentDocumentId) {
      const previousVersion = await prisma.projectDocument.findFirst({
        where: {
          OR: [
            { id: document.parentDocumentId },
            { parentDocumentId: document.parentDocumentId }
          ],
          projectId: params.id,
          documentType: document.documentType,
          isActive: true,
          version: { lt: document.version }
        },
        orderBy: { version: 'desc' },
      })

      if (previousVersion) {
        await prisma.projectDocument.update({
          where: { id: previousVersion.id },
          data: { isLatestVersion: true },
        })
      }
    }

    // Delete file from S3 if exists
    if (document.cloudStoragePath) {
      try {
        await deleteFile(document.cloudStoragePath)
      } catch (error) {
        console.error("Error deleting file from S3:", error)
        // Don't fail the entire operation if file deletion fails
      }
    }

    // Log activity
    await prisma.projectDocumentActivity.create({
      data: {
        id: uuidv4(),
        documentId: params.docId,
        action: "DELETE",
        description: `Document "${document.title}" deleted`,
        userId: session.user.id,
        userEmail: session.user.email!,
      },
    })

    return NextResponse.json({ message: "Document deleted successfully" })
  } catch (error) {
    console.error("Error deleting project document:", error)
    return NextResponse.json(
      { error: "Failed to delete project document" },
      { status: 500 }
    )
  }
}
