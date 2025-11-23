
import * as ExcelJS from 'exceljs'
import { QuotationPDFData } from './quotation-pdf-utils'

/**
 * Generate a comprehensive Excel file for a quotation
 * This provides a backup and editable version of the quotation
 */
export async function generateQuotationExcel(quotationData: QuotationPDFData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  
  // Set workbook properties
  workbook.creator = 'Ampere Business Management'
  workbook.lastModifiedBy = 'Ampere Business Management'
  workbook.created = new Date()
  workbook.modified = new Date()
  
  // Create main worksheet
  const worksheet = workbook.addWorksheet('Quotation', {
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0
    }
  })
  
  // Set column widths
  worksheet.columns = [
    { width: 5 },   // A - margin
    { width: 30 },  // B - labels/descriptions
    { width: 12 },  // C - quantity
    { width: 10 },  // D - unit
    { width: 15 },  // E - unit price
    { width: 15 },  // F - total
    { width: 5 }    // G - margin
  ]
  
  let currentRow = 1
  
  // === HEADER SECTION ===
  // Company name/logo placeholder
  const titleCell = worksheet.getCell(`B${currentRow}`)
  titleCell.value = 'AMPERE ENGINEERING PTE LTD'
  titleCell.font = { size: 16, bold: true, color: { argb: 'FF1F4788' } }
  titleCell.alignment = { horizontal: 'left', vertical: 'middle' }
  currentRow += 1
  
  const addressCell = worksheet.getCell(`B${currentRow}`)
  addressCell.value = '31 Changi South Street 1, Singapore 486769'
  addressCell.font = { size: 9 }
  currentRow += 1
  
  const contactCell = worksheet.getCell(`B${currentRow}`)
  contactCell.value = 'Tel: +65 6546 3308 | Email: info@ampere.com.sg'
  contactCell.font = { size: 9 }
  currentRow += 2
  
  // Document title
  const docTitleCell = worksheet.getCell(`B${currentRow}`)
  docTitleCell.value = 'QUOTATION'
  docTitleCell.font = { size: 18, bold: true }
  docTitleCell.alignment = { horizontal: 'center' }
  worksheet.mergeCells(`B${currentRow}:F${currentRow}`)
  currentRow += 2
  
  // === QUOTATION INFO SECTION ===
  // Quotation number and date side by side
  const qnCell = worksheet.getCell(`B${currentRow}`)
  qnCell.value = 'Quotation No:'
  qnCell.font = { bold: true }
  
  const qnValueCell = worksheet.getCell(`C${currentRow}`)
  qnValueCell.value = `${quotationData.quotationNumber} (v${quotationData.version})`
  
  const dateCell = worksheet.getCell(`E${currentRow}`)
  dateCell.value = 'Date:'
  dateCell.font = { bold: true }
  
  const dateValueCell = worksheet.getCell(`F${currentRow}`)
  dateValueCell.value = new Date()
  dateValueCell.numFmt = 'dd/mm/yyyy'
  currentRow += 1
  
  // Valid until
  const validCell = worksheet.getCell(`B${currentRow}`)
  validCell.value = 'Valid Until:'
  validCell.font = { bold: true }
  
  const validValueCell = worksheet.getCell(`C${currentRow}`)
  validValueCell.value = new Date(quotationData.validUntil)
  validValueCell.numFmt = 'dd/mm/yyyy'
  currentRow += 2
  
  // === CLIENT INFORMATION ===
  const clientHeaderCell = worksheet.getCell(`B${currentRow}`)
  clientHeaderCell.value = 'BILL TO:'
  clientHeaderCell.font = { bold: true, size: 11 }
  currentRow += 1
  
  if (quotationData.client) {
    worksheet.getCell(`B${currentRow}`).value = quotationData.client.name
    currentRow += 1
    
    if (quotationData.client.address) {
      worksheet.getCell(`B${currentRow}`).value = quotationData.client.address
      currentRow += 1
    }
    
    const cityLine = [
      quotationData.client.city,
      quotationData.client.state,
      quotationData.client.postalCode
    ].filter(Boolean).join(', ')
    
    if (cityLine) {
      worksheet.getCell(`B${currentRow}`).value = cityLine
      currentRow += 1
    }
    
    if (quotationData.client.country) {
      worksheet.getCell(`B${currentRow}`).value = quotationData.client.country
      currentRow += 1
    }
    
    if (quotationData.client.email) {
      worksheet.getCell(`B${currentRow}`).value = `Email: ${quotationData.client.email}`
      currentRow += 1
    }
    
    if (quotationData.client.phone) {
      worksheet.getCell(`B${currentRow}`).value = `Phone: ${quotationData.client.phone}`
      currentRow += 1
    }
  }
  currentRow += 1
  
  // === RE: SECTION ===
  if (quotationData.title) {
    const reCell = worksheet.getCell(`B${currentRow}`)
    reCell.value = `RE: ${quotationData.title}`
    reCell.font = { bold: true, size: 11 }
    currentRow += 2
  }

  // === INTRODUCTION PARAGRAPH ===
  const introCell = worksheet.getCell(`B${currentRow}`)
  introCell.value = 'With reference to the above mentioned, we are pleased to submit the following quotation for your kind consideration.'
  introCell.alignment = { wrapText: true }
  worksheet.mergeCells(`B${currentRow}:F${currentRow}`)
  currentRow += 2

  // === PROJECT DETAILS ===
  if (quotationData.title) {
    const projectHeaderCell = worksheet.getCell(`B${currentRow}`)
    projectHeaderCell.value = 'PROJECT:'
    projectHeaderCell.font = { bold: true, size: 11 }
    currentRow += 1
    
    const projectTitleCell = worksheet.getCell(`B${currentRow}`)
    projectTitleCell.value = quotationData.title
    projectTitleCell.font = { bold: true }
    currentRow += 1
  }
  
  if (quotationData.description) {
    worksheet.getCell(`B${currentRow}`).value = quotationData.description
    currentRow += 1
  }
  
  if (quotationData.clientReference) {
    worksheet.getCell(`B${currentRow}`).value = `Reference: ${quotationData.clientReference}`
    currentRow += 1
  }
  currentRow += 1
  
  // === LINE ITEMS TABLE ===
  const tableStartRow = currentRow
  
  // Table headers
  const headers = ['No.', 'Description', 'Qty', 'Unit', 'Unit Price', 'Amount']
  const headerCols = ['B', 'C', 'D', 'E', 'F', 'G']
  
  headers.forEach((header, index) => {
    const cell = worksheet.getCell(`${headerCols[index]}${currentRow}`)
    cell.value = header
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F4788' }
    }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    }
  })
  currentRow += 1
  
  // Table rows
  const items = quotationData.items || []
  items.forEach((item, index) => {
    // Item number
    const noCell = worksheet.getCell(`B${currentRow}`)
    noCell.value = index + 1
    noCell.alignment = { horizontal: 'center', vertical: 'top' }
    noCell.border = {
      left: { style: 'thin' },
      right: { style: 'thin' },
      bottom: { style: 'thin' }
    }
    
    // Description
    const descCell = worksheet.getCell(`C${currentRow}`)
    descCell.value = item.description
    descCell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true }
    descCell.border = {
      left: { style: 'thin' },
      right: { style: 'thin' },
      bottom: { style: 'thin' }
    }
    
    // Quantity
    const qtyCell = worksheet.getCell(`D${currentRow}`)
    qtyCell.value = item.quantity
    qtyCell.alignment = { horizontal: 'center', vertical: 'top' }
    qtyCell.border = {
      left: { style: 'thin' },
      right: { style: 'thin' },
      bottom: { style: 'thin' }
    }
    
    // Unit
    const unitCell = worksheet.getCell(`E${currentRow}`)
    unitCell.value = item.unit || 'pcs'
    unitCell.alignment = { horizontal: 'center', vertical: 'top' }
    unitCell.border = {
      left: { style: 'thin' },
      right: { style: 'thin' },
      bottom: { style: 'thin' }
    }
    
    // Unit price
    const priceCell = worksheet.getCell(`F${currentRow}`)
    priceCell.value = item.unitPrice
    priceCell.numFmt = `"${quotationData.currency}" #,##0.00`
    priceCell.alignment = { horizontal: 'right', vertical: 'top' }
    priceCell.border = {
      left: { style: 'thin' },
      right: { style: 'thin' },
      bottom: { style: 'thin' }
    }
    
    // Total
    const totalCell = worksheet.getCell(`G${currentRow}`)
    totalCell.value = item.totalPrice
    totalCell.numFmt = `"${quotationData.currency}" #,##0.00`
    totalCell.alignment = { horizontal: 'right', vertical: 'top' }
    totalCell.border = {
      left: { style: 'thin' },
      right: { style: 'thin' },
      bottom: { style: 'thin' }
    }
    
    currentRow += 1
  })
  
  // === TOTALS SECTION ===
  currentRow += 1
  
  // Subtotal
  const subtotalLabelCell = worksheet.getCell(`F${currentRow}`)
  subtotalLabelCell.value = 'Subtotal:'
  subtotalLabelCell.font = { bold: true }
  subtotalLabelCell.alignment = { horizontal: 'right' }
  
  const subtotalValueCell = worksheet.getCell(`G${currentRow}`)
  subtotalValueCell.value = quotationData.subtotal
  subtotalValueCell.numFmt = `"${quotationData.currency}" #,##0.00`
  subtotalValueCell.alignment = { horizontal: 'right' }
  subtotalValueCell.font = { bold: true }
  currentRow += 1
  
  // Discount (if applicable)
  if (quotationData.discountAmount && quotationData.discountAmount > 0) {
    const discountLabelCell = worksheet.getCell(`F${currentRow}`)
    discountLabelCell.value = 'Discount:'
    discountLabelCell.alignment = { horizontal: 'right' }
    
    const discountValueCell = worksheet.getCell(`G${currentRow}`)
    discountValueCell.value = -quotationData.discountAmount
    discountValueCell.numFmt = `"${quotationData.currency}" #,##0.00`
    discountValueCell.alignment = { horizontal: 'right' }
    currentRow += 1
  }
  
  // Tax (if applicable)
  if (quotationData.taxAmount && quotationData.taxAmount > 0) {
    const taxLabelCell = worksheet.getCell(`F${currentRow}`)
    taxLabelCell.value = 'Tax (GST):'
    taxLabelCell.alignment = { horizontal: 'right' }
    
    const taxValueCell = worksheet.getCell(`G${currentRow}`)
    taxValueCell.value = quotationData.taxAmount
    taxValueCell.numFmt = `"${quotationData.currency}" #,##0.00`
    taxValueCell.alignment = { horizontal: 'right' }
    currentRow += 1
  }
  
  // Total
  const totalLabelCell = worksheet.getCell(`F${currentRow}`)
  totalLabelCell.value = 'TOTAL:'
  totalLabelCell.font = { bold: true, size: 12 }
  totalLabelCell.alignment = { horizontal: 'right' }
  totalLabelCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE8EEF7' }
  }
  
  const totalValueCell = worksheet.getCell(`G${currentRow}`)
  totalValueCell.value = quotationData.totalAmount
  totalValueCell.numFmt = `"${quotationData.currency}" #,##0.00`
  totalValueCell.alignment = { horizontal: 'right' }
  totalValueCell.font = { bold: true, size: 12 }
  totalValueCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE8EEF7' }
  }
  currentRow += 2
  
  // === TERMS AND CONDITIONS ===
  if (quotationData.terms) {
    const termsHeaderCell = worksheet.getCell(`B${currentRow}`)
    termsHeaderCell.value = 'TERMS & CONDITIONS:'
    termsHeaderCell.font = { bold: true, size: 11 }
    currentRow += 1
    
    const termsCell = worksheet.getCell(`B${currentRow}`)
    termsCell.value = quotationData.terms
    termsCell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true }
    worksheet.mergeCells(`B${currentRow}:G${currentRow}`)
    currentRow += 2
  }
  
  // === NOTES ===
  if (quotationData.notes) {
    const notesHeaderCell = worksheet.getCell(`B${currentRow}`)
    notesHeaderCell.value = 'NOTES:'
    notesHeaderCell.font = { bold: true, size: 11 }
    currentRow += 1
    
    const notesCell = worksheet.getCell(`B${currentRow}`)
    notesCell.value = quotationData.notes
    notesCell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true }
    worksheet.mergeCells(`B${currentRow}:G${currentRow}`)
    currentRow += 2
  }
  
  // === FOOTER ===
  currentRow += 2
  const footerCell = worksheet.getCell(`B${currentRow}`)
  footerCell.value = 'This quotation is computer-generated and is valid without signature.'
  footerCell.font = { size: 8, italic: true, color: { argb: 'FF666666' } }
  footerCell.alignment = { horizontal: 'center' }
  worksheet.mergeCells(`B${currentRow}:G${currentRow}`)
  
  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

