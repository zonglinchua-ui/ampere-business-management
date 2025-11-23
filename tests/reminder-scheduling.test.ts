import assert from "assert"
import { describe, it } from "node:test"
import { calculateReminderSchedule, getCadenceOffsets, isInvoiceOutstanding } from "../lib/invoices/reminders"

describe("invoice reminder scheduling", () => {
  const baseInvoice = {
    id: "inv-1",
    dueDate: new Date("2024-01-01"),
    status: "SENT",
    totalAmount: 1000,
  }

  it("uses gentle cadence by default", () => {
    const offsets = getCadenceOffsets(undefined, null)
    assert.deepStrictEqual(offsets, [3, 7, 14])
  })

  it("supports firm cadence", () => {
    const offsets = getCadenceOffsets("FIRM", null)
    assert.deepStrictEqual(offsets, [1, 3, 7, 14])
  })

  it("builds custom cadence from offsets", () => {
    const offsets = getCadenceOffsets("CUSTOM", [2, 5, 1])
    assert.deepStrictEqual(offsets, [1, 2, 5])
  })

  it("computes next reminder date after last send", () => {
    const now = new Date("2024-01-20")
    const schedule = calculateReminderSchedule({
      ...baseInvoice,
      reminderCadence: "GENTLE",
      lastReminderSentAt: new Date("2024-01-08"),
    }, now)

    assert.strictEqual(schedule.cadence, "GENTLE")
    assert.ok(schedule.nextReminderDate)
    assert.strictEqual(schedule.shouldSend, true)
  })

  it("marks fully paid invoices as not outstanding", () => {
    assert.strictEqual(isInvoiceOutstanding({ ...baseInvoice, status: "PAID" }), false)
  })
})
