
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { DocumentTemplate } from './document-templates'

// Company letterhead configuration
const COMPANY_INFO = {
  name: 'Ampere Engineering Pte Ltd',
  address: '101 Upper Cross Street #04-05',
  address2: "People's Park Centre Singapore 058357",
  phone: 'Tel: +65 66778457',
  email: 'projects@ampere.com.sg',
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
      // Original logo dimensions: 3188 x 580 (aspect ratio ~5.5:1)
      const logoMaxWidth = 60 // Max width in PDF units
      const logoAspectRatio = 3188 / 580 // Width / Height
      const logoWidth = logoMaxWidth
      const logoHeight = logoWidth / logoAspectRatio // Maintain aspect ratio
      
      doc.addImage(companyLogoData, 'PNG', margin, yPosition, logoWidth, logoHeight)
      
      // Move to position below logo
      yPosition += logoHeight + 5
      
      // Address, phone and email directly below logo with smaller fonts
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
      
      yPosition += 6
    } else {
      // Fallback to text-based header
      doc.setFontSize(20)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(0, 51, 102)
      doc.text(COMPANY_INFO.name.toUpperCase(), margin, yPosition)
      yPosition += 15
      
      // Address, phone and email with smaller fonts
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
    
    // Address, phone and email with smaller fonts
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
  }
  
  return yPosition
}

// Helper function to add company footer
async function addCompanyFooter(doc: jsPDF, pageNumber: number, totalPages: number, preparedBy?: string): Promise<void> {
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
      logoXPosition += 27
    }
    
    if (bizsafeLogoData) {
      doc.addImage(bizsafeLogoData, 'JPEG', logoXPosition, pageHeight - 32, 15, 12)
      logoXPosition += 18
    }
    
    // Footer information
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 100, 100)
    
    // Company name (next to logos) - removed per user request
    
  } catch (error) {
    console.warn('Could not load accreditation logos')
    // Footer information without logos - company name removed per user request
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 100, 100)
  }
  
  // Center - Page number with improved spacing
  doc.setFontSize(8)
  doc.text(
    `Page ${pageNumber} of ${totalPages}`,
    pageWidth / 2,
    pageHeight - 22,
    { align: 'center' }
  )
  
  // Right side - Generation date
  doc.text(
    `Generated: ${new Date().toLocaleDateString()}`,
    pageWidth - margin,
    pageHeight - 22,
    { align: 'right' }
  )
  
  // Prepared by (if available)
  if (preparedBy) {
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 100, 100)
    doc.text(
      `Prepared by: ${preparedBy}`,
      margin,
      pageHeight - 10,
      { align: 'left' }
    )
  }
  
  // Bottom line - Computer-generated statement with adequate spacing
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 51, 102)
  doc.text(
    'This document is computer generated. No signature is required.',
    pageWidth / 2,
    pageHeight - 10,
    { align: 'center' }
  )
}

interface ProjectInfo {
  projectName: string
  projectNumber: string
  clientName: string
  location?: string
  startDate?: string
  endDate?: string
}

