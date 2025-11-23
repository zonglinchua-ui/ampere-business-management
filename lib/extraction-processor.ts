import { readFile } from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import sharp from 'sharp';
import { prisma } from '@/lib/db';

const execAsync = promisify(exec);

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_VISION_MODEL = 'llama3.2-vision';

const filenameTypeHints: Record<string, string> = {
  quotation: 'SUPPLIER_QUOTATION',
  quote: 'SUPPLIER_QUOTATION',
  invoice: 'SUPPLIER_INVOICE',
  po: 'SUPPLIER_PO',
  purchase: 'SUPPLIER_PO',
};

function detectDocumentTypeFromFilename(fileName: string): string | undefined {
  const lower = fileName.toLowerCase();
  if (lower.match(/^quot[\d-]/i) || lower.includes('quot')) return 'SUPPLIER_QUOTATION';
  if (lower.match(/^inv[\d-]/i)) return 'SUPPLIER_INVOICE';
  if (lower.match(/^po[\d-]/i)) return 'SUPPLIER_PO';
  if (lower.match(/^vo[\d-]/i) || lower.includes('variation')) return 'VARIATION_ORDER';

  for (const key of Object.keys(filenameTypeHints)) {
    if (lower.includes(key)) {
      return filenameTypeHints[key];
    }
  }
  return undefined;
}

export interface ExtractedDocumentData {
  documentNumber?: string;
  documentDate?: string;
  supplierName?: string;
  customerName?: string;
  projectName?: string;
  projectReference?: string;
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

async function convertPDFToPNG(pdfPath: string): Promise<string> {
  console.log('Converting PDF to PNG using pdftoppm...');
  const outputBasePath = pdfPath.replace('.pdf', '');
  const pngPath = `${outputBasePath}-1.png`;
  
  const command = `pdftoppm -png -f 1 -l 1 -scale-to 2000 "${pdfPath}" "${outputBasePath}"`;
  
  console.log('Running command:', command);
  await execAsync(command);
  
  if (!existsSync(pngPath)) {
    throw new Error(`PDF conversion failed: output file not found at ${pngPath}`);
  }
  
  console.log('PDF converted to PNG:', pngPath);
  return pngPath;
}

async function convertImageToPNG(filePath: string, mimeType: string): Promise<string> {
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
}

function parseMarkdownResponse(text: string): ExtractedDocumentData {
  const data: ExtractedDocumentData = {};
  
  // Extract document number
  const docNumMatch = text.match(/\*\*Document Number\*\*:?\s*([^\n*]+)/i);
  if (docNumMatch) {
    data.documentNumber = docNumMatch[1].trim();
  }
  
  // Extract document date
  const docDateMatch = text.match(/\*\*Document Date\*\*:?\s*([^\n*]+)/i);
  if (docDateMatch) {
    const dateStr = docDateMatch[1].trim();
    // Try to parse date in DD/MM/YYYY format
    const dateParts = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (dateParts) {
      const [, day, month, year] = dateParts;
      data.documentDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    } else {
      data.documentDate = dateStr;
    }
  }
  
  // Extract supplier name
  const supplierMatch = text.match(/\*\*Supplier Name\*\*:?\s*([^\n*]+)/i);
  if (supplierMatch) {
    data.supplierName = supplierMatch[1].trim();
  }
  
  // Extract customer name
  const customerMatch = text.match(/\*\*Customer Name\*\*:?\s*([^\n*]+)/i);
  if (customerMatch) {
    data.customerName = customerMatch[1].trim();
  }
  
  // Extract project name
  const projectMatch = text.match(/\*\*Project Name\/Reference\*\*:?\s*([^\n*]+)/i);
  if (projectMatch && !projectMatch[1].includes('Not mentioned')) {
    data.projectName = projectMatch[1].trim();
  }
  
  // Extract total amount
  const totalMatch = text.match(/\*\*Total Amount\*\*:?\s*S?\$?\s*([\d,]+\.?\d*)/i);
  if (totalMatch) {
    data.totalAmount = parseFloat(totalMatch[1].replace(/,/g, ''));
  }
  
  // Extract tax amount
  const taxMatch = text.match(/\*\*Tax Amount\*\*:?\s*S?\$?\s*([\d,]+\.?\d*)/i);
  if (taxMatch) {
    data.taxAmount = parseFloat(taxMatch[1].replace(/,/g, ''));
  }
  
  // Extract subtotal amount
  const subtotalMatch = text.match(/\*\*Subtotal Amount\*\*:?\s*S?\$?\s*([\d,]+\.?\d*)/i);
  if (subtotalMatch) {
    data.subtotalAmount = parseFloat(subtotalMatch[1].replace(/,/g, ''));
  }
  
  // Extract currency
  const currencyMatch = text.match(/\*\*Currency\*\*:?\s*([A-Z]{3})/i);
  if (currencyMatch) {
    data.currency = currencyMatch[1];
  } else if (text.includes('SGD') || text.includes('S$')) {
    data.currency = 'SGD';
  }
  
  // Extract payment terms
  const paymentMatch = text.match(/\*\*Payment Terms\*\*:?\s*([^\n*]+)/i);
  if (paymentMatch && !paymentMatch[1].includes('Not mentioned')) {
    data.paymentTerms = paymentMatch[1].trim();
  }
  
  // Extract due date
  const dueMatch = text.match(/\*\*Due Date\*\*:?\s*([^\n*]+)/i);
  if (dueMatch) {
    const dateStr = dueMatch[1].trim();
    const dateParts = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (dateParts) {
      const [, day, month, year] = dateParts;
      data.dueDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    } else {
      data.dueDate = dateStr;
    }
  }
  
  // Extract line items (basic parsing)
  const lineItemsMatch = text.match(/\*\*Line Items\*\*:?([\s\S]*?)(?=\*\*|$)/i);
  if (lineItemsMatch) {
    const itemsText = lineItemsMatch[1];
    const items: any[] = [];
    
    // Look for item descriptions
    const itemMatches = itemsText.matchAll(/\*\*Item \d+\*\*:?\s*([^\n]+)/gi);
    for (const match of itemMatches) {
      items.push({
        description: match[1].trim(),
        quantity: 1,
        unitPrice: 0,
        amount: 0
      });
    }
    
    if (items.length > 0) {
      data.lineItems = items;
    }
  }
  
  return data;
}

export async function prepareVisionImage(filePath: string, mimeType: string): Promise<string> {
  let processedPath = filePath;

  if (mimeType.startsWith('image/')) {
    processedPath = await convertImageToPNG(filePath, mimeType);
  } else if (mimeType === 'application/pdf') {
    processedPath = await convertPDFToPNG(filePath);
  }

  const fileBuffer = await readFile(processedPath);
  return fileBuffer.toString('base64');
}

export async function classifyProcurementDocument(
  filePath: string,
  mimeType: string,
  fileName: string,
  fallbackType: string = 'SUPPLIER_PO'
): Promise<{ documentType: string; confidence: number }> {
  const filenameGuess = detectDocumentTypeFromFilename(fileName);

  try {
    const base64Data = await prepareVisionImage(filePath, mimeType);
    const prompt = `Classify this procurement document as one of: SUPPLIER_PO, CUSTOMER_PO, SUPPLIER_QUOTATION, SUPPLIER_INVOICE, VARIATION_ORDER.
Return JSON: {"documentType": "VALUE", "confidence": 0-100}. Favor purchase orders when wording like PO, purchase order, or buyer instructions appear.`;

    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_VISION_MODEL,
        prompt,
        images: [base64Data],
        stream: false,
        options: { temperature: 0, top_p: 0.8 }
      })
    });

    if (!response.ok) {
      throw new Error(`Vision classifier failed: ${response.statusText}`);
    }

    const result = await response.json();
    const jsonMatch = (result.response as string)?.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.documentType) {
        return { documentType: parsed.documentType, confidence: parsed.confidence ?? 50 };
      }
    }
  } catch (error) {
    console.warn('[Classifier] Falling back to filename heuristic:', (error as Error).message);
  }

  if (filenameGuess) {
    return { documentType: filenameGuess, confidence: 55 };
  }

  return { documentType: fallbackType, confidence: 30 };
}

