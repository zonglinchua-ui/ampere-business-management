
/**
 * BCA Application Number Generator
 * Generates unique application numbers in the format: BCA-[YEAR]-[TYPE]-[SEQ]
 */

import { prisma } from "@/lib/db"
import { BcaApplicationType } from "@prisma/client"

export async function generateApplicationNumber(
  type: BcaApplicationType
): Promise<string> {
  const year = new Date().getFullYear()
  const typePrefix = type === "NEW" ? "NEW" : type === "RENEWAL" ? "RNW" : "UPG"

  // Get the last application number for this type and year
  const lastApplication = await prisma.bcaWorkheadApplication.findFirst({
    where: {
      applicationNumber: {
        startsWith: `BCA-${year}-${typePrefix}-`,
      },
    },
    orderBy: {
      applicationNumber: "desc",
    },
  })

  let nextNumber = 1
  if (lastApplication) {
    const parts = lastApplication.applicationNumber.split("-")
    const lastNumber = parseInt(parts[3], 10)
    nextNumber = lastNumber + 1
  }

  return `BCA-${year}-${typePrefix}-${nextNumber.toString().padStart(4, "0")}`
}
