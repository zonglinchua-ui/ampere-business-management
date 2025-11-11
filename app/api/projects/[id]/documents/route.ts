import { v4 as uuidv4 } from 'uuid'

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { uploadFile } from "@/lib/s3"
import { z } from "zod"
import { ProjectDocumentType, ProjectDocumentCategory, TemplateType } from "@prisma/client"
import { getTemplateByType } from "@/lib/document-templates"
import { generatePDFFromTemplate, generateSimpleDocumentPDF } from "@/lib/pdf-generator"
import { generateDocumentNumber, DOCUMENT_TYPE_CODES } from "@/lib/document-numbering"

const createDocumentSchema = z.object({
  documentType: z.string(),
  title: z.string().min(1),
  description: z.string().optional(),
  templateType: z.string().optional(),
  templateData: z.record(z.any()).optional(),
  requiresApproval: z.boolean().default(false),
})

// Function to get the next sequence number for a document type in a project
async function getNextDocumentSequence(projectId: string, documentType: ProjectDocumentType): Promise<number> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { projectNumber: true }
  })
  
  if (!project) {
    throw new Error('Project not found')
  }
  
  const typeCode = DOCUMENT_TYPE_CODES[documentType]
  const prefix = `${project.projectNumber}/${typeCode}/`
  
  // Find all documents for this project and document type
  const existingDocuments = await prisma.projectDocument.findMany({
    where: {
      projectId,
      documentType,
      documentNumber: {
        not: ""
      }
    },
    select: {
      documentNumber: true
    }
  })
  
  // Extract sequence numbers and find the highest
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
  
  return maxSequence + 1
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const category = searchParams.get('category')
    const status = searchParams.get('status')
    const documentType = searchParams.get('type')

    const where: any = {
      projectId: params.id,
      isActive: true,
    }

    if (category) where.category = category
    if (status) where.status = status
    if (documentType) where.documentType = documentType

    const documents = await prisma.projectDocument.findMany({
      where,
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
      },
      orderBy: [
        { category: 'asc' },
        { documentType: 'asc' },
        { version: 'desc' },
      ],
    })

    // Group by document type and only return latest versions
    const latestDocuments = documents.filter(doc => doc.isLatestVersion)

    return NextResponse.json(latestDocuments)
  } catch (error) {
    console.error("Error fetching project documents:", error)
    return NextResponse.json(
      { error: "Failed to fetch project documents" },
      { status: 500 }
    )
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has permission to create documents
    const hasPermission = ['SUPERADMIN', 'PROJECT_MANAGER', 'ADMIN'].includes(session.user.role as string)
    if (!hasPermission) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    // Verify project exists and user has access
    const project = await prisma.project.findFirst({
      where: {
        id: params.id,
        isActive: true,
      },
    })

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    const formData = await req.formData()
    const file = formData.get("file") as File | null
    
    // Handle photo uploads
    const photoDescriptions = formData.get("photoDescriptions") as string || "[]"
    const photoCount = parseInt(formData.get("photoCount") as string || "0")
    const hasPhotos = formData.get("hasPhotos") === "true"
    
    const photoFiles: File[] = []
    for (let i = 0; i < photoCount; i++) {
      const photoFile = formData.get(`photo_${i}`) as File | null
      if (photoFile) {
        photoFiles.push(photoFile)
      }
    }
    
    // Get form fields
    const documentType = formData.get("documentType") as string
    const title = formData.get("title") as string
    const description = formData.get("description") as string || ""
    const templateType = formData.get("templateType") as string || null
    const templateDataStr = formData.get("templateData") as string || "{}"
    const requiresApproval = formData.get("requiresApproval") === "true"

    // Validate required fields
    if (!documentType || !title) {
      return NextResponse.json(
        { error: "Document type and title are required" },
        { status: 400 }
      )
    }

    // Validate enum values
    const validDocumentTypes = Object.values(ProjectDocumentType)
    if (!validDocumentTypes.includes(documentType as ProjectDocumentType)) {
      return NextResponse.json(
        { error: `Invalid document type: ${documentType}. Valid types: ${validDocumentTypes.join(', ')}` },
        { status: 400 }
      )
    }

    if (templateType && !Object.values(TemplateType).includes(templateType as TemplateType)) {
      return NextResponse.json(
        { error: `Invalid template type: ${templateType}` },
        { status: 400 }
      )
    }

    let templateData = {}
    try {
      if (templateDataStr && templateDataStr.trim() !== '') {
        // Check if the string looks like valid JSON
        if (templateDataStr.trim().startsWith('{') || templateDataStr.trim().startsWith('[')) {
          templateData = JSON.parse(templateDataStr)
        } else {
          console.warn('Invalid JSON format received:', templateDataStr)
          templateData = {}
        }
      }
    } catch (error) {
      console.error('Error parsing template data JSON:', error)
      console.error('Template data string:', templateDataStr)
      // Invalid JSON, use empty object
      templateData = {}
    }

    // Determine category based on document type
    const getCategoryForType = (type: string): ProjectDocumentCategory => {
      const preConstructionTypes = [
        'PRE_CONSTRUCTION_SURVEY', 'SITE_SAFETY_PLAN', 'RISK_ASSESSMENT', 'WORK_METHOD_STATEMENT',
        'PERMIT_TO_WORK', 'HOT_WORK_PERMIT', 'LIFTING_PERMIT', 'CONFINED_SPACE_PERMIT', 'WORKER_LIST'
      ]
      const constructionTypes = [
        'DAILY_SITE_REPORT', 'INSPECTION_TEST_PLAN', 'QUALITY_CHECKLIST', 'MATERIAL_DELIVERY_NOTE',
        'PROGRESS_PHOTOS', 'VARIATION_ORDER', 'INCIDENT_REPORT', 'ACCIDENT_REPORT', 'TOOLBOX_MEETING'
      ]
      const handoverTypes = [
        'OPERATION_MAINTENANCE_MANUAL', 'TESTING_COMMISSIONING_REPORT', 'AS_BUILT_DRAWINGS',
        'HANDOVER_FORM', 'DEFECT_LIABILITY_REPORT', 'NON_CONFORMANCE_REPORT'
      ]
      const postCompletionTypes = [
        'FINAL_COMPLETION_CERTIFICATE', 'WARRANTY_CERTIFICATE', 'SERVICE_AGREEMENT'
      ]

      if (preConstructionTypes.includes(type)) return ProjectDocumentCategory.PRE_CONSTRUCTION
      if (constructionTypes.includes(type)) return ProjectDocumentCategory.CONSTRUCTION
      if (handoverTypes.includes(type)) return ProjectDocumentCategory.HANDOVER_COMPLETION
      if (postCompletionTypes.includes(type)) return ProjectDocumentCategory.POST_COMPLETION
      return ProjectDocumentCategory.CONSTRUCTION
    }

    const category = getCategoryForType(documentType)

    // Check if document type already exists (for versioning)
    const existingDocuments = await prisma.projectDocument.findMany({
      where: {
        projectId: params.id,
        documentType: documentType as ProjectDocumentType,
      },
      orderBy: {
        version: 'desc'
      }
    })

    let version = 1
    let parentDocumentId = null

    if (existingDocuments.length > 0) {
      // This is a new version
      const latestDocument = existingDocuments[0]
      version = latestDocument.version + 1
      parentDocumentId = latestDocument.parentDocumentId || latestDocument.id
      
      // Mark all existing documents as not latest version
      await prisma.projectDocument.updateMany({
        where: {
          projectId: params.id,
          documentType: documentType as ProjectDocumentType,
        },
        data: { isLatestVersion: false },
      })
    }

    // Handle file upload, photo uploads, or PDF generation
    let cloudStoragePath = null
    let filename = null
    let originalName = null
    let mimetype = null
    let size = null
    let parsedPhotoDescriptions = []

    // Parse photo descriptions
    try {
      parsedPhotoDescriptions = JSON.parse(photoDescriptions)
    } catch (error) {
      console.error('Error parsing photo descriptions:', error)
      parsedPhotoDescriptions = []
    }

    if (photoFiles.length > 0) {
      // Handle multiple photo uploads
      const uploadedPhotos = []
      
      for (let i = 0; i < photoFiles.length; i++) {
        const photoFile = photoFiles[i]
        const buffer = Buffer.from(await photoFile.arrayBuffer())
        const photoKey = await uploadFile(buffer, photoFile.name)
        
        uploadedPhotos.push({
          cloudStoragePath: photoKey,
          filename: photoFile.name,
          originalName: photoFile.name,
          mimetype: photoFile.type,
          size: photoFile.size,
          description: parsedPhotoDescriptions[i] || {}
        })
      }

      // Store the first photo as the main file for backward compatibility
      if (uploadedPhotos.length > 0) {
        cloudStoragePath = uploadedPhotos[0].cloudStoragePath
        filename = uploadedPhotos[0].filename
        originalName = uploadedPhotos[0].originalName
        mimetype = uploadedPhotos[0].mimetype
        size = uploadedPhotos[0].size
      }

      // Update photo descriptions with S3 paths
      parsedPhotoDescriptions = uploadedPhotos.map(photo => ({
        ...photo.description,
        cloudStoragePath: photo.cloudStoragePath,
        filename: photo.filename,
        originalName: photo.originalName,
        mimetype: photo.mimetype,
        size: photo.size
      }))
    } else if (file && file.size > 0) {
      // User uploaded a single file
      const buffer = Buffer.from(await file.arrayBuffer())
      cloudStoragePath = await uploadFile(buffer, file.name)
      filename = file.name
      originalName = file.name
      mimetype = file.type
      size = file.size
    } else if (templateType && Object.keys(templateData).length > 0) {
      // Generate PDF from template data
      try {
        const template = getTemplateByType(templateType as ProjectDocumentType)
        if (template) {
          const projectInfo = {
            projectName: project.name,
            projectNumber: project.projectNumber,
            clientName: '', // Will be fetched below
            location: project.description || '',
            startDate: project.startDate ? new Date(project.startDate).toLocaleDateString() : '',
            endDate: project.endDate ? new Date(project.endDate).toLocaleDateString() : '',
          }

          // Fetch client information
          const clientInfo = await prisma.customer.findUnique({
            where: { id: project.customerId },
            select: { name: true }
          })
          
          if (clientInfo) {
            projectInfo.clientName = clientInfo.name
          }

          const pdfBuffer = await generatePDFFromTemplate(template, templateData, projectInfo, title)
          
          const pdfFilename = `${title.replace(/[^a-zA-Z0-9]/g, '_')}_v${version}.pdf`
          cloudStoragePath = await uploadFile(pdfBuffer, pdfFilename)
          filename = pdfFilename
          originalName = pdfFilename
          mimetype = 'application/pdf'
          size = pdfBuffer.length
        }
      } catch (pdfError) {
        console.error('Error generating PDF:', pdfError)
        // Continue without PDF if generation fails
      }
    } else if (!file && (!templateType || Object.keys(templateData).length === 0)) {
      // Generate simple PDF for non-template documents
      try {
        const projectInfo = {
          projectName: project.name,
          projectNumber: project.projectNumber,
          clientName: '',
          location: project.description || '',
        }

        // Fetch client information
        const clientInfo = await prisma.customer.findUnique({
          where: { id: project.customerId },
          select: { name: true }
        })
        
        if (clientInfo) {
          projectInfo.clientName = clientInfo.name
        }

        const content = description || 'This document was created without specific content.'
        const pdfBuffer = await generateSimpleDocumentPDF(title, content, projectInfo)
        
        const pdfFilename = `${title.replace(/[^a-zA-Z0-9]/g, '_')}_v${version}.pdf`
        cloudStoragePath = await uploadFile(pdfBuffer, pdfFilename)
        filename = pdfFilename
        originalName = pdfFilename
        mimetype = 'application/pdf'
        size = pdfBuffer.length
      } catch (pdfError) {
        console.error('Error generating simple PDF:', pdfError)
        // Continue without PDF if generation fails
      }
    }

    // Generate document number
    const sequenceNumber = await getNextDocumentSequence(params.id, documentType as ProjectDocumentType)
    const documentNumber = generateDocumentNumber(project.projectNumber, documentType as ProjectDocumentType, sequenceNumber)

    // Create new document record
    const document = await prisma.projectDocument.create({
      data: {
        id: uuidv4(),
        projectId: params.id,
        documentNumber,
        documentType: documentType as ProjectDocumentType,
        title,
        description,
        category: category as ProjectDocumentCategory,
        version,
        cloudStoragePath,
        filename,
        originalName,
        mimetype,
        size,
        templateType: templateType ? templateType as TemplateType : null,
        templateData,
        requiresApproval,
        parentDocumentId,
        createdById: session.user.id,
        isLatestVersion: true,
        updatedAt: new Date(),
        // Photo analysis fields
        photoDescriptions: parsedPhotoDescriptions.length > 0 ? parsedPhotoDescriptions : null,
        photoCount: photoFiles.length,
        hasPhotos: photoFiles.length > 0,
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
        documentId: document.id,
        action: "CREATE",
        description: `Document "${title}" created`,
        userId: session.user.id,
        userEmail: session.user.email!,
      },
    })

    return NextResponse.json(document, { status: 201 })
  } catch (error: any) {
    console.error("Error creating project document:", error)
    console.error("Error details:", error.message, error.stack)
    
    // More specific error handling
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: "A document with this type already exists for this project" },
        { status: 409 }
      )
    }
    
    return NextResponse.json(
      { 
        error: "Failed to create project document",
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    )
  }
}
