import { prisma } from "@/lib/db"

/**
 * Generate a sequential project number using the existing pattern
 * PRJ-YYYY-### for regular projects and MNT-YYYY-### for maintenance.
 */
export async function generateProjectNumber(projectType: "REGULAR" | "MAINTENANCE") {
  const prefix = projectType === "MAINTENANCE" ? "MNT" : "PRJ"
  const currentYear = new Date().getFullYear()

  const lastProject = await prisma.project.findFirst({
    where: {
      projectType,
      projectNumber: {
        startsWith: `${prefix}-${currentYear}-`
      }
    },
    orderBy: {
      projectNumber: "desc"
    }
  })

  let nextNumber = 1
  if (lastProject) {
    const parts = lastProject.projectNumber.split("-")
    const lastNumber = parseInt(parts[2], 10)
    nextNumber = lastNumber + 1
  }

  return `${prefix}-${currentYear}-${nextNumber.toString().padStart(3, "0")}`
}

