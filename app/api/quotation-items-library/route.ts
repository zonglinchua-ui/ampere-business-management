

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'


export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const category = searchParams.get('category')
    const limit = parseInt(searchParams.get('limit') || '50')

    // Build where condition based on filters
    let where: any = {}
    
    if (search) {
      where.description = {
        contains: search,
        mode: 'insensitive'
      }
    }
    
    if (category && category !== 'ALL') {
      where.category = category
    }

    // Get items from our dedicated library table
    const libraryItems = await prisma.quotationItemLibrary.findMany({
      where,
      orderBy: [
        { usageCount: 'desc' },
        { lastUsedAt: 'desc' }
      ],
      take: limit,
      include: {
        User: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      }
    })

    const itemsLibrary = libraryItems.map((item: any) => ({
      id: item.id,
      description: item.description,
      category: item.category,
      unit: item.unit,
      averageUnitPrice: Number(item.averageUnitPrice),
      lastUnitPrice: Number(item.lastUnitPrice),
      usageCount: item.usageCount,
      lastUsedAt: item.lastUsedAt.toISOString(),
      createdBy: item.User ? `${item.User.firstName} ${item.User.lastName}` : 'Unknown',
      createdAt: item.createdAt.toISOString()
    }))

    return NextResponse.json(itemsLibrary)

  } catch (error) {
    console.error('Error fetching items library:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

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

    const data = await request.json()

    // Validate required fields
    if (!data.description || !data.category || !data.unit || data.unitPrice === undefined) {
      return NextResponse.json({ 
        error: 'Description, category, unit, and unit price are required' 
      }, { status: 400 })
    }

    // Add or update item in library
    const item = await prisma.quotationItemLibrary.upsert({
      where: {
        description_category_unit: {
          description: data.description,
          category: data.category,
          unit: data.unit
        }
      },
      update: {
        averageUnitPrice: Number(data.unitPrice),
        lastUnitPrice: Number(data.unitPrice),
        updatedAt: new Date()
      },
      create: {
        id: `qitem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        description: data.description,
        category: data.category,
        unit: data.unit,
        averageUnitPrice: Number(data.unitPrice),
        lastUnitPrice: Number(data.unitPrice),
        usageCount: 0,
        createdById: session.user?.id || '',
        lastUsedAt: new Date(),
        updatedAt: new Date()
      }
    })

    return NextResponse.json({
      id: item.id,
      description: item.description,
      category: item.category,
      unit: item.unit,
      averageUnitPrice: Number(item.averageUnitPrice),
      usageCount: item.usageCount
    })

  } catch (error) {
    console.error('Error updating items library:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = session.user?.role
    const canManageLibrary = ["SUPERADMIN", "PROJECT_MANAGER"].includes(userRole || "")
    
    if (!canManageLibrary) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const itemId = searchParams.get('id')

    if (!itemId) {
      return NextResponse.json({ error: 'Item ID is required' }, { status: 400 })
    }

    await prisma.quotationItemLibrary.delete({
      where: { id: itemId }
    })

    return NextResponse.json({ message: 'Item deleted from library successfully' })

  } catch (error) {
    console.error('Error deleting from items library:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