/**
 * Generate a comprehensive Excel file for a Purchase Order
 */
export async function generatePurchaseOrderExcel(poData: any): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  
  // Set workbook properties
  workbook.creator = 'Ampere Business Management'
  workbook.lastModifiedBy = 'Ampere Business Management'
  workbook.created = new Date()
  workbook.modified = new Date()
  
  // Create main worksheet
  const worksheet = workbook.addWorksheet('Purchase Order', {
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0
    }
  })
  
  // Set column widths
  worksheet.columns = [
    { width: 5 },   // A - margin
    { width: 12 },  // B - S/N
    { width: 35 },  // C - descriptions
    { width: 10 },  // D - quantity
    { width: 10 },  // E - unit
    { width: 15 },  // F - unit price
    { width: 12 },  // G - discount
    { width: 10 },  // H - tax
    { width: 15 },  // I - total
    { width: 5 }    // J - margin
  ]
  
  let currentRow = 1
  
  // === HEADER SECTION ===
  const titleCell = worksheet.getCell(`B${currentRow}`)
  titleCell.value = 'AMPERE ENGINEERING PTE LTD'
  titleCell.font = { size: 16, bold: true, color: { argb: 'FF1F4788' } }
  titleCell.alignment = { horizontal: 'left', vertical: 'middle' }
  currentRow += 1
  
  const addressCell = worksheet.getCell(`B${currentRow}`)
  addressCell.value = '101 Upper Cross Street #04-05'
  addressCell.font = { size: 9 }
  currentRow += 1
  
  const addressCell2 = worksheet.getCell(`B${currentRow}`)
  addressCell2.value = "People's Park Centre Singapore 058357"
  addressCell2.font = { size: 9 }
  currentRow += 1
  
  const contactCell = worksheet.getCell(`B${currentRow}`)
  contactCell.value = 'Tel: +65 66778457 | Email: projects@ampere.com.sg'
  contactCell.font = { size: 9 }
  currentRow += 2
  
  // Document title
  const docTitleCell = worksheet.getCell(`B${currentRow}`)
  docTitleCell.value = 'PURCHASE ORDER'
  docTitleCell.font = { size: 18, bold: true }
  docTitleCell.alignment = { horizontal: 'center' }
  worksheet.mergeCells(`B${currentRow}:I${currentRow}`)
  currentRow += 2
  
  // === PO INFO SECTION ===
  const poNumCell = worksheet.getCell(`B${currentRow}`)
  poNumCell.value = 'PO Number:'
  poNumCell.font = { bold: true }
  
  const poNumValueCell = worksheet.getCell(`C${currentRow}`)
  poNumValueCell.value = poData.poNumber
  
  const dateCell = worksheet.getCell(`F${currentRow}`)
  dateCell.value = 'Date:'
  dateCell.font = { bold: true }
  
  const dateValueCell = worksheet.getCell(`G${currentRow}`)
  dateValueCell.value = new Date(poData.issueDate || new Date())
  dateValueCell.numFmt = 'dd/mm/yyyy'
  currentRow += 1
  
  // Delivery date
  const deliveryCell = worksheet.getCell(`B${currentRow}`)
  deliveryCell.value = 'Delivery Date:'
  deliveryCell.font = { bold: true }
  
  const deliveryValueCell = worksheet.getCell(`C${currentRow}`)
  deliveryValueCell.value = new Date(poData.deliveryDate)
  deliveryValueCell.numFmt = 'dd/mm/yyyy'
  currentRow += 2
  
  // === SUPPLIER/CUSTOMER INFORMATION ===
  const isOutgoing = poData.type === 'OUTGOING' || poData.supplier
  const vendorInfo = isOutgoing ? poData.supplier : poData.customer
  const vendorLabel = isOutgoing ? 'TO:' : 'FROM:'
  
  const vendorHeaderCell = worksheet.getCell(`B${currentRow}`)
  vendorHeaderCell.value = vendorLabel
  vendorHeaderCell.font = { bold: true, size: 11 }
  currentRow += 1
  
  if (vendorInfo) {
    worksheet.getCell(`B${currentRow}`).value = vendorInfo.name || vendorInfo.companyName || ''
    currentRow += 1
    
    if (vendorInfo.address) {
      worksheet.getCell(`B${currentRow}`).value = vendorInfo.address
      currentRow += 1
    }
    
    const cityLine = [
      vendorInfo.city,
      vendorInfo.state,
      vendorInfo.postalCode
    ].filter(Boolean).join(', ')
    
    if (cityLine) {
      worksheet.getCell(`B${currentRow}`).value = cityLine
      currentRow += 1
    }
    
    if (vendorInfo.country) {
      worksheet.getCell(`B${currentRow}`).value = vendorInfo.country
      currentRow += 1
    }
    
    if (vendorInfo.email) {
      worksheet.getCell(`B${currentRow}`).value = `Email: ${vendorInfo.email}`
      currentRow += 1
    }
    
    if (vendorInfo.phone) {
      worksheet.getCell(`B${currentRow}`).value = `Phone: ${vendorInfo.phone}`
      currentRow += 1
    }
  }
  currentRow += 1
  
  // === PROJECT INFO ===
  if (poData.project) {
    const projectHeaderCell = worksheet.getCell(`B${currentRow}`)
    projectHeaderCell.value = 'PROJECT:'
    projectHeaderCell.font = { bold: true, size: 11 }
    currentRow += 1
    
    const projectNameCell = worksheet.getCell(`B${currentRow}`)
    projectNameCell.value = poData.project.name
    projectNameCell.font = { bold: true }
    currentRow += 1
    
    if (poData.project.projectNumber) {
      worksheet.getCell(`B${currentRow}`).value = `Project No: ${poData.project.projectNumber}`
      currentRow += 1
    }
  }
  currentRow += 1
  
  // === PAYMENT TERMS ===
  if (poData.terms) {
    const termsHeaderCell = worksheet.getCell(`B${currentRow}`)
    termsHeaderCell.value = 'PAYMENT TERMS:'
    termsHeaderCell.font = { bold: true, size: 10 }
    currentRow += 1
    
    worksheet.getCell(`B${currentRow}`).value = poData.terms
    currentRow += 1
  }
  currentRow += 1
  
  // === LINE ITEMS TABLE ===
  const tableStartRow = currentRow
  
  // Table headers
  const headers = ['S/N', 'Description', 'Qty', 'Unit', 'Unit Price', 'Discount', 'Tax', 'Amount']
  const headerCols = ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']
  
  headers.forEach((header, index) => {
    const cell = worksheet.getCell(`${headerCols[index]}${currentRow}`)
    cell.value = header
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F4788' }
    }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    }
  })
  currentRow += 1
  
  // Table rows
  const items = poData.items || []
  items.forEach((item: any, index: number) => {
    // S/N
    const snCell = worksheet.getCell(`B${currentRow}`)
    snCell.value = item.serialNumber || (index + 1).toString()
    snCell.alignment = { horizontal: 'center', vertical: 'top' }
    snCell.border = {
      left: { style: 'thin' },
      right: { style: 'thin' },
      bottom: { style: 'thin' }
    }
    
    // Description
    const descCell = worksheet.getCell(`C${currentRow}`)
    descCell.value = item.description
    descCell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true }
    descCell.border = {
      left: { style: 'thin' },
      right: { style: 'thin' },
      bottom: { style: 'thin' }
    }
    
    // Quantity
    const qtyCell = worksheet.getCell(`D${currentRow}`)
    qtyCell.value = item.quantity
    qtyCell.alignment = { horizontal: 'center', vertical: 'top' }
    qtyCell.border = {
      left: { style: 'thin' },
      right: { style: 'thin' },
      bottom: { style: 'thin' }
    }
    
    // Unit
    const unitCell = worksheet.getCell(`E${currentRow}`)
    unitCell.value = item.unit || 'pcs'
    unitCell.alignment = { horizontal: 'center', vertical: 'top' }
    unitCell.border = {
      left: { style: 'thin' },
      right: { style: 'thin' },
      bottom: { style: 'thin' }
    }
    
    // Unit price
    const priceCell = worksheet.getCell(`F${currentRow}`)
    priceCell.value = item.unitPrice
    priceCell.numFmt = `"${poData.currency}" #,##0.00`
    priceCell.alignment = { horizontal: 'right', vertical: 'top' }
    priceCell.border = {
      left: { style: 'thin' },
      right: { style: 'thin' },
      bottom: { style: 'thin' }
    }
    
    // Discount
    const discountCell = worksheet.getCell(`G${currentRow}`)
    discountCell.value = item.discount ? `${item.discount}%` : '-'
    discountCell.alignment = { horizontal: 'center', vertical: 'top' }
    discountCell.border = {
      left: { style: 'thin' },
      right: { style: 'thin' },
      bottom: { style: 'thin' }
    }
    
    // Tax
    const taxCell = worksheet.getCell(`H${currentRow}`)
    taxCell.value = item.taxRate ? `${item.taxRate}%` : '-'
    taxCell.alignment = { horizontal: 'center', vertical: 'top' }
    taxCell.border = {
      left: { style: 'thin' },
      right: { style: 'thin' },
      bottom: { style: 'thin' }
    }
    
    // Total
    const totalCell = worksheet.getCell(`I${currentRow}`)
    totalCell.value = item.totalPrice
    totalCell.numFmt = `"${poData.currency}" #,##0.00`
    totalCell.alignment = { horizontal: 'right', vertical: 'top' }
    totalCell.border = {
      left: { style: 'thin' },
      right: { style: 'thin' },
      bottom: { style: 'thin' }
    }
    
    currentRow += 1
  })
  
  // === TOTALS SECTION ===
  currentRow += 1
  
  // Subtotal
  const subtotalLabelCell = worksheet.getCell(`H${currentRow}`)
  subtotalLabelCell.value = 'Subtotal:'
  subtotalLabelCell.font = { bold: true }
  subtotalLabelCell.alignment = { horizontal: 'right' }
  
  const subtotalValueCell = worksheet.getCell(`I${currentRow}`)
  subtotalValueCell.value = poData.subtotal
  subtotalValueCell.numFmt = `"${poData.currency}" #,##0.00`
  subtotalValueCell.alignment = { horizontal: 'right' }
  subtotalValueCell.font = { bold: true }
  currentRow += 1
  
  // Discount (if applicable)
  if (poData.discountAmount && poData.discountAmount > 0) {
    const discountLabelCell = worksheet.getCell(`H${currentRow}`)
    discountLabelCell.value = 'Discount:'
    discountLabelCell.alignment = { horizontal: 'right' }
    
    const discountValueCell = worksheet.getCell(`I${currentRow}`)
    discountValueCell.value = -poData.discountAmount
    discountValueCell.numFmt = `"${poData.currency}" #,##0.00`
    discountValueCell.alignment = { horizontal: 'right' }
    currentRow += 1
  }
  
  // Tax (if applicable)
  if (poData.taxAmount && poData.taxAmount > 0) {
    const taxLabelCell = worksheet.getCell(`H${currentRow}`)
    taxLabelCell.value = 'Tax (GST):'
    taxLabelCell.alignment = { horizontal: 'right' }
    
    const taxValueCell = worksheet.getCell(`I${currentRow}`)
    taxValueCell.value = poData.taxAmount
    taxValueCell.numFmt = `"${poData.currency}" #,##0.00`
    taxValueCell.alignment = { horizontal: 'right' }
    currentRow += 1
  }
  
  // Total
  const totalLabelCell = worksheet.getCell(`H${currentRow}`)
  totalLabelCell.value = 'TOTAL:'
  totalLabelCell.font = { bold: true, size: 12 }
  totalLabelCell.alignment = { horizontal: 'right' }
  totalLabelCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE8EEF7' }
  }
  
  const totalValueCell = worksheet.getCell(`I${currentRow}`)
  totalValueCell.value = poData.totalAmount
  totalValueCell.numFmt = `"${poData.currency}" #,##0.00`
  totalValueCell.alignment = { horizontal: 'right' }
  totalValueCell.font = { bold: true, size: 12 }
  totalValueCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE8EEF7' }
  }
  currentRow += 2
  
  // === NOTES ===
  if (poData.notes) {
    const notesHeaderCell = worksheet.getCell(`B${currentRow}`)
    notesHeaderCell.value = 'NOTES:'
    notesHeaderCell.font = { bold: true, size: 11 }
    currentRow += 1
    
    const notesCell = worksheet.getCell(`B${currentRow}`)
    notesCell.value = poData.notes
    notesCell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true }
    worksheet.mergeCells(`B${currentRow}:I${currentRow}`)
    currentRow += 2
  }
  
  // === FOOTER ===
  currentRow += 2
  const footerCell = worksheet.getCell(`B${currentRow}`)
  footerCell.value = 'This purchase order is computer-generated and is valid without signature.'
  footerCell.font = { size: 8, italic: true, color: { argb: 'FF666666' } }
  footerCell.alignment = { horizontal: 'center' }
  worksheet.mergeCells(`B${currentRow}:I${currentRow}`)
  
  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}
