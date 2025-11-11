
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { ServiceInvoicePDFData } from './servicing-invoice-pdf-utils'
import { format } from 'date-fns'

// Company letterhead configuration
const COMPANY_INFO = {
  name: 'Ampere Engineering Pte Ltd',
  address: '101 Upper Cross Street #04-05',
  address2: "People's Park Centre Singapore 058357",
  phone: 'Tel: +65 66778457',
  email: 'projects@ampere.com.sg',
  gstNo: 'GST Reg No: 201234567X',
  logos: {
    company: '/branding/ampere-logo.png',
    iso45001: '/branding/iso-45001-new.jpg',
    bizsafe: '/branding/bizsafe-star-new.jpg'
  }
}

// Helper function to load image as base64
async function loadImageAsBase64(imagePath: string): Promise<string | null> {
  try {
    const fs = require('fs').promises
    const path = require('path')
    const fullPath = path.join(process.cwd(), 'public', imagePath)
    const imageBuffer = await fs.readFile(fullPath)
    const base64 = imageBuffer.toString('base64')
    const ext = path.extname(imagePath).toLowerCase()
    const mimeType = ext === '.png' ? 'png' : ext === '.jpg' || ext === '.jpeg' ? 'jpeg' : 'png'
    return `data:image/${mimeType};base64,${base64}`
  } catch (error) {
    console.warn(`Could not load image: ${imagePath}`, error)
    return null
  }
}

// Helper function to add company letterhead
async function addCompanyLetterhead(doc: jsPDF): Promise<number> {
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 20
  let yPosition = margin

  try {
    // Load and add company logo at the top
    const companyLogoData = await loadImageAsBase64(COMPANY_INFO.logos.company)
    
    if (companyLogoData) {
      // Add company logo (top left) with proper aspect ratio
      const logoMaxWidth = 60
      const logoAspectRatio = 3188 / 580
      const logoWidth = logoMaxWidth
      const logoHeight = logoWidth / logoAspectRatio
      
      doc.addImage(companyLogoData, 'PNG', margin, yPosition, logoWidth, logoHeight)
      
      // Move to position below logo
      yPosition += logoHeight + 5
      
      // Address, phone and email directly below logo
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(0, 0, 0)
      
      doc.text(COMPANY_INFO.address, margin, yPosition)
      yPosition += 4
      doc.text(COMPANY_INFO.address2, margin, yPosition)
      yPosition += 4
      doc.text(COMPANY_INFO.phone, margin, yPosition)
      yPosition += 4
      doc.text(COMPANY_INFO.email, margin, yPosition)
      yPosition += 4
      doc.text(COMPANY_INFO.gstNo, margin, yPosition)
      
      yPosition += 6
    } else {
      // Fallback to text-based header
      doc.setFontSize(20)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(0, 51, 102)
      doc.text(COMPANY_INFO.name.toUpperCase(), margin, yPosition)
      yPosition += 15
      
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(0, 0, 0)
      
      doc.text(COMPANY_INFO.address, margin, yPosition)
      yPosition += 4
      doc.text(COMPANY_INFO.address2, margin, yPosition)
      yPosition += 4
      doc.text(COMPANY_INFO.phone, margin, yPosition)
      yPosition += 4
      doc.text(COMPANY_INFO.email, margin, yPosition)
      yPosition += 4
      doc.text(COMPANY_INFO.gstNo, margin, yPosition)
      yPosition += 12
    }
    
    // Add a professional separator line
    doc.setDrawColor(0, 51, 102)
    doc.setLineWidth(0.5)
    doc.line(margin, yPosition, pageWidth - margin, yPosition)
    yPosition += 5
    
  } catch (error) {
    console.warn('Could not load company logos, using text-based header')
    // Fallback to simple text header
    doc.setFontSize(20)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(0, 51, 102)
    doc.text(COMPANY_INFO.name.toUpperCase(), margin, yPosition)
    yPosition += 15
    
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(0, 0, 0)
    
    doc.text(COMPANY_INFO.address, margin, yPosition)
    yPosition += 4
    doc.text(COMPANY_INFO.address2, margin, yPosition)
    yPosition += 4
    doc.text(COMPANY_INFO.phone, margin, yPosition)
    yPosition += 4
    doc.text(COMPANY_INFO.email, margin, yPosition)
    yPosition += 4
    doc.text(COMPANY_INFO.gstNo, margin, yPosition)
    yPosition += 4
  }
  
  return yPosition
}

