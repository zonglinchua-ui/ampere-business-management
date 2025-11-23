
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { JobSheetPDFData } from './servicing-job-sheet-pdf-utils'

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
    
    console.log(`[PDF Generator] Attempting to load image: ${fullPath}`)
    
    // Check if file exists
    try {
      await fs.access(fullPath)
    } catch (accessError) {
      console.warn(`[PDF Generator] Image file not accessible: ${imagePath}`)
      return null
    }
    
    const imageBuffer = await fs.readFile(fullPath)
    const base64 = imageBuffer.toString('base64')
    const ext = path.extname(imagePath).toLowerCase()
    const mimeType = ext === '.png' ? 'png' : ext === '.jpg' || ext === '.jpeg' ? 'jpeg' : 'png'
    
    console.log(`[PDF Generator] ✓ Image loaded successfully: ${imagePath}`)
    return `data:image/${mimeType};base64,${base64}`
  } catch (error) {
    console.warn(`[PDF Generator] Could not load image: ${imagePath}`, error instanceof Error ? error.message : error)
    return null
  }
}

// Helper function to add company letterhead (COMPRESSED)
async function addCompanyLetterhead(doc: jsPDF): Promise<number> {
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 20
  let yPosition = margin

  try {
    // Load and add company logo at the top
    const companyLogoData = await loadImageAsBase64(COMPANY_INFO.logos.company)
    
    if (companyLogoData) {
      // Add company logo (top left) with reduced size
      const logoMaxWidth = 45  // Reduced from 60
      const logoAspectRatio = 3188 / 580
      const logoWidth = logoMaxWidth
      const logoHeight = logoWidth / logoAspectRatio
      
      doc.addImage(companyLogoData, 'PNG', margin, yPosition, logoWidth, logoHeight)
      
      // Move to position below logo
      yPosition += logoHeight + 3  // Reduced from 5
      
      // Address, phone and email directly below logo
      doc.setFontSize(7)  // Reduced from 8
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(0, 0, 0)
      
      doc.text(COMPANY_INFO.address, margin, yPosition)
      yPosition += 3  // Reduced from 4
      doc.text(COMPANY_INFO.address2, margin, yPosition)
      yPosition += 3
      doc.text(COMPANY_INFO.phone, margin, yPosition)
      yPosition += 3
      doc.text(COMPANY_INFO.email, margin, yPosition)
      
      yPosition += 4  // Reduced from 6
    } else {
      // Fallback to text-based header
      doc.setFontSize(16)  // Reduced from 20
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(0, 51, 102)
      doc.text(COMPANY_INFO.name.toUpperCase(), margin, yPosition)
      yPosition += 10  // Reduced from 15
      
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(0, 0, 0)
      
      doc.text(COMPANY_INFO.address, margin, yPosition)
      yPosition += 3
      doc.text(COMPANY_INFO.address2, margin, yPosition)
      yPosition += 3
      doc.text(COMPANY_INFO.phone, margin, yPosition)
      yPosition += 3
      doc.text(COMPANY_INFO.email, margin, yPosition)
      yPosition += 8  // Reduced from 12
    }
    
    // Add a professional separator line
    doc.setDrawColor(0, 51, 102)
    doc.setLineWidth(0.5)
    doc.line(margin, yPosition, pageWidth - margin, yPosition)
    yPosition += 5  // Reduced from 8
    
  } catch (error) {
    console.warn('Could not load company logos, using text-based header')
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(0, 51, 102)
    doc.text(COMPANY_INFO.name.toUpperCase(), margin, yPosition)
    yPosition += 10
    
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(0, 0, 0)
    
    doc.text(COMPANY_INFO.address, margin, yPosition)
    yPosition += 3
    doc.text(COMPANY_INFO.address2, margin, yPosition)
    yPosition += 3
    doc.text(COMPANY_INFO.phone, margin, yPosition)
    yPosition += 3
    doc.text(COMPANY_INFO.email, margin, yPosition)
    yPosition += 3
  }
  
  return yPosition
}

// Helper function to add company footer
async function addCompanyFooter(
  doc: jsPDF, 
  pageNumber: number, 
  totalPages: number,
  showSignatureNote: boolean = true
): Promise<void> {
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
    }
    
  } catch (error) {
    console.warn('Could not load accreditation logos')
  }
  
  // Center - Page number with improved spacing
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 100, 100)
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
  
  // Bottom line - Note about signatures with adequate spacing
  if (showSignatureNote) {
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(0, 51, 102)
    doc.text(
      'IMPORTANT: This document requires customer endorsement upon work completion.',
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    )
  }
}

