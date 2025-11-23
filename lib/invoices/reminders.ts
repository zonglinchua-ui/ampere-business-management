import { addDays } from "date-fns"

export type ReminderCadence = "GENTLE" | "FIRM" | "CUSTOM"

export interface InvoiceReminderCandidate {
  id: string
  dueDate: Date
  status: string
  totalAmount: number
  reminderCadence?: ReminderCadence | null
  reminderOffsets?: number[] | null
  lastReminderSentAt?: Date | null
}

export function getCadenceOffsets(cadence?: ReminderCadence | null, customOffsets?: number[] | null) {
  if (cadence === "CUSTOM" && customOffsets?.length) {
    return customOffsets.sort((a, b) => a - b)
  }

  if (cadence === "FIRM") {
    return [1, 3, 7, 14]
  }

  return [3, 7, 14]
}

export function calculateReminderSchedule(invoice: InvoiceReminderCandidate, now = new Date()) {
  const cadence = invoice.reminderCadence || "GENTLE"
  const offsets = getCadenceOffsets(cadence, invoice.reminderOffsets)
  const dueDate = new Date(invoice.dueDate)
  const lastSent = invoice.lastReminderSentAt ? new Date(invoice.lastReminderSentAt) : null
  const schedule = offsets.map(days => addDays(dueDate, days))
  const nextReminderDate = schedule.find(date => !lastSent || date > lastSent)

  return {
    cadence,
    schedule,
    nextReminderDate,
    shouldSend: Boolean(nextReminderDate && nextReminderDate <= now),
  }
}

export function isInvoiceOutstanding(invoice: InvoiceReminderCandidate) {
  return !["PAID", "CANCELLED"].includes(invoice.status) && Number(invoice.totalAmount) > 0
}
