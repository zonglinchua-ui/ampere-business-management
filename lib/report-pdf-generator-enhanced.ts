
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// Company letterhead configuration
const COMPANY_INFO = {
  name: 'AMPERE ENGINEERING PTE LTD',
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

// Color scheme
const COLORS = {
  primary: [0, 51, 102] as [number, number, number],      // Dark blue
  secondary: [41, 128, 185] as [number, number, number],   // Light blue
  accent: [52, 152, 219] as [number, number, number],      // Bright blue
  text: [0, 0, 0] as [number, number, number],             // Black
  textLight: [100, 100, 100] as [number, number, number],  // Gray
  background: [245, 248, 252] as [number, number, number], // Light blue-gray
  success: [46, 125, 50] as [number, number, number],      // Green
  warning: [245, 124, 0] as [number, number, number],      // Orange
  danger: [211, 47, 47] as [number, number, number]        // Red
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

// Helper function to add professional report header
async function addProfessionalHeader(doc: jsPDF): Promise<number> {
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 20
  let yPosition = margin

  try {
    // Add header background
    doc.setFillColor(...COLORS.primary)
    doc.rect(0, 0, pageWidth, 45, 'F')

    const companyLogoData = await loadImageAsBase64(COMPANY_INFO.logos.company)
    
    if (companyLogoData) {
      const logoHeight = 12
      const logoAspectRatio = 3188 / 580
      const logoWidth = logoHeight * logoAspectRatio
      
      // Add white background behind logo for contrast
      doc.setFillColor(255, 255, 255)
      doc.roundedRect(margin - 2, yPosition - 2, logoWidth + 4, logoHeight + 4, 2, 2, 'F')
      
      doc.addImage(companyLogoData, 'PNG', margin, yPosition, logoWidth, logoHeight)
      
      // Company info on white background
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(255, 255, 255)
      
      const contactInfoX = pageWidth - margin - 70
      doc.text(COMPANY_INFO.address, contactInfoX, yPosition + 6, { align: 'left' })
      doc.text(COMPANY_INFO.address2, contactInfoX, yPosition + 10, { align: 'left' })
      doc.text(COMPANY_INFO.phone, contactInfoX, yPosition + 14, { align: 'left' })
      doc.text(COMPANY_INFO.email, contactInfoX, yPosition + 18, { align: 'left' })
      
      yPosition = 50
    } else {
      // Fallback without logo
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(255, 255, 255)
      doc.text(COMPANY_INFO.name, margin, yPosition + 8)
      
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      const contactInfoX = pageWidth - margin - 70
      doc.text(COMPANY_INFO.address, contactInfoX, yPosition + 6, { align: 'left' })
      doc.text(COMPANY_INFO.address2, contactInfoX, yPosition + 10, { align: 'left' })
      doc.text(COMPANY_INFO.phone, contactInfoX, yPosition + 14, { align: 'left' })
      doc.text(COMPANY_INFO.email, contactInfoX, yPosition + 18, { align: 'left' })
      
      yPosition = 50
    }
    
  } catch (error) {
    console.warn('Could not load company logo, using fallback header')
    yPosition = 50
  }
  
  return yPosition
}

// Helper function to add professional footer with accreditation logos
async function addProfessionalFooter(doc: jsPDF, pageNumber: number, totalPages: number, preparedBy: string): Promise<void> {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 20
  
  // Footer line
  doc.setDrawColor(...COLORS.primary)
  doc.setLineWidth(0.5)
  doc.line(margin, pageHeight - 35, pageWidth - margin, pageHeight - 35)
  
  try {
    // Add accreditation logos
    const iso45001LogoData = await loadImageAsBase64(COMPANY_INFO.logos.iso45001)
    const bizsafeLogoData = await loadImageAsBase64(COMPANY_INFO.logos.bizsafe)
    
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
  
  // Footer text
  doc.setFontSize(8)
  doc.setTextColor(...COLORS.textLight)
  doc.text(
    `Page ${pageNumber} of ${totalPages}`,
    pageWidth / 2,
    pageHeight - 20,
    { align: 'center' }
  )
  
  doc.text(
    `Generated: ${new Date().toLocaleDateString('en-SG', { day: '2-digit', month: 'short', year: 'numeric' })}`,
    pageWidth - margin,
    pageHeight - 20,
    { align: 'right' }
  )
  
  doc.text(
    `Prepared By: ${preparedBy}`,
    margin,
    pageHeight - 20,
    { align: 'left' }
  )
  
  // Legal disclaimer
  doc.setFontSize(7)
  doc.setTextColor(...COLORS.textLight)
  doc.text(
    'This document is computer generated. All financial figures are in SGD unless otherwise stated.',
    pageWidth / 2,
    pageHeight - 8,
    { align: 'center' }
  )
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
    month: 'short',
    year: 'numeric'
  })
}

// Helper function to format percentage
function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`
}

interface ReportMetadata {
  data: any[]
  headers: string[]
  dateRange: {
    from: Date
    to: Date
  }
  generatedBy: string
  filters?: any
  summary?: {
    title: string
    metrics: Array<{
      label: string
      value: string | number
      format?: 'currency' | 'number' | 'percentage' | 'text'
      trend?: 'up' | 'down' | 'neutral'
    }>
  }
  chartData?: {
    title: string
    data: Array<{
      label: string
      value: number
    }>
  }
  notes?: string[]
}

export async function generateEnhancedReportPDF(
  title: string,
  reportMetadata: ReportMetadata,
  reportType: string
): Promise<Buffer> {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 20

  let yPosition = await addProfessionalHeader(doc)

  // Report Title with subtitle
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.primary)
  doc.text(title, pageWidth / 2, yPosition, { align: 'center' })
  yPosition += 8

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.textLight)
  doc.text(COMPANY_INFO.name, pageWidth / 2, yPosition, { align: 'center' })
  yPosition += 10

  // Report Information Card
  doc.setDrawColor(...COLORS.primary)
  doc.setLineWidth(0.3)
  doc.setFillColor(...COLORS.background)
  doc.roundedRect(margin, yPosition, pageWidth - 2 * margin, 32, 3, 3, 'FD')
  
  yPosition += 8
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.primary)
  doc.text('REPORT DETAILS', margin + 5, yPosition)
  yPosition += 8

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.text)
  doc.setFontSize(9)
  
  const infoLeftX = margin + 5
  const infoRightX = pageWidth / 2 + 5
  let infoY = yPosition
  
  // Left column
  doc.setFont('helvetica', 'bold')
  doc.text('Report Type:', infoLeftX, infoY)
  doc.setFont('helvetica', 'normal')
  doc.text(reportType, infoLeftX + 25, infoY)
  infoY += 6
  
  doc.setFont('helvetica', 'bold')
  doc.text('Date Range:', infoLeftX, infoY)
  doc.setFont('helvetica', 'normal')
  doc.text(`${formatDate(reportMetadata.dateRange.from)} to ${formatDate(reportMetadata.dateRange.to)}`, infoLeftX + 25, infoY)
  
  // Right column
  infoY = yPosition
  doc.setFont('helvetica', 'bold')
  doc.text('Generated:', infoRightX, infoY)
  doc.setFont('helvetica', 'normal')
  doc.text(new Date().toLocaleString('en-SG', { 
    day: '2-digit', 
    month: 'short', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }), infoRightX + 22, infoY)
  infoY += 6
  
  doc.setFont('helvetica', 'bold')
  doc.text('Prepared By:', infoRightX, infoY)
  doc.setFont('helvetica', 'normal')
  doc.text(reportMetadata.generatedBy, infoRightX + 22, infoY)
  
  yPosition += 20

  // Executive Summary Section
  if (reportMetadata.summary && reportMetadata.summary.metrics.length > 0) {
    // Check if we need a new page
    if (yPosition > pageHeight - 120) {
      doc.addPage()
      yPosition = margin
    }

    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...COLORS.primary)
    doc.text(reportMetadata.summary.title || 'Executive Summary', margin, yPosition)
    yPosition += 10

    // Summary metrics in professional cards
    const metricsPerRow = 3
    const metricBoxWidth = (pageWidth - 2 * margin - 20) / metricsPerRow
    const metricBoxHeight = 24
    let currentMetricX = margin
    let metricRowY = yPosition

    reportMetadata.summary.metrics.forEach((metric, index) => {
      if (index > 0 && index % metricsPerRow === 0) {
        metricRowY += metricBoxHeight + 6
        currentMetricX = margin
      }

      // Draw metric box with shadow effect
      doc.setDrawColor(220, 220, 220)
      doc.setLineWidth(0.2)
      doc.setFillColor(255, 255, 255)
      doc.roundedRect(currentMetricX, metricRowY, metricBoxWidth, metricBoxHeight, 3, 3, 'FD')

      // Colored top accent bar
      let accentColor = COLORS.primary
      if (metric.trend === 'up') accentColor = COLORS.success
      else if (metric.trend === 'down') accentColor = COLORS.danger
      
      doc.setFillColor(...accentColor)
      doc.roundedRect(currentMetricX, metricRowY, metricBoxWidth, 2, 0, 0, 'F')

      // Metric label
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...COLORS.textLight)
      doc.text(metric.label, currentMetricX + 4, metricRowY + 9)

      // Metric value
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...COLORS.primary)
      
      let displayValue: string
      if (metric.format === 'currency' && typeof metric.value === 'number') {
        displayValue = formatCurrency(metric.value)
      } else if (metric.format === 'percentage' && typeof metric.value === 'number') {
        displayValue = formatPercentage(metric.value)
      } else if (metric.format === 'number' && typeof metric.value === 'number') {
        displayValue = metric.value.toLocaleString('en-SG')
      } else {
        displayValue = String(metric.value)
      }
      
      // Handle long values
      if (displayValue.length > 15) {
        doc.setFontSize(10)
      }
      
      doc.text(displayValue, currentMetricX + 4, metricRowY + 18)

      currentMetricX += metricBoxWidth + 10
    })

    yPosition = metricRowY + metricBoxHeight + 15
  }

  // Chart Visualization Section
  if (reportMetadata.chartData && reportMetadata.chartData.data.length > 0) {
    // Check if we need a new page
    if (yPosition > pageHeight - 100) {
      doc.addPage()
      yPosition = margin
    }

    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...COLORS.primary)
    doc.text(reportMetadata.chartData.title, margin, yPosition)
    yPosition += 12

    // Professional bar chart
    const maxValue = Math.max(...reportMetadata.chartData.data.map(d => d.value))
    const chartAreaWidth = pageWidth - 2 * margin - 80 // Leave space for labels
    const barHeight = 10
    const barSpacing = 16
    const labelWidth = 80

    reportMetadata.chartData.data.slice(0, 10).forEach((item, index) => {
      if (yPosition > pageHeight - 80) {
        doc.addPage()
        yPosition = margin + 20
      }

      // Label with truncation
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...COLORS.text)
      const truncatedLabel = item.label.length > 25 ? item.label.substring(0, 22) + '...' : item.label
      doc.text(truncatedLabel, margin, yPosition + 7, { maxWidth: labelWidth - 5 })

      // Bar background
      doc.setFillColor(240, 240, 240)
      doc.roundedRect(margin + labelWidth, yPosition, chartAreaWidth, barHeight, 2, 2, 'F')

      // Bar foreground with gradient effect (simulated with darker border)
      const barWidth = (item.value / maxValue) * chartAreaWidth
      if (barWidth > 0) {
        doc.setFillColor(...COLORS.accent)
        doc.roundedRect(margin + labelWidth, yPosition, barWidth, barHeight, 2, 2, 'F')
        
        // Add subtle border for depth
        doc.setDrawColor(...COLORS.secondary)
        doc.setLineWidth(0.3)
        doc.roundedRect(margin + labelWidth, yPosition, barWidth, barHeight, 2, 2, 'S')
      }

      // Value label
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(...COLORS.primary)
      const valueText = formatCurrency(item.value)
      const valueX = margin + labelWidth + Math.max(barWidth + 3, 3)
      doc.text(valueText, valueX, yPosition + 7)

      yPosition += barSpacing
    })

    yPosition += 10
  }

  // Data Table Section
  // Check if we need a new page
  if (yPosition > pageHeight - 100) {
    doc.addPage()
    yPosition = margin
  }

  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.primary)
  doc.text('Detailed Data', margin, yPosition)
  yPosition += 10

  if (reportMetadata.data && reportMetadata.data.length > 0) {
    // Convert data objects to array format for autoTable
    const tableData = reportMetadata.data.map(row => {
      return reportMetadata.headers.map(header => {
        const value = row[header]
        if (value === null || value === undefined) return 'N/A'
        if (typeof value === 'number') {
          if (header.toLowerCase().includes('amount') || 
              header.toLowerCase().includes('value') || 
              header.toLowerCase().includes('revenue') ||
              header.toLowerCase().includes('cost') ||
              header.toLowerCase().includes('budget')) {
            return formatCurrency(value)
          }
          if (header.toLowerCase().includes('progress') || 
              header.toLowerCase().includes('%') ||
              header.toLowerCase().includes('rate') ||
              header.toLowerCase().includes('margin')) {
            return formatPercentage(value)
          }
          return value.toLocaleString('en-SG')
        }
        return String(value)
      })
    })

    autoTable(doc, {
      head: [reportMetadata.headers],
      body: tableData,
      startY: yPosition,
      theme: 'striped',
      headStyles: {
        fillColor: COLORS.primary,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'left',
        cellPadding: 4
      },
      bodyStyles: {
        fontSize: 7,
        cellPadding: 3,
        textColor: COLORS.text
      },
      alternateRowStyles: {
        fillColor: COLORS.background
      },
      columnStyles: {
        // Auto-adjust column widths based on content
      },
      margin: { left: margin, right: margin },
      didDrawPage: function (data: any) {
        // Track table position
      },
      styles: {
        overflow: 'linebreak',
        cellWidth: 'wrap',
        fontSize: 7,
        cellPadding: 3
      }
    })

    yPosition = (doc as any).lastAutoTable?.finalY + 15 || yPosition
  } else {
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(...COLORS.textLight)
    doc.setFontSize(10)
    doc.text('No data available for the selected criteria.', margin, yPosition)
    yPosition += 15
  }

  // Notes Section
  if (reportMetadata.notes && reportMetadata.notes.length > 0) {
    // Check if we need a new page
    if (yPosition > pageHeight - 80) {
      doc.addPage()
      yPosition = margin
    }

    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...COLORS.primary)
    doc.text('Notes & Remarks', margin, yPosition)
    yPosition += 8

    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...COLORS.text)

    reportMetadata.notes.forEach((note, index) => {
      const noteLines = doc.splitTextToSize(`${index + 1}. ${note}`, pageWidth - 2 * margin)
      doc.text(noteLines, margin, yPosition)
      yPosition += noteLines.length * 5 + 2
    })

    yPosition += 10
  }

  // Summary totals section (for financial reports)
  const hasTotals = reportMetadata.summary && reportMetadata.summary.metrics.some(m => 
    m.label.toLowerCase().includes('total')
  )

  if (hasTotals && yPosition < pageHeight - 60) {
    doc.setDrawColor(...COLORS.primary)
    doc.setLineWidth(0.5)
    doc.line(margin, yPosition, pageWidth - margin, yPosition)
    yPosition += 10

    // Totals box
    doc.setFillColor(...COLORS.background)
    doc.roundedRect(pageWidth - margin - 80, yPosition, 80, 30, 3, 3, 'F')

    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...COLORS.primary)
    
    const totalsMetrics = reportMetadata.summary!.metrics.filter(m => 
      m.label.toLowerCase().includes('total') || m.label.toLowerCase().includes('grand')
    )

    let totalsY = yPosition + 6
    totalsMetrics.forEach(metric => {
      doc.text(metric.label + ':', pageWidth - margin - 76, totalsY)
      
      let displayValue: string
      if (metric.format === 'currency' && typeof metric.value === 'number') {
        displayValue = formatCurrency(metric.value)
      } else {
        displayValue = String(metric.value)
      }
      
      doc.text(displayValue, pageWidth - margin - 4, totalsY, { align: 'right' })
      totalsY += 6
    })
  }

  // Add professional footer to all pages
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    await addProfessionalFooter(doc, i, totalPages, reportMetadata.generatedBy)
  }

  return Buffer.from(doc.output('arraybuffer'))
}
