
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { v4 as uuidv4 } from 'uuid'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const companyProfile = await prisma.companyProfile.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ companyProfile })
  } catch (error) {
    console.error('Error fetching company profile:', error)
    return NextResponse.json(
      { error: 'Failed to fetch company profile' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Check if profile already exists
    const existingProfile = await prisma.companyProfile.findFirst({
      where: { isActive: true }
    })

    if (existingProfile) {
      // Update existing profile
      const updated = await prisma.companyProfile.update({
        where: { id: existingProfile.id },
        data: {
          ...body,
          updatedAt: new Date()
        }
      })

      return NextResponse.json({ 
        companyProfile: updated,
        message: 'Company profile updated successfully'
      })
    } else {
      // Create new profile
      const profile = await prisma.companyProfile.create({
        data: {
          id: uuidv4(),
          ...body,
          createdById: session.user.id,
          updatedAt: new Date()
        }
      })

      return NextResponse.json({ 
        companyProfile: profile,
        message: 'Company profile created successfully'
      }, { status: 201 })
    }
  } catch (error) {
    console.error('Error saving company profile:', error)
    return NextResponse.json(
      { error: 'Failed to save company profile' },
      { status: 500 }
    )
  }
}
