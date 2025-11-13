
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { uploadFile } from '@/lib/s3'


export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = session?.user?.role
    const canUseAI = ["SUPERADMIN", "FINANCE", "PROJECT_MANAGER"].includes(userRole || "")
    
    if (!canUseAI) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Max size is 10MB' }, { status: 400 })
    }

    // Check file type
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'image/jpeg',
      'image/png',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv'
    ]

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'File type not supported' }, { status: 400 })
    }

    // Convert file to buffer and upload to S3
    const buffer = Buffer.from(await file.arrayBuffer())
    const cloudStoragePath = await uploadFile(buffer, file.name)

    // Save document record to database
    const document = await prisma.document.create({
      data: {
        id: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        filename: file.name,
        originalName: file.name,
        mimetype: file.type,
        size: file.size,
        cloudStoragePath: cloudStoragePath,
        uploadedById: session.user?.id || '',
        category: 'GENERAL',
        description: 'AI Assistant uploaded document',
        updatedAt: new Date()
      }
    })

    return NextResponse.json({
      document: {
        id: document.id,
        filename: file.name,
        cloudStoragePath: cloudStoragePath,
        uploadedAt: document.createdAt.toISOString()
      }
    })

  } catch (error: any) {
    console.error('Document upload error:', error)
    console.error('Error stack:', error.stack)
    console.error('Error message:', error.message)
    return NextResponse.json(
      { 
        error: 'Failed to upload document',
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}
