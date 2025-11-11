
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { generatePDFFromTemplate, generateSimpleDocumentPDF } from '@/lib/pdf-generator'
import { getTemplateByType } from '@/lib/document-templates'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = params

    // Fetch document from database
    const document = await prisma.projectDocument.findUnique({
      where: { id },
      include: {
        Project: {
          include: {
            Customer: true
          }
        },
        User_ProjectDocument_createdByIdToUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    })

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      )
    }

    // Generate PDF based on document type
    let pdfBuffer: Buffer

    if (document.templateType && document.templateData) {
      // Generate from template with standardized letterhead
      const template = getTemplateByType(document.documentType)
      
      if (!template) {
        return NextResponse.json(
          { error: 'Template not found' },
          { status: 404 }
        )
      }

      const projectInfo = {
        projectName: document.Project.name,
        projectNumber: document.Project.projectNumber,
        clientName: document.Project.Customer.name,
        location: document.Project.description || undefined,
        startDate: document.Project.startDate?.toISOString() || undefined,
        endDate: document.Project.endDate?.toISOString() || undefined
      }

      // Cast templateData to Record<string, any> for type compatibility
      const templateData = (typeof document.templateData === 'object' && document.templateData !== null && !Array.isArray(document.templateData))
        ? document.templateData as Record<string, any>
        : {}

      pdfBuffer = await generatePDFFromTemplate(
        template,
        templateData,
        projectInfo,
        document.title
      )
    } else {
      // Generate simple document with standardized letterhead
      const projectInfo = {
        projectName: document.Project.name,
        projectNumber: document.Project.projectNumber,
        clientName: document.Project.Customer.name,
        location: document.Project.description || undefined,
        startDate: document.Project.startDate?.toISOString() || undefined,
        endDate: document.Project.endDate?.toISOString() || undefined
      }

      const content = document.description || 'No content available'
      pdfBuffer = await generateSimpleDocumentPDF(
        document.title,
        content,
        projectInfo
      )
    }

    // Return PDF with appropriate headers
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${document.documentNumber || document.title}.pdf"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  } catch (error) {
    console.error('Error generating PDF preview:', error)
    return NextResponse.json(
      { 
        error: 'Failed to generate PDF preview',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