/**
 * Generate job sheet PDF with comprehensive error handling
 */
export async function generateJobSheetPDF(jobSheetData: JobSheetPDFData): Promise<Buffer> {
  try {
    console.log('[PDF Generator] Starting job sheet PDF generation...')
    
    // Validate required fields
    if (!jobSheetData) {
      throw new Error('Job sheet data is null or undefined')
    }
    if (!jobSheetData.jobSheetNumber) {
      throw new Error('Job sheet number is missing')
    }
    if (!jobSheetData.contract?.contractNo) {
      throw new Error('Contract number is missing')
    }
    if (!jobSheetData.customer?.name) {
      throw new Error('Customer name is missing')
    }
    if (!jobSheetData.scheduledDate) {
      throw new Error('Scheduled date is missing')
    }
    
    console.log(`[PDF Generator] ✓ All required fields validated`)
    console.log(`[PDF Generator] Generating PDF for job sheet: ${jobSheetData.jobSheetNumber}`)
    
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 20

    // Add company letterhead
    console.log('[PDF Generator] Adding company letterhead...')
    let yPosition = await addCompanyLetterhead(doc)
    console.log('[PDF Generator] ✓ Letterhead added')

  // Document Title (COMPRESSED)
  doc.setFontSize(14)  // Reduced from 18
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 51, 102)
  doc.text('SERVICE JOB SHEET', pageWidth / 2, yPosition, { align: 'center' })
  yPosition += 8  // Reduced from 15

  // Job Sheet Information and Customer Information (same level)
  const startYPosition = yPosition
  
  // Define layout boundaries
  const leftSectionMaxWidth = (pageWidth - 2 * margin) * 0.55
  const rightSideX = margin + leftSectionMaxWidth + 10
  
  // Customer Information Section (Left Side) - COMPRESSED
  doc.setFontSize(8)  // Reduced from 10
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 0, 0)
  
  let customerYPosition = yPosition
  doc.text('CUSTOMER:', margin, customerYPosition)
  
  if (jobSheetData.customer?.name) {
    // Customer name in bold font
    doc.setFontSize(9)  // Reduced from 11
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(0, 0, 0)
    const customerNameLines = doc.splitTextToSize(jobSheetData.customer.name, leftSectionMaxWidth - 15)
    doc.text(customerNameLines[0], margin + 30, customerYPosition)
    customerYPosition += 4.5  // Reduced from 6
    
    if (customerNameLines.length > 1) {
      for (let i = 1; i < customerNameLines.length; i++) {
        doc.text(customerNameLines[i], margin + 30, customerYPosition)
        customerYPosition += 4.5
      }
    }
    
    // Add customer address directly below name in lighter, smaller font
    doc.setFontSize(7)  // Reduced from 8
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(120, 120, 120)  // Lighter gray color for address
    
    if (jobSheetData.customer?.address) {
      const addressLines = doc.splitTextToSize(jobSheetData.customer.address, leftSectionMaxWidth - 30)
      addressLines.forEach((line: string) => {
        doc.text(line, margin + 30, customerYPosition)
        customerYPosition += 3  // Reduced from 4
      })
    }
    
    let locationParts = []
    if (jobSheetData.customer?.city) locationParts.push(jobSheetData.customer.city)
    if (jobSheetData.customer?.state) locationParts.push(jobSheetData.customer.state)
    if (jobSheetData.customer?.postalCode) locationParts.push(jobSheetData.customer.postalCode)
    if (jobSheetData.customer?.country) locationParts.push(jobSheetData.customer.country)
    if (locationParts.length > 0) {
      doc.text(locationParts.join(', '), margin + 30, customerYPosition)
      customerYPosition += 3  // Reduced from 4
    }
    
    if (jobSheetData.customer?.phone) {
      doc.text(`Tel: ${jobSheetData.customer.phone}`, margin + 30, customerYPosition)
      customerYPosition += 3  // Reduced from 4
    }
    
    if (jobSheetData.customer?.email) {
      doc.text(`Email: ${jobSheetData.customer.email}`, margin + 30, customerYPosition)
      customerYPosition += 3  // Reduced from 4
    }
  }
  
  // Job Sheet Information (Right Side) - COMPRESSED
  let infoYPosition = startYPosition
  doc.setFontSize(8)  // Reduced from 9
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 0, 0)
  
  // Pre-filled information
  const prefilledInfo = [
    ['Job Sheet No:', jobSheetData.jobSheetNumber],
    ['Contract No:', jobSheetData.contract.contractNo],
    ['Service Type:', jobSheetData.contract.serviceType],
    ['Frequency:', jobSheetData.contract.frequency],
  ]
  
  prefilledInfo.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold')
    doc.text(label, rightSideX, infoYPosition)
    doc.setFont('helvetica', 'normal')
    doc.text(value, rightSideX + 35, infoYPosition)
    infoYPosition += 4  // Reduced from 5
  })
  
  // Fillable fields (blank lines for manual entry at site)
  const fillableFields = [
    'Scheduled Date:',
    'Status:',
  ]
  
  fillableFields.forEach((label) => {
    doc.setFont('helvetica', 'bold')
    doc.text(label, rightSideX, infoYPosition)
    doc.setFont('helvetica', 'normal')
    doc.text('_____________________', rightSideX + 35, infoYPosition)
    infoYPosition += 4  // Reduced from 5
  })
  
  // Update yPosition to be below both sections
  yPosition = Math.max(customerYPosition, infoYPosition) + 6  // Reduced from 10

  // Project Information (if applicable) - COMPRESSED
  if (jobSheetData.project) {
    doc.setFontSize(8)  // Reduced from 10
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(0, 51, 102)
    doc.text('PROJECT INFORMATION', margin, yPosition)
    yPosition += 4  // Reduced from 6
    
    doc.setFontSize(7)  // Reduced from 9
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(0, 0, 0)
    doc.text(`Project: ${jobSheetData.project.name} (${jobSheetData.project.projectNumber})`, margin, yPosition)
    yPosition += 3.5  // Reduced from 5
    
    if (jobSheetData.project.address) {
      doc.text(`Location: ${jobSheetData.project.address}`, margin, yPosition)
      yPosition += 3.5  // Reduced from 5
    }
    yPosition += 3  // Reduced from 5
  }

  // Assigned To Information - COMPRESSED
  doc.setFontSize(8)  // Reduced from 10
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 51, 102)
  doc.text('ASSIGNED TO', margin, yPosition)
  yPosition += 4  // Reduced from 6
  
  doc.setFontSize(7)  // Reduced from 9
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(0, 0, 0)
  
  // Fillable fields with blank lines
  doc.setFont('helvetica', 'bold')
  doc.text('Staff Name:', margin, yPosition)
  doc.setFont('helvetica', 'normal')
  doc.text('___________________________________________________________', margin + 25, yPosition)
  yPosition += 4  // Reduced from 5
  
  doc.setFont('helvetica', 'bold')
  doc.text('Phone:', margin, yPosition)
  doc.setFont('helvetica', 'normal')
  doc.text('___________________________________________________________', margin + 25, yPosition)
  yPosition += 4  // Reduced from 5
  
  doc.setFont('helvetica', 'bold')
  doc.text('Email:', margin, yPosition)
  doc.setFont('helvetica', 'normal')
  doc.text('___________________________________________________________', margin + 25, yPosition)
  yPosition += 6  // Reduced from 10

  // Type of Work Section with Checkboxes - COMPRESSED
  doc.setFontSize(8)  // Reduced from 10
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 51, 102)
  doc.text('TYPE OF WORK PERFORMED', margin, yPosition)
  yPosition += 5  // Reduced from 8
  
  // Define common servicing work types
  const workTypes = [
    'Plumbing & Sanitary',
    'Electrical Works',
    'ACMV (Air Conditioning & Mechanical Ventilation)',
    'Fire Protection System',
    'Building Maintenance',
    'Painting & Decoration',
    'Civil & Structural Works',
    'Preventive Maintenance',
    'Others (Please specify below)'
  ]
  
  doc.setFontSize(7)  // Reduced from 9
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(0, 0, 0)
  
  // Create checkbox layout (2 columns) - more compact
  const checkboxSize = 3  // Reduced from 4
  const checkboxSpacing = 35
  const columnWidth = (pageWidth - 2 * margin) / 2
  
  workTypes.forEach((workType, index) => {
    const columnIndex = index % 2
    const rowIndex = Math.floor(index / 2)
    const xPos = margin + (columnIndex * columnWidth)
    const yPos = yPosition + (rowIndex * 4.5)  // Reduced from 6
    
    // Draw checkbox
    doc.setDrawColor(0, 0, 0)
    doc.setLineWidth(0.3)
    doc.rect(xPos, yPos - 2.5, checkboxSize, checkboxSize)
    
    // Add work type label
    doc.text(workType, xPos + checkboxSize + 2, yPos)
  })
  
  yPosition += (Math.ceil(workTypes.length / 2) * 4.5) + 5  // Reduced from 6 + 8
  
  // ============================================================================
  // STRICT PAGE BREAK PROTECTION - Define protected zone
  // Footer occupies bottom 50 units: line at -35, content from -32 to -10
  // We add 50 units buffer for safety = 100 units total PROTECTED ZONE
  // NO CONTENT should ever be placed below pageHeight - 100
  // ============================================================================
  const FOOTER_PROTECTED_ZONE = 100
  const maxContentY = pageHeight - FOOTER_PROTECTED_ZONE
  
  // Helper function to check if content will fit on current page
  const needsNewPage = (requiredHeight: number): boolean => {
    return (yPosition + requiredHeight) > maxContentY
  }
  
  // Helper function to add page break if needed
  const addPageBreakIfNeeded = (requiredHeight: number): void => {
    if (needsNewPage(requiredHeight)) {
      doc.addPage()
      yPosition = margin + 20
      console.log('[PDF Generator] ✓ Page break added to prevent footer encroachment')
    }
  }
  
  // Work Description Section - MAXIMIZED for page 1
  addPageBreakIfNeeded(95)
  
  doc.setFontSize(8)  // Reduced from 10
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 51, 102)
  doc.text('WORK DESCRIPTION / SCOPE', margin, yPosition)
  yPosition += 4  // Reduced from 6
  
  // Draw box for manual entry - MAXIMIZED to fill page 1 space
  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.3)
  const descriptionBoxHeight = 85  // MAXIMIZED for page 1 (increased from 60)
  doc.rect(margin, yPosition, pageWidth - 2 * margin, descriptionBoxHeight)
  
  doc.setFontSize(7)  // Reduced from 8
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(120, 120, 120)
  doc.text('Please describe the work performed in detail...', margin + 3, yPosition + 5)
  
  yPosition += descriptionBoxHeight + 4  // Compact spacing
  
  // Materials Used Section - ENLARGED to maximize page 1 space
  addPageBreakIfNeeded(45)
  
  doc.setFontSize(8)  // Reduced from 10
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 51, 102)
  doc.text('MATERIALS / PARTS USED', margin, yPosition)
  yPosition += 4  // Reduced from 6
  
  // Draw box for materials - ENLARGED to fill remaining page 1 space
  const materialsBoxHeight = 40  // INCREASED from 18 to maximize page 1 usage
  doc.rect(margin, yPosition, pageWidth - 2 * margin, materialsBoxHeight)
  
  doc.setFontSize(7)  // Reduced from 8
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(120, 120, 120)
  doc.text('List all materials and parts used...', margin + 3, yPosition + 5)
  
  yPosition += materialsBoxHeight + 4  // Compact spacing

  // ============================================================================
  // FORCE PAGE BREAK - Page 1 ends here, Page 2 starts with Remarks
  // ============================================================================
  doc.addPage()
  yPosition = margin + 20
  console.log('[PDF Generator] ✓ Forced page break - Page 2 for Remarks and Signatures')

  // Additional Remarks Section - NOW ON PAGE 2
  doc.setFontSize(8)  // Reduced from 10
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 51, 102)
  doc.text('REMARKS / ADDITIONAL NOTES', margin, yPosition)
  yPosition += 4  // Reduced from 6
  
  // Draw box for remarks - can be larger now on page 2
  const remarksBoxHeight = 30  // Increased back to 30 for page 2
  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.3)
  doc.rect(margin, yPosition, pageWidth - 2 * margin, remarksBoxHeight)
  
  doc.setFontSize(7)  // Reduced from 8
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(120, 120, 120)
  doc.text('Any additional comments, observations, or issues noted...', margin + 3, yPosition + 5)
  
  yPosition += remarksBoxHeight + 8  // Standard spacing

  // WORKER/TECHNICIAN SIGNATURE SECTION - Already on page 2, no page break needed
  doc.setFontSize(9)  // Reduced from 11
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 51, 102)
  doc.text('WORKER / TECHNICIAN CERTIFICATION', margin, yPosition)
  yPosition += 5  // Reduced from 8
  
  doc.setFontSize(7)  // Reduced from 8
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(80, 80, 80)
  doc.text('I hereby certify that the work described above has been completed in accordance with the contract requirements.', margin, yPosition)
  yPosition += 6  // Reduced from 10
  
  // Worker signature box
  const workerBoxHeight = 32  // Reduced from 45
  doc.setDrawColor(0, 51, 102)
  doc.setLineWidth(0.5)
  doc.rect(margin, yPosition, pageWidth - 2 * margin, workerBoxHeight)
  
  doc.setFontSize(7)  // Reduced from 9
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(0, 0, 0)
  
  // Two-column layout for worker details
  const workerColumnWidth = (pageWidth - 2 * margin) / 2
  
  // Left column
  doc.text('Name:', margin + 5, yPosition + 6)
  doc.text('_________________________________', margin + 20, yPosition + 6)
  
  doc.text('Signature:', margin + 5, yPosition + 15)
  doc.text('_________________________________', margin + 20, yPosition + 15)
  
  // Right column
  doc.text('Date:', margin + workerColumnWidth + 5, yPosition + 6)
  doc.text('__________________________', margin + workerColumnWidth + 20, yPosition + 6)
  
  doc.text('Time:', margin + workerColumnWidth + 5, yPosition + 15)
  doc.text('__________________________', margin + workerColumnWidth + 20, yPosition + 15)
  
  // Company representative line
  doc.setFontSize(6.5)  // Reduced from 8
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(60, 60, 60)
  doc.text('(Representative of Ampere Engineering Pte Ltd)', margin + 5, yPosition + 26)
  
  yPosition += workerBoxHeight + 8  // Reduced from 12
  
  // Check again before customer endorsement
  // Customer endorsement needs ~60 units (COMPRESSED)
  addPageBreakIfNeeded(60)
  
  // CUSTOMER ENDORSEMENT SECTION - COMPRESSED
  doc.setFontSize(9)  // Reduced from 11
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 51, 102)
  doc.text('CUSTOMER ENDORSEMENT', margin, yPosition)
  yPosition += 5  // Reduced from 8
  
  doc.setFontSize(7)  // Reduced from 8
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(80, 80, 80)
  doc.text('I acknowledge that the work has been completed to my satisfaction and accept the work as described above.', margin, yPosition)
  yPosition += 6  // Reduced from 10
  
  // Customer endorsement box
  const customerBoxHeight = 40  // Reduced from 55
  doc.setDrawColor(0, 51, 102)
  doc.setLineWidth(0.5)
  doc.rect(margin, yPosition, pageWidth - 2 * margin, customerBoxHeight)
  
  doc.setFontSize(7)  // Reduced from 9
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(0, 0, 0)
  
  // Customer details - Two column layout
  const customerColumnWidth = (pageWidth - 2 * margin) / 2
  
  // Left column
  doc.text('Name:', margin + 5, yPosition + 6)
  doc.text('_________________________________', margin + 20, yPosition + 6)
  
  doc.text('IC / Company:', margin + 5, yPosition + 15)
  doc.text('_________________________________', margin + 20, yPosition + 15)
  
  doc.text('Signature:', margin + 5, yPosition + 24)
  doc.text('_________________________________', margin + 20, yPosition + 24)
  
  // Right column
  doc.text('Date:', margin + customerColumnWidth + 5, yPosition + 6)
  doc.text('__________________________', margin + customerColumnWidth + 20, yPosition + 6)
  
  doc.text('Contact:', margin + customerColumnWidth + 5, yPosition + 15)
  doc.text('__________________________', margin + customerColumnWidth + 20, yPosition + 15)
  
  // Company stamp/chop area
  doc.setFontSize(6.5)  // Reduced from 8
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(60, 60, 60)
  doc.text('Company Stamp / Chop (if applicable)', margin + 5, yPosition + 35)
  
  yPosition += customerBoxHeight + 10  // Reduced from 15

    // Add footer to all pages
    console.log('[PDF Generator] Adding footer to all pages...')
    const totalPages = doc.getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i)
      await addCompanyFooter(doc, i, totalPages)
    }
    console.log('[PDF Generator] ✓ Footer added to all pages')

    // Return PDF as buffer
    console.log('[PDF Generator] Converting PDF to buffer...')
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'))
    console.log(`[PDF Generator] ✓ PDF generated successfully, size: ${pdfBuffer.length} bytes`)
    
    return pdfBuffer
    
  } catch (error) {
    console.error('[PDF Generator] Error generating job sheet PDF:', error)
    if (error instanceof Error) {
      console.error('[PDF Generator] Error message:', error.message)
      console.error('[PDF Generator] Error stack:', error.stack)
    }
    throw new Error(`PDF generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}
