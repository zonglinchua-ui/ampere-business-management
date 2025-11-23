import { prisma } from "@/lib/db"
import { createSystemLog } from "@/lib/logger"

export type ExpiryNotifier = (message: string) => Promise<void>

const DEFAULT_THRESHOLD_DAYS = 21

export function isExpiringSoon(
  expiresAt: Date | null,
  thresholdDays: number = DEFAULT_THRESHOLD_DAYS
): boolean {
  if (!expiresAt) return false
  const now = Date.now()
  const diffDays = (expiresAt.getTime() - now) / (1000 * 60 * 60 * 24)
  return diffDays >= 0 && diffDays <= thresholdDays
}

export async function defaultNotifier(message: string) {
  if (process.env.SLACK_WEBHOOK_URL) {
    try {
      await fetch(process.env.SLACK_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: message })
      })
    } catch (error) {
      console.error("Failed to send Slack notification", error)
    }
  }
  await createSystemLog({
    type: "ALERT",
    action: "COMPLIANCE_EXPIRY_ALERT",
    message,
    module: "SUPPLIER_COMPLIANCE",
    status: "INFO"
  })
}

export async function findExpiringComplianceDocuments(
  thresholdDays: number = DEFAULT_THRESHOLD_DAYS,
  client = prisma
) {
  const now = new Date()
  const thresholdDate = new Date()
  thresholdDate.setDate(thresholdDate.getDate() + thresholdDays)

  return client.supplierComplianceDocument.findMany({
    where: {
      expiresAt: {
        gte: now,
        lte: thresholdDate
      },
      verificationStatus: {
        in: ["VERIFIED", "PENDING"]
      }
    },
    include: {
      Supplier: true
    }
  })
}

export async function notifyExpiringComplianceDocuments(
  thresholdDays: number = DEFAULT_THRESHOLD_DAYS,
  client = prisma,
  notifier: ExpiryNotifier = defaultNotifier
) {
  const expiring = await findExpiringComplianceDocuments(thresholdDays, client)

  for (const doc of expiring) {
    const daysLeft = Math.ceil((doc.expiresAt!.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    const message = `Compliance document "${doc.name}" for supplier ${doc.Supplier.name} expires in ${daysLeft} day(s).`
    await notifier(message)
  }

  return { count: expiring.length }
}
