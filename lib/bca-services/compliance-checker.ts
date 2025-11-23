
/**
 * BCA Compliance Checker
 * Validates project data against BCA workhead requirements
 */

import { prisma } from "@/lib/db"
import { BcaCheckStatus } from "@prisma/client"

export interface ComplianceResult {
  checkType: string
  checkDescription: string
  status: BcaCheckStatus
  errorMessage?: string
  warningMessage?: string
}

export async function runComplianceChecks(
  applicationId: string,
  workheadCode: string
): Promise<ComplianceResult[]> {
  const results: ComplianceResult[] = []

  // Get application with project forms
  const application = await prisma.bcaWorkheadApplication.findUnique({
    where: { id: applicationId },
    include: {
      ProjectForms: {
        include: {
          Attachments: true,
        },
      },
    },
  })

  if (!application) {
    throw new Error("Application not found")
  }

  // Get workhead requirements
  const workheadData = await prisma.bcaWorkheadData.findUnique({
    where: { workheadCode },
  })

  // Check 1: Minimum project count
  const projectCountCheck: ComplianceResult = {
    checkType: "PROJECT_COUNT",
    checkDescription: "Minimum number of projects requirement",
    status: "PASS",
  }

  const minProjectCount = workheadData?.minProjectCount || 2
  if (application.projectCount < minProjectCount) {
    projectCountCheck.status = "FAIL"
    projectCountCheck.errorMessage = `Requires at least ${minProjectCount} projects. Current: ${application.projectCount}`
  }
  results.push(projectCountCheck)

  // Check 2: Minimum contract value
  const contractValueCheck: ComplianceResult = {
    checkType: "CONTRACT_VALUE",
    checkDescription: "Minimum total contract value requirement",
    status: "PASS",
  }

  const minContractValue = workheadData?.minContractValue || 0
  if (Number(application.totalContractValue) < Number(minContractValue)) {
    contractValueCheck.status = "FAIL"
    contractValueCheck.errorMessage = `Requires minimum contract value of $${minContractValue}. Current: $${application.totalContractValue}`
  }
  results.push(contractValueCheck)

  // Check 3: Required documents for each project
  for (const form of application.ProjectForms) {
    const requiredDocs = form.isOngoing
      ? ["LETTER_OF_AWARD", "CONTRACT_AGREEMENT"]
      : [
          "LETTER_OF_AWARD",
          "CONTRACT_AGREEMENT",
          "CERTIFICATE_OF_COMPLETION",
          "FINAL_INVOICE",
        ]

    const providedDocs = form.Attachments.filter((a) => a.isProvided).map((a) => a.attachmentType)

    const missingDocs = requiredDocs.filter((doc) => !providedDocs.includes(doc as any))

    if (missingDocs.length > 0) {
      results.push({
        checkType: "REQUIRED_DOCUMENTS",
        checkDescription: `Required documents for form ${form.formNumber}`,
        status: "FAIL",
        errorMessage: `Missing documents: ${missingDocs.join(", ")}`,
      })
    } else {
      results.push({
        checkType: "REQUIRED_DOCUMENTS",
        checkDescription: `Required documents for form ${form.formNumber}`,
        status: "PASS",
      })
    }
  }

  // Check 4: Form completion status
  const incompleteFormsCheck: ComplianceResult = {
    checkType: "FORM_COMPLETION",
    checkDescription: "All forms must be complete",
    status: "PASS",
  }

  const incompleteForms = application.ProjectForms.filter(
    (f) => f.status === "INCOMPLETE"
  )
  if (incompleteForms.length > 0) {
    incompleteFormsCheck.status = "WARNING"
    incompleteFormsCheck.warningMessage = `${incompleteForms.length} form(s) are incomplete`
  }
  results.push(incompleteFormsCheck)

  // Save compliance checks to database
  await prisma.bcaComplianceCheck.deleteMany({
    where: { applicationId },
  })

  for (const result of results) {
    await prisma.bcaComplianceCheck.create({
      data: {
        applicationId,
        checkType: result.checkType,
        checkDescription: result.checkDescription,
        status: result.status,
        errorMessage: result.errorMessage,
        warningMessage: result.warningMessage,
      },
    })
  }

  return results
}
