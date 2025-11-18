import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import PDFDocument from 'pdfkit';
import { createWriteStream } from 'fs';

async function generatePOPDF(
  poRequest: any,
  project: any,
  outputPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const stream = createWriteStream(outputPath);
      
      doc.pipe(stream);

      // Header
      doc.fontSize(20).text('PURCHASE ORDER', { align: 'center' });
      doc.moveDown();

      // PO Details
      doc.fontSize(10);
      doc.font('Helvetica-Bold').text(`PO Number: ${poRequest.poNumber}`, ).font('Helvetica');
      doc.text(`Date: ${new Date(poRequest.poDate).toLocaleDateString('en-SG')}`);
      doc.text(`Project: ${project.projectNumber} - ${project.name}`);
      doc.moveDown();

      // Supplier Details
      doc.fontSize(12).text('Supplier:', { underline: true });
      doc.fontSize(10);
      doc.text(poRequest.Supplier.name);
      if (poRequest.Supplier.address) {
        doc.text(poRequest.Supplier.address);
      }
      doc.moveDown();

      // Delivery Details
      if (poRequest.deliveryDate || poRequest.deliveryAddress) {
        doc.fontSize(12).text('Delivery:', { underline: true });
        doc.fontSize(10);
        if (poRequest.deliveryDate) {
          doc.text(`Delivery Date: ${new Date(poRequest.deliveryDate).toLocaleDateString('en-SG')}`);
        }
        if (poRequest.deliveryAddress) {
          doc.text(`Delivery Address: ${poRequest.deliveryAddress}`);
        }
        doc.moveDown();
      }

      // Line Items Table
      doc.fontSize(12).text('Items:', { underline: true });
      doc.moveDown(0.5);

      // Table Header
      const tableTop = doc.y;
      const itemX = 50;
      const qtyX = 300;
      const priceX = 370;
      const amountX = 450;

      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('Description', itemX, tableTop);
      doc.text('Qty', qtyX, tableTop);
      doc.text('Unit Price', priceX, tableTop);
      doc.text('Amount', amountX, tableTop);
      
      doc.moveTo(itemX, tableTop + 15).lineTo(550, tableTop + 15).stroke();

      // Table Rows
      doc.font('Helvetica');
      let y = tableTop + 20;
      
      if (poRequest.Quotation.LineItems && poRequest.Quotation.LineItems.length > 0) {
        poRequest.Quotation.LineItems.forEach((item: any) => {
          doc.text(item.description, itemX, y, { width: 240 });
          doc.text(item.quantity?.toFixed(2) || '-', qtyX, y);
          doc.text(
            item.unitPrice
              ? `${poRequest.currency} ${item.unitPrice.toFixed(2)}`
              : '-',
            priceX,
            y
          );
          doc.text(`${poRequest.currency} ${item.amount.toFixed(2)}`, amountX, y);
          y += 25;
        });
      }

      doc.moveTo(itemX, y).lineTo(550, y).stroke();
      y += 10;

      // Totals
      doc.font('Helvetica-Bold');
      if (poRequest.taxAmount) {
        const subtotal = poRequest.totalAmount - poRequest.taxAmount;
        doc.text('Subtotal:', priceX, y);
        doc.text(`${poRequest.currency} ${subtotal.toFixed(2)}`, amountX, y);
        y += 15;
        
        doc.text('Tax:', priceX, y);
        doc.text(`${poRequest.currency} ${poRequest.taxAmount.toFixed(2)}`, amountX, y);
        y += 15;
      }
      
      doc.fontSize(11);
      doc.text('Total:', priceX, y);
      doc.text(`${poRequest.currency} ${poRequest.totalAmount.toFixed(2)}`, amountX, y);
      y += 25;

      // Payment Terms
      doc.font('Helvetica');
      doc.fontSize(10);
      doc.text(`Payment Terms: ${poRequest.paymentTerms.replace(/_/g, ' ')}`, itemX, y);
      if (poRequest.customPaymentTerms) {
        y += 15;
        doc.text(`Custom Terms: ${poRequest.customPaymentTerms}`, itemX, y);
      }
      y += 25;

      // Terms & Conditions
      if (poRequest.termsAndConditions) {
        doc.fontSize(12).font('Helvetica-Bold').text('Terms & Conditions:', itemX, y);
        y += 15;
        doc.fontSize(9).font('Helvetica').text(poRequest.termsAndConditions, itemX, y, {
          width: 500,
          align: 'justify',
        });
      }

      doc.end();
      stream.on('finish', () => resolve());
      stream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is superadmin
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Only superadmins can approve PO requests' },
        { status: 403 }
      );
    }

    const projectId = params.id;
    const body = await request.json();
    
    const { poRequestId, action, comments } = body;

    // Validate action
    if (!['APPROVED', 'REJECTED'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be APPROVED or REJECTED' },
        { status: 400 }
      );
    }

    // Fetch PO request
    const poRequest = await prisma.procurementPORequest.findFirst({
      where: {
        id: poRequestId,
        projectId,
      },
      include: {
        Quotation: {
          include: {
            Supplier: true,
            LineItems: {
              orderBy: { lineNumber: 'asc' },
            },
          },
        },
        Project: {
          select: {
            id: true,
            name: true,
            projectNumber: true,
          },
        },
        Supplier: true,
      },
    });

    if (!poRequest) {
      return NextResponse.json(
        { error: 'PO request not found' },
        { status: 404 }
      );
    }

    if (poRequest.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'PO request has already been processed' },
        { status: 400 }
      );
    }

    let generatedPO: any = null;

    if (action === 'APPROVED') {
      // Generate PO document
      const nasBasePath = process.env.NAS_BASE_PATH || 'C:/ampere/nas';
      const projectFolder = `${poRequest.Project.projectNumber}-${poRequest.Project.name}`;
      const poFolder = join(nasBasePath, 'PROJECT', projectFolder, 'POs to suppliers');
      
      // Create folder if not exists
      if (!existsSync(poFolder)) {
        await mkdir(poFolder, { recursive: true });
      }

      // Generate filename
      const fileName = `PO ${poRequest.poNumber} - ${poRequest.Supplier.name} - ${poRequest.Project.name}.pdf`;
      const filePath = join(poFolder, fileName);

      // Generate PDF
      await generatePOPDF(poRequest, poRequest.Project, filePath);

      // Also save to central PO folder for cross-project search
      const centralPOFolder = join(nasBasePath, 'POs');
      if (!existsSync(centralPOFolder)) {
        await mkdir(centralPOFolder, { recursive: true });
      }
      const centralFilePath = join(centralPOFolder, fileName);
      
      // Copy to central folder
      const fs = require('fs');
      fs.copyFileSync(filePath, centralFilePath);

      // Create PO document record
      generatedPO = await prisma.procurementDocument.create({
        data: {
          projectId,
          documentType: 'SUPPLIER_PO',
          documentNumber: poRequest.poNumber,
          documentDate: poRequest.poDate,
          status: 'APPROVED',
          fileName,
          originalFileName: fileName,
          filePath,
          centralFilePath,
          fileSize: fs.statSync(filePath).size,
          mimeType: 'application/pdf',
          supplierId: poRequest.supplierId,
          totalAmount: poRequest.totalAmount,
          currency: poRequest.currency,
          taxAmount: poRequest.taxAmount,
          subtotalAmount: poRequest.taxAmount && poRequest.totalAmount
            ? (Number(poRequest.totalAmount) - Number(poRequest.taxAmount))
            : null,
          paymentTerms: poRequest.paymentTerms as any,
          customPaymentTerms: poRequest.customPaymentTerms,
          termsAndConditions: poRequest.termsAndConditions,
          linkedQuotationId: poRequest.quotationId,
          requiresApproval: false,
          approvalStatus: 'APPROVED',
          approvedById: session.user.id,
          approvedAt: new Date(),
          uploadedById: poRequest.requestedById,
        },
      });

      // Copy line items from quotation to PO
      if (poRequest.Quotation.LineItems && poRequest.Quotation.LineItems.length > 0) {
        await prisma.procurementDocumentLineItem.createMany({
          data: poRequest.Quotation.LineItems.map((item: any, index: number) => ({
            id: `line_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`,
            documentId: generatedPO.id,
            lineNumber: item.lineNumber,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            unit: item.unit,
            amount: item.amount,
            notes: item.notes,
          })),
        });
      }

      // Update PO request with generated PO ID
      await prisma.procurementPORequest.update({
        where: { id: poRequestId },
        data: {
          status: 'APPROVED',
          approvedById: session.user.id,
          approvedAt: new Date(),
          generatedPOId: generatedPO.id,
        },
      });

      // Update quotation status
      await prisma.procurementDocument.update({
        where: { id: poRequest.quotationId },
        data: {
          status: 'APPROVED',
          approvalStatus: 'APPROVED',
          approvedById: session.user.id,
          approvedAt: new Date(),
        },
      });
    } else {
      // Rejected
      await prisma.procurementPORequest.update({
        where: { id: poRequestId },
        data: {
          status: 'REJECTED',
          approvedById: session.user.id,
          approvedAt: new Date(),
          rejectionReason: comments,
        },
      });

      // Update quotation status
      await prisma.procurementDocument.update({
        where: { id: poRequest.quotationId },
        data: {
          status: 'REJECTED',
          approvalStatus: 'REJECTED',
          approvedById: session.user.id,
          approvedAt: new Date(),
          rejectionReason: comments,
        },
      });
    }

    // Create approval history entry
    await prisma.procurementApprovalHistory.create({
      data: {
        poRequestId,
        action: action as any,
        comments,
        approvedById: session.user.id,
      },
    });

    return NextResponse.json({
      success: true,
      action,
      generatedPO,
      message: action === 'APPROVED'
        ? 'PO approved and generated successfully'
        : 'PO request rejected',
    });
  } catch (error) {
    console.error('Error processing PO approval:', error);
    return NextResponse.json(
      { error: 'Failed to process PO approval', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
