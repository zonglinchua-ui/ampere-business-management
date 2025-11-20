import { PrismaClient } from '@prisma/client';
import { readFile } from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import sharp from 'sharp';

const execAsync = promisify(exec);
const prisma = new PrismaClient();

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_VISION_MODEL = 'llama3.2-vision';

interface ExtractedDocumentData {
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

async function extractDocumentData(
  filePath: string,
  mimeType: string,
  documentType: string,
  projectName: string
): Promise<{ data: ExtractedDocumentData; confidence: number }> {
  try {
    let processedPath = filePath;
    
    // Convert to PNG
    if (mimeType.startsWith('image/')) {
      processedPath = await convertImageToPNG(filePath, mimeType);
    } else if (mimeType === 'application/pdf') {
      console.log('Converting PDF to PNG for vision model...');
      processedPath = await convertPDFToPNG(filePath);
    }
    
    // Read file as base64
    const fileBuffer = await readFile(processedPath);
    const base64Data = fileBuffer.toString('base64');
    
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
The current project this document is uploaded to is: "${projectName}"

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
The current project this document is uploaded to is: "${projectName}"

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
The current project this document is uploaded to is: "${projectName}"

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
        console.log('Extracted data:', JSON.stringify(extractedData, null, 2));
      } catch (parseError) {
        console.error('Failed to parse JSON from Ollama response:', parseError);
        console.error('Raw response:', responseText.substring(0, 500));
      }
    } else {
      console.warn('No JSON found in Ollama response');
      console.warn('Raw response:', responseText.substring(0, 500));
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
