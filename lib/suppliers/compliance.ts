import { prisma } from "@/lib/db"

export const COMPLIANCE_DOCUMENT_TYPES = [
  "INSURANCE",
  "LICENSE",
  "SAFETY",
  "CERTIFICATION",
  "FINANCIAL",
  "CUSTOM",
] as const
export type ComplianceDocumentType = (typeof COMPLIANCE_DOCUMENT_TYPES)[number]

export const COMPLIANCE_VERIFICATION_STATUSES = [
  "PENDING",
  "VERIFIED",
  "REJECTED",
  "EXPIRED",
] as const
export type ComplianceVerificationStatus = (typeof COMPLIANCE_VERIFICATION_STATUSES)[number]

export const RISK_LEVELS = ["LOW", "MEDIUM", "HIGH"] as const
export type RiskLevel = (typeof RISK_LEVELS)[number]

export type ComplianceDocumentInput = {
  name: string
  type: ComplianceDocumentType
  fileUrl?: string | null
  verificationStatus?: ComplianceVerificationStatus
  verificationNotes?: string | null
  expiresAt?: Date | string | null
  riskScore?: number | null
}

export type ComplianceRiskProfile = {
  complianceRiskScore: number
  financialRiskScore: number
  deliveryRiskScore: number
  overallRiskScore: number
  riskLevel: RiskLevel
  riskEvaluatedAt: Date
}

export function determineRiskLevel(score: number): RiskLevel {
  if (score >= 70) return "HIGH"
  if (score >= 40) return "MEDIUM"
  return "LOW"
}

export function calculateDocumentRisk(document: {
  verificationStatus: ComplianceVerificationStatus
  expiresAt: Date | null
}): number {
  let score = 20

  switch (document.verificationStatus) {
    case "VERIFIED":
      score -= 10
      break
    case "REJECTED":
      score += 15
      break
    case "EXPIRED":
      score += 20
      break
    case "PENDING":
    default:
      score += 5
  }

  if (document.expiresAt) {
    const daysUntilExpiry = (document.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    if (daysUntilExpiry < 0) {
      score += 15
    } else if (daysUntilExpiry <= 30) {
      score += 10
    }
  }

  return Math.max(0, Math.min(100, score))
}

export function calculateRiskProfile(documents: Array<{
  verificationStatus: ComplianceVerificationStatus
  expiresAt: Date | null
  riskScore?: number | null
}>): ComplianceRiskProfile {
  if (documents.length === 0) {
    const baseline: ComplianceRiskProfile = {
      complianceRiskScore: 50,
      financialRiskScore: 50,
      deliveryRiskScore: 50,
      overallRiskScore: 50,
      riskLevel: determineRiskLevel(50),
      riskEvaluatedAt: new Date()
    }
    return baseline
  }

  const scores = documents.map((doc) => doc.riskScore ?? calculateDocumentRisk(doc))
  const average = scores.reduce((sum, value) => sum + value, 0) / scores.length

  const profile: ComplianceRiskProfile = {
    complianceRiskScore: Math.round(average),
    financialRiskScore: Math.round(Math.max(0, Math.min(100, average * 0.9))),
    deliveryRiskScore: Math.round(Math.max(0, Math.min(100, average * 0.85))),
    overallRiskScore: Math.round(average),
    riskLevel: determineRiskLevel(average),
    riskEvaluatedAt: new Date()
  }

  return profile
}

export async function listComplianceDocuments(supplierId: string, client = prisma) {
  return client.supplierComplianceDocument.findMany({
    where: { supplierId },
    orderBy: { createdAt: "desc" }
  })
}

export async function createComplianceDocument(
  supplierId: string,
  payload: ComplianceDocumentInput,
  client = prisma
) {
  const document = await client.supplierComplianceDocument.create({
    data: {
      supplierId,
      name: payload.name,
      type: payload.type,
      fileUrl: payload.fileUrl,
      verificationStatus: payload.verificationStatus ?? "PENDING",
      verificationNotes: payload.verificationNotes,
      expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : null,
      riskScore: payload.riskScore ?? null
    }
  })

  await updateSupplierRiskScores(supplierId, client)
  return document
}

export async function updateComplianceDocument(
  documentId: string,
  payload: Partial<ComplianceDocumentInput>,
  client = prisma
) {
  const document = await client.supplierComplianceDocument.update({
    where: { id: documentId },
    data: {
      ...payload,
      expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : undefined
    }
  })

  await updateSupplierRiskScores(document.supplierId, client)
  return document
}

export async function deleteComplianceDocument(documentId: string, client = prisma) {
  const document = await client.supplierComplianceDocument.delete({
    where: { id: documentId }
  })

  await updateSupplierRiskScores(document.supplierId, client)
  return document
}

export async function updateSupplierRiskScores(supplierId: string, client = prisma) {
  const documents = await client.supplierComplianceDocument.findMany({
    where: { supplierId }
  })

  const profile = calculateRiskProfile(
    documents.map((doc) => ({
      verificationStatus: doc.verificationStatus,
      expiresAt: doc.expiresAt,
      riskScore: doc.riskScore ?? undefined
    }))
  )

  await client.supplier.update({
    where: { id: supplierId },
    data: {
      complianceRiskScore: profile.complianceRiskScore,
      financialRiskScore: profile.financialRiskScore,
      deliveryRiskScore: profile.deliveryRiskScore,
      overallRiskScore: profile.overallRiskScore,
      riskLevel: profile.riskLevel,
      riskEvaluatedAt: profile.riskEvaluatedAt
    }
  })

  return profile
}

export async function getComplianceSummary(supplierId: string, client = prisma) {
  const documents = await listComplianceDocuments(supplierId, client)
  const profile = calculateRiskProfile(
    documents.map((doc) => ({
      verificationStatus: doc.verificationStatus,
      expiresAt: doc.expiresAt,
      riskScore: doc.riskScore ?? undefined
    }))
  )

  return { documents, risk: profile }
}
