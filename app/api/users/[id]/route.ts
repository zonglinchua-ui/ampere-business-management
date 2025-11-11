

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import bcrypt from 'bcryptjs'


// GET /api/users/[id] - Get single user
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = session.user?.role
    const canView = ["SUPERADMIN"].includes(userRole || "") || session.user?.id === params.id
    
    if (!canView) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const user = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        userId: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
        companyName: true
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json(user)

  } catch (error) {
    console.error('Error fetching user:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT /api/users/[id] - Update user
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = session.user?.role
    const canEdit = ["SUPERADMIN"].includes(userRole || "") || session.user?.id === params.id
    const isSelfUpdate = session.user?.id === params.id
    const isAdmin = ["SUPERADMIN"].includes(userRole || "")
    
    if (!canEdit) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const data = await request.json()

    // Check if this is a status-only update (for activate/deactivate) - admin only
    const isStatusOnlyUpdate = Object.keys(data).length === 1 && data.hasOwnProperty('isActive')
    const isPasswordOnlyUpdate = Object.keys(data).length === 1 && data.hasOwnProperty('password')

    // Prepare update data
    const updateData: any = {
      updatedAt: new Date()
    }

    // Handle status-only updates (activate/deactivate) - admin only
    if (isStatusOnlyUpdate && isAdmin) {
      updateData.isActive = data.isActive
    }
    // Handle password-only updates - admin only
    else if (isPasswordOnlyUpdate && isAdmin) {
      updateData.password = await bcrypt.hash(data.password, 12)
    }
    // Handle profile updates
    else {
      // For self-updates, validate required fields differently
      if (isSelfUpdate) {
        if (!data.firstName || !data.lastName || !data.email) {
          return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }
      } else if (isAdmin) {
        // Admin updating other users
        if (!data.firstName || !data.lastName || !data.email || !data.role) {
          return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }
      }

      // Check if email is already taken by another user
      const existingUser = await prisma.user.findFirst({
        where: {
          email: data.email,
          id: { not: params.id }
        }
      })

      if (existingUser) {
        return NextResponse.json({ error: 'Email already exists' }, { status: 400 })
      }

      // Check if userId is already taken by another user (if provided)
      if (data.userId) {
        const existingUserWithUserId = await prisma.user.findFirst({
          where: {
            userId: data.userId,
            id: { not: params.id }
          }
        })

        if (existingUserWithUserId) {
          return NextResponse.json({ error: 'User ID already exists' }, { status: 400 })
        }
      }

      updateData.firstName = data.firstName
      updateData.lastName = data.lastName
      updateData.email = data.email
      updateData.userId = data.userId || null
      updateData.companyName = data.companyName || null

      // Only admins can change role and status for other users
      if (isAdmin && !isSelfUpdate) {
        updateData.role = data.role
        updateData.isActive = data.isActive !== undefined ? data.isActive : true
      }

      // Handle password change
      if (data.newPassword && data.newPassword.length > 0) {
        // For self-updates, verify current password
        if (isSelfUpdate) {
          if (!data.currentPassword) {
            return NextResponse.json({ error: 'Current password is required' }, { status: 400 })
          }

          // Get current user to verify password
          const currentUser = await prisma.user.findUnique({
            where: { id: params.id },
            select: { password: true }
          })

          if (!currentUser || !currentUser.password) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
          }

          // Verify current password
          const isPasswordValid = await bcrypt.compare(data.currentPassword, currentUser.password)
          if (!isPasswordValid) {
            return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })
          }
        }

        // Hash new password
        updateData.password = await bcrypt.hash(data.newPassword, 12)
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: params.id },
      data: updateData,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        userId: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
        companyName: true
      }
    })

    return NextResponse.json(updatedUser)

  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/users/[id] - Deactivate user
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = session.user?.role
    const canDelete = ["SUPERADMIN"].includes(userRole || "")
    
    if (!canDelete) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Don't allow deletion of current user
    if (params.id === session.user?.id) {
      return NextResponse.json({ error: 'Cannot deactivate your own account' }, { status: 400 })
    }

    // Deactivate user instead of hard delete
    const updatedUser = await prisma.user.update({
      where: { id: params.id },
      data: { 
        isActive: false,
        updatedAt: new Date()
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        isActive: true
      }
    })

    return NextResponse.json(updatedUser)

  } catch (error) {
    console.error('Error deactivating user:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

