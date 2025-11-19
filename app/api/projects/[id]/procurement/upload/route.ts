import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

// Ollama configuration
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.1:8b';

interface ExtractedDocumentData {
  documentNumber?: string;
  documentDate?: string;
  supplierName?: string;
  customerName?: string;
  totalAmount?: number;
  taxAmount?: number;
  subtotalAmount?: number;
  currency?: string;
  paymentTerms?: string;
  dueDate?: string;
  termsAndConditions?: string;
  lineItems?: Array<{
    description: string;
    quantity?: number;
    unitPrice?: number;
    unit?: string;
    amount: number;
  }>;
}

async function extractDocumentData(
  filePath: string,
  documentType: string
): Promise<{ data: ExtractedDocumentData; confidence: number }> {
  try {
    // Convert PDF to text using pdf-parse
    const fs = await import('fs');
    const pdfParse = (await import('pdf-parse')).default;
    const fileBuffer = fs.readFileSync(filePath);
    
    let documentText = '';
    try {
      const pdfData = await pdfParse(fileBuffer);
      documentText = pdfData.text;
    } catch (pdfError) {
      console.error('Error parsing PDF:', pdfError);
      // If PDF parsing fails, return 0 confidence
      return { data: {}, confidence: 0 };
    }
    
    // Create extraction prompt based on document type
    let prompt = '';
    
    switch (documentType) {
      case 'SUPPLIER_QUOTATION':
        prompt = `Extract the following information from this supplier quotation document:
- Document/Quotation Number
- Document Date
- Supplier Name
- Total Amount
- Tax Amount (GST/VAT)
- Subtotal Amount
- Currency
- Payment Terms (e.g., NET 30, NET 45)
- Terms and Conditions
- Line Items (description, quantity, unit price, unit, amount)

Return the data in JSON format with these exact keys: documentNumber, documentDate, supplierName, totalAmount, taxAmount, subtotalAmount, currency, paymentTerms, termsAndConditions, lineItems (array with description, quantity, unitPrice, unit, amount).`;
        break;
        
      case 'SUPPLIER_INVOICE':
        prompt = `Extract the following information from this supplier invoice document:
- Invoice Number
- Invoice Date
- Supplier Name
- Total Amount
- Tax Amount (GST/VAT)
- Subtotal Amount
- Currency
- Payment Terms
- Due Date
- Line Items (description, quantity, unit price, unit, amount)

Return the data in JSON format with these exact keys: documentNumber, documentDate, supplierName, totalAmount, taxAmount, subtotalAmount, currency, paymentTerms, dueDate, lineItems (array with description, quantity, unitPrice, unit, amount).`;
        break;
        
      case 'CUSTOMER_PO':
        prompt = `Extract the following information from this customer purchase order document:
- PO Number
- PO Date
- Customer Name
- Total Amount
- Tax Amount (GST/VAT)
- Subtotal Amount
- Currency
- Payment Terms
- Terms and Conditions
- Line Items (description, quantity, unit price, unit, amount)

Return the data in JSON format with these exact keys: documentNumber, documentDate, customerName, totalAmount, taxAmount, subtotalAmount, currency, paymentTerms, termsAndConditions, lineItems (array with description, quantity, unitPrice, unit, amount).`;
        break;
        
      case 'VARIATION_ORDER':
        prompt = `Extract the following information from this variation order document:
- VO Number
- VO Date
- Supplier/Customer Name
- Total Amount
- Tax Amount (GST/VAT)
- Subtotal Amount
- Currency
- Description of variations
- Line Items (description, quantity, unit price, unit, amount)

Return the data in JSON format with these exact keys: documentNumber, documentDate, supplierName, totalAmount, taxAmount, subtotalAmount, currency, termsAndConditions, lineItems (array with description, quantity, unitPrice, unit, amount).`;
        break;
        
      default:
        prompt = `Extract key information from this document including document number, date, amounts, and line items. Return as JSON.`;
    }
    
    // Call Ollama API for extraction with document text
    const fullPrompt = `${prompt}\n\nDocument text:\n${documentText}\n\nExtract the information and return ONLY valid JSON, no additional text.`;
    
    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: fullPrompt,
        stream: false,
        format: 'json',
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log('Ollama raw response:', JSON.stringify(result, null, 2));
    
    let extractedData: any = {};
    try {
      // Ollama returns response in 'response' field
      if (result.response) {
        // Try to parse as JSON
        extractedData = JSON.parse(result.response);
      } else {
        console.error('No response field in Ollama result');
        return { data: {}, confidence: 0 };
      }
    } catch (parseError) {
      console.error('Failed to parse Ollama response as JSON:', parseError);
      console.error('Raw response:', result.response);
      return { data: {}, confidence: 0 };
    }
    
    console.log('Extracted data:', JSON.stringify(extractedData, null, 2));
    
    // Calculate confidence based on completeness of extracted data
    const requiredFields = ['documentNumber', 'documentDate', 'totalAmount'];
    const extractedFields = Object.keys(extractedData).filter(key => {
      const value = extractedData[key];
      return value !== null && value !== undefined && value !== '';
    });
    const confidence = Math.min((extractedFields.length / requiredFields.length) * 100, 100);
    
    console.log(`Extraction confidence: ${confidence}% (${extractedFields.length}/${requiredFields.length} required fields)`);
    
    return {
      data: extractedData,
      confidence,
    };
  } catch (error) {
    console.error('Error extracting document data:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    return {
      data: {},
      confidence: 0,
    };
  }
}

