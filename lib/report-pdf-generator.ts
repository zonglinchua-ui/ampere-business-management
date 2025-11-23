
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

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

// Helper function to add report header
async function addReportHeader(doc: jsPDF): Promise<number> {
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 20
  let yPosition = margin

  try {
    const companyLogoData = await loadImageAsBase64(COMPANY_INFO.logos.company)
    
    if (companyLogoData) {
      const logoHeight = 14
      const logoAspectRatio = 3188 / 580
      const logoWidth = logoHeight * logoAspectRatio
      doc.addImage(companyLogoData, 'PNG', margin, yPosition, logoWidth, logoHeight)
      
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(0, 0, 0)
      
      const contactInfoX = pageWidth - margin - 60
      doc.text(COMPANY_INFO.address, contactInfoX, yPosition + 5, { align: 'left' })
      doc.text(COMPANY_INFO.address2, contactInfoX, yPosition + 9, { align: 'left' })
      doc.text(COMPANY_INFO.phone, contactInfoX, yPosition + 13, { align: 'left' })
      doc.text(COMPANY_INFO.email, contactInfoX, yPosition + 17, { align: 'left' })
      
      yPosition += 25
    } else {
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
    
    doc.setDrawColor(0, 51, 102)
    doc.setLineWidth(0.5)
    doc.line(margin, yPosition, pageWidth - margin, yPosition)
    yPosition += 10
    
  } catch (error) {
    console.warn('Could not load company logo, using fallback header')
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
    
    doc.setDrawColor(0, 51, 102)
    doc.setLineWidth(0.5)
    doc.line(margin, yPosition, pageWidth - margin, yPosition)
    yPosition += 10
  }
  
  return yPosition
}

// Helper function to add company footer
async function addReportFooter(doc: jsPDF, pageNumber: number, totalPages: number): Promise<void> {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 20
  
  doc.setDrawColor(0, 51, 102)
  doc.setLineWidth(0.3)
  doc.line(margin, pageHeight - 35, pageWidth - margin, pageHeight - 35)
  
  try {
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
  
  doc.setFontSize(8)
  doc.text(
    `Page ${pageNumber} of ${totalPages}`,
    pageWidth / 2,
    pageHeight - 25,
    { align: 'center' }
  )
  
  doc.text(
    `Generated: ${new Date().toLocaleDateString()}`,
    pageWidth - margin,
    pageHeight - 25,
    { align: 'right' }
  )
  
  doc.setFontSize(7)
  doc.text(
    'This document is computer generated. No signature is required.',
    pageWidth / 2,
    pageHeight - 6,
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
    month: '2-digit',
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
    }>
  }
  chartData?: {
    title: string
    data: Array<{
      label: string
      value: number
    }>
  }
}

export async function generateBusinessReportPDF(
  title: string,
  reportMetadata: ReportMetadata,
  reportType: string
): Promise<Buffer> {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 20

  let yPosition = await addReportHeader(doc)

  // Report Title
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 51, 102)
  doc.text(title, pageWidth / 2, yPosition, { align: 'center' })
  yPosition += 12

  // Report Information Box
  doc.setDrawColor(0, 51, 102)
  doc.setFillColor(245, 248, 252)
  doc.roundedRect(margin, yPosition, pageWidth - 2 * margin, 30, 3, 3, 'FD')
  
  yPosition += 8
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 51, 102)
  doc.text('REPORT INFORMATION', margin + 5, yPosition)
  yPosition += 6

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(0, 0, 0)
  doc.setFontSize(8)
  
  const infoLeftX = margin + 5
  const infoRightX = pageWidth / 2 + 10
  let infoY = yPosition
  
  // Left column
  doc.text(`Report Type: ${reportType}`, infoLeftX, infoY)
  infoY += 5
  doc.text(`Generated: ${new Date().toLocaleString()}`, infoLeftX, infoY)
  
  // Right column
  infoY = yPosition
  doc.text(`Date Range: ${formatDate(reportMetadata.dateRange.from)} to ${formatDate(reportMetadata.dateRange.to)}`, infoRightX, infoY)
  infoY += 5
  doc.text(`Generated By: ${reportMetadata.generatedBy}`, infoRightX, infoY)
  
  yPosition += 25

  // Executive Summary Section (if provided)
  if (reportMetadata.summary) {
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(0, 51, 102)
    doc.text(reportMetadata.summary.title || 'Executive Summary', margin, yPosition)
    yPosition += 8

    // Summary metrics in a grid
    const metricsPerRow = 2
    const metricBoxWidth = (pageWidth - 2 * margin - 10) / metricsPerRow
    const metricBoxHeight = 20
    let currentMetricX = margin
    let metricRowY = yPosition

    reportMetadata.summary.metrics.forEach((metric, index) => {
      if (index > 0 && index % metricsPerRow === 0) {
        metricRowY += metricBoxHeight + 5
        currentMetricX = margin
      }

      // Draw metric box
      doc.setDrawColor(200, 200, 200)
      doc.setFillColor(255, 255, 255)
      doc.roundedRect(currentMetricX, metricRowY, metricBoxWidth, metricBoxHeight, 2, 2, 'FD')

      // Metric label
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(100, 100, 100)
      doc.text(metric.label, currentMetricX + 5, metricRowY + 7)

      // Metric value
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(0, 51, 102)
      
      let displayValue: string
      if (metric.format === 'currency' && typeof metric.value === 'number') {
        displayValue = formatCurrency(metric.value)
      } else if (metric.format === 'percentage' && typeof metric.value === 'number') {
        displayValue = formatPercentage(metric.value)
      } else if (metric.format === 'number' && typeof metric.value === 'number') {
        displayValue = metric.value.toLocaleString()
      } else {
        displayValue = String(metric.value)
      }
      
      doc.text(displayValue, currentMetricX + 5, metricRowY + 16)

      currentMetricX += metricBoxWidth + 10
    })

    yPosition = metricRowY + metricBoxHeight + 15
  }

  // Check if we need a new page before the data table
  if (yPosition > pageHeight - 50) {
    doc.addPage()
    yPosition = margin
  }

  // Data Table Section
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 51, 102)
  doc.text('Detailed Data', margin, yPosition)
  yPosition += 8

  if (reportMetadata.data && reportMetadata.data.length > 0) {
    // Convert data objects to array format for autoTable
    const tableData = reportMetadata.data.map(row => {
      return reportMetadata.headers.map(header => {
        const value = row[header]
        if (value === null || value === undefined) return 'N/A'
        if (typeof value === 'number' && header.toLowerCase().includes('amount')) {
          return formatCurrency(value)
        }
        if (typeof value === 'number' && header.toLowerCase().includes('progress')) {
          return formatPercentage(value)
        }
        return String(value)
      })
    })

    autoTable(doc, {
      head: [reportMetadata.headers],
      body: tableData,
      startY: yPosition,
      theme: 'grid',
      headStyles: {
        fillColor: [0, 51, 102],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9,
        halign: 'left'
      },
      bodyStyles: {
        fontSize: 8,
        cellPadding: 3
      },
      alternateRowStyles: {
        fillColor: [245, 248, 252]
      },
      margin: { left: margin, right: margin },
      didDrawPage: function (data: any) {
        // Keep track of position after table for next content
      }
    })

    yPosition = (doc as any).lastAutoTable?.finalY + 10 || yPosition
  } else {
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 100, 100)
    doc.setFontSize(10)
    doc.text('No data available for the selected criteria.', margin, yPosition)
    yPosition += 15
  }

  // Chart Visualization Section (textual representation)
  if (reportMetadata.chartData && reportMetadata.chartData.data.length > 0) {
    // Check if we need a new page
    if (yPosition > pageHeight - 50) {
      doc.addPage()
      yPosition = margin
    }

    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(0, 51, 102)
    doc.text(reportMetadata.chartData.title, margin, yPosition)
    yPosition += 10

    // Create a simple bar chart representation
    const maxValue = Math.max(...reportMetadata.chartData.data.map(d => d.value))
    const chartWidth = pageWidth - 2 * margin
    const barHeight = 8
    const barSpacing = 12

    reportMetadata.chartData.data.forEach((item, index) => {
      if (yPosition > pageHeight - 50) {
        doc.addPage()
        yPosition = margin
      }

      // Label
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(0, 0, 0)
      doc.text(item.label, margin, yPosition + 5)

      // Bar
      const barWidth = (item.value / maxValue) * (chartWidth * 0.6)
      doc.setFillColor(0, 51, 102)
      doc.rect(margin + 60, yPosition, barWidth, barHeight, 'F')

      // Value
      doc.setFont('helvetica', 'bold')
      doc.text(formatCurrency(item.value), margin + 65 + barWidth, yPosition + 5)

      yPosition += barSpacing
    })

    yPosition += 10
  }

  // Add filters information at the end
  if (reportMetadata.filters && Object.keys(reportMetadata.filters).length > 0) {
    // Check if we need a new page
    if (yPosition > pageHeight - 50) {
      doc.addPage()
      yPosition = margin
    }

    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(0, 51, 102)
    doc.text('Applied Filters:', margin, yPosition)
    yPosition += 7

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(0, 0, 0)

    Object.entries(reportMetadata.filters).forEach(([key, value]) => {
      if (value && key !== 'dateRange') {
        doc.text(`${key}: ${JSON.stringify(value)}`, margin + 5, yPosition)
        yPosition += 5
      }
    })

    yPosition += 10
  }

  // Disclaimer / Notes
  if (yPosition < pageHeight - 50) {
    doc.setDrawColor(200, 200, 200)
    doc.line(margin, yPosition, pageWidth - margin, yPosition)
    yPosition += 8

    doc.setFontSize(7)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(100, 100, 100)
    const disclaimer = 'This report is generated from the business management system. All financial figures are in SGD unless otherwise stated. Data accuracy is subject to proper data entry and system synchronization.'
    const disclaimerLines = doc.splitTextToSize(disclaimer, pageWidth - 2 * margin)
    doc.text(disclaimerLines, margin, yPosition)
  }

  // Add standardized footer to all pages
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    await addReportFooter(doc, i, totalPages)
  }

  return Buffer.from(doc.output('arraybuffer'))
}

