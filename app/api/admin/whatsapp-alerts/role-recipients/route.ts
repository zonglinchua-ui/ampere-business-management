import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

// GET /api/admin/whatsapp-alerts/role-recipients - Get all role recipients
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'SUPERADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized - Super admin access required' },
        { status: 403 }
      )
    }

    const roleRecipients = await prisma.whatsAppRoleRecipients.findMany({
      orderBy: {
        roleName: 'asc'
      }
    })

    return NextResponse.json({ roleRecipients })
  } catch (error) {
    console.error('[WhatsApp Role Recipients] Error fetching recipients:', error)
    return NextResponse.json(
      { error: 'Failed to fetch role recipients' },
      { status: 500 }
    )
  }
}

// POST /api/admin/whatsapp-alerts/role-recipients - Create or update role recipients
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'SUPERADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized - Super admin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { roleName, phoneNumbers, enabled } = body

    if (!roleName || !phoneNumbers || !Array.isArray(phoneNumbers)) {
      return NextResponse.json(
        { error: 'Role name and phone numbers array are required' },
        { status: 400 }
      )
    }

    // Validate phone numbers format
    const phoneRegex = /^\+\d{1,4}\d{6,14}$/
    const invalidNumbers = phoneNumbers.filter((num: string) => !phoneRegex.test(num))
    
    if (invalidNumbers.length > 0) {
      return NextResponse.json(
        { error: `Invalid phone numbers: ${invalidNumbers.join(', ')}` },
        { status: 400 }
      )
    }

    // Upsert the role recipients
    const roleRecipient = await prisma.whatsAppRoleRecipients.upsert({
      where: {
        roleName
      },
      update: {
        phoneNumbers,
        enabled: enabled ?? true
      },
      create: {
        roleName,
        phoneNumbers,
        enabled: enabled ?? true
      }
    })

    return NextResponse.json({ roleRecipient })
  } catch (error) {
    console.error('[WhatsApp Role Recipients] Error saving recipients:', error)
    return NextResponse.json(
      { error: 'Failed to save role recipients' },
      { status: 500 }
    )
  }
}