export async function generatePDFFromTemplate(
  template: DocumentTemplate,
  templateData: Record<string, any>,
  projectInfo: ProjectInfo,
  documentTitle: string
): Promise<Buffer> {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 20

  // Add standardized quotation header (logo left, address right, divider line)
  let yPosition = await addQuotationHeader(doc)

  // Document Title
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 51, 102) // Professional blue
  doc.text(documentTitle, pageWidth / 2, yPosition, { align: 'center' })
  yPosition += 15

  // Project Information Box
  doc.setDrawColor(0, 51, 102)
  doc.setFillColor(245, 248, 252)
  doc.roundedRect(margin, yPosition, pageWidth - 2 * margin, 40, 3, 3, 'FD')
  
  yPosition += 8
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 51, 102)
  doc.text('PROJECT INFORMATION', margin + 5, yPosition)
  yPosition += 6

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(0, 0, 0)
  const projectInfoLines = [
    `Project: ${projectInfo.projectName} (${projectInfo.projectNumber})`,
    `Client: ${projectInfo.clientName}`,
    `Date: ${new Date().toLocaleDateString()}`,
  ]

  projectInfoLines.forEach(line => {
    doc.text(line, margin + 5, yPosition)
    yPosition += 5
  })

  // Add extra margin below PROJECT INFORMATION box for proper spacing
  yPosition += 25

  // Template Content
  if (template.sections) {
    template.sections.forEach((section, sectionIndex) => {
      // Check if we need a new page - use 100-unit footer protection
      if (yPosition > pageHeight - 50) {
        doc.addPage()
        yPosition = margin
      }

      // Section Header
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text(section.title, margin, yPosition)
      yPosition += 10

      // Section Fields
      section.fields.forEach(fieldId => {
        const field = template.fields.find(f => f.id === fieldId)
        if (!field) return

        const value = templateData[fieldId] || ''

        // Check if we need a new page - use 100-unit footer protection
        if (yPosition > pageHeight - 50) {
          doc.addPage()
          yPosition = margin
        }

        doc.setFontSize(10)
        doc.setFont('helvetica', 'bold')
        doc.text(`${field.label}:`, margin, yPosition)
        yPosition += 6

        doc.setFont('helvetica', 'normal')
        
        if (field.type === 'textarea' && value) {
          // Handle multi-line text
          const lines = doc.splitTextToSize(value, pageWidth - 2 * margin)
          doc.text(lines, margin, yPosition)
          yPosition += lines.length * 5 + 5
        } else {
          doc.text(value.toString(), margin, yPosition)
          yPosition += 8
        }
      })

      yPosition += 10
    })
  } else {
    // No sections, just display all fields
    template.fields.forEach(field => {
      const value = templateData[field.id] || ''

      // Check if we need a new page - use 100-unit footer protection
      if (yPosition > pageHeight - 50) {
        doc.addPage()
        yPosition = margin
      }

      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.text(`${field.label}:`, margin, yPosition)
      yPosition += 6

      doc.setFont('helvetica', 'normal')
      
      if (field.type === 'textarea' && value) {
        const lines = doc.splitTextToSize(value, pageWidth - 2 * margin)
        doc.text(lines, margin, yPosition)
        yPosition += lines.length * 5 + 5
      } else {
        doc.text(value.toString(), margin, yPosition)
        yPosition += 8
      }
    })
  }

  // Add standardized footer to all pages
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    await addCompanyFooter(doc, i, totalPages)
  }

  return Buffer.from(doc.output('arraybuffer'))
}

export async function generateSimpleDocumentPDF(
  title: string,
  content: string,
  projectInfo: ProjectInfo
): Promise<Buffer> {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 20

  // Add standardized quotation header (logo left, address right, divider line)
  let yPosition = await addQuotationHeader(doc)

  // Document Title
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 51, 102) // Professional blue
  doc.text(title, pageWidth / 2, yPosition, { align: 'center' })
  yPosition += 15

  // Project Information Box
  doc.setDrawColor(0, 51, 102)
  doc.setFillColor(245, 248, 252)
  doc.roundedRect(margin, yPosition, pageWidth - 2 * margin, 30, 3, 3, 'FD')
  
  yPosition += 8
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 51, 102)
  doc.text('PROJECT INFORMATION', margin + 5, yPosition)
  yPosition += 6

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(0, 0, 0)
  doc.text(`Project: ${projectInfo.projectName} (${projectInfo.projectNumber})`, margin + 5, yPosition)
  yPosition += 5
  doc.text(`Client: ${projectInfo.clientName}`, margin + 5, yPosition)
  yPosition += 5
  doc.text(`Date: ${new Date().toLocaleDateString()}`, margin + 5, yPosition)
  
  // Add extra margin below PROJECT INFORMATION box for proper spacing
  yPosition += 25

  // Content
  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(0, 0, 0)
  const lines = doc.splitTextToSize(content, pageWidth - 2 * margin)
  
  // Add content with proper page breaks to avoid running into footer
  const lineHeight = 6
  for (let i = 0; i < lines.length; i++) {
    // Check if we need a new page - use 100-unit footer protection
    if (yPosition > pageHeight - 50) {
      doc.addPage()
      yPosition = margin
    }
    doc.text(lines[i], margin, yPosition)
    yPosition += lineHeight
  }

  // Add standardized footer to all pages
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    await addCompanyFooter(doc, i, totalPages)
  }

  return Buffer.from(doc.output('arraybuffer'))
}

