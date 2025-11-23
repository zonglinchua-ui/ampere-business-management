
import { NextRequest, NextResponse } from "next/server"
import { prisma } from '@/lib/db'
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"


// Track usage of items when added to quotations
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { items } = body // Array of { description, category, unit, unitPrice }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "No items provided" }, { status: 400 })
    }

    const updates = []

    for (const item of items) {
      // Find matching item in library
      const libraryItem = await prisma.quotationItemLibrary.findFirst({
        where: {
          description: item.description,
          category: item.category,
          unit: item.unit
        }
      })

      if (libraryItem) {
        // Update usage stats
        const newUsageCount = libraryItem.usageCount + 1
        const newAveragePrice = (
          (Number(libraryItem.averageUnitPrice) * libraryItem.usageCount + item.unitPrice) / 
          newUsageCount
        )

        updates.push(
          prisma.quotationItemLibrary.update({
            where: { id: libraryItem.id },
            data: {
              usageCount: newUsageCount,
              lastUnitPrice: item.unitPrice,
              averageUnitPrice: newAveragePrice,
              lastUsedAt: new Date(),
              updatedAt: new Date()
            }
          })
        )
      } else {
        // Create new library item automatically
        updates.push(
          prisma.quotationItemLibrary.create({
            data: {
              id: `qil_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              description: item.description,
              category: item.category,
              unit: item.unit,
              averageUnitPrice: item.unitPrice,
              lastUnitPrice: item.unitPrice,
              usageCount: 1,
              createdById: session.user.id,
              lastUsedAt: new Date(),
              createdAt: new Date(),
              updatedAt: new Date()
            }
          })
        )
      }
    }

    // Execute all updates
    await Promise.all(updates)

    return NextResponse.json({ success: true, updated: updates.length })
  } catch (error) {
    console.error('Error tracking usage:', error)
    return NextResponse.json(
      { error: "Failed to track usage" },
      { status: 500 }
    )
  }
}
