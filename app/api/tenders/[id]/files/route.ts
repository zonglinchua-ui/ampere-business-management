// File: app/api/tenders/[id]/files/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { writeFile, readdir, unlink, stat, readFile } from 'fs/promises'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import { prisma } from '@/lib/db'

const NAS_BASE_PATH = 'A:\\AMPERE WEB SERVER\\TENDER'

// Helper to get tender folder path
async function getTenderFolderPath(tenderId: string) {
  try {
    // Fetch tender from database with customer information
    const tender = await prisma.tender.findUnique({
      where: { id: tenderId },
      include: { Customer: true }
    })
    
    if (!tender) {
      throw new Error('Tender not found')
    }

    // Create folder path: A:\AMPERE WEB SERVER\TENDER\{CUSTOMER}\{TENDER}\
    const customerName = tender.Customer?.name || 'Unknown Customer'
    const tenderTitle = tender.title || 'Unknown Tender'
    
    const folderPath = join(NAS_BASE_PATH, customerName, tenderTitle)
    
    // Create folder if it doesn't exist
    if (!existsSync(folderPath)) {
      mkdirSync(folderPath, { recursive: true })
    }
    
    return folderPath
  } catch (error) {
    console.error('Error getting tender folder path:', error)
    throw error
  }
}

// GET - List files or download a specific file
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenderId = params.id
    const searchParams = request.nextUrl.searchParams
    const filename = searchParams.get('filename')
    
    const folderPath = await getTenderFolderPath(tenderId)

    // If filename is provided, download the file
    if (filename) {
      const filePath = join(folderPath, filename)
      
      if (!existsSync(filePath)) {
        return NextResponse.json(
          { error: 'File not found' },
          { status: 404 }
        )
      }

      const fileBuffer = await readFile(filePath)
      
      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      })
    }

    // Otherwise, list all files
    if (!existsSync(folderPath)) {
      // Folder doesn't exist yet, return empty list
      return NextResponse.json({ files: [] })
    }

    const files = await readdir(folderPath)
    
    const fileDetails = await Promise.all(
      files.map(async (filename) => {
        const filePath = join(folderPath, filename)
        const stats = await stat(filePath)
        
        return {
          name: filename,
          size: stats.size,
          modifiedAt: stats.mtime.toISOString(),
          type: filename.split('.').pop() || 'unknown',
        }
      })
    )

    return NextResponse.json({ files: fileDetails })
  } catch (error) {
    console.error('Error in GET /api/tenders/[id]/files:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process request' },
      { status: 500 }
    )
  }
}

// POST - Upload a file
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenderId = params.id
    const formData = await request.formData()
    const file = formData.get('file') as File
    const relativePath = formData.get('relativePath') as string | null
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    const baseFolderPath = await getTenderFolderPath(tenderId)
    
    // Use relative path if provided, otherwise just the filename
    const fileRelativePath = relativePath || file.name
    const filePath = join(baseFolderPath, fileRelativePath)
    
    // Create subdirectories if they don't exist
    const fileDir = join(baseFolderPath, ...fileRelativePath.split('/').slice(0, -1))
    if (!existsSync(fileDir)) {
      mkdirSync(fileDir, { recursive: true })
    }

    // Check if file already exists
    if (existsSync(filePath)) {
      return NextResponse.json(
        { error: 'File already exists' },
        { status: 409 }
      )
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    
    await writeFile(filePath, buffer)

    return NextResponse.json({
      message: 'File uploaded successfully',
      filename: fileRelativePath,
    })
  } catch (error) {
    console.error('Error in POST /api/tenders/[id]/files:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload file' },
      { status: 500 }
    )
  }
}

// DELETE - Delete a file
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenderId = params.id
    const searchParams = request.nextUrl.searchParams
    const filename = searchParams.get('filename')
    
    if (!filename) {
      return NextResponse.json(
        { error: 'Filename is required' },
        { status: 400 }
      )
    }

    const folderPath = await getTenderFolderPath(tenderId)
    const filePath = join(folderPath, filename)

    if (!existsSync(filePath)) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      )
    }

    await unlink(filePath)

    return NextResponse.json({
      message: 'File deleted successfully',
      filename,
    })
  } catch (error) {
    console.error('Error in DELETE /api/tenders/[id]/files:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete file' },
      { status: 500 }
    )
  }
}

