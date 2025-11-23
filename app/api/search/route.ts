import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit"
import { GlobalSearchResult, SearchEntityType } from "@/lib/search"

interface SearchHandlerDeps {
  prismaClient: typeof prisma
  getSession: () => Promise<any>
  rateLimit?: typeof checkRateLimit
  clientIdentifier?: typeof getClientIdentifier
}

interface SearchContext {
  query: string
  limit: number
  recent: boolean
}

export function createSearchHandler({
  prismaClient,
  getSession,
  rateLimit = checkRateLimit,
  clientIdentifier = getClientIdentifier
}: SearchHandlerDeps) {
  return async function handleSearch(req: NextRequest) {
    try {
      const session = await getSession()

      if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }

      const identifier = session.user?.id || clientIdentifier(req)
      const rateLimitResult = rateLimit(identifier, {
        maxRequests: 60,
        windowSeconds: 60
      })

      if (!rateLimitResult.success) {
        const retryAfter = Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000)

        return NextResponse.json(
          {
            error: "Too many requests",
            message: "You have exceeded the search rate limit. Please try again shortly.",
            retryAfter
          },
          {
            status: 429,
            headers: {
              "Retry-After": retryAfter.toString(),
              "X-RateLimit-Limit": "60",
              "X-RateLimit-Remaining": "0",
              "X-RateLimit-Reset": rateLimitResult.resetAt.toString()
            }
          }
        )
      }

      const { searchParams } = new URL(req.url)
      const query = searchParams.get("query") || searchParams.get("q") || ""
      const limit = parseInt(searchParams.get("limit") || "8", 10)
      const recent = searchParams.get("recent") === "true"
      const explicitEntity = searchParams.get("entity") as SearchEntityType | null
      const entityList =
        searchParams
          .get("entities")
          ?.split(",")
          .map((entry) => entry.trim())
          .filter(Boolean) as SearchEntityType[] | undefined

      const entities: SearchEntityType[] =
        explicitEntity
          ? [explicitEntity]
          : entityList && entityList.length
            ? entityList
            : ["supplier", "project", "invoice"]

      const invalidEntity = entities.find(
        (entity) => !["supplier", "project", "invoice", "customer", "user"].includes(entity)
      )

      if (invalidEntity) {
        return NextResponse.json(
          { error: `Invalid entity type: ${invalidEntity}` },
          { status: 400 }
        )
      }

      const ctx: SearchContext = { query, limit, recent }
      const entityResults = await Promise.all(
        entities.map((entity) => searchByEntity(prismaClient, entity, ctx))
      )
      const results: GlobalSearchResult[] = entityResults.flat()

      return NextResponse.json({
        results,
        count: results.length,
        entities,
        query
      })
    } catch (error) {
      console.error("Search API error:", error)
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      )
    }
  }
}

async function searchByEntity(
  prismaClient: typeof prisma,
  entity: SearchEntityType,
  ctx: SearchContext
) {
  switch (entity) {
    case "customer":
      return searchCustomers(prismaClient, ctx)
    case "supplier":
      return searchSuppliers(prismaClient, ctx)
    case "project":
      return searchProjects(prismaClient, ctx)
    case "invoice":
      return searchInvoices(prismaClient, ctx)
    case "user":
      return searchUsers(prismaClient, ctx)
    default:
      return []
  }
}

async function searchCustomers(prismaClient: typeof prisma, ctx: SearchContext) {
  const customers = await prismaClient.customer.findMany({
    where: {
      isActive: true,
      isDeleted: false,
      isCustomer: true,
      OR: ctx.query
        ? [
          { name: { contains: ctx.query, mode: "insensitive" } },
          { customerNumber: { contains: ctx.query, mode: "insensitive" } },
          { contactPerson: { contains: ctx.query, mode: "insensitive" } },
          { email: { contains: ctx.query, mode: "insensitive" } },
        ]
        : undefined
    },
    take: ctx.limit,
    select: {
      id: true,
      name: true,
      customerNumber: true,
      email: true,
      contactPerson: true,
      customerType: true,
    },
    orderBy: ctx.recent ? { updatedAt: "desc" } : { name: "asc" }
  })

  return customers.map((c) => ({
    id: c.id,
    value: c.id,
    type: "customer" as const,
    title: `${c.name}${c.customerNumber ? ` (${c.customerNumber})` : ""}`,
    label: `${c.name}${c.customerNumber ? ` (${c.customerNumber})` : ""}`,
    subtitle: c.contactPerson || c.email || undefined,
    metadata: {
      customerNumber: c.customerNumber,
      email: c.email,
      contactPerson: c.contactPerson,
      customerType: c.customerType
    }
  }))
}