export async function extractDocumentData(
  filePath: string,
  mimeType: string,
  documentType: string,
  projectName?: string
): Promise<{ data: ExtractedDocumentData; confidence: number }> {
  try {
    const base64Data = await prepareVisionImage(filePath, mimeType);
    const projectNameForPrompt = projectName || 'Unknown Project';
    
    // Create extraction prompt with project name validation
    let prompt = '';
    
    switch (documentType) {
      case 'SUPPLIER_QUOTATION':
        prompt = `Analyze this quotation image and extract the following information in JSON format:
{
  "documentNumber": "quotation number",
  "documentDate": "date in YYYY-MM-DD format",
  "supplierName": "supplier company name",
  "projectName": "project name or reference if mentioned",
  "projectReference": "project reference number if mentioned",
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

IMPORTANT: Look carefully for any project name, project reference, or site address mentioned in the document.
The current project this document is uploaded to is: "${projectNameForPrompt}"

Only return valid JSON, no additional text.`;
        break;
        
      case 'SUPPLIER_INVOICE':
        prompt = `Analyze this invoice image and extract the following information in JSON format:
{
  "documentNumber": "invoice number",
  "documentDate": "date in YYYY-MM-DD format",
  "supplierName": "supplier company name",
  "projectName": "project name or reference if mentioned",
  "projectReference": "project reference number if mentioned",
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

IMPORTANT: Look carefully for any project name, project reference, or site address mentioned in the document.
The current project this document is uploaded to is: "${projectName}"

Only return valid JSON, no additional text.`;
        break;
        
      case 'SUPPLIER_PO':
        prompt = `Analyze this purchase order image and extract the following information in JSON format:
{
  "documentNumber": "PO number",
  "documentDate": "date in YYYY-MM-DD format",
  "supplierName": "supplier company name",
  "customerName": "customer/buyer name if visible",
  "projectName": "project name or reference if mentioned",
  "projectReference": "project reference number if mentioned",
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
  "dueDate": "delivery or handover date if stated",
  "termsAndConditions": "terms and conditions"
}

IMPORTANT: Look carefully for any project name, project reference, or site address mentioned in the document.
The current project this document is uploaded to is: "${projectNameForPrompt}"

Only return valid JSON, no additional text.`;
        break;
        
      default:
        prompt = `Analyze this document image and extract key information in JSON format:
{
  "documentNumber": "document number if present",
  "documentDate": "date in YYYY-MM-DD format if present",
  "supplierName": "company name if present",
  "projectName": "project name or reference if mentioned",
  "projectReference": "project reference number if mentioned",
  "totalAmount": numeric value if present,
  "currency": "currency code if present"
}

IMPORTANT: Look carefully for any project name, project reference, or site address mentioned in the document.
The current project this document is uploaded to is: "${projectNameForPrompt}"

Only return valid JSON, no additional text.`;
    }
    
    console.log(`Calling Ollama ${OLLAMA_VISION_MODEL} for extraction...`);
    console.log(`Image size: ${(base64Data.length / 1024).toFixed(2)} KB base64`);
    
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
        console.log('Extracted data from JSON:', JSON.stringify(extractedData, null, 2));
      } catch (parseError) {
        console.error('Failed to parse JSON from Ollama response:', parseError);
        console.error('Raw response:', responseText.substring(0, 500));
      }
    } else {
      console.warn('No JSON found in Ollama response, trying markdown parsing...');
      console.warn('Raw response:', responseText.substring(0, 500));
      
      // Fallback: Parse markdown format
      extractedData = parseMarkdownResponse(responseText);
      
      if (Object.keys(extractedData).length > 0) {
        console.log('Extracted data from markdown:', JSON.stringify(extractedData, null, 2));
      } else {
        console.error('Failed to extract any data from response');
      }
    }
    
    // Calculate confidence based on required fields
    const requiredFields = ['documentNumber', 'totalAmount', 'supplierName'];
    const extractedFields = requiredFields.filter((field: any) => 
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
    throw error;
  }
}

