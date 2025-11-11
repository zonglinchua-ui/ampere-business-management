

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { downloadFile } from '@/lib/s3'
import { generateQuotationPDF } from '@/lib/pdf-generator'
import { saveToNAS, generateFileName } from '@/lib/nas-storage'
import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

const SETTINGS_FILE = path.join(process.cwd(), 'data', 'settings.json')

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch quotation with all related data
    const quotation = await prisma.quotation.findUnique({
      where: { id: params.id },
      include: {
        Customer: true,
        Tender: true,
        User_Quotation_salespersonIdToUser: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        },
        QuotationItem: {
          orderBy: {
            order: 'asc'
          }
        }
      }
    })

    if (!quotation) {
      return NextResponse.json({ error: 'Quotation not found' }, { status: 404 })
    }

    // Check if PDF exists in S3
    const existingPDF = await prisma.document.findFirst({
      where: {
        quotationId: params.id,
        category: 'PROPOSAL',
        isActive: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    let pdfBuffer: Buffer

    if (existingPDF && existingPDF.cloudStoragePath) {
      try {
        // Download from S3
        const signedUrl = await downloadFile(existingPDF.cloudStoragePath)
        const response = await fetch(signedUrl)
        if (!response.ok) {
          throw new Error('Failed to download from S3')
        }
        const arrayBuffer = await response.arrayBuffer()
        pdfBuffer = Buffer.from(arrayBuffer)
        console.log('Successfully downloaded existing PDF from S3')
      } catch (error) {
        console.error('Error downloading from S3, generating new PDF:', error)
        // Fall back to generating new PDF
        pdfBuffer = await generateNewQuotationPDF(quotation)
      }
    } else {
      console.log('No existing PDF found, generating new one')
      // Generate PDF on the fly
      pdfBuffer = await generateNewQuotationPDF(quotation)
    }

    // Load settings to get naming convention and NAS configuration
    let settings: any = {
      storage: {
        nasEnabled: false,
        nasPath: "",
        nasUsername: "",
        nasPassword: "",
        autoDownload: true,
        organizeFolders: true,
        namingConvention: "{quotationNumber}.{clientName}.{projectName}.{title}"
      }
    }

    try {
      if (fs.existsSync(SETTINGS_FILE)) {
        const fileContent = fs.readFileSync(SETTINGS_FILE, 'utf-8')
        const savedSettings = JSON.parse(fileContent)
        settings = { ...settings, ...savedSettings }
      }
    } catch (error) {
      console.error('Error reading settings:', error)
    }

    // Generate filename based on configured naming convention
    const clientName = quotation.Customer?.name || 'Unknown Client'
    const projectName = quotation.Tender?.title || 'General Project'
    const quotationTitle = quotation.title || 'Quotation'
    
    const quotationDataForNaming = {
      quotationNumber: quotation.quotationNumber,
      clientName,
      projectName,
      title: quotationTitle
    }

    const filename = generateFileName(settings.storage.namingConvention, quotationDataForNaming)

    // Save to NAS if enabled with year-based organization
    let nasPath = null
    if (settings.storage.nasEnabled && settings.storage.nasPath) {
      try {
        const nasResult = await saveToNAS(pdfBuffer, settings.storage, {
          ...quotationDataForNaming,
          documentType: 'quotations',
          createdAt: quotation.createdAt
        })
        if (nasResult.success) {
          nasPath = nasResult.path
          console.log('✅ PDF successfully saved to NAS:', nasResult.path)
        } else {
          console.error('❌ Failed to save to NAS:', nasResult.error)
        }
      } catch (error) {
        console.error('❌ Error saving to NAS:', error)
      }
    }

    // Log the export activity
    await prisma.quotationActivity.create({
      data: {
        id: uuidv4(),
        quotationId: params.id,
        action: 'EXPORTED',
        description: `Quotation PDF exported by ${session.user?.firstName} ${session.user?.lastName}${nasPath ? ` and saved to NAS: ${nasPath}` : ''}`,
        userId: session.user?.id || '',
        userEmail: session.user?.email || ''
      }
    })

    // Return the PDF as download
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })

  } catch (error) {
    console.error('❌ Error downloading quotation PDF:', error)
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Helper function to generate new PDF
async function generateNewQuotationPDF(quotation: any): Promise<Buffer> {
  const quotationData = {
    id: quotation.id,
    quotationNumber: quotation.quotationNumber,
    version: quotation.version,
    title: quotation.title,
    description: quotation.description,
    clientReference: quotation.clientReference,
    subtotal: parseFloat(quotation.subtotal?.toString() || '0'),
    taxAmount: parseFloat(quotation.taxAmount?.toString() || '0'),
    discountAmount: parseFloat(quotation.discountAmount?.toString() || '0'),
    totalAmount: parseFloat(quotation.totalAmount?.toString() || '0'),
    currency: quotation.currency || 'SGD',
    validUntil: quotation.validUntil,
    terms: quotation.terms,
    notes: quotation.notes,
    client: quotation.Customer ? {
      name: quotation.Customer.name,
      email: quotation.Customer.email,
      phone: quotation.Customer.phone,
      address: quotation.Customer.address,
      city: quotation.Customer.city,
      state: quotation.Customer.state,
      postalCode: quotation.Customer.postalCode,
      country: quotation.Customer.country
    } : undefined,
    items: quotation.QuotationItem.map((item: any) => ({
      description: item.description,
      category: item.category,
      quantity: parseFloat(item.quantity?.toString() || '1'),
      unit: item.unit,
      unitPrice: parseFloat(item.unitPrice?.toString() || '0'),
      totalPrice: parseFloat(item.totalPrice?.toString() || '0')
    }))
  }

  return await generateQuotationPDF(quotationData)
}

