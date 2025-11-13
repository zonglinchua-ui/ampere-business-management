/**
 * API Endpoint: Process Progress Claim and Prepare Invoice
 * 
 * POST /api/ai-assistant/process-progress-claim
 * 
 * Extracts data from a progress claim/certification document and prepares an invoice
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getFileBuffer } from '@/lib/s3'
import { extractProgressClaimData } from '@/lib/ai-document-extraction'
import { createAuditLog } from '@/lib/api-audit-context'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = session?.user?.role
    const canProcess = ["SUPERADMIN", "ADMIN", "PROJECT_MANAGER", "FINANCE"].includes(userRole || "")
    
    if (!canProcess) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const { documentId, extractedData, projectId, createInvoice } = body

    // Step 1: If no extracted data provided, extract from document
    let claimData = extractedData
    
    if (!claimData && documentId) {
      console.log(`[Process Progress Claim] Extracting data from document: ${documentId}`)
      
      const document = await prisma.document.findUnique({
        where: { id: documentId }
      })

      if (!document) {
        return NextResponse.json({ error: 'Document not found' }, { status: 404 })
      }

      // Get file from S3 and extract data
      const fileBuffer = await getFileBuffer(document.cloudStoragePath)
      claimData = await extractProgressClaimData(fileBuffer, document.filename, document.mimetype)
      
      console.log(`[Process Progress Claim] Extraction complete. Confidence: ${claimData.confidence}`)
      
      // Try to find matching project
      let suggestedProject = null
      if (claimData.projectReference) {
        suggestedProject = await prisma.project.findFirst({
          where: {
            OR: [
              { projectNumber: { contains: claimData.projectReference, mode: 'insensitive' } },
              { poNumber: { contains: claimData.projectReference, mode: 'insensitive' } },
              { name: { contains: claimData.projectReference, mode: 'insensitive' } }
            ],
            isActive: true
          },
          include: {
            Customer: true
          }
        })
      }

      // Return extracted data for review
      return NextResponse.json({
        success: true,
        extractedData: claimData,
        suggestedProject: suggestedProject ? {
          id: suggestedProject.id,
          projectNumber: suggestedProject.projectNumber,
          name: suggestedProject.name,
          customer: suggestedProject.Customer?.name
        } : null,
        message: 'Progress claim data extracted successfully. Please review and confirm.'
      })
    }

    // Step 2: If createInvoice flag is true, create the progress claim invoice
    if (createInvoice && claimData) {
      console.log(`[Process Progress Claim] Creating progress claim: ${claimData.claimNumber}`)
      
      // Verify project exists
      if (!projectId) {
        return NextResponse.json({ error: 'Project ID is required' }, { status: 400 })
      }

      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: { 
          Customer: true,
          ProgressClaims: {
            orderBy: { claimNumber: 'desc' },
            take: 1
          }
        }
      })

      if (!project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 })
      }

      // Generate claim number if not provided
      let claimNumber = claimData.claimNumber
      if (!claimNumber || claimNumber === 'N/A') {
        const lastClaim = project.ProgressClaims[0]
        const nextClaimNum = lastClaim ? parseInt(lastClaim.claimNumber) + 1 : 1
        claimNumber = nextClaimNum.toString()
      }

      // Calculate amounts
      const subtotal = claimData.currentClaimAmount
      const retentionAmount = claimData.retentionAmount || (subtotal * (claimData.retentionPercentage || 0) / 100)
      const gstAmount = claimData.gstAmount || ((subtotal - retentionAmount) * 0.09) // 9% GST
      const totalAmount = claimData.netAmount || (subtotal - retentionAmount + gstAmount)

      // Create progress claim
      const progressClaim = await prisma.progressClaim.create({
        data: {
          projectId: project.id,
          claimNumber: claimNumber,
          claimDate: claimData.claimDate ? new Date(claimData.claimDate) : new Date(),
          periodFrom: claimData.claimPeriod?.from ? new Date(claimData.claimPeriod.from) : null,
          periodTo: claimData.claimPeriod?.to ? new Date(claimData.claimPeriod.to) : null,
          previousClaimedAmount: claimData.previousClaimedTotal || 0,
          currentClaimAmount: claimData.currentClaimAmount,
          totalClaimedToDate: claimData.totalClaimedToDate || (claimData.previousClaimedTotal || 0) + claimData.currentClaimAmount,
          retentionPercentage: claimData.retentionPercentage || 10,
          retentionAmount: retentionAmount,
          gstAmount: gstAmount,
          totalAmount: totalAmount,
          status: 'DRAFT',
          certifiedBy: claimData.certifiedBy || '',
          certificationDate: claimData.certificationDate ? new Date(claimData.certificationDate) : null,
          remarks: `Processed from ${documentId ? 'uploaded document' : 'AI extraction'}`
        }
      })

      console.log(`[Process Progress Claim] Progress claim created: Claim #${progressClaim.claimNumber}`)

      // Create work items
      if (claimData.workItems && claimData.workItems.length > 0) {
        const workItemsData = claimData.workItems.map((item, index) => ({
          progressClaimId: progressClaim.id,
          itemNumber: (index + 1).toString(),
          description: item.description,
          previousClaimed: item.previousClaimed || 0,
          currentClaim: item.currentClaim,
          totalToDate: item.totalToDate || (item.previousClaimed || 0) + item.currentClaim,
          percentComplete: item.percentComplete || 0
        }))

        await prisma.progressClaimItem.createMany({
          data: workItemsData
        })

        console.log(`[Process Progress Claim] Created ${workItemsData.length} work items`)
      }

      // Link document to project and progress claim
      if (documentId) {
        await prisma.document.update({
          where: { id: documentId },
          data: {
            projectId: project.id,
            category: 'CERTIFICATE',
            description: `Progress Claim ${claimNumber} - ${claimData.projectName || project.name}`
          }
        })
        console.log(`[Process Progress Claim] Document linked to project`)
      }

      // Create audit log
      await createAuditLog({
        userId: session.user.id,
        userEmail: session.user.email || '',
        action: 'CREATE',
        entityType: 'PROGRESS_CLAIM',
        entityId: progressClaim.id,
        entityName: `Progress Claim #${progressClaim.claimNumber}`,
        newValues: {
          project: project.projectNumber,
          claimNumber: progressClaim.claimNumber,
          currentClaimAmount: progressClaim.currentClaimAmount,
          totalAmount: progressClaim.totalAmount,
          source: 'AI_ASSISTANT_PROGRESS_CLAIM_PROCESSING'
        }
      })

      return NextResponse.json({
        success: true,
        progressClaim: {
          id: progressClaim.id,
          claimNumber: progressClaim.claimNumber,
          project: {
            projectNumber: project.projectNumber,
            name: project.name,
            customer: project.Customer?.name
          },
          currentClaimAmount: progressClaim.currentClaimAmount,
          retentionAmount: progressClaim.retentionAmount,
          gstAmount: progressClaim.gstAmount,
          totalAmount: progressClaim.totalAmount,
          status: progressClaim.status
        },
        message: `Progress Claim #${progressClaim.claimNumber} created for project ${project.projectNumber}`
      })
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  } catch (error: any) {
    console.error('[Process Progress Claim] Error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to process progress claim',
        details: error.message 
      },
      { status: 500 }
    )
  }
}
