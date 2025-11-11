import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import fs from 'fs'
import path from 'path'
import { writeFile } from 'fs/promises'

/**
 * GET - List files in a tender's NAS folder (with subfolder support)
 * Query params: tenderId, subPath (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const tenderId = searchParams.get('tenderId')
    const subPath = searchParams.get('subPath') || ''

    if (!tenderId) {
      return NextResponse.json({ error: 'Tender ID is required' }, { status: 400 })
    }

    // Get tender with NAS path
    const tender = await prisma.tender.findUnique({
      where: { id: tenderId },
      select: {
        id: true,
        tenderNumber: true,
        title: true,
        nasDocumentPath: true,
        Customer: {
          select: {
            name: true
          }
        }
      }
    })

    if (!tender) {
      return NextResponse.json({ error: 'Tender not found' }, { status: 404 })
    }

    if (!tender.nasDocumentPath) {
      return NextResponse.json({ 
        files: [],
        message: 'No NAS folder configured for this tender',
        tender: {
          id: tender.id,
          tenderNumber: tender.tenderNumber,
          title: tender.title,
          customerName: tender.Customer?.name
        }
      })
    }

    // Build full path with subPath
    const fullPath = path.join(tender.nasDocumentPath, subPath)
    
    // Security check: ensure the path is within the tender's NAS folder
    if (!fullPath.startsWith(tender.nasDocumentPath)) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
    }

    // Check if folder exists
    if (!fs.existsSync(fullPath)) {
      // Try to create the folder
      try {
        await fs.promises.mkdir(fullPath, { recursive: true })
      } catch (error) {
        console.error('Error creating NAS folder:', error)
      }
      
      return NextResponse.json({ 
        files: [],
        currentPath: subPath,
        message: 'Folder created',
        tender: {
          id: tender.id,
          tenderNumber: tender.tenderNumber,
          title: tender.title,
          customerName: tender.Customer?.name,
          nasPath: tender.nasDocumentPath
        }
      })
    }

    // Read directory contents
    const files = await fs.promises.readdir(fullPath, { withFileTypes: true })
    
    // Get file details
    const fileList = await Promise.all(
      files.map(async (file) => {
        const filePath = path.join(fullPath, file.name)
        const stats = await fs.promises.stat(filePath)
        
        return {
          name: file.name,
          size: stats.size,
          isDirectory: file.isDirectory(),
          createdAt: stats.birthtime,
          modifiedAt: stats.mtime,
          extension: path.extname(file.name).toLowerCase()
        }
      })
    )

    // Sort: directories first, then by name
    fileList.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1
      if (!a.isDirectory && b.isDirectory) return 1
      return a.name.localeCompare(b.name)
    })

    // Build breadcrumb path
    const breadcrumbs = subPath ? subPath.split(path.sep).filter(Boolean) : []

    return NextResponse.json({
      tender: {
        id: tender.id,
        tenderNumber: tender.tenderNumber,
        title: tender.title,
        customerName: tender.Customer?.name,
        nasPath: tender.nasDocumentPath
      },
      files: fileList,
      currentPath: subPath,
      breadcrumbs: breadcrumbs,
      totalFiles: fileList.filter(f => !f.isDirectory).length,
      totalFolders: fileList.filter(f => f.isDirectory).length
    })

  } catch (error) {
    console.error('Error listing tender files:', error)
    return NextResponse.json(
      { error: 'Failed to list files', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * POST - Upload file or create folder
 * Body: FormData with 'file' and 'tenderId' for upload
 *       OR JSON with 'tenderId', 'folderName', 'subPath' for folder creation
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const contentType = request.headers.get('content-type') || ''

    // Check if this is a folder creation request (JSON) or file upload (FormData)
    if (contentType.includes('application/json')) {
      // Folder creation
      const { tenderId, folderName, subPath } = await request.json()

      if (!tenderId || !folderName) {
        return NextResponse.json({ error: 'Tender ID and folder name are required' }, { status: 400 })
      }

      // Get tender with NAS path
      const tender = await prisma.tender.findUnique({
        where: { id: tenderId },
        select: {
          id: true,
          nasDocumentPath: true
        }
      })

      if (!tender) {
        return NextResponse.json({ error: 'Tender not found' }, { status: 404 })
      }

      if (!tender.nasDocumentPath) {
        return NextResponse.json({ error: 'No NAS folder configured for this tender' }, { status: 400 })
      }

      // Sanitize folder name
      const sanitizedFolderName = folderName
        .replace(/[<>:"/\\|?*]/g, '')
        .replace(/\s+/g, ' ')
        .trim()

      // Build full path
      const basePath = path.join(tender.nasDocumentPath, subPath || '')
      const folderPath = path.join(basePath, sanitizedFolderName)

      // Security check
      if (!folderPath.startsWith(tender.nasDocumentPath)) {
        return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
      }

      // Create folder
      await fs.promises.mkdir(folderPath, { recursive: true })

      return NextResponse.json({
        success: true,
        message: 'Folder created successfully',
        folderName: sanitizedFolderName
      })
    } else {
      // File upload
      const formData = await request.formData()
      const file = formData.get('file') as File | null
      const tenderId = formData.get('tenderId') as string | null
      const subPath = (formData.get('subPath') as string) || ''

      console.log('Upload request received:', { 
        hasFile: !!file, 
        fileName: file?.name,
        fileSize: file?.size,
        tenderId,
        subPath
      })

      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 })
      }

      if (!tenderId) {
        return NextResponse.json({ error: 'Tender ID is required' }, { status: 400 })
      }

      // Get tender with NAS path
      const tender = await prisma.tender.findUnique({
        where: { id: tenderId },
        select: {
          id: true,
          tenderNumber: true,
          nasDocumentPath: true
        }
      })

      if (!tender) {
        return NextResponse.json({ error: 'Tender not found' }, { status: 404 })
      }

      if (!tender.nasDocumentPath) {
        return NextResponse.json({ error: 'No NAS folder configured for this tender' }, { status: 400 })
      }

      // Build upload path with subPath
      const uploadPath = path.join(tender.nasDocumentPath, subPath)

      // Security check
      if (!uploadPath.startsWith(tender.nasDocumentPath)) {
        return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
      }

      // Ensure folder exists
      await fs.promises.mkdir(uploadPath, { recursive: true })

      // Sanitize filename
      const sanitizedFilename = file.name
        .replace(/[<>:"/\\|?*]/g, '')
        .replace(/\s+/g, ' ')
        .trim()

      // Create full file path
      let filePath = path.join(uploadPath, sanitizedFilename)
      let finalFilename = sanitizedFilename

      // Check if file already exists
      if (fs.existsSync(filePath)) {
        // Add timestamp to filename to avoid overwrite
        const ext = path.extname(sanitizedFilename)
        const nameWithoutExt = path.basename(sanitizedFilename, ext)
        const timestamp = Date.now()
        finalFilename = `${nameWithoutExt}_${timestamp}${ext}`
        filePath = path.join(uploadPath, finalFilename)
      }

      // Convert file to buffer and write
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      
      await writeFile(filePath, buffer)

      console.log('File uploaded successfully:', { filePath, size: buffer.length })

      return NextResponse.json({
        success: true,
        message: 'File uploaded successfully',
        file: {
          name: finalFilename,
          originalName: file.name,
          size: file.size,
          path: filePath
        }
      })
    }

  } catch (error) {
    console.error('Error in POST:', error)
    return NextResponse.json(
      { error: 'Operation failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE - Delete file or folder
 * Body: { tenderId, filename, subPath }
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { tenderId, filename, subPath } = await request.json()

    if (!tenderId || !filename) {
      return NextResponse.json({ error: 'Tender ID and filename are required' }, { status: 400 })
    }

    // Get tender with NAS path
    const tender = await prisma.tender.findUnique({
      where: { id: tenderId },
      select: {
        id: true,
        nasDocumentPath: true
      }
    })

    if (!tender) {
      return NextResponse.json({ error: 'Tender not found' }, { status: 404 })
    }

    if (!tender.nasDocumentPath) {
      return NextResponse.json({ error: 'No NAS folder configured for this tender' }, { status: 400 })
    }

    const basePath = path.join(tender.nasDocumentPath, subPath || '')
    const filePath = path.join(basePath, filename)

    // Security check
    if (!filePath.startsWith(tender.nasDocumentPath)) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
    }

    // Check if file/folder exists
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'File or folder not found' }, { status: 404 })
    }

    // Check if it's a directory
    const stats = await fs.promises.stat(filePath)
    if (stats.isDirectory()) {
      // Delete directory recursively
      await fs.promises.rm(filePath, { recursive: true, force: true })
      return NextResponse.json({
        success: true,
        message: 'Folder deleted successfully',
        filename: filename
      })
    } else {
      // Delete file
      await fs.promises.unlink(filePath)
      return NextResponse.json({
        success: true,
        message: 'File deleted successfully',
        filename: filename
      })
    }

  } catch (error) {
    console.error('Error deleting:', error)
    return NextResponse.json(
      { error: 'Failed to delete', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

