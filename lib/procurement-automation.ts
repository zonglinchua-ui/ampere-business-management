import { Prisma, ProcurementDocumentStatus, ProcurementDocumentType } from "@prisma/client"
import { randomUUID } from "crypto"
import { mkdir, rename } from "fs/promises"
import { existsSync } from "fs"
import { join } from "path"
import { prisma } from "@/lib/db"
import { generateProjectNumber } from "@/lib/project-number"
import { ExtractedDocumentData } from "@/lib/extraction-processor"

function parseDate(value?: string | null) {
  if (!value) return null
  const date = new Date(value)
  return isNaN(date.getTime()) ? null : date
}

function inferProjectType(extractedData: ExtractedDocumentData): "REGULAR" | "MAINTENANCE" {
  const haystack = `${extractedData.paymentTerms || ""} ${extractedData.termsAndConditions || ""}`.toLowerCase()
  if (haystack.includes("maintenance") || haystack.includes("amc") || haystack.includes("preventive")) {
    return "MAINTENANCE"
  }
  return "REGULAR"
}

async function findOrCreateCustomer(name: string, userId: string) {
  const existing = await prisma.customer.findFirst({
    where: { name: { equals: name, mode: "insensitive" } }
  })

  if (existing) return existing

  return prisma.customer.create({
    data: {
      name,
      createdById: userId,
      isActive: true,
      country: "Singapore",
    }
  })
}

function decimalOrNull(value?: number | null) {
  if (value === undefined || value === null || Number.isNaN(value)) return null
  return new Prisma.Decimal(value)
}

async function persistLineItems(documentId: string, lineItems?: ExtractedDocumentData["lineItems"]) {
  if (!lineItems || lineItems.length === 0) return

  const prepared = lineItems.map((item, index) => ({
    documentId,
    lineNumber: index + 1,
    description: item.description || "Line item",
    quantity: decimalOrNull(item.quantity ?? 1),
    unitPrice: decimalOrNull(item.unitPrice ?? item.amount ?? 0),
    unit: item.unit,
    amount: decimalOrNull(
      item.amount ??
      (item.quantity !== undefined && item.unitPrice !== undefined
        ? item.quantity * item.unitPrice
        : 0)
    )!,
  }))

  await prisma.procurementDocumentLineItem.createMany({ data: prepared })
}

export async function createProjectFromPurchaseOrder(options: {
  extractedData: ExtractedDocumentData
  extractionConfidence: number
  uploadedFilePath: string
  uploadedFileName: string
  mimeType: string
  fileSize: number
  notes?: string
  uploadedById: string
  classificationType?: ProcurementDocumentType
}) {
  const customerName = options.extractedData.customerName || options.extractedData.supplierName || "Unknown Customer"
  const customer = await findOrCreateCustomer(customerName, options.uploadedById)
  const projectType = inferProjectType(options.extractedData)
  const projectNumber = await generateProjectNumber(projectType)

  const projectName =
    options.extractedData.projectName ||
    options.extractedData.projectReference ||
    `${customer.name} - ${options.extractedData.documentNumber || "PO"}`

  const project = await prisma.project.create({
    data: {
      id: randomUUID(),
      projectNumber,
      name: projectName,
      customerId: customer.id,
      createdById: options.uploadedById,
      status: "PLANNING",
      projectType,
      contractValue: decimalOrNull(options.extractedData.totalAmount),
      contractTaxAmount: decimalOrNull(options.extractedData.taxAmount),
      contractValueBeforeTax: decimalOrNull(options.extractedData.subtotalAmount),
      endDate: parseDate(options.extractedData.dueDate),
      description: options.notes || undefined,
    }
  })

  const nasBasePath = process.env.NAS_BASE_PATH || "\\\\Czl-home\\ampere\\AMPERE WEB SERVER"
  const projectFolder = join(nasBasePath, "projects", project.id, "procurement", "customer_pos")
  if (!existsSync(projectFolder)) {
    await mkdir(projectFolder, { recursive: true })
  }

  const storedFileName = `${Date.now()}_${options.uploadedFileName}`
  const storedPath = join(projectFolder, storedFileName)
  await rename(options.uploadedFilePath, storedPath)

  const document = await prisma.procurementDocument.create({
    data: {
      projectId: project.id,
      customerId: customer.id,
      documentType: options.classificationType || ProcurementDocumentType.CUSTOMER_PO,
      documentNumber: options.extractedData.documentNumber,
      documentDate: parseDate(options.extractedData.documentDate) ?? undefined,
      status: ProcurementDocumentStatus.EXTRACTED,
      fileName: storedFileName,
      originalFileName: options.uploadedFileName,
      filePath: storedPath,
      fileSize: options.fileSize,
      mimeType: options.mimeType,
      extractedData: options.extractedData as any,
      extractionConfidence: options.extractionConfidence,
      projectMismatch: false,
      notes: options.notes,
      uploadedById: options.uploadedById,
      totalAmount: decimalOrNull(options.extractedData.totalAmount),
      currency: options.extractedData.currency || "SGD",
      taxAmount: decimalOrNull(options.extractedData.taxAmount),
      subtotalAmount: decimalOrNull(options.extractedData.subtotalAmount),
      dueDate: parseDate(options.extractedData.dueDate) ?? undefined,
      paymentTerms: undefined,
    }
  })

  await persistLineItems(document.id, options.extractedData.lineItems)

  return { project, customer, document }
}