export async function generateReportPDF(
  title: string,
  data: any,
  reportType: string
): Promise<Buffer> {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 20

  // Add standardized quotation header (logo left, address right, divider line)
  let yPosition = await addQuotationHeader(doc)

  // Report Title
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 51, 102) // Professional blue
  doc.text(title, pageWidth / 2, yPosition, { align: 'center' })
  yPosition += 15

  // Report Information Box
  doc.setDrawColor(0, 51, 102)
  doc.setFillColor(245, 248, 252)
  doc.roundedRect(margin, yPosition, pageWidth - 2 * margin, 25, 3, 3, 'FD')
  
  yPosition += 8
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 51, 102)
  doc.text('REPORT INFORMATION', margin + 5, yPosition)
  yPosition += 6

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(0, 0, 0)
  doc.text(`Report Type: ${reportType}`, margin + 5, yPosition)
  yPosition += 5
  doc.text(`Generated: ${new Date().toLocaleString()}`, margin + 5, yPosition)
  
  // Add extra margin below REPORT INFORMATION box for proper spacing
  yPosition += 25

  // Report Content (basic implementation)
  doc.setFontSize(10)
  doc.setTextColor(0, 0, 0)
  doc.text('Report data:', margin, yPosition)
  yPosition += 10
  
  const dataStr = JSON.stringify(data, null, 2)
  const lines = doc.splitTextToSize(dataStr, pageWidth - 2 * margin)
  
  // Add content with proper page breaks to avoid running into footer
  const lineHeight = 5
  for (let i = 0; i < lines.length; i++) {
    // Check if we need a new page - use 100-unit footer protection
    if (yPosition > pageHeight - 50) {
      doc.addPage()
      yPosition = margin
    }
    doc.text(lines[i], margin, yPosition)
    yPosition += lineHeight
  }

  // Add standardized footer to all pages
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    await addCompanyFooter(doc, i, totalPages)
  }

  return Buffer.from(doc.output('arraybuffer'))
}

// Helper function to format currency
function formatCurrency(amount: number, currency: string = 'SGD'): string {
  return new Intl.NumberFormat('en-SG', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount)
}

// Helper function to format date
function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-SG', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

// Enhanced quotation header with logo and right-aligned address
async function addQuotationHeader(doc: jsPDF): Promise<number> {
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 20
  let yPosition = margin

  try {
    // Load and add company logo at the top left
    const companyLogoData = await loadImageAsBase64(COMPANY_INFO.logos.company)
    
    if (companyLogoData) {
      // Add company logo (top left) with proper aspect ratio
      // Original logo dimensions: 3188 x 580 (aspect ratio ~5.5:1)
      const logoHeight = 14 // Reduced for better proportions
      const logoAspectRatio = 3188 / 580 // Width / Height
      const logoWidth = logoHeight * logoAspectRatio // Maintain aspect ratio
      doc.addImage(companyLogoData, 'PNG', margin, yPosition, logoWidth, logoHeight)
      
      // Company address and contact info (top right) - left-aligned for consistent left edges
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(0, 0, 0)
      
      // Fixed starting position for contact info (right side of page)
      const contactInfoX = pageWidth - margin - 60 // 60 units from right edge
      doc.text(COMPANY_INFO.address, contactInfoX, yPosition + 5, { align: 'left' })
      doc.text(COMPANY_INFO.address2, contactInfoX, yPosition + 9, { align: 'left' })
      doc.text(COMPANY_INFO.phone, contactInfoX, yPosition + 13, { align: 'left' })
      doc.text(COMPANY_INFO.email, contactInfoX, yPosition + 17, { align: 'left' })
      
      yPosition += 25
    } else {
      // Fallback without logo - just right-aligned address
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(0, 0, 0)
      
      const rightMargin = pageWidth - margin
      doc.text(COMPANY_INFO.address, rightMargin, yPosition, { align: 'right' })
      yPosition += 4
      doc.text(COMPANY_INFO.address2, rightMargin, yPosition, { align: 'right' })
      yPosition += 4
      doc.text(COMPANY_INFO.phone, rightMargin, yPosition, { align: 'right' })
      yPosition += 4
      doc.text(COMPANY_INFO.email, rightMargin, yPosition, { align: 'right' })
      yPosition += 10
    }
    
    // Add separator line
    doc.setDrawColor(0, 51, 102)
    doc.setLineWidth(0.5)
    doc.line(margin, yPosition, pageWidth - margin, yPosition)
    yPosition += 10
    
  } catch (error) {
    console.warn('Could not load company logo, using fallback header')
    // Fallback - just right-aligned address
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(0, 0, 0)
    
    const rightMargin = pageWidth - margin
    doc.text(COMPANY_INFO.address, rightMargin, yPosition, { align: 'right' })
    yPosition += 4
    doc.text(COMPANY_INFO.address2, rightMargin, yPosition, { align: 'right' })
    yPosition += 4
    doc.text(COMPANY_INFO.phone, rightMargin, yPosition, { align: 'right' })
    yPosition += 4
    doc.text(COMPANY_INFO.email, rightMargin, yPosition, { align: 'right' })
    yPosition += 10
    
    // Add separator line
    doc.setDrawColor(0, 51, 102)
    doc.setLineWidth(0.5)
    doc.line(margin, yPosition, pageWidth - margin, yPosition)
    yPosition += 10
  }
  
  return yPosition
}

