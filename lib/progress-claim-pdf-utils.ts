
import { PrismaClient } from '@prisma/client';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as ExcelJS from 'exceljs';
import { uploadFile } from './s3';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

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
};

// Helper function to load image as base64
async function loadImageAsBase64(imagePath: string): Promise<string | null> {
  try {
    const fs = require('fs').promises;
    const path = require('path');
    const fullPath = path.join(process.cwd(), 'public', imagePath);
    const imageBuffer = await fs.readFile(fullPath);
    const base64 = imageBuffer.toString('base64');
    const ext = path.extname(imagePath).toLowerCase();
    const mimeType = ext === '.png' ? 'png' : ext === '.jpg' || ext === '.jpeg' ? 'jpeg' : 'png';
    return `data:image/${mimeType};base64,${base64}`;
  } catch (error) {
    console.warn(`Could not load image: ${imagePath}`, error);
    return null;
  }
}

// Helper function to add company letterhead
async function addCompanyLetterhead(doc: jsPDF): Promise<number> {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPosition = margin;

  try {
    // Load and add company logo at the top
    const companyLogoData = await loadImageAsBase64(COMPANY_INFO.logos.company);
    
    if (companyLogoData) {
      // Add company logo (top left) with proper aspect ratio
      const logoMaxWidth = 60; // Max width in PDF units
      const logoAspectRatio = 3188 / 580; // Width / Height
      const logoWidth = logoMaxWidth;
      const logoHeight = logoWidth / logoAspectRatio; // Maintain aspect ratio
      
      doc.addImage(companyLogoData, 'PNG', margin, yPosition, logoWidth, logoHeight);
      
      // Move to position below logo
      yPosition += logoHeight + 5;
      
      // Address, phone and email directly below logo with smaller fonts
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      
      doc.text(COMPANY_INFO.address, margin, yPosition);
      yPosition += 4;
      doc.text(COMPANY_INFO.address2, margin, yPosition);
      yPosition += 4;
      doc.text(COMPANY_INFO.phone, margin, yPosition);
      yPosition += 4;
      doc.text(COMPANY_INFO.email, margin, yPosition);
      
      yPosition += 6;
    } else {
      // Fallback to text-based header
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 51, 102);
      doc.text(COMPANY_INFO.name.toUpperCase(), margin, yPosition);
      yPosition += 15;
      
      // Address, phone and email with smaller fonts
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      
      doc.text(COMPANY_INFO.address, margin, yPosition);
      yPosition += 4;
      doc.text(COMPANY_INFO.address2, margin, yPosition);
      yPosition += 4;
      doc.text(COMPANY_INFO.phone, margin, yPosition);
      yPosition += 4;
      doc.text(COMPANY_INFO.email, margin, yPosition);
      yPosition += 12;
    }
    
    // Add a professional separator line
    doc.setDrawColor(0, 51, 102);
    doc.setLineWidth(0.5);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 5;
    
  } catch (error) {
    console.warn('Could not load company logos, using text-based header');
    // Fallback to simple text header
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 51, 102);
    doc.text(COMPANY_INFO.name.toUpperCase(), margin, yPosition);
    yPosition += 15;
    
    // Address, phone and email with smaller fonts
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    
    doc.text(COMPANY_INFO.address, margin, yPosition);
    yPosition += 4;
    doc.text(COMPANY_INFO.address2, margin, yPosition);
    yPosition += 4;
    doc.text(COMPANY_INFO.phone, margin, yPosition);
    yPosition += 4;
    doc.text(COMPANY_INFO.email, margin, yPosition);
    yPosition += 4;
  }
  
  return yPosition;
}

