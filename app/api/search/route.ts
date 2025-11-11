
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

/**
 * Unified Search API
 * GET /api/search?entity=customer&query=ABC&limit=20
 * 
 * Supports searching across multiple entity types with live typeahead
 */

type SearchEntity = 'customer' | 'supplier' | 'project' | 'user'

interface SearchResult {
  id: string
  label: string
  value: string
  subtitle?: string
  metadata?: Record<string, any>
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const entity = searchParams.get("entity") as SearchEntity
    const query = searchParams.get("query") || ""
    const limit = parseInt(searchParams.get("limit") || "20")

    if (!entity) {
      return NextResponse.json(
        { error: "Entity type is required" },
        { status: 400 }
      )
    }

    let results: SearchResult[] = []

    switch (entity) {
      case 'customer':
        results = await searchCustomers(query, limit)
        break
      case 'supplier':
        results = await searchSuppliers(query, limit)
        break
      case 'project':
        results = await searchProjects(query, limit)
        break
      case 'user':
        results = await searchUsers(query, limit)
        break
      default:
        return NextResponse.json(
          { error: "Invalid entity type" },
          { status: 400 }
        )
    }

    return NextResponse.json({
      results,
      count: results.length,
      entity,
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

async function searchCustomers(query: string, limit: number): Promise<SearchResult[]> {
  const customers = await prisma.customer.findMany({
    where: {
      isActive: true,
      isDeleted: false,
      isCustomer: true, // Only customers, not general contacts
      OR: query ? [
        { name: { contains: query, mode: "insensitive" } },
        { customerNumber: { contains: query, mode: "insensitive" } },
        { contactPerson: { contains: query, mode: "insensitive" } },
        { email: { contains: query, mode: "insensitive" } },
      ] : undefined
    },
    take: limit,
    select: {
      id: true,
      name: true,
      customerNumber: true,
      email: true,
      contactPerson: true,
      customerType: true,
    },
    orderBy: { name: "asc" }
  })

  return customers.map(c => ({
    id: c.id,
    value: c.id,
    label: `${c.name} ${c.customerNumber ? `(${c.customerNumber})` : ''}`,
    subtitle: c.contactPerson || c.email || undefined,
    metadata: {
      customerNumber: c.customerNumber,
      email: c.email,
      contactPerson: c.contactPerson,
      customerType: c.customerType
    }
  }))
}

async function searchSuppliers(query: string, limit: number): Promise<SearchResult[]> {
  const suppliers = await prisma.supplier.findMany({
    where: {
      isActive: true,
      isDeleted: false,
      OR: query ? [
        { name: { contains: query, mode: "insensitive" } },
        { supplierNumber: { contains: query, mode: "insensitive" } },
        { contactPerson: { contains: query, mode: "insensitive" } },
        { email: { contains: query, mode: "insensitive" } },
      ] : undefined
    },
    take: limit,
    select: {
      id: true,
      name: true,
      supplierNumber: true,
      email: true,
      phone: true,
      contactPerson: true,
    },
    orderBy: { name: "asc" }
  })

  return suppliers.map(s => ({
    id: s.id,
    value: s.id,
    label: `${s.name} ${s.supplierNumber ? `(${s.supplierNumber})` : ''}`,
    subtitle: s.contactPerson || s.email || s.phone || undefined,
    metadata: {
      supplierNumber: s.supplierNumber,
      email: s.email,
      phone: s.phone,
      contactPerson: s.contactPerson
    }
  }))
}

async function searchProjects(query: string, limit: number): Promise<SearchResult[]> {
  const projects = await prisma.project.findMany({
    where: {
      isActive: true,
      OR: query ? [
        { name: { contains: query, mode: "insensitive" } },
        { projectNumber: { contains: query, mode: "insensitive" } },
        { description: { contains: query, mode: "insensitive" } },
      ] : undefined
    },
    take: limit,
    select: {
      id: true,
      name: true,
      projectNumber: true,
      description: true,
      status: true,
      Customer: {
        select: {
          name: true
        }
      }
    },
    orderBy: { createdAt: "desc" }
  })

  return projects.map(p => ({
    id: p.id,
    value: p.id,
    label: `${p.name} (${p.projectNumber})`,
    subtitle: p.Customer?.name || p.description || undefined,
    metadata: {
      projectNumber: p.projectNumber,
      description: p.description,
      status: p.status,
      customerName: p.Customer?.name
    }
  }))
}

async function searchUsers(query: string, limit: number): Promise<SearchResult[]> {
  const users = await prisma.user.findMany({
    where: {
      OR: query ? [
        { name: { contains: query, mode: "insensitive" } },
        { email: { contains: query, mode: "insensitive" } },
      ] : undefined
    },
    take: limit,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
    orderBy: { name: "asc" }
  })

  return users.map(u => ({
    id: u.id,
    value: u.id,
    label: u.name || u.email,
    subtitle: u.email !== u.name ? u.email : undefined,
    metadata: {
      email: u.email,
      role: u.role
    }
  }))
}

export const dynamic = "force-dynamic"
