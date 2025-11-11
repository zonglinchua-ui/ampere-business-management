

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import bcrypt from 'bcryptjs'


export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = session.user?.role
    const canCleanup = ["SUPERADMIN"].includes(userRole || "")
    
    if (!canCleanup) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { action } = await request.json()

    if (action === 'cleanup_test_users') {
      // Keep only one essential superadmin account
      const currentUser = session.user?.email
      
      if (!currentUser) {
        return NextResponse.json({ error: 'No current user session' }, { status: 400 })
      }

      const password = await bcrypt.hash('admin123', 12) // Default password for the remaining admin

      // Delete all users except current session user  
      await prisma.user.deleteMany({
        where: {
          NOT: {
            email: currentUser
          }
        }
      })

      // Ensure the remaining user has proper admin details
      await prisma.user.update({
        where: {
          email: currentUser
        },
        data: {
          firstName: 'Super',
          lastName: 'Admin',
          role: 'SUPERADMIN',
          companyName: 'Ampere Engineering Pte Ltd',
          isActive: true,
          password: password
        }
      })

      return NextResponse.json({ 
        message: 'User cleanup completed successfully',
        remainingUsers: 1
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  } catch (error) {
    console.error('Error during user cleanup:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