// Helper function to add company footer
async function addCompanyFooter(doc: jsPDF, pageNumber: number, totalPages: number): Promise<void> {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  
  // Footer line - positioned lower to maximize usable space
  doc.setDrawColor(0, 51, 102);
  doc.setLineWidth(0.3);
  doc.line(margin, pageHeight - 35, pageWidth - margin, pageHeight - 35);
  
  try {
    // Load accreditation logos
    const iso45001LogoData = await loadImageAsBase64(COMPANY_INFO.logos.iso45001);
    const bizsafeLogoData = await loadImageAsBase64(COMPANY_INFO.logos.bizsafe);
    
    // Add accreditation logos at bottom left - with proper spacing from footer line
    let logoXPosition = margin;
    
    if (iso45001LogoData) {
      doc.addImage(iso45001LogoData, 'JPEG', logoXPosition, pageHeight - 32, 24, 12);
      logoXPosition += 27;
    }
    
    if (bizsafeLogoData) {
      doc.addImage(bizsafeLogoData, 'JPEG', logoXPosition, pageHeight - 32, 15, 12);
      logoXPosition += 18;
    }
    
  } catch (error) {
    console.warn('Could not load accreditation logos');
  }
  
  // Center - Page number with improved spacing
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(
    `Page ${pageNumber} of ${totalPages}`,
    pageWidth / 2,
    pageHeight - 22,
    { align: 'center' }
  );
  
  // Right side - Generation date
  doc.text(
    `Generated: ${new Date().toLocaleDateString()}`,
    pageWidth - margin,
    pageHeight - 22,
    { align: 'right' }
  );
  
  // Bottom line - Computer-generated statement with adequate spacing
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 51, 102);
  doc.text(
    'This document is computer generated. No signature is required.',
    pageWidth / 2,
    pageHeight - 10,
    { align: 'center' }
  );
}

export interface ProgressClaimPDFData {
  id: string;
  claimNumber: string;
  claimTitle: string;
  claimDate: string | Date;
  description?: string | null;
  status: string;
  currentClaimAmount: number;
  previousClaimedAmount: number;
  cumulativeAmount: number;
  retentionPercentage: number;
  retentionAmount: number;
  gstRate?: number;
  gstAmount?: number;
  subTotal?: number;
  netClaimAmount: number;
  currency: string;
  project?: {
    name: string;
    projectNumber: string;
    address?: string | null;
    country?: string | null;
  };
  customer?: {
    name: string;
    companyName?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    city?: string | null;
    postalCode?: string | null;
  };
  items?: Array<{
    itemNumber: number;
    description: string;
    unit: string;
    unitRate: number;
    totalQuantity: number;
    previousClaimedQty: number;
    previousClaimedPct: number;
    currentClaimQty: number;
    currentClaimPct: number;
    cumulativePct: number;
    currentClaimAmount: number;
  }>;
}

/**
 * Generate PDF for a progress claim
 */