async function detectDocumentType(documentText: string): Promise<string> {
  // Use simple keyword matching to detect document type
  const textLower = documentText.toLowerCase();
  
  // Check for invoice indicators
  if (textLower.includes('invoice') || textLower.includes('inv no') || textLower.includes('invoice no')) {
    // Distinguish between supplier and client invoice
    if (textLower.includes('bill to:') || textLower.includes('customer:')) {
      return 'CLIENT_INVOICE';
    }
    return 'SUPPLIER_INVOICE';
  }
  
  // Check for quotation indicators
  if (textLower.includes('quotation') || textLower.includes('quote') || textLower.includes('proposal')) {
    return 'SUPPLIER_QUOTATION';
  }
  
  // Check for PO indicators
  if (textLower.includes('purchase order') || textLower.includes('p.o.') || textLower.includes('po no')) {
    // Distinguish between customer and supplier PO
    if (textLower.includes('vendor:') || textLower.includes('supplier:')) {
      return 'SUPPLIER_PO';
    }
    return 'CUSTOMER_PO';
  }
  
  // Check for variation order indicators
  if (textLower.includes('variation order') || textLower.includes('vo no') || textLower.includes('change order')) {
    return 'VARIATION_ORDER';
  }
  
  // Default to supplier invoice if can't determine
  return 'SUPPLIER_INVOICE';
}