async function searchSuppliers(prismaClient: typeof prisma, ctx: SearchContext) {
  const suppliers = await prismaClient.supplier.findMany({
    where: {
      isActive: true,
      isDeleted: false,
      OR: ctx.query
        ? [
          { name: { contains: ctx.query, mode: "insensitive" } },
          { supplierNumber: { contains: ctx.query, mode: "insensitive" } },
          { contactPerson: { contains: ctx.query, mode: "insensitive" } },
          { email: { contains: ctx.query, mode: "insensitive" } },
        ]
        : undefined
    },
    take: ctx.limit,
    select: {
      id: true,
      name: true,
      supplierNumber: true,
      email: true,
      phone: true,
      contactPerson: true,
      isApproved: true,
      updatedAt: true
    },
    orderBy: ctx.recent ? { updatedAt: "desc" } : { name: "asc" }
  })

  return suppliers.map((s) => ({
    id: s.id,
    value: s.id,
    type: "supplier" as const,
    title: s.name,
    label: `${s.name}${s.supplierNumber ? ` (${s.supplierNumber})` : ""}`,
    subtitle: s.contactPerson || s.email || s.phone || undefined,
    href: `/suppliers/${s.id}`,
    status: s.isApproved ? "Approved" : "Pending",
    metadata: {
      supplierNumber: s.supplierNumber,
      email: s.email,
      phone: s.phone,
      contactPerson: s.contactPerson
    }
  }))
}

async function searchProjects(prismaClient: typeof prisma, ctx: SearchContext) {
  const projects = await prismaClient.project.findMany({
    where: {
      isActive: true,
      OR: ctx.query
        ? [
          { name: { contains: ctx.query, mode: "insensitive" } },
          { projectNumber: { contains: ctx.query, mode: "insensitive" } },
          { description: { contains: ctx.query, mode: "insensitive" } },
        ]
        : undefined
    },
    take: ctx.limit,
    select: {
      id: true,
      name: true,
      projectNumber: true,
      description: true,
      status: true,
      contractValue: true,
      Customer: {
        select: {
          name: true
        }
      },
      updatedAt: true
    },
    orderBy: ctx.recent ? { updatedAt: "desc" } : { createdAt: "desc" }
  })

  return projects.map((p) => ({
    id: p.id,
    value: p.id,
    type: "project" as const,
    title: `${p.name} (${p.projectNumber})`,
    label: `${p.name} (${p.projectNumber})`,
    subtitle: p.Customer?.name || p.description || undefined,
    href: `/projects/${p.id}`,
    status: p.status,
    amount: p.contractValue ? Number(p.contractValue) : undefined,
    currency: "SGD",
    metadata: {
      projectNumber: p.projectNumber,
      description: p.description,
      status: p.status,
      customerName: p.Customer?.name
    }
  }))
}

async function searchInvoices(prismaClient: typeof prisma, ctx: SearchContext) {
  const invoices = await prismaClient.customerInvoice.findMany({
    where: ctx.query
      ? {
        OR: [
          { invoiceNumber: { contains: ctx.query, mode: "insensitive" } },
          { description: { contains: ctx.query, mode: "insensitive" } },
          { Customer: { name: { contains: ctx.query, mode: "insensitive" } } },
          { Project: { name: { contains: ctx.query, mode: "insensitive" } } },
        ]
      }
      : undefined,
    take: ctx.limit,
    select: {
      id: true,
      invoiceNumber: true,
      status: true,
      totalAmount: true,
      amountDue: true,
      currency: true,
      description: true,
      issueDate: true,
      Customer: {
        select: { name: true }
      },
      Project: {
        select: { name: true, projectNumber: true }
      },
      createdAt: true
    },
    orderBy: ctx.recent ? { issueDate: "desc" } : { issueDate: "desc" }
  })

  return invoices.map((invoice) => ({
    id: invoice.id,
    value: invoice.id,
    type: "invoice" as const,
    title: `${invoice.invoiceNumber}${invoice.Customer?.name ? ` — ${invoice.Customer.name}` : ""}`,
    label: `${invoice.invoiceNumber}${invoice.Customer?.name ? ` — ${invoice.Customer.name}` : ""}`,
    subtitle: invoice.Project?.name || invoice.description || undefined,
    href: `/finance/customer-invoices/${invoice.id}`,
    status: invoice.status,
    amount: invoice.totalAmount ? Number(invoice.totalAmount) : undefined,
    currency: invoice.currency,
    metadata: {
      amountDue: invoice.amountDue ? Number(invoice.amountDue) : undefined,
      projectNumber: invoice.Project?.projectNumber,
      customerName: invoice.Customer?.name,
      issueDate: invoice.issueDate
    }
  }))
}

async function searchUsers(prismaClient: typeof prisma, ctx: SearchContext) {
  const users = await prismaClient.user.findMany({
    where: {
      OR: ctx.query
        ? [
          { name: { contains: ctx.query, mode: "insensitive" } },
          { email: { contains: ctx.query, mode: "insensitive" } },
        ]
        : undefined
    },
    take: ctx.limit,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
    orderBy: ctx.recent ? { updatedAt: "desc" } : { name: "asc" }
  })

  return users.map((u) => ({
    id: u.id,
    value: u.id,
    type: "user" as const,
    title: u.name || u.email,
    label: u.name || u.email,
    subtitle: u.email !== u.name ? u.email : undefined,
    metadata: {
      email: u.email,
      role: u.role
    }
  }))
}

export const GET = createSearchHandler({
  prismaClient: prisma,
  getSession: () => getServerSession(authOptions)
})

export const dynamic = "force-dynamic"
