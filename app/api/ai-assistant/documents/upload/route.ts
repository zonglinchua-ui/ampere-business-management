
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { v4 as uuidv4 } from 'uuid'
import { promises as fs } from 'fs'
import path from 'path'
import { getNASPath } from '@/lib/nas-storage'


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

    // Get NAS base path
    const nasBasePath = await getNASPath()
    if (!nasBasePath) {
      return NextResponse.json({ error: 'NAS path not configured' }, { status: 500 })
    }

    // Create PROCESSED DOCUMENT folder structure
    const processedDocPath = path.join(nasBasePath, 'PROCESSED DOCUMENT')
    await fs.mkdir(processedDocPath, { recursive: true })

    // Generate unique filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const fileExt = path.extname(file.name)
    const fileBaseName = path.basename(file.name, fileExt)
    const uniqueFileName = `${timestamp}_${fileBaseName}${fileExt}`
    const filePath = path.join(processedDocPath, uniqueFileName)

    // Convert file to buffer and save to NAS
    const buffer = Buffer.from(await file.arrayBuffer())
    await fs.writeFile(filePath, buffer)

    console.log(`[AI Document Upload] ✅ File saved to NAS: ${filePath}`)

    // Save document record to database
    const document = await prisma.document.create({
      data: {
        id: uuidv4(),
        filename: uniqueFileName,
        originalName: file.name,
        mimetype: file.type,
        size: file.size,
        cloudStoragePath: filePath, // Store NAS path instead of S3 path
        description: 'AI Assistant uploaded document',
        category: 'GENERAL',
        uploadedById: session.user?.id || '',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    })

    return NextResponse.json({
      document: {
        id: document.id,
        filename: uniqueFileName,
        originalName: file.name,
        cloudStoragePath: filePath,
        uploadedAt: document.createdAt.toISOString()
      }
    })

  } catch (error: any) {
    console.error('[AI Document Upload] ❌ Error:', error)
    console.error('[AI Document Upload] Error stack:', error.stack)
    console.error('[AI Document Upload] Error message:', error.message)
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
