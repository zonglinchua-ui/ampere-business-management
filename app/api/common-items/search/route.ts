
import { NextRequest, NextResponse } from "next/server"
import { prisma } from '@/lib/db'
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"


export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q') || ''

    if (query.length < 2) {
      return NextResponse.json({ items: [] })
    }

    // Search items by description with case-insensitive matching
    const items = await prisma.quotationItemLibrary.findMany({
      where: {
        description: {
          contains: query,
          mode: 'insensitive'
        }
      },
      orderBy: [
        { usageCount: 'desc' },
        { lastUsedAt: 'desc' }
      ],
      take: 20
    })

    return NextResponse.json({ items })
  } catch (error) {
    console.error('Error searching common items:', error)
    return NextResponse.json(
      { error: "Failed to search common items" },
      { status: 500 }
    )
  }
}
