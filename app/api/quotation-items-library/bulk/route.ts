

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { v4 as uuidv4 } from 'uuid'


export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = session.user?.role
    const canManageLibrary = ["SUPERADMIN", "PROJECT_MANAGER", "ADMIN"].includes(userRole || "")
    
    if (!canManageLibrary) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { items } = await request.json()

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Items array is required' }, { status: 400 })
    }

    // Bulk insert/update items
    const results = await Promise.all(
      items.map(async (item: any) => {
        if (!item.description || !item.category || !item.unit || item.unitPrice === undefined) {
          return null // Skip invalid items
        }

        try {
          return await prisma.quotationItemLibrary.upsert({
            where: {
              description_category_unit: {
                description: item.description,
                category: item.category,
                unit: item.unit
              }
            },
            update: {
              averageUnitPrice: Number(item.unitPrice),
              lastUnitPrice: Number(item.unitPrice),
              updatedAt: new Date()
            },
            create: {
              id: uuidv4(),
              description: item.description,
              category: item.category,
              unit: item.unit,
              averageUnitPrice: Number(item.unitPrice),
              lastUnitPrice: Number(item.unitPrice),
              usageCount: 0,
              createdById: session.user?.id || '',
              lastUsedAt: new Date(),
              updatedAt: new Date()
            }
          })
        } catch (error) {
          console.error('Error processing item:', item, error)
          return null
        }
      })
    )

    const successCount = results.filter(r => r !== null).length

    return NextResponse.json({ 
      message: `Successfully processed ${successCount} items`,
      processed: successCount,
      total: items.length 
    })

  } catch (error) {
    console.error('Error bulk updating items library:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