async function findOrCreateSupplier(supplierName: string, userId: string) {
  if (!supplierName) return null;
  
  // Try to find existing supplier by name (case-insensitive)
  let supplier = await prisma.supplier.findFirst({
    where: {
      name: {
        equals: supplierName,
        mode: 'insensitive',
      },
    },
  });
  
  // If not found, create new supplier
  if (!supplier) {
    const supplierCount = await prisma.supplier.count();
    const supplierNumber = `SUP${String(supplierCount + 1).padStart(5, '0')}`;
    
    supplier = await prisma.supplier.create({
      data: {
        id: `supplier_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: supplierName,
        supplierNumber,
        isActive: true,
        isApproved: false,
        createdById: userId,
        updatedAt: new Date(),
      },
    });
  }
  
  return supplier;
}

async function findOrCreateCustomer(customerName: string, userId: string) {
  if (!customerName) return null;
  
  // Try to find existing customer by name (case-insensitive)
  let customer = await prisma.customer.findFirst({
    where: {
      name: {
        equals: customerName,
        mode: 'insensitive',
      },
    },
  });
  
  // If not found, create new customer
  if (!customer) {
    const customerCount = await prisma.customer.count();
    const customerNumber = `CUS${String(customerCount + 1).padStart(5, '0')}`;
    
    customer = await prisma.customer.create({
      data: {
        id: `customer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: customerName,
        customerNumber,
        isActive: true,
        createdById: userId,
        updatedAt: new Date(),
      },
    });
  }
  
  return customer;
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

    const projectId = params.id;

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        projectNumber: true,
        name: true,
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const documentType = formData.get('documentType') as string;
    const notes = formData.get('notes') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!documentType) {
      return NextResponse.json({ error: 'Document type is required' }, { status: 400 });
    }

    // Validate document type
    const validTypes = [
      'AUTO',
      'CUSTOMER_PO',
      'SUPPLIER_QUOTATION',
      'SUPPLIER_INVOICE',
      'SUPPLIER_PO',
      'CLIENT_INVOICE',
      'VARIATION_ORDER',
    ];

    if (!validTypes.includes(documentType)) {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    // Auto-detect document type if needed
    let finalDocumentType = documentType;
    if (documentType === 'AUTO') {
      try {
        const pdfParse = (await import('pdf-parse')).default;
        const pdfData = await pdfParse(buffer);
        finalDocumentType = await detectDocumentType(pdfData.text);
        console.log(`Auto-detected document type: ${finalDocumentType}`);
      } catch (error) {
        console.error('Error auto-detecting document type:', error);
        // Default to SUPPLIER_INVOICE if detection fails
        finalDocumentType = 'SUPPLIER_INVOICE';
      }
    }

    // Determine NAS path based on document type
    let nasBasePath = process.env.NAS_BASE_PATH || 'C:/ampere/nas';
    
    // Convert forward slashes to backslashes for Windows UNC paths
    // UNC paths must use backslashes: \\server\share
    if (nasBasePath.startsWith('//')) {
      nasBasePath = '\\\\' + nasBasePath.substring(2).replace(/\//g, '\\');
    } else {
      nasBasePath = nasBasePath.replace(/\//g, '\\');
    }
    
    const projectFolder = `${project.projectNumber}-${project.name}`;
    
    let documentSubfolder = '';
    switch (finalDocumentType) {
      case 'CUSTOMER_PO':
        documentSubfolder = 'POs from customer';
        break;
      case 'SUPPLIER_QUOTATION':
        documentSubfolder = 'invoices & quotations from suppliers';
        break;
      case 'SUPPLIER_INVOICE':
        documentSubfolder = 'invoices & quotations from suppliers';
        break;
      case 'SUPPLIER_PO':
        documentSubfolder = 'POs to suppliers';
        break;
      case 'VARIATION_ORDER':
        documentSubfolder = 'VOs';
        break;
      default:
        documentSubfolder = 'documents';
    }

    // Create project folder structure using backslashes for Windows
    const projectPath = `${nasBasePath}\\PROJECT\\${projectFolder}\\${documentSubfolder}`;
    if (!existsSync(projectPath)) {
      await mkdir(projectPath, { recursive: true });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const originalName = file.name;
    const extension = originalName.substring(originalName.lastIndexOf('.'));
    const fileName = `${timestamp}_${originalName}`;
    const filePath = `${projectPath}\\${fileName}`;

    // Save file to NAS
    await writeFile(filePath, buffer);

    // Extract document data using AI
    const { data: extractedData, confidence } = await extractDocumentData(
      filePath,
      finalDocumentType
    );

    // Find or create supplier/customer based on extracted data
    let supplierId = null;
    let customerId = null;

    if (extractedData.supplierName) {
      const supplier = await findOrCreateSupplier(extractedData.supplierName, session.user.id);
      supplierId = supplier?.id || null;
    }

    if (extractedData.customerName) {
      const customer = await findOrCreateCustomer(extractedData.customerName, session.user.id);
      customerId = customer?.id || null;
    }

    // Parse payment terms
    let paymentTerms = null;
    if (extractedData.paymentTerms) {
      const termsUpper = extractedData.paymentTerms.toUpperCase();
      if (termsUpper.includes('7')) paymentTerms = 'NET_7';
      else if (termsUpper.includes('15')) paymentTerms = 'NET_15';
      else if (termsUpper.includes('30')) paymentTerms = 'NET_30';
      else if (termsUpper.includes('45')) paymentTerms = 'NET_45';
      else if (termsUpper.includes('60')) paymentTerms = 'NET_60';
      else if (termsUpper.includes('90')) paymentTerms = 'NET_90';
      else if (termsUpper.includes('IMMEDIATE')) paymentTerms = 'IMMEDIATE';
      else paymentTerms = 'CUSTOM';
    }

    // Create procurement document record
    const procurementDocument = await prisma.procurementDocument.create({
      data: {
        projectId,
        documentType: finalDocumentType as any,
        documentNumber: extractedData.documentNumber || null,
        documentDate: extractedData.documentDate ? new Date(extractedData.documentDate) : null,
        status: 'EXTRACTED',
        fileName,
        originalFileName: originalName,
        filePath,
        fileSize: buffer.length,
        mimeType: file.type,
        supplierId,
        customerId,
        extractedData: extractedData as any,
        extractionConfidence: confidence,
        totalAmount: extractedData.totalAmount || null,
        currency: extractedData.currency || 'SGD',
        taxAmount: extractedData.taxAmount || null,
        subtotalAmount: extractedData.subtotalAmount || null,
        paymentTerms: paymentTerms as any,
        customPaymentTerms: paymentTerms === 'CUSTOM' ? extractedData.paymentTerms : null,
        dueDate: extractedData.dueDate ? new Date(extractedData.dueDate) : null,
        termsAndConditions: extractedData.termsAndConditions || null,
        notes,
        uploadedById: session.user.id,
      },
      include: {
        Supplier: true,
        Customer: true,
        UploadedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Create line items if extracted
    if (extractedData.lineItems && extractedData.lineItems.length > 0) {
      await prisma.procurementDocumentLineItem.createMany({
        data: extractedData.lineItems.map((item, index) => ({
          id: `line_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`,
          documentId: procurementDocument.id,
          lineNumber: index + 1,
          description: item.description,
          quantity: item.quantity || null,
          unitPrice: item.unitPrice || null,
          unit: item.unit || null,
          amount: item.amount,
        })),
      });
    }

    // Fetch complete document with line items
    const completeDocument = await prisma.procurementDocument.findUnique({
      where: { id: procurementDocument.id },
      include: {
        Supplier: true,
        Customer: true,
        UploadedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        LineItems: {
          orderBy: { lineNumber: 'asc' },
        },
      },
    });

    return NextResponse.json({
      success: true,
      document: completeDocument,
      message: 'Document uploaded and processed successfully',
    });
  } catch (error) {
    console.error('Error uploading procurement document:', error);
    return NextResponse.json(
      { error: 'Failed to upload document', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
