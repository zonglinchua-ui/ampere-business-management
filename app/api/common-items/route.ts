
import { NextRequest, NextResponse } from "next/server"
import { prisma } from '@/lib/db'
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"


// GET all common items
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '100')
    const page = parseInt(searchParams.get('page') || '1')
    const skip = (page - 1) * limit

    const items = await prisma.quotationItemLibrary.findMany({
      orderBy: [
        { usageCount: 'desc' },
        { lastUsedAt: 'desc' }
      ],
      take: limit,
      skip,
      include: {
        User: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      }
    })

    const total = await prisma.quotationItemLibrary.count()

    return NextResponse.json({
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    })
  } catch (error) {
    console.error('Error fetching common items:', error)
    return NextResponse.json(
      { error: "Failed to fetch common items" },
      { status: 500 }
    )
  }
}

// POST - Create new common item
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check role
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })

    if (!user || !['SUPERADMIN', 'PROJECT_MANAGER'].includes(user.role)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { description, category, unit, defaultPrice, sku } = body

    if (!description || !category || !unit || !defaultPrice) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Check if item already exists
    const existing = await prisma.quotationItemLibrary.findFirst({
      where: {
        description,
        category,
        unit
      }
    })

    if (existing) {
      return NextResponse.json(
        { error: "An item with this description, category, and unit already exists" },
        { status: 400 }
      )
    }

    const item = await prisma.quotationItemLibrary.create({
      data: {
        id: `qil_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        description,
        category,
        unit,
        averageUnitPrice: parseFloat(defaultPrice),
        lastUnitPrice: parseFloat(defaultPrice),
        usageCount: 0,
        createdById: session.user.id,
        lastUsedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      }
    })

    return NextResponse.json({ item }, { status: 201 })
  } catch (error) {
    console.error('Error creating common item:', error)
    return NextResponse.json(
      { error: "Failed to create common item" },
      { status: 500 }
    )
  }
}
