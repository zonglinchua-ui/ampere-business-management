
/**
 * BCA Form Generator
 * Generates D1 and D2 forms with auto-filled data
 */

import { prisma } from "@/lib/db"

export interface FormData {
  companyInfo: {
    name: string
    uen: string
    address: string
    contactPerson: string
    email: string
    phone: string
  }
  projectInfo: {
    id: string
    name: string
    clientName: string
    siteName: string
    contractSum: number
    startDate: Date | null
    completionDate: Date | null
    status: string
    completionPercentage?: number
  }
  workDetails: {
    workType: string
    discipline: string
    description: string
  }
  documents: {
    type: string
    filename: string
    url: string
  }[]
}

export async function generateFormData(projectId: string): Promise<FormData> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      Customer: true,
      Document: true,
      Quotation: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      PurchaseOrder: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  })

  if (!project) {
    throw new Error("Project not found")
  }

  // Get company info (this should come from settings/env)
  const companyInfo = {
    name: "Ampere Engineering Pte Ltd",
    uen: "201021612W",
    address: "101 Upper Cross Street #04-05, People's Park Centre Singapore 058357",
    contactPerson: "Admin",
    email: "projects@ampere.com.sg",
    phone: "+65 66778457",
  }

  // Prepare project info
  const projectInfo = {
    id: project.id,
    name: project.name,
    clientName: project.Customer.name,
    siteName: project.description || project.name,
    contractSum: Number(project.contractValue || project.estimatedBudget || 0),
    startDate: project.startDate,
    completionDate: project.endDate,
    status: project.status,
    completionPercentage: project.progress,
  }

  // Prepare work details
  const workDetails = {
    workType: project.projectType === "MAINTENANCE" ? "Maintenance" : "Construction",
    discipline: "Electrical & Mechanical Engineering",
    description: project.description || "",
  }

  // Prepare documents
  const documents = project.Document.filter(
    (d) => d.isActive && d.cloudStoragePath
  ).map((doc) => ({
    type: doc.category,
    filename: doc.originalName,
    url: doc.cloudStoragePath,
  }))

  return {
    companyInfo,
    projectInfo,
    workDetails,
    documents,
  }
}
