/**
 * API Endpoint: Process Purchase Order and Create Project
 * 
 * POST /api/ai-assistant/process-po
 * 
 * Extracts data from a PO document and creates a new project
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getFileBuffer } from '@/lib/s3'
import { extractPurchaseOrderData, autoExtractDocumentData } from '@/lib/ai-document-extraction'
import { createProjectFolders } from '@/lib/project-folder-service'
import { createAuditLog } from '@/lib/api-audit-context'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = session?.user?.role
    const canProcess = ["SUPERADMIN", "ADMIN", "PROJECT_MANAGER"].includes(userRole || "")
    
    if (!canProcess) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const { documentId, extractedData, createProject } = body

    // Step 1: If no extracted data provided, extract from document
    let poData = extractedData
    
    if (!poData && documentId) {
      console.log(`[Process PO] Extracting data from document: ${documentId}`)
      
      const document = await prisma.document.findUnique({
        where: { id: documentId }
      })

      if (!document) {
        return NextResponse.json({ error: 'Document not found' }, { status: 404 })
      }

      // Get file from S3 and extract data
      const fileBuffer = await getFileBuffer(document.cloudStoragePath)
      poData = await extractPurchaseOrderData(fileBuffer, document.filename, document.mimetype)
      
      console.log(`[Process PO] Extraction complete. Confidence: ${poData.confidence}`)
      
      // Return extracted data for review
      return NextResponse.json({
        success: true,
        extractedData: poData,
        message: 'PO data extracted successfully. Please review and confirm.'
      })
    }

    // Step 2: If createProject flag is true, create the project
    if (createProject && poData) {
      console.log(`[Process PO] Creating project from PO: ${poData.poNumber}`)
      
      // Find or create customer
      let customer = await prisma.customer.findFirst({
        where: {
          name: {
            contains: poData.customer.name,
            mode: 'insensitive'
          }
        }
      })

      if (!customer) {
        console.log(`[Process PO] Creating new customer: ${poData.customer.name}`)
        customer = await prisma.customer.create({
          data: {
            id: uuidv4(),
            customerNumber: `C-${Date.now()}`,
            name: poData.customer.name,
            email: poData.customer.email || null,
            phone: poData.customer.phone || null,
            address: poData.customer.address || null,
            contactPerson: poData.customer.contactPerson || null,
            customerType: 'ENTERPRISE',
            isActive: true,
            createdById: session.user.id,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        })
      }

      // Generate project number
      const currentYear = new Date().getFullYear()
      const lastProject = await prisma.project.findFirst({
        where: {
          projectType: 'REGULAR',
          projectNumber: {
            startsWith: `PRJ-${currentYear}-`
          }
        },
        orderBy: {
          projectNumber: 'desc'
        }
      })

      let nextNumber = 1
      if (lastProject) {
        const parts = lastProject.projectNumber.split('-')
        const lastNumber = parseInt(parts[2], 10)
        nextNumber = lastNumber + 1
      }

      const projectNumber = `PRJ-${currentYear}-${nextNumber.toString().padStart(3, '0')}`

      // Map work type
      const workTypeMapping: { [key: string]: string } = {
        'REINSTATEMENT': 'REINSTATEMENT',
        'MEP': 'MEP',
        'ELECTRICAL_ONLY': 'ELECTRICAL_ONLY',
        'ELECTRICAL': 'ELECTRICAL_ONLY',
        'PLUMBING': 'PLUMBING',
        'HVAC': 'HVAC',
        'CIVIL': 'CIVIL',
        'STRUCTURAL': 'STRUCTURAL'
      }

      const workType = workTypeMapping[poData.projectInfo.workType?.toUpperCase() || ''] || 'OTHER'

      // Create project
      const project = await prisma.project.create({
        data: {
          id: uuidv4(),
          projectNumber,
          name: poData.projectInfo.projectName,
          description: poData.projectInfo.projectDescription || `Project from PO ${poData.poNumber}`,
          projectType: 'REGULAR',
          workType: workType as any,
          status: 'PLANNING',
          customerId: customer.id,
          address: poData.projectInfo.location || null,
          startDate: poData.startDate ? new Date(poData.startDate) : null,
          endDate: poData.endDate ? new Date(poData.endDate) : null,
          contractValue: poData.totalAmount,
          createdById: session.user.id,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        include: {
          Customer: true
        }
      })

      console.log(`[Process PO] Project created: ${project.projectNumber} - ${project.name}`)

      // Create project folders on NAS (async, don't wait)
      createProjectFolders(project.projectNumber, project.name)
        .then(result => {
          if (result.success) {
            console.log(`[Process PO] ✅ Project folders created: ${result.path}`)
          } else {
            console.warn(`[Process PO] ⚠️ Project folder creation failed: ${result.error}`)
          }
        })
        .catch(error => {
          console.error('[Process PO] ❌ Project folder creation error:', error)
        })

      // Link document to project if documentId provided
      if (documentId) {
        await prisma.document.update({
          where: { id: documentId },
          data: {
            projectId: project.id,
            category: 'CONTRACT',
            description: `Purchase Order ${poData.poNumber}`
          }
        })
        console.log(`[Process PO] Document linked to project`)
      }

      // Create audit log
      await createAuditLog({
        userId: session.user.id,
        userEmail: session.user.email || '',
        action: 'CREATE',
        entityType: 'PROJECT',
        entityId: project.id,
        entityName: project.name,
        newValues: {
          projectNumber: project.projectNumber,
          name: project.name,
          customer: customer.name,
          poNumber: poData.poNumber,
          source: 'AI_ASSISTANT_PO_PROCESSING'
        }
      })

      return NextResponse.json({
        success: true,
        project: {
          id: project.id,
          projectNumber: project.projectNumber,
          name: project.name,
          customer: customer.name,
          contractValue: project.contractValue,
          status: project.status
        },
        message: `Project ${project.projectNumber} created successfully from PO ${poData.poNumber}`
      })
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  } catch (error: any) {
    console.error('[Process PO] Error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to process PO',
        details: error.message 
      },
      { status: 500 }
    )
  }
}