export async function generateProgressClaimPDF(
  claimData: ProgressClaimPDFData
): Promise<Buffer> {
  try {
    console.log('Starting PDF generation for claim:', claimData.claimNumber);
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;

  // Helper function to safely format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-SG', {
      style: 'currency',
      currency: claimData.currency || 'SGD',
    }).format(amount || 0);
  };

  // Helper function to safely format numbers
  const formatNumber = (num: number, decimals: number = 2) => {
    return (num || 0).toFixed(decimals);
  };

  // Add company letterhead
  let yPos = await addCompanyLetterhead(doc);
  yPos += 5;

  // Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 51, 102);
  doc.text('PROGRESS CLAIM', pageWidth / 2, yPos, { align: 'center' });
  yPos += 8;

  // Claim Number
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text(claimData.claimNumber, pageWidth / 2, yPos, { align: 'center' });
  yPos += 12;

  // Customer Information
  if (claimData.customer) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('To:', margin, yPos);
    doc.setFont('helvetica', 'normal');
    yPos += 5;
    doc.text(claimData.customer.companyName || claimData.customer.name, margin, yPos);
    yPos += 4;
    if (claimData.customer.address) {
      doc.text(claimData.customer.address, margin, yPos);
      yPos += 4;
    }
    if (claimData.customer.city && claimData.customer.postalCode) {
      doc.text(
        `${claimData.customer.city} ${claimData.customer.postalCode}`,
        margin,
        yPos
      );
      yPos += 4;
    }
    yPos += 6;
  }

  // Project Information
  doc.setFont('helvetica', 'bold');
  doc.text('Project:', margin, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(claimData.project?.name || 'N/A', margin + 25, yPos);
  yPos += 5;

  doc.setFont('helvetica', 'bold');
  doc.text('Project No:', margin, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(claimData.project?.projectNumber || 'N/A', margin + 25, yPos);
  yPos += 5;

  doc.setFont('helvetica', 'bold');
  doc.text('Claim Title:', margin, yPos);
  doc.setFont('helvetica', 'normal');
  const titleMaxWidth = pageWidth - margin * 2 - 25;
  const titleLines = doc.splitTextToSize(claimData.claimTitle, titleMaxWidth);
  doc.text(titleLines, margin + 25, yPos);
  yPos += titleLines.length * 4 + 1;

  doc.setFont('helvetica', 'bold');
  doc.text('Date:', margin, yPos);
  doc.setFont('helvetica', 'normal');
  const claimDate = new Date(claimData.claimDate).toLocaleDateString('en-SG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  doc.text(claimDate, margin + 25, yPos);
  yPos += 10;

  // Items Table
  if (claimData.items && claimData.items.length > 0) {
    const tableData = claimData.items.map((item) => [
      item.itemNumber.toString(),
      item.description,
      item.unit,
      formatCurrency(item.unitRate),
      formatNumber(item.totalQuantity),
      formatNumber(item.previousClaimedPct) + '%',
      formatNumber(item.currentClaimQty),
      formatNumber(item.currentClaimPct) + '%',
      formatNumber(item.cumulativePct) + '%',
      formatCurrency(item.currentClaimAmount),
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [
        [
          '#',
          'Description',
          'Unit',
          'Rate',
          'Total',
          'Prev%',
          'Curr Qty',
          'Curr%',
          'Cumul%',
          'Amount',
        ],
      ],
      body: tableData,
      theme: 'grid',
      headStyles: { 
        fillColor: [41, 128, 185], 
        textColor: 255, 
        fontSize: 7,
        fontStyle: 'bold',
        cellPadding: 1.5
      },
      bodyStyles: { 
        fontSize: 7,
        cellPadding: 1.5
      },
      columnStyles: {
        0: { cellWidth: 8 },
        1: { cellWidth: 35 },
        2: { cellWidth: 12 },
        3: { cellWidth: 18, halign: 'right' },
        4: { cellWidth: 13, halign: 'right' },
        5: { cellWidth: 12, halign: 'right' },
        6: { cellWidth: 15, halign: 'right' },
        7: { cellWidth: 13, halign: 'right' },
        8: { cellWidth: 18, halign: 'right' },
        9: { cellWidth: 21, halign: 'right' },
      },
      margin: { left: margin, right: margin, top: margin, bottom: 45 },
      didDrawPage: (data: any) => {
        // Update yPos after each page is drawn
        yPos = data.cursor.y;
      }
    });

    // Add extra spacing after the table for the financial summary
    yPos += 10;
  }

  // Financial Summary - Check if we need a new page
  const pageHeight = doc.internal.pageSize.getHeight();
  const summaryHeight = 60; // Estimated height for financial summary
  
  // Check if summary section fits on current page - use 50-unit footer protection
  if (yPos + summaryHeight > pageHeight - 50) {
    // Not enough space, add new page
    doc.addPage();
    yPos = margin + 10;
  }

  // Financial Summary with improved spacing
  doc.setFontSize(10);
  const labelX = 110; // Start position for labels
  const amountX = pageWidth - margin; // Right align amounts at page margin

  doc.setFont('helvetica', 'normal');
  doc.text('Previous Claims:', labelX, yPos);
  doc.text(formatCurrency(claimData.previousClaimedAmount), amountX, yPos, {
    align: 'right',
  });
  yPos += 6;

  doc.setFont('helvetica', 'bold');
  doc.text('Current Claim:', labelX, yPos);
  doc.text(formatCurrency(claimData.currentClaimAmount), amountX, yPos, {
    align: 'right',
  });
  yPos += 6;

  doc.setFont('helvetica', 'normal');
  doc.text('Cumulative Amount:', labelX, yPos);
  doc.text(formatCurrency(claimData.cumulativeAmount), amountX, yPos, {
    align: 'right',
  });
  yPos += 8;

  if (claimData.retentionAmount && claimData.retentionAmount > 0) {
    doc.text(
      `Less Retention (${claimData.retentionPercentage || 0}%):`,
      labelX,
      yPos
    );
    doc.text(`(${formatCurrency(claimData.retentionAmount)})`, amountX, yPos, {
      align: 'right',
    });
    yPos += 6;
  }

  // Calculate subtotal (after retention)
  const subTotal = claimData.subTotal || (claimData.cumulativeAmount - (claimData.retentionAmount || 0));
  
  doc.setFont('helvetica', 'normal');
  doc.text('Sub-Total:', labelX, yPos);
  doc.text(formatCurrency(subTotal), amountX, yPos, {
    align: 'right',
  });
  yPos += 8;

  // GST Calculation - Default 9% for Singapore, 0% for overseas
  const gstRate = claimData.gstRate !== undefined ? claimData.gstRate : 9;
  const gstAmount = claimData.gstAmount !== undefined ? claimData.gstAmount : (subTotal * gstRate / 100);
  
  if (gstRate > 0) {
    doc.text(`Add GST (${gstRate}%):`, labelX, yPos);
    doc.text(formatCurrency(gstAmount), amountX, yPos, {
      align: 'right',
    });
    yPos += 10;
  } else {
    // Show GST line even if 0% (e.g., for overseas projects)
    doc.text('GST (0% - Overseas):', labelX, yPos);
    doc.text(formatCurrency(0), amountX, yPos, {
      align: 'right',
    });
    yPos += 10;
  }

  // Draw a line before final amount
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.line(labelX, yPos - 3, amountX, yPos - 3);
  yPos += 2;

  // Net Amount Payable - with better spacing between label and amount
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Net Amount Payable:', labelX, yPos);
  doc.text(formatCurrency(claimData.netClaimAmount), amountX, yPos, {
    align: 'right',
  });
  
  // Draw a double line after final amount
  yPos += 3;
  doc.setLineWidth(0.5);
  doc.line(labelX, yPos, amountX, yPos);
  yPos += 1;
  doc.line(labelX, yPos, amountX, yPos);

  // Description (if any)
  if (claimData.description) {
    yPos += 15;
    
    // Check if we need a new page for description
    // Check page break before adding description section - use 50-unit footer protection
    if (yPos + 20 > pageHeight - 50) {
      doc.addPage();
      yPos = margin + 10;
    }
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Notes:', margin, yPos);
    yPos += 5;
    doc.setFont('helvetica', 'normal');
    const splitDescription = doc.splitTextToSize(claimData.description, pageWidth - margin * 2);
    doc.text(splitDescription, margin, yPos);
  }

  // Add footer to all pages
  console.log('Adding footers to pages...');
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    await addCompanyFooter(doc, i, totalPages);
  }

  console.log('Generating final PDF buffer...');
  const buffer = Buffer.from(doc.output('arraybuffer'));
  console.log('PDF generated successfully, size:', buffer.length, 'bytes');
  return buffer;
  } catch (error) {
    console.error('Error in generateProgressClaimPDF:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown',
      stack: error instanceof Error ? error.stack : undefined,
      claimNumber: claimData?.claimNumber
    });
    throw error;
  }
}