// Quotation-specific PDF generator  
export async function generateQuotationPDF(quotationData: any): Promise<Buffer> {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 20

  let yPosition = await addQuotationHeader(doc)

  // Document Title
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 51, 102)
  doc.text('QUOTATION', pageWidth / 2, yPosition, { align: 'center' })
  yPosition += 12

  // Client and Quotation Info
  const startYPosition = yPosition
  const clientSectionMaxWidth = (pageWidth - 2 * margin) * 0.55
  const rightSideX = margin + clientSectionMaxWidth + 10

  // Client Info
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 0, 0) // Black for "TO:"
  doc.text('TO:', margin, yPosition)
  if (quotationData.client?.name) {
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(0, 0, 0) // Black for customer name
    doc.text(quotationData.client.name, margin + 15, yPosition)
    yPosition += 5
    
    // Customer address in light grey
    if (quotationData.client.address) {
      doc.setTextColor(128, 128, 128) // Light grey for address
      doc.setFontSize(9)
      const addressLines = doc.splitTextToSize(quotationData.client.address, clientSectionMaxWidth - 15)
      doc.text(addressLines, margin + 15, yPosition)
      yPosition += addressLines.length * 4
    }
    doc.setTextColor(0, 0, 0) // Reset to black
    doc.setFontSize(10) // Reset font size
  }

  // Quotation Info
  let rightYPosition = startYPosition
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('Quotation No:', rightSideX, rightYPosition)
  doc.setFont('helvetica', 'normal')
  doc.text(`${quotationData.quotationNumber} (v${quotationData.version})`, rightSideX + 35, rightYPosition)
  rightYPosition += 5

  doc.setFont('helvetica', 'bold')
  doc.text('Date:', rightSideX, rightYPosition)
  doc.setFont('helvetica', 'normal')
  doc.text(formatDate(new Date()), rightSideX + 35, rightYPosition)
  rightYPosition += 5

  doc.setFont('helvetica', 'bold')
  doc.text('Valid Until:', rightSideX, rightYPosition)
  doc.setFont('helvetica', 'normal')
  doc.text(formatDate(quotationData.validUntil), rightSideX + 35, rightYPosition)

  yPosition = Math.max(yPosition, rightYPosition) + 10

  // RE: Section
  if (quotationData.title) {
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text(`RE: ${quotationData.title}`, margin, yPosition)
    yPosition += 10
  }

  // Items Table with hierarchical S/N
  const tableHeaders = [['S/N', 'Description', 'Qty', 'Unit', 'Unit Price', 'Total']]
  const tableData: any[][] = []
  let sectionCounter = 0
  let itemCounter = 1

  if (quotationData.items && quotationData.items.length > 0) {
    quotationData.items.forEach((item: any) => {
      if (item.category === 'SUBTITLE') {
        sectionCounter++
        itemCounter = 1
        tableData.push([
          {
            content: String.fromCharCode(64 + sectionCounter),
            styles: { fontStyle: 'bold', fillColor: [230, 230, 230], halign: 'center' }
          },
          {
            content: item.description.toUpperCase(),
            styles: { fontStyle: 'bold', fillColor: [230, 230, 230] },
            colSpan: 5
          }
        ])
      } else {
        let descriptionContent = item.description || ''
        if (item.notes && item.notes.trim()) {
          descriptionContent += '\n' + item.notes.trim()
        }

        tableData.push([
          `${String.fromCharCode(64 + sectionCounter)}.${itemCounter++}`,
          descriptionContent,
          parseFloat(item.quantity || 0).toString(),
          item.unit || 'pcs',
          formatCurrency(parseFloat(item.unitPrice || 0), quotationData.currency),
          formatCurrency(parseFloat(item.totalPrice || 0), quotationData.currency)
        ])
      }
    })
  }

  autoTable(doc, {
    head: tableHeaders,
    body: tableData,
    startY: yPosition,
    theme: 'plain',
    headStyles: { fillColor: [0, 51, 102], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
    columnStyles: {
      0: { cellWidth: 15, halign: 'center' },
      1: { cellWidth: 'auto', valign: 'top' },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 30, halign: 'center' },
      5: { cellWidth: 30, halign: 'center' }
    },
    didDrawCell: (data) => {
      if (data.column.index === 1 && data.cell.raw && typeof data.cell.raw === 'string') {
        const rawText = data.cell.raw
        const [description, ...notes] = rawText.split('\n')
        
        // Check if this is a subtitle row (has grey background)
        const isSubtitle = data.cell.styles && data.cell.styles.fillColor && 
                          Array.isArray(data.cell.styles.fillColor) && 
                          data.cell.styles.fillColor[0] === 230

        // Only process non-subtitle rows with notes
        if (!isSubtitle && notes.length > 0 && notes.join('').trim()) {
          // Clear the cell content that was automatically drawn
          doc.setFillColor(255, 255, 255) // White background
          doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F')

          // Draw the description
          doc.setFontSize(9)
          doc.setFont('helvetica', 'normal')
          doc.setTextColor(0, 0, 0)
          const descriptionLines = doc.splitTextToSize(description, data.cell.width - 4)
          doc.text(descriptionLines, data.cell.x + 2, data.cell.y + 4)

          // Draw the notes below the description
          const notesY = data.cell.y + 4 + (descriptionLines.length * 4) + 2
          doc.setFontSize(8)
          doc.setFont('helvetica', 'italic')
          doc.setTextColor(128, 128, 128)
          const notesLines = doc.splitTextToSize(notes.join('\n'), data.cell.width - 4)
          doc.text(notesLines, data.cell.x + 2, notesY)
        }
      }
    }
  })

  yPosition = (doc as any).lastAutoTable.finalY + 10

  // Check if we need a new page for the summary
  if (yPosition > pageHeight - 50) {
    doc.addPage()
    yPosition = margin
  }

  // Financial Summary
  const summaryBoxWidth = 95
  const summaryBoxX = pageWidth - margin - summaryBoxWidth
  
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 0, 0)
  doc.text('Summary:', summaryBoxX, yPosition)
  yPosition += 6
  
  const summaryBoxY = yPosition
  const summaryBoxPadding = 8
  
  const summaryRows: Array<{ label: string; value: string; isBold: boolean }> = []
  
  summaryRows.push({
    label: 'Subtotal:',
    value: formatCurrency(parseFloat(quotationData.subtotal || 0), quotationData.currency),
    isBold: false
  })
  
  if (quotationData.discountAmount && parseFloat(quotationData.discountAmount) > 0) {
    summaryRows.push({
      label: 'Discount:',
      value: `-${formatCurrency(parseFloat(quotationData.discountAmount), quotationData.currency)}`,
      isBold: false
    })
  }
  
  if (quotationData.taxAmount && parseFloat(quotationData.taxAmount) > 0) {
    summaryRows.push({
      label: 'GST (9%):',
      value: formatCurrency(parseFloat(quotationData.taxAmount), quotationData.currency),
      isBold: false
    })
  }
  
  summaryRows.push({
    label: 'Total:',
    value: formatCurrency(parseFloat(quotationData.totalAmount || 0), quotationData.currency),
    isBold: true
  })
  
  autoTable(doc, {
    body: summaryRows.map(row => [row.label, row.value]),
    startY: yPosition,
    theme: 'plain',
    tableWidth: summaryBoxWidth,
    margin: { left: summaryBoxX },
    styles: { fontSize: 10, cellPadding: 2 },
    columnStyles: { 
      0: { halign: 'left' },
      1: { halign: 'right' }
    },
    didParseCell: (data) => {
      if (summaryRows[data.row.index].isBold) {
        data.cell.styles.fontStyle = 'bold'
      }
    }
  })

  yPosition = (doc as any).lastAutoTable.finalY + 10

  // Terms & Conditions
  const defaultTerms = `1. Prices quoted are in ${quotationData.currency || 'SGD'} and are valid for 30 days from the date of this quotation.\n2. Payment terms: Net 30 days from invoice date.\n3. Delivery time to be confirmed upon order confirmation.\n4. All prices exclude GST unless otherwise stated.\n5. This quotation is subject to our standard terms and conditions of sale.`
  
  const termsToDisplay = quotationData.termsAndConditions || defaultTerms
  
  if (termsToDisplay) {
    if (yPosition > pageHeight - 80) {
      doc.addPage()
      yPosition = margin
    }

    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(0, 51, 102)
    doc.text('Terms & Conditions:', margin, yPosition)
    yPosition += 7

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(0, 0, 0)
    const termsLines = doc.splitTextToSize(termsToDisplay, pageWidth - 2 * margin)
    doc.text(termsLines, margin, yPosition)
  }

  // Add footer to all pages
  const totalPages = doc.internal.pages.length - 1
  const preparedBy = quotationData.preparedBy?.firstName && quotationData.preparedBy?.lastName 
    ? `${quotationData.preparedBy.firstName} ${quotationData.preparedBy.lastName}`
    : quotationData.preparedBy?.name || null
  
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    await addCompanyFooter(doc, i, totalPages, preparedBy)
  }

  return Buffer.from(doc.output('arraybuffer'))
}


