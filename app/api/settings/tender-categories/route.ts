
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

// GET /api/settings/tender-categories - List all tender categories (from enum)
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Return the enum values as a structured list
    // These are the fixed Prisma enum values
    const defaultCategories = [
      { id: 'CONSTRUCTION', name: 'CONSTRUCTION', displayName: 'Construction', description: 'Construction projects and works', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: 'ENGINEERING', name: 'ENGINEERING', displayName: 'Engineering', description: 'Engineering services and projects', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: 'SUPPLY', name: 'SUPPLY', displayName: 'Supply', description: 'Supply of materials and equipment', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: 'CONSULTING', name: 'CONSULTING', displayName: 'Consulting', description: 'Consulting and advisory services', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: 'MAINTENANCE', name: 'MAINTENANCE', displayName: 'Maintenance', description: 'Maintenance and repair works', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: 'INSTALLATION', name: 'INSTALLATION', displayName: 'Installation', description: 'Installation services', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: 'REINSTATEMENT', name: 'REINSTATEMENT', displayName: 'Reinstatement', description: 'Reinstatement works', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: 'GENERAL', name: 'GENERAL', displayName: 'General', description: 'General tender category', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    ]

    return NextResponse.json(defaultCategories)
  } catch (error) {
    console.error('[TENDER_CATEGORIES_GET]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/settings/tender-categories - Not supported for enum-based categories
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is superadmin
    const user = await prisma.user.findUnique({
      where: { email: session.user?.email || '' }
    })

    if (user?.role !== 'SUPERADMIN') {
      return NextResponse.json(
        { error: 'Only superadmin can manage tender categories' },
        { status: 403 }
      )
    }

    return NextResponse.json(
      { 
        error: 'Cannot add new categories dynamically. Tender categories are defined in the system schema. Please contact system administrator to add new categories.',
        info: 'To add a new category, it must be added to the TenderCategory enum in the Prisma schema and a database migration must be run.'
      },
      { status: 400 }
    )
  } catch (error) {
    console.error('[TENDER_CATEGORIES_POST]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
