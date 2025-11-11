
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

/**
 * GET /api/suppliers/list
 * Returns a simplified list of active suppliers for dropdowns
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const search = searchParams.get("search") || ""
    const limit = parseInt(searchParams.get("limit") || "500")

    const where = {
      isActive: true,
      isDeleted: false, // Exclude soft-deleted suppliers
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { supplierNumber: { contains: search, mode: "insensitive" as const } },
          { contactPerson: { contains: search, mode: "insensitive" as const } },
        ],
      }),
    }

    const suppliers = await prisma.supplier.findMany({
      where,
      take: limit,
      select: {
        id: true,
        name: true,
        supplierNumber: true,
        email: true,
        phone: true,
        contactPerson: true,
      },
      orderBy: [
        { name: "asc" },
      ],
    })

    return NextResponse.json({
      suppliers,
      count: suppliers.length,
    })
  } catch (error) {
    console.error("GET /api/suppliers/list error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export const dynamic = "force-dynamic"
