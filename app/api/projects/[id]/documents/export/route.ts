
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { downloadFile } from "@/lib/s3"
import JSZip from "jszip"

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { packageType, documentIds } = await req.json()

    if (!packageType || !documentIds?.length) {
      return NextResponse.json(
        { error: "Package type and document IDs are required" },
        { status: 400 }
      )
    }

    // Verify project exists
    const project = await prisma.project.findFirst({
      where: {
        id: params.id,
        isActive: true,
      },
      include: {
        Customer: true,
      },
    })

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    // Get documents
    const documents = await prisma.projectDocument.findMany({
      where: {
        id: { in: documentIds },
        projectId: params.id,
        isActive: true,
        status: 'APPROVED', // Only include approved documents in export
      },
      include: {
        User_ProjectDocument_createdByIdToUser: {
          select: {
            name: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    })

    if (!documents.length) {
      return NextResponse.json(
        { error: "No approved documents found for export" },
        { status: 400 }
      )
    }

    // Create ZIP file
    const zip = new JSZip()
    const packageFolder = zip.folder(`${packageType}_Package_${project.name.replace(/[^a-zA-Z0-9]/g, '_')}`)

    // Add documents to ZIP
    for (const doc of documents) {
      if (doc.cloudStoragePath) {
        try {
          const downloadUrl = await downloadFile(doc.cloudStoragePath)
          const response = await fetch(downloadUrl)
          const buffer = await response.arrayBuffer()
          
          const filename = doc.originalName || doc.filename || `${doc.title}.pdf`
          const categoryFolder = packageFolder?.folder(doc.category)
          categoryFolder?.file(filename, buffer)
        } catch (error) {
          console.error(`Error downloading file for document ${doc.id}:`, error)
          // Continue with other files
        }
      }
    }

    // Add package summary
    const summary = {
      packageType,
      projectName: project.name,
      projectNumber: project.projectNumber,
      clientName: project.Customer.name,
      generatedAt: new Date().toISOString(),
      generatedBy: session.user?.name || session.user?.email,
      documents: documents.map((doc: any) => ({
        title: doc.title,
        type: doc.documentType,
        category: doc.category,
        version: doc.version,
        status: doc.status,
        User_ProjectDocument_createdByIdToUser: doc.createdBy?.name || `${doc.createdBy?.firstName} ${doc.createdBy?.lastName}`.trim(),
        createdAt: doc.createdAt,
      })),
    }

    packageFolder?.file('Package_Summary.json', JSON.stringify(summary, null, 2))

    // Generate ZIP buffer
    const zipBuffer = await zip.generateAsync({ type: 'arraybuffer' })

    // Return ZIP file
    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${packageType}_Package_${project.name.replace(/[^a-zA-Z0-9]/g, '_')}.zip"`,
      },
    })
  } catch (error) {
    console.error("Error creating document package:", error)
    return NextResponse.json(
      { error: "Failed to create document package" },
      { status: 500 }
    )
  }
}
