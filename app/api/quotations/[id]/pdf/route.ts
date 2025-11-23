
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getQuotationPDF } from '@/lib/quotation-pdf-utils'
import fs from 'fs'
import path from 'path'
import { validateQuotationCalculations } from '@/lib/quotation-gst-calculator'
import { backupQuotation } from '@/lib/document-backup-service'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get quotation with all necessary data for validation
    const quotation = await prisma.quotation.findUnique({
      where: { id: params.id },
      include: {
        QuotationItem: {
          select: {
            description: true,
            quantity: true,
            unitPrice: true,
            totalPrice: true,
            category: true,
            unit: true,
            notes: true
          }
        },
        Customer: {
          select: {
            name: true,
            email: true,
            phone: true,
            address: true,
            city: true,
            state: true,
            postalCode: true,
            country: true
          }
        }
      }
    })

    if (!quotation) {
      return NextResponse.json({ error: 'Quotation not found' }, { status: 404 })
    }

    // Validate quotation calculations
    const validation = validateQuotationCalculations({
      ...quotation,
      items: quotation.QuotationItem
    })

    if (!validation.isValid) {
      console.warn('âš ï¸ Quotation has calculation errors:', validation.errors)
      
      // If calculations are wrong, update the quotation first
      if (validation.correctedData) {
        await prisma.quotation.update({
          where: { id: params.id },
          data: {
            subtotal: validation.correctedData.subtotal,
            taxAmount: validation.correctedData.taxAmount,
            totalAmount: validation.correctedData.totalAmount,
            updatedAt: new Date()
          }
        })
        console.log('âœ… Quotation calculations corrected')
      }
    }

    // Get the latest PDF for this quotation
    const pdfInfo = await getQuotationPDF(params.id)
    
    if (!pdfInfo) {
      return NextResponse.json({ 
        error: 'No PDF found for this quotation. It may still be generating.',
        suggestion: 'Try refreshing the page or regenerating the PDF.'
      }, { status: 404 })
    }

    try {
      // Generate a signed URL for the PDF
      // For local storage, serve file directly
      const filePath = pdfInfo.cloudStoragePath
      if (!fs.existsSync(filePath)) {
        throw new Error('PDF file not found on disk')
      }
      const fileBuffer = await fs.promises.readFile(filePath)
      const signedUrl = `data:application/pdf;base64,${fileBuffer.toString('base64')}`
      
      // Trigger NAS backup asynchronously (don't wait for it)
      backupQuotation(params.id).then(backupResult => {
        if (backupResult.success) {
          console.log('âœ… Quotation backed up to NAS:', backupResult.pdfPath, backupResult.excelPath)
        } else {
          console.warn('âš ï¸ NAS backup failed:', backupResult.error)
        }
      }).catch(err => {
        console.error('âŒ NAS backup error:', err)
      })
      
      // Return the download URL and metadata
      return NextResponse.json({
        downloadUrl: signedUrl,
        filename: pdfInfo.filename,
        generatedAt: pdfInfo.createdAt,
        quotationNumber: quotation.quotationNumber,
        version: quotation.version,
        title: quotation.title,
        calculationsValid: validation.isValid,
        calculationErrors: validation.errors.length > 0 ? validation.errors : undefined
      })
    } catch (s3Error: any) {
      console.error('âŒ Failed to generate download URL:', s3Error)
      return NextResponse.json({ 
        error: 'Failed to generate download URL',
        details: s3Error.message
      }, { status: 500 })
    }

  } catch (error: any) {
    console.error('âŒ Error in quotation PDF endpoint:', error)
    return NextResponse.json(
      { 
        error: 'Failed to retrieve quotation PDF',
        details: error.message 
      },
      { status: 500 }
    )
  }
}

/**
 * POST endpoint to regenerate PDF with corrected calculations
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get quotation data
    const quotation = await prisma.quotation.findUnique({
      where: { id: params.id },
      include: {
        QuotationItem: true,
        Customer: true
      }
    })

    if (!quotation) {
      return NextResponse.json({ error: 'Quotation not found' }, { status: 404 })
    }

    // Validate and correct calculations
    const validation = validateQuotationCalculations({
      ...quotation,
      items: quotation.QuotationItem
    })

    // Update quotation with corrected calculations if needed
    if (!validation.isValid && validation.correctedData) {
      await prisma.quotation.update({
        where: { id: params.id },
        data: {
          subtotal: validation.correctedData.subtotal,
          taxAmount: validation.correctedData.taxAmount,
          totalAmount: validation.correctedData.totalAmount,
          updatedAt: new Date()
        }
      })
    }

    // Import the PDF generation function
    const { updateQuotationPDF } = await import('@/lib/quotation-pdf-utils')
    
    // Generate new PDF with corrected data
    const correctedData = validation.correctedData || quotation
    const pdfPath = await updateQuotationPDF({
      id: correctedData.id,
      quotationNumber: correctedData.quotationNumber,
      version: correctedData.version,
      title: correctedData.title,
      description: correctedData.description,
      clientReference: correctedData.clientReference,
      subtotal: Number(correctedData.subtotal),
      taxAmount: Number(correctedData.taxAmount || 0),
      discountAmount: Number(correctedData.discountAmount || 0),
      totalAmount: Number(correctedData.totalAmount),
      currency: correctedData.currency,
      validUntil: correctedData.validUntil,
      terms: correctedData.terms,
      notes: correctedData.notes,
      client: correctedData.Customer,
      items: correctedData.QuotationItem?.map((item: any) => ({
        description: item.description,
        category: item.category || 'General',
        quantity: Number(item.quantity),
        unit: item.unit || 'pcs',
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.totalPrice || (Number(item.quantity) * Number(item.unitPrice)))
      })) || []
    }, session.user.id)

    return NextResponse.json({
      success: true,
      message: 'PDF regenerated successfully',
      pdfPath,
      calculationsFixed: !validation.isValid,
      errors: validation.errors
    })

  } catch (error: any) {
    console.error('âŒ Error regenerating quotation PDF:', error)
    return NextResponse.json(
      { 
        error: 'Failed to regenerate PDF',
        details: error.message 
      },
      { status: 500 }
    )
  }
}
