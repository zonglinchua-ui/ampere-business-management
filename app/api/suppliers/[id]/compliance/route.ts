import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import {
  ComplianceDocumentInput,
  createComplianceDocument,
  deleteComplianceDocument,
  getComplianceSummary,
  updateComplianceDocument
} from "@/lib/suppliers/compliance"

const buildDeps = (overrides?: Partial<typeof defaultDeps>) => ({
  ...defaultDeps,
  ...overrides
})

const defaultDeps = {
  getSession: () => getServerSession(authOptions),
  client: prisma
}

export function createComplianceRouteHandlers(deps = defaultDeps) {
  return {
    async GET(_request: Request, { params }: { params: { id: string } }) {
      const session = await deps.getSession()
      if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }

      const summary = await getComplianceSummary(params.id, deps.client)
      return NextResponse.json(summary)
    },

    async POST(request: Request, { params }: { params: { id: string } }) {
      const session = await deps.getSession()
      if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }

      const body = (await request.json()) as ComplianceDocumentInput
      if (!body?.name || !body?.type) {
        return NextResponse.json({ error: "Name and type are required" }, { status: 400 })
      }

      await createComplianceDocument(params.id, body, deps.client)
      const summary = await getComplianceSummary(params.id, deps.client)
      return NextResponse.json(summary, { status: 201 })
    },

    async PUT(request: Request, { params }: { params: { id: string } }) {
      const session = await deps.getSession()
      if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }

      const { documentId, ...payload } = (await request.json()) as ComplianceDocumentInput & {
        documentId?: string
      }
      if (!documentId) {
        return NextResponse.json({ error: "documentId is required" }, { status: 400 })
      }

      await updateComplianceDocument(documentId, payload, deps.client)
      const summary = await getComplianceSummary(params.id, deps.client)
      return NextResponse.json(summary)
    },

    async DELETE(request: Request, { params }: { params: { id: string } }) {
      const session = await deps.getSession()
      if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }

      const { documentId } = (await request.json()) as { documentId?: string }
      if (!documentId) {
        return NextResponse.json({ error: "documentId is required" }, { status: 400 })
      }

      await deleteComplianceDocument(documentId, deps.client)
      const summary = await getComplianceSummary(params.id, deps.client)
      return NextResponse.json(summary)
    }
  }
}

export const { GET, POST, PUT, DELETE } = createComplianceRouteHandlers(buildDeps())
