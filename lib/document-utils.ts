
import { ProjectDocumentType, ProjectDocumentStatus, ProjectDocumentCategory } from "@prisma/client"

export const DOCUMENT_TYPE_LABELS: Record<ProjectDocumentType, string> = {
  // Pre-Construction Stage
  PRE_CONSTRUCTION_SURVEY: "Pre-Construction Survey",
  SITE_SAFETY_PLAN: "Site Safety Plan",
  RISK_ASSESSMENT: "Risk Assessment",
  WORK_METHOD_STATEMENT: "Work Method Statement",
  PERMIT_TO_WORK: "Permit to Work",
  HOT_WORK_PERMIT: "Hot Work Permit",
  LIFTING_PERMIT: "Lifting Permit",
  CONFINED_SPACE_PERMIT: "Confined Space Permit",
  WORKER_LIST: "Worker List",
  
  // Construction Stage
  DAILY_SITE_REPORT: "Daily Site Report",
  INSPECTION_TEST_PLAN: "Inspection & Test Plan",
  QUALITY_CHECKLIST: "Quality Checklist",
  MATERIAL_DELIVERY_NOTE: "Material Delivery Note",
  PROGRESS_PHOTOS: "Progress Photos",
  PROGRESS_CLAIM: "Progress Claim",
  VARIATION_ORDER: "Variation Order",
  INCIDENT_REPORT: "Incident Report",
  ACCIDENT_REPORT: "Accident Report",
  TOOLBOX_MEETING: "Toolbox Meeting Record",
  
  // Handover & Completion Stage
  OPERATION_MAINTENANCE_MANUAL: "O&M Manual",
  TESTING_COMMISSIONING_REPORT: "Testing & Commissioning Report",
  AS_BUILT_DRAWINGS: "As-Built Drawings",
  HANDOVER_FORM: "Handover Form",
  DEFECT_LIABILITY_REPORT: "Defect Liability Report",
  NON_CONFORMANCE_REPORT: "Non-Conformance Report",
  DELIVERY_ORDER_JOB_COMPLETION: "Delivery Order / Job Completion",
  
  // Post-Completion Stage
  FINAL_COMPLETION_CERTIFICATE: "Final Completion Certificate",
  WARRANTY_CERTIFICATE: "Warranty Certificate",
  SERVICE_AGREEMENT: "Service Agreement",
  
  // General
  GENERAL: "General Document"
}

export const DOCUMENT_STATUS_CONFIG = {
  DRAFT: {
    label: "Draft",
    color: "bg-gray-100 text-gray-800",
    icon: "FileText"
  },
  SUBMITTED: {
    label: "Submitted",
    color: "bg-blue-100 text-blue-800",
    icon: "Send"
  },
  UNDER_REVIEW: {
    label: "Under Review",
    color: "bg-yellow-100 text-yellow-800",
    icon: "Clock"
  },
  APPROVED: {
    label: "Approved",
    color: "bg-green-100 text-green-800",
    icon: "CheckCircle"
  },
  REJECTED: {
    label: "Rejected",
    color: "bg-red-100 text-red-800",
    icon: "XCircle"
  },
  ARCHIVED: {
    label: "Archived",
    color: "bg-gray-100 text-gray-600",
    icon: "Archive"
  }
}

export const DOCUMENT_CATEGORY_LABELS: Record<ProjectDocumentCategory, string> = {
  PRE_CONSTRUCTION: "Pre-Construction",
  CONSTRUCTION: "Construction",
  HANDOVER_COMPLETION: "Handover & Completion",
  POST_COMPLETION: "Post-Completion"
}

export const DOCUMENT_CATEGORY_COLORS: Record<ProjectDocumentCategory, string> = {
  PRE_CONSTRUCTION: "bg-blue-50 border-blue-200",
  CONSTRUCTION: "bg-orange-50 border-orange-200",
  HANDOVER_COMPLETION: "bg-purple-50 border-purple-200",
  POST_COMPLETION: "bg-green-50 border-green-200"
}

export function getDocumentTypesByCategory(category: ProjectDocumentCategory): ProjectDocumentType[] {
  switch (category) {
    case 'PRE_CONSTRUCTION':
      return [
        'PRE_CONSTRUCTION_SURVEY',
        'SITE_SAFETY_PLAN',
        'RISK_ASSESSMENT',
        'WORK_METHOD_STATEMENT',
        'PERMIT_TO_WORK',
        'HOT_WORK_PERMIT',
        'LIFTING_PERMIT',
        'CONFINED_SPACE_PERMIT',
        'WORKER_LIST'
      ]
    case 'CONSTRUCTION':
      return [
        'DAILY_SITE_REPORT',
        'INSPECTION_TEST_PLAN',
        'QUALITY_CHECKLIST',
        'MATERIAL_DELIVERY_NOTE',
        'PROGRESS_PHOTOS',
        'PROGRESS_CLAIM',
        'VARIATION_ORDER',
        'INCIDENT_REPORT',
        'ACCIDENT_REPORT',
        'TOOLBOX_MEETING'
      ]
    case 'HANDOVER_COMPLETION':
      return [
        'OPERATION_MAINTENANCE_MANUAL',
        'TESTING_COMMISSIONING_REPORT',
        'AS_BUILT_DRAWINGS',
        'HANDOVER_FORM',
        'DEFECT_LIABILITY_REPORT',
        'NON_CONFORMANCE_REPORT',
        'DELIVERY_ORDER_JOB_COMPLETION'
      ]
    case 'POST_COMPLETION':
      return [
        'FINAL_COMPLETION_CERTIFICATE',
        'WARRANTY_CERTIFICATE',
        'SERVICE_AGREEMENT'
      ]
    default:
      return ['GENERAL']
  }
}

