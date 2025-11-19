import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';  // ✅ CORRECT IMPORT PATH
import { PrismaClient } from '@prisma/client';
import { writeFile, mkdir, readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import sharp from 'sharp';

const prisma = new PrismaClient();

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
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

async function convertImageToPNG(filePath: string, mimeType: string): Promise<string> {
  try {
    // If already PNG, just return the path
    if (mimeType === 'image/png') {
      console.log('Image is already PNG, using as-is');
      return filePath;
    }
    
    console.log('Converting image to PNG using sharp...');
    const pngPath = filePath.replace(/\.(jpg|jpeg|webp|gif|bmp)$/i, '.png');
    
    await sharp(filePath)
      .png()
      .resize(2000, 2000, { fit: 'inside', withoutEnlargement: true })
      .toFile(pngPath);
    
    console.log('Image converted to PNG:', pngPath);
    return pngPath;
  } catch (error) {
    console.error('Error converting image to PNG:', error);
    throw error;
  }
}

async function extractDocumentData(
  filePath: string,
  mimeType: string,
  documentType: string
): Promise<{ data: ExtractedDocumentData; confidence: number }> {
  try {
    let processedPath = filePath;
    let isImage = false;
    
    // Convert images to PNG, but leave PDFs as-is
    if (mimeType.startsWith('image/')) {
      processedPath = await convertImageToPNG(filePath, mimeType);
      isImage = true;
    } else if (mimeType === 'application/pdf') {
      console.log('Processing PDF directly (no conversion)');
      // Some Ollama vision models can handle PDFs directly
      // If this fails, we'll need to install PDF conversion tools
    }
    
    // Read file as base64
    const fileBuffer = await readFile(processedPath);
    const base64Data = fileBuffer.toString('base64');
    
    // Create extraction prompt based on document type
    let prompt = '';
    const docTypeStr = isImage ? 'image' : 'document';
    
    switch (documentType) {
      case 'SUPPLIER_QUOTATION':
        prompt = `Analyze this quotation ${docTypeStr} and extract the following information in JSON format:
{
  "documentNumber": "quotation number",
  "documentDate": "date in YYYY-MM-DD format",
  "supplierName": "supplier company name",
  "totalAmount": numeric value only,
  "currency": "currency code (SGD, USD, etc.)",
  "lineItems": [
    {
      "description": "item description",
      "quantity": numeric value,
      "unitPrice": numeric value,
      "unit": "unit of measurement",
      "amount": numeric value
    }
  ],
  "paymentTerms": "payment terms",
  "termsAndConditions": "terms and conditions"
}

Only return valid JSON, no additional text.`;
        break;
        
      case 'SUPPLIER_INVOICE':
        prompt = `Analyze this invoice ${docTypeStr} and extract the following information in JSON format:
{
  "documentNumber": "invoice number",
  "documentDate": "date in YYYY-MM-DD format",
  "supplierName": "supplier company name",
  "totalAmount": numeric value only,
  "taxAmount": numeric value only,
  "subtotalAmount": numeric value only,
  "currency": "currency code (SGD, USD, etc.)",
  "lineItems": [
    {
      "description": "item description",
      "quantity": numeric value,
      "unitPrice": numeric value,
      "unit": "unit of measurement",
      "amount": numeric value
    }
  ],
  "paymentTerms": "payment terms",
  "dueDate": "due date in YYYY-MM-DD format"
}

Only return valid JSON, no additional text.`;
        break;
        
      case 'SUPPLIER_PO':
        prompt = `Analyze this purchase order ${docTypeStr} and extract the following information in JSON format:
{
  "documentNumber": "PO number",
  "documentDate": "date in YYYY-MM-DD format",
  "supplierName": "supplier company name",
  "totalAmount": numeric value only,
  "currency": "currency code (SGD, USD, etc.)",
  "lineItems": [
    {
      "description": "item description",
      "quantity": numeric value,
      "unitPrice": numeric value,
      "unit": "unit of measurement",
      "amount": numeric value
    }
  ],
  "paymentTerms": "payment terms",
  "termsAndConditions": "terms and conditions"
}

Only return valid JSON, no additional text.`;
        break;
        
      default:
        prompt = `Analyze this ${docTypeStr} and extract key information in JSON format:
{
  "documentNumber": "document number if present",
  "documentDate": "date in YYYY-MM-DD format if present",
  "supplierName": "company name if present",
  "totalAmount": numeric value if present,
  "currency": "currency code if present"
}

Only return valid JSON, no additional text.`;
    }
    
    console.log(`Using vision model ${OLLAMA_VISION_MODEL} for extraction`);
    console.log(`Sending ${isImage ? 'PNG image' : 'PDF'} (${(base64Data.length / 1024).toFixed(2)} KB base64) to Ollama...`);
    
    // Call Ollama vision API
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
        options: {
          temperature: 0.1,
          top_p: 0.9,
        }
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Ollama API error:', response.status, errorText);
      
      // If PDF failed, suggest conversion
      if (mimeType === 'application/pdf') {
        console.error('PDF processing failed. The llama3.2-vision model may not support PDFs directly.');
        console.error('Please install Poppler and pdf2image for PDF-to-PNG conversion.');
      }
      
      throw new Error(`Ollama API error: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log('Ollama response received, length:', JSON.stringify(result).length);
    
    // Parse the response
    let extractedData: ExtractedDocumentData = {};
    let responseText = result.response || '';
    
    // Try to extract JSON from the response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        extractedData = JSON.parse(jsonMatch[0]);
        console.log('Extracted data:', JSON.stringify(extractedData, null, 2));
      } catch (parseError) {
        console.error('Failed to parse JSON from Ollama response:', parseError);
        console.error('Raw response:', responseText.substring(0, 500));
      }
    } else {
      console.warn('No JSON found in Ollama response');
      console.warn('Raw response:', responseText.substring(0, 500));
    }
    
    // Calculate confidence based on how many required fields were extracted
    const requiredFields = ['documentNumber', 'totalAmount', 'supplierName'];
    const extractedFields = requiredFields.filter(field => 
      extractedData[field as keyof ExtractedDocumentData] !== undefined && 
      extractedData[field as keyof ExtractedDocumentData] !== null &&
      extractedData[field as keyof ExtractedDocumentData] !== ''
    );
    
    const confidence = (extractedFields.length / requiredFields.length) * 100;
    console.log(`Extraction confidence: ${confidence}% (${extractedFields.length}/${requiredFields.length} required fields)`);
    
    return {
      data: extractedData,
      confidence: confidence
    };
  } catch (error) {
    console.error('Error extracting document data:', error);
    console.error('Error message:', (error as Error).message);
    console.error('Error stack:', (error as Error).stack);
    return {
      data: {},
      confidence: 0
    };
  }
}

async function detectDocumentType(fileName: string, mimeType: string): Promise<string> {
  const lowerFileName = fileName.toLowerCase();
  
  // Simple keyword-based detection
  if (lowerFileName.includes('quotation') || lowerFileName.includes('quote')) {
    return 'SUPPLIER_QUOTATION';
  } else if (lowerFileName.includes('invoice') || lowerFileName.includes('inv')) {
    return 'SUPPLIER_INVOICE';
  } else if (lowerFileName.includes('po') || lowerFileName.includes('purchase order')) {
    return 'SUPPLIER_PO';
  } else if (lowerFileName.includes('vo') || lowerFileName.includes('variation')) {
    return 'VARIATION_ORDER';
  }
  
  // Default to invoice if uncertain
  return 'SUPPLIER_INVOICE';
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('=== Document Upload Started ===');
    
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      console.error('Unauthorized: No session or user');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log('User authenticated:', (session.user as any).email);
    
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const documentType = formData.get('documentType') as string;
    const notes = formData.get('notes') as string || '';
    
    if (!file) {
      console.error('No file provided in form data');
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    
    console.log(`File received: ${file.name} (${file.type}, ${file.size} bytes)`);
    
    const projectId = params.id;
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    // Determine final document type
    let finalDocumentType = documentType;
    if (documentType === 'AUTO') {
      finalDocumentType = await detectDocumentType(file.name, file.type);
      console.log(`Auto-detected document type: ${finalDocumentType}`);
    }
    
    // Determine storage path based on document type
    const typeFolder = {
      'SUPPLIER_QUOTATION': 'supplier_quotations',
      'SUPPLIER_INVOICE': 'supplier_invoices',
      'SUPPLIER_PO': 'supplier_pos',
      'CUSTOMER_PO': 'customer_pos',
      'CLIENT_INVOICE': 'client_invoices',
      'VARIATION_ORDER': 'variation_orders'
    }[finalDocumentType] || 'other';
    
    // Save to NAS
    const nasBasePath = process.env.NAS_BASE_PATH || '\\\\Czl-home\\ampere\\AMPERE WEB SERVER';
    const projectPath = join(nasBasePath, 'projects', projectId, 'procurement', typeFolder);
    
    console.log(`Target path: ${projectPath}`);
    
    if (!existsSync(projectPath)) {
      console.log('Creating directory...');
      await mkdir(projectPath, { recursive: true });
    }
    
    const timestamp = Date.now();
    const fileName = `${timestamp}_${file.name}`;
    const filePath = join(projectPath, fileName);
    
    console.log(`Saving file to: ${filePath}`);
    await writeFile(filePath, buffer);
    console.log('File saved successfully');
    
    // Extract data using vision model
    console.log('Starting AI extraction...');
    const { data: extractedData, confidence } = await extractDocumentData(
      filePath,
      file.type,
      finalDocumentType
    );
    
    console.log(`Extraction completed with ${confidence}% confidence`);
    
    // Create database record
    console.log('Creating database record...');
    const document = await prisma.procurementDocument.create({
      data: {
        projectId,
        documentType: finalDocumentType,
        fileName: fileName,
        originalFileName: file.name,
        filePath: filePath,
        fileSize: file.size,
        mimeType: file.type,
        status: 'EXTRACTED',
        extractedData: extractedData as any,
        extractionConfidence: confidence,
        notes: notes,
        uploadedById: (session.user as any).id || null,
      },
    });
    
    console.log(`Document record created: ${document.id}`);
    console.log('=== Document Upload Completed Successfully ===');
    
    return NextResponse.json({
      success: true,
      document: document,
      extractedData: extractedData,
      confidence: confidence
    });
    
  } catch (error) {
    console.error('=== Document Upload Failed ===');
    console.error('Error:', error);
    console.error('Error message:', (error as Error).message);
    console.error('Error stack:', (error as Error).stack);
    
    return NextResponse.json(
      { 
        error: 'Failed to upload document', 
        details: (error as Error).message,
        stack: process.env.NODE_ENV === 'development' ? (error as Error).stack : undefined
      },
      { status: 500 }
    );
  }
}
