
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'


export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        userId: true,
        phone: true,
        role: true,
        isActive: true,
        whatsappNotifications: true,
        createdAt: true,
        lastLoginAt: true,
        companyName: true
      },
      orderBy: [
        { isActive: 'desc' }, // Show active users first
        { firstName: 'asc' },
        { lastName: 'asc' }
      ]
    })

    // Always return an array, even if query fails
    return NextResponse.json(Array.isArray(users) ? users : [])

  } catch (error) {
    console.error('Error fetching users:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    // Return empty array instead of error to prevent .map() errors
    return NextResponse.json([])
  }
}

// POST /api/users - Create new user
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = session.user?.role
    const canCreate = ["SUPERADMIN"].includes(userRole || "")
    
    if (!canCreate) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const data = await request.json()

    // Validate required fields
    if (!data.firstName || !data.lastName || !data.email || !data.role || !data.password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email }
    })

    if (existingUser) {
      return NextResponse.json({ error: 'Email already exists' }, { status: 400 })
    }

    // Check if userId already exists (if provided)
    if (data.userId) {
      const existingUserWithUserId = await prisma.user.findUnique({
        where: { userId: data.userId }
      })

      if (existingUserWithUserId) {
        return NextResponse.json({ error: 'User ID already exists' }, { status: 400 })
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 12)

    // Create user
    const newUser = await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        firstName: data.firstName,
        lastName: data.lastName,
        name: data.userId || `${data.firstName} ${data.lastName}`, // Use userId if provided, otherwise full name
        email: data.email,
        userId: data.userId || null,
        phone: data.phone || null,
        role: data.role,
        password: hashedPassword,
        companyName: data.companyName || null,
        whatsappNotifications: data.whatsappNotifications ?? true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        userId: true,
        phone: true,
        role: true,
        isActive: true,
        whatsappNotifications: true,
        createdAt: true,
        lastLoginAt: true,
        companyName: true
      }
    })

    return NextResponse.json(newUser, { status: 201 })

  } catch (error) {
    console.error('Error creating user:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