export function getCategoryForDocumentType(documentType: ProjectDocumentType): ProjectDocumentCategory {
  const preConstructionTypes = [
    'PRE_CONSTRUCTION_SURVEY', 'SITE_SAFETY_PLAN', 'RISK_ASSESSMENT', 'WORK_METHOD_STATEMENT',
    'PERMIT_TO_WORK', 'HOT_WORK_PERMIT', 'LIFTING_PERMIT', 'CONFINED_SPACE_PERMIT', 'WORKER_LIST'
  ]
  
  const constructionTypes = [
    'DAILY_SITE_REPORT', 'INSPECTION_TEST_PLAN', 'QUALITY_CHECKLIST', 'MATERIAL_DELIVERY_NOTE',
    'PROGRESS_PHOTOS', 'PROGRESS_CLAIM', 'VARIATION_ORDER', 'INCIDENT_REPORT', 'ACCIDENT_REPORT', 'TOOLBOX_MEETING'
  ]
  
  const handoverTypes = [
    'OPERATION_MAINTENANCE_MANUAL', 'TESTING_COMMISSIONING_REPORT', 'AS_BUILT_DRAWINGS',
    'HANDOVER_FORM', 'DEFECT_LIABILITY_REPORT', 'NON_CONFORMANCE_REPORT', 'DELIVERY_ORDER_JOB_COMPLETION'
  ]
  
  const postCompletionTypes = [
    'FINAL_COMPLETION_CERTIFICATE', 'WARRANTY_CERTIFICATE', 'SERVICE_AGREEMENT'
  ]
  
  if (preConstructionTypes.includes(documentType)) {
    return 'PRE_CONSTRUCTION'
  } else if (constructionTypes.includes(documentType)) {
    return 'CONSTRUCTION'
  } else if (handoverTypes.includes(documentType)) {
    return 'HANDOVER_COMPLETION'
  } else if (postCompletionTypes.includes(documentType)) {
    return 'POST_COMPLETION'
  }
  
  return 'CONSTRUCTION' // Default fallback
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export function getRequiredDocumentsForProject(projectType: string): ProjectDocumentType[] {
  // Basic required documents for all projects
  const basicRequirements: ProjectDocumentType[] = [
    'RISK_ASSESSMENT',
    'WORK_METHOD_STATEMENT',
    'HANDOVER_FORM'
  ]
  
  // Additional requirements based on project complexity
  if (projectType === 'MAINTENANCE') {
    return [
      ...basicRequirements,
      'SITE_SAFETY_PLAN',
      'INSPECTION_TEST_PLAN'
    ]
  }
  
  // For regular construction projects
  return [
    ...basicRequirements,
    'PRE_CONSTRUCTION_SURVEY',
    'SITE_SAFETY_PLAN',
    'INSPECTION_TEST_PLAN',
    'OPERATION_MAINTENANCE_MANUAL',
    'AS_BUILT_DRAWINGS',
    'FINAL_COMPLETION_CERTIFICATE'
  ]
}

export function isDocumentOverdue(documentType: ProjectDocumentType, projectStartDate: Date, currentDate: Date = new Date()): boolean {
  const daysDiff = Math.floor((currentDate.getTime() - projectStartDate.getTime()) / (1000 * 60 * 60 * 24))
  
  // Define deadline rules for different document types (in days from project start)
  const deadlines: Partial<Record<ProjectDocumentType, number>> = {
    RISK_ASSESSMENT: 0, // Due before project starts
    WORK_METHOD_STATEMENT: 0, // Due before project starts
    SITE_SAFETY_PLAN: 0, // Due before project starts
    PRE_CONSTRUCTION_SURVEY: -7, // Due 7 days before project starts
    DAILY_SITE_REPORT: 1, // Due daily during construction
    HANDOVER_FORM: 90, // Typical project duration assumption
    OPERATION_MAINTENANCE_MANUAL: 85, // Due 5 days before handover
    FINAL_COMPLETION_CERTIFICATE: 95 // Due 5 days after handover
  }
  
  const deadline = deadlines[documentType]
  if (deadline === undefined) return false
  
  return daysDiff > deadline
}

export function getDocumentPriority(documentType: ProjectDocumentType): 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' {
  const highPriority: ProjectDocumentType[] = [
    'RISK_ASSESSMENT',
    'WORK_METHOD_STATEMENT',
    'SITE_SAFETY_PLAN',
    'INCIDENT_REPORT',
    'ACCIDENT_REPORT'
  ]
  
  const urgentPriority: ProjectDocumentType[] = [
    'HOT_WORK_PERMIT',
    'CONFINED_SPACE_PERMIT',
    'LIFTING_PERMIT'
  ]
  
  if (urgentPriority.includes(documentType)) {
    return 'URGENT'
  } else if (highPriority.includes(documentType)) {
    return 'HIGH'
  } else {
    return 'MEDIUM'
  }
}