export async function generatePurchaseOrderPDF(poData: any): Promise<Buffer> {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 20

  // Enhanced header with logo and right-aligned address
  let yPosition = await addQuotationHeader(doc)

  // Document Title
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 51, 102)
  doc.text('PURCHASE ORDER', pageWidth / 2, yPosition, { align: 'center' })
  yPosition += 12

  // Supplier/Customer Information and PO Information (same level)
  const startYPosition = yPosition
  
  // Supplier/Customer Information Section (Left Side)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 0, 0)
  
  // Determine if this is an outgoing or incoming PO
  const isOutgoing = poData.type === 'OUTGOING' || poData.supplier
  const vendorInfo = isOutgoing ? poData.supplier : poData.customer
  const vendorLabel = isOutgoing ? 'TO:' : 'FROM:'
  
  let vendorYPosition = yPosition
  doc.text(vendorLabel, margin, vendorYPosition)
  
  if (vendorInfo?.name) {
    doc.setFont('helvetica', 'normal')
    doc.text(vendorInfo.name, margin + 15, vendorYPosition)
    vendorYPosition += 5
    
    // Add vendor address information
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(80, 80, 80)
    
    if (vendorInfo?.address && vendorInfo.address.trim()) {
      doc.text(vendorInfo.address.trim(), margin + 15, vendorYPosition)
      vendorYPosition += 4
    }
    
    // Display city, state, and postal code on one line
    let locationParts = []
    if (vendorInfo?.city && vendorInfo.city.trim()) {
      locationParts.push(vendorInfo.city.trim())
    }
    if (vendorInfo?.state && vendorInfo.state.trim()) {
      locationParts.push(vendorInfo.state.trim())
    }
    if (vendorInfo?.postalCode && vendorInfo.postalCode.trim()) {
      locationParts.push(vendorInfo.postalCode.trim())
    }
    if (locationParts.length > 0) {
      doc.text(locationParts.join(', '), margin + 15, vendorYPosition)
      vendorYPosition += 4
    }
    
    // Display country if available
    if (vendorInfo?.country && vendorInfo.country.trim()) {
      doc.text(vendorInfo.country.trim(), margin + 15, vendorYPosition)
      vendorYPosition += 4
    }
    
    // Reset font and color for contact info
    doc.setFontSize(9)
    doc.setTextColor(0, 0, 0)
    vendorYPosition += 2
  } else {
    vendorYPosition += 5
  }
  
  if (vendorInfo?.email) {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(vendorInfo.email, margin + 15, vendorYPosition)
    vendorYPosition += 4
  }
  if (vendorInfo?.phone) {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(vendorInfo.phone, margin + 15, vendorYPosition)
    vendorYPosition += 4
  }

  // PO Information (Right Side)
  const rightSideX = pageWidth / 2 + 20
  let rightYPosition = startYPosition

  doc.setFont('helvetica', 'bold')
  doc.text('PO Number:', rightSideX, rightYPosition)
  doc.setFont('helvetica', 'normal')
  doc.text(poData.poNumber, rightSideX + 30, rightYPosition)
  rightYPosition += 5

  doc.setFont('helvetica', 'bold')
  doc.text('Date:', rightSideX, rightYPosition)
  doc.setFont('helvetica', 'normal')
  doc.text(formatDate(poData.issueDate || new Date()), rightSideX + 30, rightYPosition)
  rightYPosition += 5

  doc.setFont('helvetica', 'bold')
  doc.text('Delivery Date:', rightSideX, rightYPosition)
  doc.setFont('helvetica', 'normal')
  doc.text(formatDate(poData.deliveryDate), rightSideX + 30, rightYPosition)
  rightYPosition += 5

  // Use the max Y position from both sides
  yPosition = Math.max(vendorYPosition, rightYPosition) + 5

  // Project Header (if applicable) - Moved below TO: section
  if (poData.project) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(0, 51, 102)
    doc.text(`Project: ${poData.project.name}`, margin, yPosition)
    yPosition += 5
    
    if (poData.project.projectNumber) {
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.text(`Project No: ${poData.project.projectNumber}`, margin, yPosition)
      yPosition += 5
    }
    yPosition += 3
  }

  // Delivery Address Section (if applicable)
  if (poData.deliveryAddress && poData.deliveryAddress.trim()) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(0, 51, 102)
    doc.text('DELIVERY ADDRESS:', margin, yPosition)
    yPosition += 5
    
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(0, 0, 0)
    const deliveryLines = doc.splitTextToSize(poData.deliveryAddress, pageWidth - 2 * margin)
    doc.text(deliveryLines, margin, yPosition)
    yPosition += deliveryLines.length * 4 + 5
  }

  // Items table
  yPosition += 5

  const tableData = (poData.items || []).map((item: any, index: number) => {
    // Calculate line item subtotal (quantity × unitPrice - discount, but before tax)
    const subtotal = item.quantity * item.unitPrice
    const discountAmount = (subtotal * (item.discount || 0)) / 100
    const lineTotal = subtotal - discountAmount
    
    return [
      item.serialNumber || (index + 1).toString(),
      item.description,
      item.quantity.toString(),
      item.unit || 'pcs',
      formatCurrency(item.unitPrice, poData.currency),
      formatCurrency(lineTotal, poData.currency)
    ]
  })

  autoTable(doc, {
    startY: yPosition,
    head: [[
      'S/N',
      'Description',
      'Qty',
      'Unit',
      'Unit Price',
      'Total'
    ]],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [0, 51, 102],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'center'
    },
    bodyStyles: {
      fontSize: 8
    },
    columnStyles: {
      0: { cellWidth: 15, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 15, halign: 'center' },
      3: { cellWidth: 15, halign: 'center' },
      4: { cellWidth: 30, halign: 'right' },
      5: { cellWidth: 35, halign: 'right' }
    },
    margin: { left: margin, right: margin, bottom: 70 }, // Footer protection with optimized spacing
    didDrawPage: function (data: any) {
      // Track where the table ends
      yPosition = data.cursor.y
    }
  })

  yPosition += 10

  // Totals section - increased width to prevent text overlap
  const totalsStartX = pageWidth - margin - 85
  const totalsValueOffset = 55 // Increased spacing for longer labels like "Tax (GST 9%)"
  
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  
  doc.text('Subtotal:', totalsStartX, yPosition)
  doc.text(formatCurrency(poData.subtotal, poData.currency), totalsStartX + totalsValueOffset, yPosition, { align: 'right' })
  yPosition += 6
  
  if (poData.discountAmount && poData.discountAmount > 0) {
    doc.text('Discount:', totalsStartX, yPosition)
    doc.text(`-${formatCurrency(poData.discountAmount, poData.currency)}`, totalsStartX + totalsValueOffset, yPosition, { align: 'right' })
    yPosition += 6
  }
  
  if (poData.taxAmount && poData.taxAmount > 0) {
    // Calculate effective tax rate from items (default to 9% if not specified)
    const effectiveTaxRate = poData.items && poData.items.length > 0 
      ? (poData.items[0].taxRate || 9) 
      : 9
    doc.text(`Tax (GST ${effectiveTaxRate}%):`, totalsStartX, yPosition)
    doc.text(formatCurrency(poData.taxAmount, poData.currency), totalsStartX + totalsValueOffset, yPosition, { align: 'right' })
    yPosition += 6
  }
  
  // Draw a line above the total
  doc.setLineWidth(0.5)
  doc.line(totalsStartX, yPosition, totalsStartX + totalsValueOffset, yPosition)
  yPosition += 5
  
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('TOTAL:', totalsStartX, yPosition)
  doc.text(formatCurrency(poData.totalAmount, poData.currency), totalsStartX + totalsValueOffset, yPosition, { align: 'right' })
  yPosition += 15

  // Terms and Conditions Section - Moved below totals with improved page break handling
  // Always render terms since we pre-load standard terms in the form
  if (poData.terms && poData.terms.trim()) {
    // Check if we need a new page for terms header - use 100-unit footer protection
    if (yPosition > pageHeight - 50) {
      doc.addPage()
      yPosition = margin
    }

    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(0, 51, 102)
    doc.text('TERMS AND CONDITIONS', margin, yPosition)
    yPosition += 6
    
    // Add a subtle separator line
    doc.setDrawColor(200, 200, 200)
    doc.setLineWidth(0.5)
    doc.line(margin, yPosition, pageWidth - margin, yPosition)
    yPosition += 4
    
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5) // Smaller font for comprehensive terms
    doc.setTextColor(40, 40, 40)
    
    // Split terms by double newlines to preserve paragraph structure
    const termsParagraphs = poData.terms.split('\n\n').filter((p: string) => p.trim())
    
    // Define footer safe zone - use 100-unit footer protection
    const footerSafeZone = pageHeight - 50
    
    for (const paragraph of termsParagraphs) {
      const cleanedParagraph = paragraph.trim()
      const lines = doc.splitTextToSize(cleanedParagraph, pageWidth - 2 * margin)
      
      // Check for headings (ALL CAPS or numbered sections)
      const isHeading = cleanedParagraph.match(/^[A-Z\s&]+$/) || cleanedParagraph.match(/^\d+\.\s+[A-Z]/)
      if (isHeading) {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8)
      } else {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7.5)
      }
      
      // Calculate space needed for this paragraph (each line is ~3.5 units + 2 units padding)
      const spaceNeeded = lines.length * 3.5 + 2
      
      // Check if we need a new page BEFORE rendering
      if (yPosition + spaceNeeded > footerSafeZone) {
        doc.addPage()
        yPosition = margin
      }
      
      // Render each line individually with careful position tracking
      for (let i = 0; i < lines.length; i++) {
        // Double-check before each line to ensure we don't overflow
        if (yPosition + 3.5 > footerSafeZone) {
          doc.addPage()
          yPosition = margin
        }
        
        doc.text(lines[i], margin, yPosition)
        yPosition += 3.5
      }
      
      // Add paragraph spacing
      yPosition += 2
    }
  }

  // Notes (if any) - with improved page break handling
  if (poData.notes && poData.notes.trim()) {
    // Define footer safe zone - use 100-unit footer protection
    const footerSafeZone = pageHeight - 50
    
    // Check if we need a new page for notes header
    if (yPosition > footerSafeZone - 20) {
      doc.addPage()
      yPosition = margin
    }

    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Notes:', margin, yPosition)
    yPosition += 6

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    const notesLines = doc.splitTextToSize(poData.notes, pageWidth - 2 * margin)
    
    // Render each line with careful position tracking
    for (let i = 0; i < notesLines.length; i++) {
      // Check before each line to ensure we don't overflow into footer
      if (yPosition + 5 > footerSafeZone) {
        doc.addPage()
        yPosition = margin
      }
      
      doc.text(notesLines[i], margin, yPosition)
      yPosition += 5
    }
  }

  // Add standardized footer to all pages
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    await addCompanyFooter(doc, i, totalPages)
  }

  return Buffer.from(doc.output('arraybuffer'))
}