// Helper function to add company footer
async function addCompanyFooter(doc: jsPDF, pageNumber: number, totalPages: number): Promise<void> {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 20
  
  // Footer line - positioned lower to maximize usable space
  doc.setDrawColor(0, 51, 102)
  doc.setLineWidth(0.3)
  doc.line(margin, pageHeight - 35, pageWidth - margin, pageHeight - 35)
  
  try {
    // Load accreditation logos
    const iso45001LogoData = await loadImageAsBase64(COMPANY_INFO.logos.iso45001)
    const bizsafeLogoData = await loadImageAsBase64(COMPANY_INFO.logos.bizsafe)
    
    // Add accreditation logos at bottom left - with proper spacing from footer line
    let logoXPosition = margin
    
    if (iso45001LogoData) {
      doc.addImage(iso45001LogoData, 'JPEG', logoXPosition, pageHeight - 32, 24, 12)
      logoXPosition += 28
    }
    
    if (bizsafeLogoData) {
      doc.addImage(bizsafeLogoData, 'JPEG', logoXPosition, pageHeight - 32, 15, 12)
    }
  } catch (error) {
    console.warn('Could not load accreditation logos for footer')
  }
  
  // Page number and generation date with improved spacing
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 100, 100)
  
  // Page number (centered)
  const pageText = `Page ${pageNumber} of ${totalPages}`
  const pageTextWidth = doc.getTextWidth(pageText)
  doc.text(pageText, (pageWidth - pageTextWidth) / 2, pageHeight - 22)
  
  // Generation date (right aligned)
  const generatedText = `Generated: ${format(new Date(), 'dd/MM/yyyy')}`
  doc.text(generatedText, pageWidth - margin - doc.getTextWidth(generatedText), pageHeight - 22)
  
  // Computer generated statement with adequate spacing
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 51, 102)
  const disclaimer = 'This document is computer generated. No signature is required.'
  const disclaimerWidth = doc.getTextWidth(disclaimer)
  doc.text(disclaimer, (pageWidth - disclaimerWidth) / 2, pageHeight - 10)
}

/**
 * Generate service invoice PDF
 */
