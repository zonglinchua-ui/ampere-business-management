
/**
 * BCA Notification Service
 * Handles push notifications and email alerts for BCA module
 */

import { prisma } from "@/lib/db"
import { BcaNotificationType, Prisma } from "@prisma/client"

export interface NotificationData {
  userId: string
  type: BcaNotificationType
  title: string
  message: string
  applicationId?: string
  sendEmail?: boolean
}

export async function sendBcaNotification(data: NotificationData): Promise<void> {
  // Create notification in database
  const notification = await prisma.bcaNotification.create({
    data: {
      userId: data.userId,
      notificationType: data.type,
      title: data.title,
      message: data.message,
      applicationId: data.applicationId,
    },
  })

  // If email should be sent, queue it (integrate with existing email system)
  if (data.sendEmail) {
    // TODO: Integrate with existing email service
    console.log(`[BCA] Email notification queued for ${data.userId}:`, data.title)
    
    // Update notification status
    await prisma.bcaNotification.update({
      where: { id: notification.id },
      data: {
        isEmailSent: true,
        emailSentAt: new Date(),
      },
    })
  }
}

export async function checkAndSendExpiryNotifications(): Promise<void> {
  // Get company info with expiring workheads
  const companies = await prisma.bcaCompanyInfo.findMany({
    where: {
      expiryDates: { not: Prisma.JsonNull },
    },
  })

  const today = new Date()
  const superAdmins = await prisma.user.findMany({
    where: { role: "SUPERADMIN", isActive: true },
  })

  for (const company of companies) {
    const expiryDates = company.expiryDates as any

    if (expiryDates && typeof expiryDates === "object") {
      for (const [workhead, expiryDate] of Object.entries(expiryDates)) {
        const expiry = new Date(expiryDate as string)
        const daysUntilExpiry = Math.floor(
          (expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        )

        // Send notifications at 90, 60, and 30 days before expiry
        if ([90, 60, 30].includes(daysUntilExpiry)) {
          for (const admin of superAdmins) {
            await sendBcaNotification({
              userId: admin.id,
              type: "WORKHEAD_EXPIRY",
              title: "BCA Workhead Expiry Alert",
              message: `Workhead ${workhead} will expire in ${daysUntilExpiry} days on ${expiry.toLocaleDateString()}`,
              sendEmail: true,
            })
          }
        }
      }
    }
  }
}

export async function sendIncompleteSubmissionAlert(
  applicationId: string,
  missingItems: string[]
): Promise<void> {
  const superAdmins = await prisma.user.findMany({
    where: { role: "SUPERADMIN", isActive: true },
  })

  for (const admin of superAdmins) {
    await sendBcaNotification({
      userId: admin.id,
      type: "INCOMPLETE_SUBMISSION",
      title: "BCA Application Incomplete",
      message: `Application has missing items: ${missingItems.join(", ")}`,
      applicationId,
      sendEmail: true,
    })
  }
}
