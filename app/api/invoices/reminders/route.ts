import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { calculateReminderSchedule, isInvoiceOutstanding } from "@/lib/invoices/reminders"

export async function GET() {
  try {
    const invoices = await prisma.legacyInvoice.findMany({
      where: {
        status: {
          notIn: ["PAID", "CANCELLED"],
        },
      },
      include: {
        Customer: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    const reminders = invoices.map(invoice => {
      const schedule = calculateReminderSchedule({
        id: invoice.id,
        dueDate: invoice.dueDate,
        status: invoice.status,
        totalAmount: Number(invoice.totalAmount),
        reminderCadence: invoice.reminderCadence as any,
        reminderOffsets: invoice.reminderOffsets as any,
        lastReminderSentAt: invoice.lastReminderSentAt ?? undefined,
      })

      return {
        invoiceId: invoice.id,
        customer: invoice.Customer?.name,
        cadence: schedule.cadence,
        schedule: schedule.schedule,
        nextReminderDate: schedule.nextReminderDate,
        shouldSend: schedule.shouldSend && isInvoiceOutstanding({
          id: invoice.id,
          dueDate: invoice.dueDate,
          status: invoice.status,
          totalAmount: Number(invoice.totalAmount),
        }),
      }
    })

    return NextResponse.json({ reminders })
  } catch (error) {
    console.error("GET /api/invoices/reminders error", error)
    return NextResponse.json({ error: "Failed to build reminder schedule" }, { status: 500 })
  }
}

export async function POST() {
  try {
    const invoices = await prisma.legacyInvoice.findMany({
      where: {
        status: {
          notIn: ["PAID", "CANCELLED"],
        },
      },
      include: {
        Customer: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    const reminders = invoices.map(invoice => {
      const schedule = calculateReminderSchedule({
        id: invoice.id,
        dueDate: invoice.dueDate,
        status: invoice.status,
        totalAmount: Number(invoice.totalAmount),
        reminderCadence: invoice.reminderCadence as any,
        reminderOffsets: invoice.reminderOffsets as any,
        lastReminderSentAt: invoice.lastReminderSentAt ?? undefined,
      })

      return {
        invoiceId: invoice.id,
        customer: invoice.Customer?.name,
        cadence: schedule.cadence,
        schedule: schedule.schedule,
        nextReminderDate: schedule.nextReminderDate,
        shouldSend: schedule.shouldSend && isInvoiceOutstanding({
          id: invoice.id,
          dueDate: invoice.dueDate,
          status: invoice.status,
          totalAmount: Number(invoice.totalAmount),
        }),
      }
    })
    const now = new Date()
    const actionable = reminders.filter((reminder: any) => reminder.shouldSend)

    if (!actionable.length) {
      return NextResponse.json({ remindersSent: 0, reminders: [] })
    }

    const sent: any[] = []

    for (const reminder of actionable) {
      await prisma.legacyInvoice.update({
        where: { id: reminder.invoiceId },
        data: { lastReminderSentAt: now },
      })

      sent.push({
        invoiceId: reminder.invoiceId,
        customer: reminder.customer,
        nextReminderDate: reminder.nextReminderDate,
        cadence: reminder.cadence,
      })
    }

    return NextResponse.json({ remindersSent: sent.length, reminders: sent })
  } catch (error) {
    console.error("POST /api/invoices/reminders error", error)
    return NextResponse.json({ error: "Failed to send reminders" }, { status: 500 })
  }
}

export const dynamic = "force-dynamic"
