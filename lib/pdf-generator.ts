import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { DocumentTemplate } from './document-templates'

// Company letterhead configuration
const COMPANY_INFO = {
  name: 'Ampere Engineering Pte Ltd',
  address: '2 Gambas Crescent, #04-10, Nordcom Two, Singapore 757044',
  phone: '+65 6251 9107',
  email: 'contact@ampere.com.sg',
  website: 'www.ampere.com.sg',
  logoUrl: 'https://raw.githubusercontent.com/zonglinchua-ui/ampere-web-app/main/public/logo-full.png' // URL to your logo
}

// Helper function to format dates
const formatDate = (date: Date | string) => {
  if (!date) return ''
  const d = new Date(date)
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`
}

// Helper function to format currency
const formatCurrency = (amount: number, currency: string = 'SGD') => {
  return new Intl.NumberFormat('en-SG', { style: 'currency', currency }).format(amount)
}

// Reusable header function
async function addHeader(doc: jsPDF, title: string) {
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 20
  let yPosition = 20

  // Add logo if URL is provided
  if (COMPANY_INFO.logoUrl) {
    try {
      const response = await fetch(COMPANY_INFO.logoUrl)
      const blob = await response.blob()
      const reader = new FileReader()
      const dataUrl = await new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string)
        reader.readAsDataURL(blob)
      })
      doc.addImage(dataUrl, 'PNG', margin, yPosition, 50, 15) // Adjust size as needed
    } catch (error) {
      console.error('Error fetching or adding logo:', error)
    }
  }

  // Company address on the right
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 100, 100)
  doc.text(COMPANY_INFO.address, pageWidth - margin, yPosition, { align: 'right' })
  doc.text(COMPANY_INFO.phone, pageWidth - margin, yPosition + 4, { align: 'right' })
  doc.text(COMPANY_INFO.email, pageWidth - margin, yPosition + 8, { align: 'right' })
  doc.text(COMPANY_INFO.website, pageWidth - margin, yPosition + 12, { align: 'right' })

  yPosition += 30 // Space after header

  // Add a horizontal line
  doc.setDrawColor(200, 200, 200)
  doc.line(margin, yPosition, pageWidth - margin, yPosition)
  yPosition += 10

  return yPosition
}

// Reusable footer function
function addFooter(doc: jsPDF) {
  const pageCount = doc.internal.pages.length
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 20

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(150, 150, 150)

    // Page number
    doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' })

    // Generated date
    doc.text(`Generated: ${formatDate(new Date())}`, pageWidth - margin, pageHeight - 10, { align: 'right' })

    // "This document is computer generated..." text
    doc.text('This document is computer generated. No signature is required.', margin, pageHeight - 10, { align: 'left' })
  }
}

// Quotation-specific PDF generator
export async function generateQuotationPDF(quotationData: any): Promise<Buffer> {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 20

  let yPosition = await addHeader(doc, 'Quotation')

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
  doc.text('TO:', margin, yPosition)
  if (quotationData.client?.name) {
    doc.setFont('helvetica', 'normal')
    const clientNameLines = doc.splitTextToSize(quotationData.client.name, clientSectionMaxWidth - 15)
    doc.text(clientNameLines, margin + 15, yPosition)
    yPosition += clientNameLines.length * 5
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

  // Items Table
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
    theme: 'striped',
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
      if (data.column.index === 1 && data.cell.text && data.cell.text.length > 1) {
        const [description, ...notes] = data.cell.text
        doc.setFontSize(9)
        doc.setTextColor(0, 0, 0)
        doc.text(description, data.cell.x + 2, data.cell.y + 4)

        if (notes.length > 0) {
          doc.setFontSize(8)
          doc.setFont('helvetica', 'italic')
          doc.setTextColor(128, 128, 128)
          doc.text(notes.join('\n'), data.cell.x + 2, data.cell.y + 9)
        }
      }
    }
  })

  yPosition = (doc as any).lastAutoTable.finalY + 10

  // Summary
  const summaryBoxWidth = 95
  const summaryBoxX = pageWidth - margin - summaryBoxWidth
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Summary:', summaryBoxX, yPosition)
  yPosition += 6

  const summaryRows = [
    { label: 'Subtotal:', value: formatCurrency(quotationData.subtotal, quotationData.currency) },
    { label: 'GST (9%):', value: formatCurrency(quotationData.taxAmount, quotationData.currency) },
    { label: 'Total:', value: formatCurrency(quotationData.totalAmount, quotationData.currency), isBold: true }
  ]

  autoTable(doc, {
    body: summaryRows.map(row => [row.label, row.value]),
    startY: yPosition,
    theme: 'plain',
    tableWidth: summaryBoxWidth,
    margin: { left: summaryBoxX },
    styles: { fontSize: 10 },
    columnStyles: { 1: { halign: 'right' } },
    didParseCell: (data) => {
      if (summaryRows[data.row.index].isBold) {
        data.cell.styles.fontStyle = 'bold'
      }
    }
  })

  addFooter(doc)

  return Buffer.from(doc.output('arraybuffer'))
}