export async function generateServiceInvoicePDF(data: ServiceInvoicePDFData): Promise<Buffer> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  })
  
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 20
  
  // Add company letterhead
  let yPosition = await addCompanyLetterhead(doc)
  yPosition += 5
  
  // Document title
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 51, 102)
  const title = 'SERVICE INVOICE'
  doc.text(title, pageWidth / 2, yPosition, { align: 'center' })
  yPosition += 12
  
  // Two-column layout: Customer info (left) and Invoice info (right)
  const leftColX = margin
  const rightColX = pageWidth / 2 + 5
  const colStartY = yPosition
  
  // Left column - Customer information
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 0, 0)
  doc.text('BILL TO:', leftColX, yPosition)
  yPosition += 6
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(data.customer.name, leftColX, yPosition)
  yPosition += 4
  
  if (data.customer.address) {
    doc.text(data.customer.address, leftColX, yPosition)
    yPosition += 4
  }
  
  if (data.customer.city || data.customer.postalCode) {
    const cityLine = [
      data.customer.city,
      data.customer.state,
      data.customer.postalCode
    ].filter(Boolean).join(' ')
    doc.text(cityLine, leftColX, yPosition)
    yPosition += 4
  }
  
  if (data.customer.phone) {
    doc.text(`Tel: ${data.customer.phone}`, leftColX, yPosition)
    yPosition += 4
  }
  
  if (data.customer.email) {
    doc.text(`Email: ${data.customer.email}`, leftColX, yPosition)
    yPosition += 4
  }
  
  // Right column - Invoice information
  yPosition = colStartY
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  
  const infoRows = [
    ['Invoice No:', data.invoiceNo],
    ['Invoice Type:', data.invoiceType],
    ['Date:', format(new Date(data.date), 'dd/MM/yyyy')],
    ['Status:', data.status],
  ]
  
  if (data.dueDate) {
    infoRows.push(['Due Date:', format(new Date(data.dueDate), 'dd/MM/yyyy')])
  }
  
  infoRows.push(['Contract No:', data.contract.contractNo])
  
  infoRows.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold')
    doc.text(label, rightColX, yPosition)
    doc.setFont('helvetica', 'normal')
    doc.text(String(value), rightColX + 30, yPosition)
    yPosition += 5
  })
  
  // Move Y position to below both columns
  yPosition = Math.max(yPosition, colStartY + 50) + 5
  
  // Service details section
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('SERVICE DETAILS:', leftColX, yPosition)
  yPosition += 6
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(`Service Type: ${data.contract.serviceType}`, leftColX, yPosition)
  yPosition += 4
  doc.text(`Contract Title: ${data.contract.title}`, leftColX, yPosition)
  yPosition += 4
  doc.text(`Frequency: ${data.contract.frequency}`, leftColX, yPosition)
  yPosition += 4
  doc.text(`Scheduled Date: ${format(new Date(data.job.scheduledDate), 'dd/MM/yyyy')}`, leftColX, yPosition)
  yPosition += 4
  
  if (data.job.completedAt) {
    doc.text(`Completed Date: ${format(new Date(data.job.completedAt), 'dd/MM/yyyy')}`, leftColX, yPosition)
    yPosition += 4
  }
  
  if (data.project) {
    yPosition += 2
    doc.text(`Project: ${data.project.name} (${data.project.projectNumber})`, leftColX, yPosition)
    yPosition += 4
    if (data.project.address) {
      doc.text(`Location: ${data.project.address}`, leftColX, yPosition)
      yPosition += 4
    }
  }
  
  yPosition += 5
  
  // Line items table
  const tableData = data.lineItems.map(item => [
    item.description,
    item.quantity.toString(),
    `$${item.unitPrice.toFixed(2)}`,
    `$${item.amount.toFixed(2)}`
  ])
  
  autoTable(doc, {
    startY: yPosition,
    head: [['Description', 'Qty', 'Unit Price', 'Amount']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [0, 51, 102],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9
    },
    bodyStyles: {
      fontSize: 9
    },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 25, halign: 'center' },
      2: { cellWidth: 30, halign: 'right' },
      3: { cellWidth: 30, halign: 'right' }
    },
    margin: { left: margin, right: margin, bottom: 100 } // 100-unit footer protection
  })
  
  // Get the final Y position after the table
  yPosition = (doc as any).lastAutoTable.finalY + 5
  
  // Check if summary section fits on current page - use 100-unit footer protection
  const summaryHeight = 40 // Estimated height for summary section
  if (yPosition + summaryHeight > pageHeight - 100) {
    doc.addPage()
    yPosition = margin + 20
  }
  
  // Summary box (right-aligned)
  const summaryX = pageWidth - margin - 60
  const summaryWidth = 60
  
  // Draw summary box
  doc.setDrawColor(0, 51, 102)
  doc.setLineWidth(0.3)
  
  // Subtotal
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('Subtotal:', summaryX, yPosition)
  doc.text(`$${data.amount.toFixed(2)}`, summaryX + summaryWidth, yPosition, { align: 'right' })
  yPosition += 5
  
  // GST
  doc.text('GST (9%):', summaryX, yPosition)
  doc.text(`$${data.tax.toFixed(2)}`, summaryX + summaryWidth, yPosition, { align: 'right' })
  yPosition += 5
  
  // Draw line before total
  doc.line(summaryX, yPosition, summaryX + summaryWidth, yPosition)
  yPosition += 5
  
  // Total
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('TOTAL:', summaryX, yPosition)
  doc.text(`$${data.totalAmount.toFixed(2)}`, summaryX + summaryWidth, yPosition, { align: 'right' })
  yPosition += 10
  
  // Payment terms
  if (data.paymentTerms) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text('PAYMENT TERMS:', leftColX, yPosition)
    yPosition += 5
    
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    const paymentTermsLines = doc.splitTextToSize(data.paymentTerms, pageWidth - 2 * margin)
    doc.text(paymentTermsLines, leftColX, yPosition)
    yPosition += paymentTermsLines.length * 5
  }
  
  // Notes/Description
  if (data.notes) {
    yPosition += 5
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text('NOTES:', leftColX, yPosition)
    yPosition += 5
    
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    const notesLines = doc.splitTextToSize(data.notes, pageWidth - 2 * margin)
    doc.text(notesLines, leftColX, yPosition)
  }
  
  // Add footer
  const totalPages = doc.internal.pages.length - 1 // Subtract 1 because first page is empty
  await addCompanyFooter(doc, 1, totalPages || 1)
  
  // Convert to buffer
  const pdfBuffer = Buffer.from(doc.output('arraybuffer'))
  return pdfBuffer
}