/**
 * Generate Excel for a progress claim
 */
export async function generateProgressClaimExcel(
  claimData: ProgressClaimPDFData
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Progress Claim');

  // Helper function to safely format numbers
  const formatNumber = (num: number, decimals: number = 2) => {
    return parseFloat((num || 0).toFixed(decimals));
  };

  // Title
  worksheet.mergeCells('A1:J1');
  worksheet.getCell('A1').value = 'PROGRESS CLAIM';
  worksheet.getCell('A1').font = { size: 16, bold: true };
  worksheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };

  // Claim Number
  worksheet.mergeCells('A2:J2');
  worksheet.getCell('A2').value = claimData.claimNumber;
  worksheet.getCell('A2').font = { size: 12, bold: true };
  worksheet.getCell('A2').alignment = { horizontal: 'center' };

  let rowNum = 4;

  // Project Information
  worksheet.getCell(`A${rowNum}`).value = 'Project:';
  worksheet.getCell(`A${rowNum}`).font = { bold: true };
  worksheet.getCell(`B${rowNum}`).value = claimData.project?.name || 'N/A';
  rowNum++;

  worksheet.getCell(`A${rowNum}`).value = 'Project No:';
  worksheet.getCell(`A${rowNum}`).font = { bold: true };
  worksheet.getCell(`B${rowNum}`).value = claimData.project?.projectNumber || 'N/A';
  rowNum++;

  worksheet.getCell(`A${rowNum}`).value = 'Claim Title:';
  worksheet.getCell(`A${rowNum}`).font = { bold: true };
  worksheet.getCell(`B${rowNum}`).value = claimData.claimTitle;
  rowNum++;

  worksheet.getCell(`A${rowNum}`).value = 'Date:';
  worksheet.getCell(`A${rowNum}`).font = { bold: true };
  worksheet.getCell(`B${rowNum}`).value = new Date(claimData.claimDate);
  worksheet.getCell(`B${rowNum}`).numFmt = 'dd mmm yyyy';
  rowNum += 2;

  // Customer Information
  if (claimData.customer) {
    worksheet.getCell(`A${rowNum}`).value = 'Customer:';
    worksheet.getCell(`A${rowNum}`).font = { bold: true };
    worksheet.getCell(`B${rowNum}`).value =
      claimData.customer.companyName || claimData.customer.name;
    rowNum += 2;
  }

  // Items Table Header
  const headerRow = worksheet.getRow(rowNum);
  headerRow.values = [
    '#',
    'Description',
    'Unit',
    'Unit Rate',
    'Total Qty',
    'Prev %',
    'Current Qty',
    'Current %',
    'Cumulative %',
    'Amount',
  ];
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF2980B9' },
  };
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
  rowNum++;

  // Items Data
  if (claimData.items && claimData.items.length > 0) {
    claimData.items.forEach((item) => {
      const row = worksheet.getRow(rowNum);
      row.values = [
        item.itemNumber,
        item.description,
        item.unit,
        formatNumber(item.unitRate),
        formatNumber(item.totalQuantity),
        formatNumber(item.previousClaimedPct),
        formatNumber(item.currentClaimQty),
        formatNumber(item.currentClaimPct),
        formatNumber(item.cumulativePct),
        formatNumber(item.currentClaimAmount),
      ];

      // Format currency columns
      row.getCell(4).numFmt = '#,##0.00';
      row.getCell(10).numFmt = '#,##0.00';

      // Format percentage columns
      row.getCell(6).numFmt = '0.00"%"';
      row.getCell(8).numFmt = '0.00"%"';
      row.getCell(9).numFmt = '0.00"%"';

      // Format quantity columns
      row.getCell(5).numFmt = '#,##0.00';
      row.getCell(7).numFmt = '#,##0.00';

      rowNum++;
    });
  }

  rowNum += 2;

  // Financial Summary
  worksheet.getCell(`H${rowNum}`).value = 'Previous Claims:';
  worksheet.getCell(`H${rowNum}`).font = { bold: false };
  worksheet.getCell(`J${rowNum}`).value = formatNumber(claimData.previousClaimedAmount);
  worksheet.getCell(`J${rowNum}`).numFmt = '#,##0.00';
  rowNum++;

  worksheet.getCell(`H${rowNum}`).value = 'Current Claim:';
  worksheet.getCell(`H${rowNum}`).font = { bold: true };
  worksheet.getCell(`J${rowNum}`).value = formatNumber(claimData.currentClaimAmount);
  worksheet.getCell(`J${rowNum}`).numFmt = '#,##0.00';
  rowNum++;

  worksheet.getCell(`H${rowNum}`).value = 'Cumulative Amount:';
  worksheet.getCell(`H${rowNum}`).font = { bold: false };
  worksheet.getCell(`J${rowNum}`).value = formatNumber(claimData.cumulativeAmount);
  worksheet.getCell(`J${rowNum}`).numFmt = '#,##0.00';
  rowNum++;

  if (claimData.retentionAmount && claimData.retentionAmount > 0) {
    worksheet.getCell(`H${rowNum}`).value = `Less Retention (${claimData.retentionPercentage || 0}%):`;
    worksheet.getCell(`H${rowNum}`).font = { bold: false };
    worksheet.getCell(`J${rowNum}`).value = -formatNumber(claimData.retentionAmount);
    worksheet.getCell(`J${rowNum}`).numFmt = '#,##0.00';
    rowNum++;
  }

  // Sub-Total
  const subTotal = claimData.subTotal || (claimData.cumulativeAmount - (claimData.retentionAmount || 0));
  worksheet.getCell(`H${rowNum}`).value = 'Sub-Total:';
  worksheet.getCell(`H${rowNum}`).font = { bold: false };
  worksheet.getCell(`J${rowNum}`).value = formatNumber(subTotal);
  worksheet.getCell(`J${rowNum}`).numFmt = '#,##0.00';
  rowNum++;

  // GST
  const gstRate = claimData.gstRate !== undefined ? claimData.gstRate : 9;
  const gstAmount = claimData.gstAmount !== undefined ? claimData.gstAmount : (subTotal * gstRate / 100);
  
  if (gstRate > 0) {
    worksheet.getCell(`H${rowNum}`).value = `Add GST (${gstRate}%):`;
  } else {
    worksheet.getCell(`H${rowNum}`).value = 'GST (0% - Overseas):';
  }
  worksheet.getCell(`H${rowNum}`).font = { bold: false };
  worksheet.getCell(`J${rowNum}`).value = formatNumber(gstAmount);
  worksheet.getCell(`J${rowNum}`).numFmt = '#,##0.00';
  rowNum++;

  // Add border before net amount
  rowNum++;

  worksheet.getCell(`H${rowNum}`).value = 'Net Amount Payable:';
  worksheet.getCell(`H${rowNum}`).font = { bold: true, size: 12 };
  worksheet.getCell(`J${rowNum}`).value = formatNumber(claimData.netClaimAmount);
  worksheet.getCell(`J${rowNum}`).numFmt = '#,##0.00';
  worksheet.getCell(`J${rowNum}`).font = { bold: true, size: 12 };
  
  // Add border styling
  worksheet.getCell(`H${rowNum}`).border = {
    top: { style: 'double' },
    bottom: { style: 'double' }
  };
  worksheet.getCell(`J${rowNum}`).border = {
    top: { style: 'double' },
    bottom: { style: 'double' }
  };

  // Column widths
  worksheet.getColumn(1).width = 5;
  worksheet.getColumn(2).width = 35;
  worksheet.getColumn(3).width = 10;
  worksheet.getColumn(4).width = 12;
  worksheet.getColumn(5).width = 12;
  worksheet.getColumn(6).width = 10;
  worksheet.getColumn(7).width = 12;
  worksheet.getColumn(8).width = 12;
  worksheet.getColumn(9).width = 14;
  worksheet.getColumn(10).width = 15;

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Generate and store both PDF and Excel for a progress claim
 */
export async function generateAndStoreProgressClaimPDF(
  claimData: ProgressClaimPDFData,
  userId: string
): Promise<{ pdfPath: string; excelPath: string }> {
  try {
    // Generate both PDF and Excel buffers in parallel
    const [pdfBuffer, excelBuffer] = await Promise.all([
      generateProgressClaimPDF(claimData),
      generateProgressClaimExcel(claimData),
    ]);

    // Create filenames
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const pdfFilename = `progress-claim-${claimData.claimNumber}-${timestamp}.pdf`;
    const excelFilename = `progress-claim-${claimData.claimNumber}-${timestamp}.xlsx`;

    // Upload both files to S3 in parallel
    const [pdfCloudPath, excelCloudPath] = await Promise.all([
      uploadFile(pdfBuffer, pdfFilename),
      uploadFile(excelBuffer, excelFilename),
    ]);

    // Note: Documents are not stored in database for progress claims
    // They are generated on-demand for download/preview

    return { pdfPath: pdfCloudPath, excelPath: excelCloudPath };
  } catch (error) {
    console.error('Error generating progress claim documents:', error);
    throw error;
  }
}
