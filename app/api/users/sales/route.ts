

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'


// GET /api/users/sales - Get all sales personnel
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only SUPERADMIN, PROJECT_MANAGER, FINANCE, and SALES can view sales personnel
    if (!['SUPERADMIN', 'PROJECT_MANAGER', 'FINANCE', 'SALES'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const salesPersonnel = await prisma.user.findMany({
      where: {
        role: {
          in: ['SALES', 'SUPERADMIN']
        },
        isActive: true
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        companyName: true
      },
      orderBy: [
        { firstName: 'asc' },
        { lastName: 'asc' }
      ]
    })

    // Format the response with display names
    const formattedSalesPersonnel = salesPersonnel.map((person: any) => ({
      id: person.id,
      firstName: person.firstName,
      lastName: person.lastName,
      email: person.email,
      companyName: person.companyName,
      displayName: `${person.firstName || ''} ${person.lastName || ''}`.trim() || person.email
    }))

    return NextResponse.json(formattedSalesPersonnel)

  } catch (error) {
    console.error('Error fetching sales personnel:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
