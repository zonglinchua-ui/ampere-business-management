
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { downloadFile } from "@/lib/s3"

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
    })

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    if (!document.cloudStoragePath) {
      return NextResponse.json({ error: "No file attached to this document" }, { status: 400 })
    }

    // Generate signed URL for download
    const downloadUrl = await downloadFile(document.cloudStoragePath)

    return NextResponse.json({ 
      downloadUrl,
      filename: document.originalName || document.filename,
      mimetype: document.mimetype,
      size: document.size 
    })
  } catch (error) {
    console.error("Error generating download URL:", error)
    return NextResponse.json(
      { error: "Failed to generate download URL" },
      { status: 500 }
    )
  }
}
