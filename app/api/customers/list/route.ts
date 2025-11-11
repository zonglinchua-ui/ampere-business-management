
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

/**
 * GET /api/customers/list
 * Returns a simplified list of active customers for dropdowns
 * 
 * NOTE: The Customer table stores ALL contacts (customers, suppliers, general contacts).
 * This endpoint filters for contacts where isCustomer = true OR null (backwards compatibility).
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

    // Build the where clause properly for Prisma
    const whereConditions: any = {
      AND: [
        { isActive: true },
        { isDeleted: false }, // Exclude soft-deleted customers
        // ✅ Fetch contacts where isCustomer is true OR null (for backwards compatibility)
        {
          OR: [
            { isCustomer: true },
            { isCustomer: null }, // Include legacy customers without explicit flag
          ],
        },
      ],
    }

    // Add search conditions if provided
    if (search) {
      whereConditions.AND.push({
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { customerNumber: { contains: search, mode: "insensitive" as const } },
          { contactPerson: { contains: search, mode: "insensitive" as const } },
        ],
      })
    }

    const customers = await prisma.customer.findMany({
      where: whereConditions,
      take: limit,
      select: {
        id: true,
        name: true,
        customerNumber: true,
        email: true,
        contactPerson: true,
        customerType: true,
      },
      orderBy: [
        { name: "asc" },
      ],
    })

    return NextResponse.json({
      customers,
      count: customers.length,
    })
  } catch (error) {
    console.error("GET /api/customers/list error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export const dynamic = "force-dynamic"
