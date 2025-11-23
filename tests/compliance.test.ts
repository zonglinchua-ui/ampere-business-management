import assert from "node:assert"
import test from "node:test"
import {
  calculateRiskProfile,
  determineRiskLevel
} from "@/lib/suppliers/compliance"
import {
  isExpiringSoon,
  notifyExpiringComplianceDocuments
} from "@/lib/suppliers/compliance-alerts"
import { createComplianceRouteHandlers } from "@/app/api/suppliers/[id]/compliance/handlers"

function createMockClient(initialDocs: any[] = []) {
  const documents = [...initialDocs]
  return {
    supplierComplianceDocument: {
      findMany: async (args?: any) => {
        if (!args?.where?.expiresAt) return documents
        const { gte, lte } = args.where.expiresAt
        const statuses: string[] = args.where.verificationStatus?.in ?? []
        return documents
          .filter((doc) => !statuses.length || statuses.includes(doc.verificationStatus))
          .filter((doc) => doc.expiresAt && doc.expiresAt >= gte && doc.expiresAt <= lte)
          .map((doc) => ({ ...doc, Supplier: { name: "Test Supplier" } }))
      },
      create: async ({ data }: any) => {
        const created = {
          ...data,
          id: `doc-${documents.length + 1}`,
          createdAt: new Date(),
          updatedAt: new Date()
        }
        documents.push(created)
        return created
      },
      update: async ({ where, data }: any) => {
        const index = documents.findIndex((d) => d.id === where.id)
        documents[index] = { ...documents[index], ...data }
        return documents[index]
      },
      delete: async ({ where }: any) => {
        const index = documents.findIndex((d) => d.id === where.id)
        const [removed] = documents.splice(index, 1)
        return removed
      }
    },
    supplier: {
      update: async ({ data }: any) => ({ id: "supplier-1", ...data })
    }
  }
}

test("determineRiskLevel categorises numeric scores", () => {
  assert.equal(determineRiskLevel(80), "HIGH")
  assert.equal(determineRiskLevel(40), "MEDIUM")
  assert.equal(determineRiskLevel(10), "LOW")
})

test("calculateRiskProfile scores documents with expiry consideration", () => {
  const soon = new Date()
  soon.setDate(soon.getDate() + 5)
  const profile = calculateRiskProfile([
    { verificationStatus: "VERIFIED", expiresAt: soon },
    { verificationStatus: "PENDING", expiresAt: null }
  ])

  assert.ok(profile.complianceRiskScore >= 15 && profile.complianceRiskScore <= 100)
  assert.equal(profile.riskLevel, "LOW")
})

test("isExpiringSoon flags dates within threshold", () => {
  const soon = new Date()
  soon.setDate(soon.getDate() + 7)
  const far = new Date()
  far.setDate(far.getDate() + 45)

  assert.equal(isExpiringSoon(soon, 10), true)
  assert.equal(isExpiringSoon(far, 10), false)
})

test("API compliance handlers perform CRUD and recompute risk", async () => {
  const client = createMockClient()
  const handlers = createComplianceRouteHandlers({
    getSession: async () => ({ user: { id: "tester" } }),
    client
  })

  const createdResponse = await handlers.POST(
    new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ name: "Insurance", type: "INSURANCE" })
    }),
    { params: { id: "supplier-1" } }
  )
  assert.equal(createdResponse.status, 201)
  const createdBody: any = await createdResponse.json()
  assert.equal(createdBody.documents.length, 1)

  const updateResponse = await handlers.PUT(
    new Request("http://localhost", {
      method: "PUT",
      body: JSON.stringify({ documentId: createdBody.documents[0].id, verificationStatus: "VERIFIED" })
    }),
    { params: { id: "supplier-1" } }
  )
  assert.equal(updateResponse.status, 200)
  const updateBody: any = await updateResponse.json()
  assert.equal(updateBody.documents[0].verificationStatus, "VERIFIED")
})

test("notifyExpiringComplianceDocuments emits messages for soon-to-expire docs", async () => {
  const soon = new Date()
  soon.setDate(soon.getDate() + 2)
  const later = new Date()
  later.setDate(later.getDate() + 90)

  const client = createMockClient([
    { id: "d1", name: "WSH", type: "SAFETY", expiresAt: soon, verificationStatus: "VERIFIED" },
    { id: "d2", name: "COI", type: "INSURANCE", expiresAt: later, verificationStatus: "VERIFIED" }
  ])

  const messages: string[] = []
  const result = await notifyExpiringComplianceDocuments(30, client as any, async (msg) => {
    messages.push(msg)
  })

  assert.equal(result.count, 1)
  assert.equal(messages.length, 1)
  assert.ok(messages[0].includes("WSH"))
})
