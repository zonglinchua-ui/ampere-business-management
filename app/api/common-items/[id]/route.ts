
import { NextRequest, NextResponse } from "next/server"
import { prisma } from '@/lib/db'
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"


// GET single item
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const item = await prisma.quotationItemLibrary.findUnique({
      where: { id: params.id },
      include: {
        User: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      }
    })

    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 })
    }

    return NextResponse.json({ item })
  } catch (error) {
    console.error('Error fetching common item:', error)
    return NextResponse.json(
      { error: "Failed to fetch common item" },
      { status: 500 }
    )
  }
}

// PUT - Update item
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    const { description, category, unit, defaultPrice } = body

    if (!description || !category || !unit || !defaultPrice) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Check if item exists
    const existing = await prisma.quotationItemLibrary.findUnique({
      where: { id: params.id }
    })

    if (!existing) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 })
    }

    // Update the item (keep usage stats, only update description/price/etc)
    const item = await prisma.quotationItemLibrary.update({
      where: { id: params.id },
      data: {
        description,
        category,
        unit,
        averageUnitPrice: parseFloat(defaultPrice),
        updatedAt: new Date()
      }
    })

    return NextResponse.json({ item })
  } catch (error) {
    console.error('Error updating common item:', error)
    return NextResponse.json(
      { error: "Failed to update common item" },
      { status: 500 }
    )
  }
}

// DELETE - Delete item
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    await prisma.quotationItemLibrary.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting common item:', error)
    return NextResponse.json(
      { error: "Failed to delete common item" },
      { status: 500 }
    )
  }
}
