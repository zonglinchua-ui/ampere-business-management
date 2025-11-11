
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

// PUT /api/settings/tender-categories/[id] - Not supported for enum-based categories
export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
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
        error: 'Cannot modify enum-based categories. Tender categories are defined in the system schema.',
        info: 'Category metadata (display names, descriptions) cannot be modified as they are part of the system schema.'
      },
      { status: 400 }
    )
  } catch (error) {
    console.error('[TENDER_CATEGORIES_PUT]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/settings/tender-categories/[id] - Not supported for enum-based categories
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
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
        error: 'Cannot delete enum-based categories. Tender categories are defined in the system schema and cannot be deleted.',
        info: 'System categories are permanent and used throughout the application.'
      },
      { status: 400 }
    )
  } catch (error) {
    console.error('[TENDER_CATEGORIES_DELETE]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
