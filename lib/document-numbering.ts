

import { ProjectDocumentType } from "@prisma/client"

/**
 * Document type codes for generating structured document numbers
 * Format: PROJECT_NUMBER/TYPE_CODE/SEQUENCE_NUMBER
 * Example: PRJ-2025-001/WMS/001
 */
export const DOCUMENT_TYPE_CODES: Record<ProjectDocumentType, string> = {
  // Pre-Construction Stage
  PRE_CONSTRUCTION_SURVEY: "PCS",
  SITE_SAFETY_PLAN: "SSP",
  RISK_ASSESSMENT: "RA",
  WORK_METHOD_STATEMENT: "WMS",
  PERMIT_TO_WORK: "PTW",
  HOT_WORK_PERMIT: "HWP",
  LIFTING_PERMIT: "LP",
  CONFINED_SPACE_PERMIT: "CSP",
  WORKER_LIST: "WL",
  
  // Construction Stage
  DAILY_SITE_REPORT: "DSR",
  INSPECTION_TEST_PLAN: "ITP",
  QUALITY_CHECKLIST: "QC",
  MATERIAL_DELIVERY_NOTE: "MDN",
  PROGRESS_PHOTOS: "PP",
  PROGRESS_CLAIM: "PC",
  VARIATION_ORDER: "VO",
  INCIDENT_REPORT: "IR",
  ACCIDENT_REPORT: "AR",
  TOOLBOX_MEETING: "TBM",
  
  // Handover & Completion Stage
  OPERATION_MAINTENANCE_MANUAL: "OMM",
  TESTING_COMMISSIONING_REPORT: "TCR",
  AS_BUILT_DRAWINGS: "ABD",
  HANDOVER_FORM: "HF",
  DEFECT_LIABILITY_REPORT: "DLR",
  NON_CONFORMANCE_REPORT: "NCR",
  DELIVERY_ORDER_JOB_COMPLETION: "DOJC",
  
  // Post-Completion Stage
  FINAL_COMPLETION_CERTIFICATE: "FCC",
  WARRANTY_CERTIFICATE: "WC",
  SERVICE_AGREEMENT: "SA",
  
  // General
  GENERAL: "GD"
}

/**
 * Generate document number in format: PROJECT_NUMBER/TYPE_CODE/SEQUENCE
 * @param projectNumber - The project number (e.g., "PRJ-2025-001")
 * @param documentType - The document type enum value
 * @param sequenceNumber - The sequence number for this document type in the project
 * @returns Formatted document number (e.g., "PRJ-2025-001/WMS/001")
 */
export function generateDocumentNumber(
  projectNumber: string, 
  documentType: ProjectDocumentType, 
  sequenceNumber: number
): string {
  const typeCode = DOCUMENT_TYPE_CODES[documentType]
  const paddedSequence = sequenceNumber.toString().padStart(3, '0')
  
  return `${projectNumber}/${typeCode}/${paddedSequence}`
}

/**
 * Parse document number to extract components
 * @param documentNumber - Full document number (e.g., "PRJ-2025-001/WMS/001")
 * @returns Object with project number, type code, and sequence number
 */
export function parseDocumentNumber(documentNumber: string): {
  projectNumber: string
  typeCode: string
  sequenceNumber: number
} | null {
  const parts = documentNumber.split('/')
  if (parts.length !== 3) return null
  
  const [projectNumber, typeCode, sequenceStr] = parts
  const sequenceNumber = parseInt(sequenceStr, 10)
  
  if (isNaN(sequenceNumber)) return null
  
  return {
    projectNumber,
    typeCode,
    sequenceNumber
  }
}

/**
 * Get the document type from a document number
 * @param documentNumber - Full document number
 * @returns Document type or null if not found
 */
export function getDocumentTypeFromNumber(documentNumber: string): ProjectDocumentType | null {
  const parsed = parseDocumentNumber(documentNumber)
  if (!parsed) return null
  
  // Find the document type by type code
  for (const [type, code] of Object.entries(DOCUMENT_TYPE_CODES)) {
    if (code === parsed.typeCode) {
      return type as ProjectDocumentType
    }
  }
  
  return null
}

/**
 * Validate document number format
 * @param documentNumber - Document number to validate
 * @returns True if valid format
 */
export function isValidDocumentNumber(documentNumber: string): boolean {
  const parsed = parseDocumentNumber(documentNumber)
  if (!parsed) return false
  
  // Check if type code exists
  const documentType = getDocumentTypeFromNumber(documentNumber)
  return documentType !== null
}

/**
 * Get display name for document type code
 * @param typeCode - Document type code (e.g., "WMS")
 * @returns Full document type name
 */
export function getDocumentTypeNameFromCode(typeCode: string): string {
  for (const [type, code] of Object.entries(DOCUMENT_TYPE_CODES)) {
    if (code === typeCode) {
      const documentType = type as ProjectDocumentType
      // Get the label from document-utils
      return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    }
  }
  return typeCode
}

/**
 * Generate global job sheet number in format: CS-25-10-XXXX
 * XXXX is a running number across all projects
 * @param sequenceNumber - The global sequence number
 * @returns Formatted job sheet number (e.g., "CS-25-10-0001")
 */
export function generateJobSheetNumber(sequenceNumber: number): string {
  const paddedSequence = sequenceNumber.toString().padStart(4, '0')
  return `CS-25-10-${paddedSequence}`
}

/**
 * Parse job sheet number to extract sequence
 * @param jobSheetNumber - Full job sheet number (e.g., "CS-25-10-0001")
 * @returns Sequence number or null if invalid format
 */
export function parseJobSheetNumber(jobSheetNumber: string): number | null {
  const pattern = /^CS-25-10-(\d{4})$/
  const match = jobSheetNumber.match(pattern)
  
  if (!match) return null
  
  return parseInt(match[1], 10)
}

/**
 * Validate job sheet number format
 * @param jobSheetNumber - Job sheet number to validate
 * @returns True if valid format
 */
export function isValidJobSheetNumber(jobSheetNumber: string): boolean {
  return parseJobSheetNumber(jobSheetNumber) !== null
}

