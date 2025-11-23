import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { existsSync } from "fs"
import { mkdir, writeFile } from "fs/promises"
import { join } from "path"
import { classifyProcurementDocument, extractDocumentData } from "@/lib/extraction-processor"
import { createProjectFromPurchaseOrder } from "@/lib/procurement-automation"

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const notes = (formData.get("notes") as string) || undefined

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const nasBasePath = process.env.NAS_BASE_PATH || "\\\\Czl-home\\ampere\\AMPERE WEB SERVER"
    const intakeFolder = join(nasBasePath, "procurement", "ingest")

    if (!existsSync(intakeFolder)) {
      await mkdir(intakeFolder, { recursive: true })
    }

    const intakeFileName = `${Date.now()}_${file.name}`
    const intakePath = join(intakeFolder, intakeFileName)
    await writeFile(intakePath, buffer)

    const classification = await classifyProcurementDocument(intakePath, file.type, file.name)
    if (!classification.documentType.includes("PO")) {
      return NextResponse.json({
        error: "Only purchase orders can be auto-ingested",
        classification,
      }, { status: 422 })
    }
    const extraction = await extractDocumentData(intakePath, file.type, classification.documentType, "New Intake")

    const autoCreated = await createProjectFromPurchaseOrder({
      extractedData: extraction.data,
      extractionConfidence: extraction.confidence,
      uploadedFilePath: intakePath,
      uploadedFileName: file.name,
      mimeType: file.type,
      fileSize: file.size,
      notes,
      uploadedById: (session.user as any).id,
      classificationType: classification.documentType as any,
    })

    return NextResponse.json({
      success: true,
      project: autoCreated.project,
      customer: autoCreated.customer,
      document: autoCreated.document,
      extraction: {
        classification,
        confidence: extraction.confidence,
      }
    })
  } catch (error) {
    console.error("[Ingest] Failed to auto-process purchase order", error)
    return NextResponse.json(
      { error: "Failed to ingest procurement document", details: (error as Error).message },
      { status: 500 }
    )
  }
}

