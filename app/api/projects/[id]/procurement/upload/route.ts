import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = 'llama3.1:8b';
const OLLAMA_VISION_MODEL = 'llama3.2-vision';

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
    quantity: number;
    unitPrice: number;
    unit?: string;
    amount: number;
  }>;
}

async function extractDocumentData(
  filePath: string,
  documentType: string
): Promise<{ data: ExtractedDocumentData; confidence: number }> {
  try {
    // Read PDF as base64 for vision model
    const fs = await import('fs');
    const fileBuffer = fs.readFileSync(filePath);
    const base64Pdf = fileBuffer.toString('base64');
    
    // Create extraction prompt based on document type
    let prompt = '';
    
    switch (documentType) {
      case 'SUPPLIER_QUOTATION':
        prompt = `You are analyzing a supplier quotation document image. Extract the following information:
- Document/Quotation Number
- Document Date
- Supplier Name
- Total Amount (number only, no currency symbols)
- Tax Amount (GST/VAT, number only)
- Subtotal Amount (number only)
- Currency (e.g., SGD, USD)
- Payment Terms (e.g., NET 30)
- Terms and Conditions
- Line Items: for each item extract description, quantity (number), unitPrice (number), unit (e.g., pcs, kg), amount (number)

Return ONLY valid JSON with these exact keys: documentNumber, documentDate, supplierName, totalAmount, taxAmount, subtotalAmount, currency, paymentTerms, termsAndConditions, lineItems (array).`;
        break;
        
      case 'SUPPLIER_INVOICE':
        prompt = `You are analyzing a supplier invoice document image. Extract the following information:
- Invoice Number
- Invoice Date
- Supplier Name
- Total Amount (number only, no currency symbols)
- Tax Amount (GST/VAT, number only)
- Subtotal Amount (number only)
- Currency (e.g., SGD, USD)
- Payment Terms
- Due Date
- Line Items: for each item extract description, quantity (number), unitPrice (number), unit (e.g., pcs, kg), amount (number)

Return ONLY valid JSON with these exact keys: documentNumber, documentDate, supplierName, totalAmount, taxAmount, subtotalAmount, currency, paymentTerms, dueDate, lineItems (array).`;
        break;
        
      case 'CUSTOMER_PO':
        prompt = `You are analyzing a customer purchase order document image. Extract the following information:
- PO Number
- PO Date
- Customer Name
- Total Amount (number only, no currency symbols)
- Tax Amount (GST/VAT, number only)
- Subtotal Amount (number only)
- Currency (e.g., SGD, USD)
- Payment Terms
- Terms and Conditions
- Line Items: for each item extract description, quantity (number), unitPrice (number), unit (e.g., pcs, kg), amount (number)

Return ONLY valid JSON with these exact keys: documentNumber, documentDate, customerName, totalAmount, taxAmount, subtotalAmount, currency, paymentTerms, termsAndConditions, lineItems (array).`;
        break;
        
      case 'VARIATION_ORDER':
        prompt = `You are analyzing a variation order document image. Extract the following information:
- VO Number
- VO Date
- Supplier/Customer Name
- Total Amount (number only, no currency symbols)
- Tax Amount (GST/VAT, number only)
- Subtotal Amount (number only)
- Currency (e.g., SGD, USD)
- Description of variations
- Line Items: for each item extract description, quantity (number), unitPrice (number), unit (e.g., pcs, kg), amount (number)

Return ONLY valid JSON with these exact keys: documentNumber, documentDate, supplierName, totalAmount, taxAmount, subtotalAmount, currency, termsAndConditions, lineItems (array).`;
        break;
        
      default:
        prompt = `Extract key information from this document image including document number, date, amounts, and line items. Return ONLY valid JSON.`;
    }
    
    // Call Ollama vision API
    console.log(`Using vision model ${OLLAMA_VISION_MODEL} for extraction`);
    
    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OLLAMA_VISION_MODEL,
        prompt: prompt,
        images: [base64Pdf],
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
      if (result.response) {
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
    
    // Calculate confidence based on completeness
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

async function detectDocumentType(base64Data: string): Promise<string> {
  try {
    const prompt = `You are analyzing a document image. Determine if this is a:
- SUPPLIER_QUOTATION (quotation from supplier to us)
- SUPPLIER_INVOICE (invoice from supplier to us)
- SUPPLIER_PO (purchase order to supplier)
- CUSTOMER_PO (purchase order from customer to us)
- CLIENT_INVOICE (invoice from us to client)
- VARIATION_ORDER (variation order/change order)

Return ONLY the document type as one of the exact strings above, nothing else.`;

    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OLLAMA_VISION_MODEL,
        prompt: prompt,
        images: [base64Data],
        stream: false,
      }),
    });

    if (!response.ok) {
      console.error('Ollama API error during type detection:', response.statusText);
      return 'SUPPLIER_INVOICE'; // Default fallback
    }

    const result = await response.json();
    const detectedType = result.response?.trim().toUpperCase();
    
    // Validate the detected type
    const validTypes = ['SUPPLIER_QUOTATION', 'SUPPLIER_INVOICE', 'SUPPLIER_PO', 'CUSTOMER_PO', 'CLIENT_INVOICE', 'VARIATION_ORDER'];
    if (validTypes.includes(detectedType)) {
      return detectedType;
    }
    
    return 'SUPPLIER_INVOICE'; // Default fallback
  } catch (error) {
    console.error('Error detecting document type:', error);
    return 'SUPPLIER_INVOICE'; // Default fallback
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectId = params.id;
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const documentType = formData.get('documentType') as string;
    const notes = formData.get('notes') as string || '';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Read file as buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    // Auto-detect document type if needed
    let finalDocumentType = documentType;
    if (documentType === 'AUTO') {
      try {
        const base64Data = buffer.toString('base64');
        finalDocumentType = await detectDocumentType(base64Data);
        console.log(`Auto-detected document type: ${finalDocumentType}`);
      } catch (error) {
        console.error('Error auto-detecting document type:', error);
        finalDocumentType = 'SUPPLIER_INVOICE';
      }
    }

    // Determine NAS path based on document type
    const nasBasePath = process.env.NAS_BASE_PATH || '//192.168.1.100/ampere_data';
    let documentFolder = '';
    
    switch (finalDocumentType) {
      case 'SUPPLIER_QUOTATION':
        documentFolder = 'quotations';
        break;
      case 'SUPPLIER_INVOICE':
        documentFolder = 'supplier_invoices';
        break;
      case 'SUPPLIER_PO':
        documentFolder = 'supplier_pos';
        break;
      case 'CUSTOMER_PO':
        documentFolder = 'customer_pos';
        break;
      case 'CLIENT_INVOICE':
        documentFolder = 'client_invoices';
        break;
      case 'VARIATION_ORDER':
        documentFolder = 'variation_orders';
        break;
      default:
        documentFolder = 'other';
    }

    const projectFolder = join(nasBasePath, 'projects', projectId, 'procurement', documentFolder);
    
    // Create directory if it doesn't exist
    if (!existsSync(projectFolder)) {
      await mkdir(projectFolder, { recursive: true });
    }

    // Save file to NAS
    const fileName = `${Date.now()}_${file.name}`;
    const filePath = join(projectFolder, fileName);
    await writeFile(filePath, buffer);

    // Extract data using AI
    const { data: extractedData, confidence } = await extractDocumentData(filePath, finalDocumentType);

    // Save to database
    const document = await prisma.procurementDocument.create({
      data: {
        projectId,
        documentType: finalDocumentType,
        fileName: file.name,
        filePath,
        fileSize: file.size,
        status: 'EXTRACTED',
        extractedData: extractedData as any,
        aiConfidence: confidence,
        notes,
        uploadedById: session.user.id,
      },
    });

    return NextResponse.json({
      success: true,
      document,
    });
  } catch (error) {
    console.error('Error uploading document:', error);
    return NextResponse.json(
      { error: 'Failed to upload document' },
      { status: 500 }
    );
  }
}