export async function processExtraction(job: any) {
  console.log(`[Processor] Starting extraction for document ${job.documentId}`);
  
  try {
    // Update status to EXTRACTING
    await prisma.procurementDocument.update({
      where: { id: job.documentId },
      data: { status: 'EXTRACTING' }
    });
    
    // Get project name for validation
    const project = await prisma.project.findUnique({
      where: { id: job.projectId },
      select: { name: true }
    });
    
    const projectName = project?.name || 'Unknown Project';
    
    // Perform extraction
    const { data: extractedData, confidence } = await extractDocumentData(
      job.filePath,
      job.mimeType,
      job.documentType,
      projectName
    );
    
    // Check for project name mismatch
    let projectMismatch = false;
    if (extractedData.projectName || extractedData.projectReference) {
      const extractedProjectInfo = (extractedData.projectName || extractedData.projectReference || '').toLowerCase();
      const currentProjectName = projectName.toLowerCase();
      
      // Simple fuzzy match - if they don't contain each other, it's a mismatch
      if (!extractedProjectInfo.includes(currentProjectName) && !currentProjectName.includes(extractedProjectInfo)) {
        projectMismatch = true;
        console.warn(`[Processor] Project mismatch detected!`);
        console.warn(`  Document mentions: ${extractedData.projectName || extractedData.projectReference}`);
        console.warn(`  Uploaded to: ${projectName}`);
      }
    }
    
    // Update database with extracted data
    await prisma.procurementDocument.update({
      where: { id: job.documentId },
      data: {
        status: 'EXTRACTED',
        extractedData: extractedData as any,
        extractionConfidence: confidence,
        projectMismatch: projectMismatch,
      },
    });
    
    console.log(`[Processor] Completed extraction for document ${job.documentId} with ${confidence}% confidence`);
    
    if (projectMismatch) {
      console.log(`[Processor] ⚠️ Project mismatch flag set for document ${job.documentId}`);
    }
    
  } catch (error) {
    console.error(`[Processor] Extraction failed for document ${job.documentId}:`, error);
    
    // Update status to FAILED
    await prisma.procurementDocument.update({
      where: { id: job.documentId },
      data: { 
        status: 'FAILED',
        extractedData: { error: (error as Error).message } as any
      }
    });
    
    throw error;
  }
}
