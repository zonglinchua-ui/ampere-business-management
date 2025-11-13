/**
 * AI Document Extraction Service
 * 
 * Specialized extraction for different document types:
 * - Purchase Orders (PO) → Extract data to create projects
 * - Invoices → Extract data to link to projects
 * - Progress Claims/Certifications → Extract data to prepare invoices
 */

import { getFileBuffer } from './s3'
import * as mammoth from 'mammoth'

// Types for extracted data
export interface ExtractedPOData {
  documentType: 'PURCHASE_ORDER'
  poNumber: string
  poDate: string
  customer: {
    name: string
    address?: string
    contactPerson?: string
    email?: string
    phone?: string
  }
  projectInfo: {
    projectName: string
    projectDescription?: string
    location?: string
    workType?: string
  }
  lineItems: Array<{
    description: string
    quantity?: number
    unit?: string
    unitPrice?: number
    amount?: number
  }>
  totalAmount: number
  currency?: string
  startDate?: string
  endDate?: string
  paymentTerms?: string
  specialInstructions?: string
  confidence: number
}

export interface ExtractedInvoiceData {
  documentType: 'INVOICE'
  invoiceNumber: string
  invoiceDate: string
  dueDate?: string
  vendor: {
    name: string
    address?: string
    phone?: string
    email?: string
  }
  billTo?: {
    name: string
    address?: string
  }
  projectReference?: string
  lineItems: Array<{
    description: string
    quantity?: number
    unit?: string
    unitPrice?: number
    amount: number
  }>
  subtotal: number
  tax?: number
  totalAmount: number
  currency?: string
  paymentTerms?: string
  confidence: number
}

export interface ExtractedProgressClaimData {
  documentType: 'PROGRESS_CLAIM'
  claimNumber: string
  claimDate: string
  projectReference: string
  projectName?: string
  customer: {
    name: string
    address?: string
  }
  claimPeriod?: {
    from: string
    to: string
  }
  workItems: Array<{
    description: string
    previousClaimed?: number
    currentClaim: number
    totalToDate?: number
    percentComplete?: number
  }>
  previousClaimedTotal?: number
  currentClaimAmount: number
  totalClaimedToDate?: number
  retentionPercentage?: number
  retentionAmount?: number
  gstAmount?: number
  netAmount: number
  currency?: string
  certifiedBy?: string
  certificationDate?: string
  confidence: number
}

export type ExtractedDocumentData = ExtractedPOData | ExtractedInvoiceData | ExtractedProgressClaimData

/**
 * Extract Purchase Order data from document
 */
export async function extractPurchaseOrderData(
  fileBuffer: Buffer,
  filename: string,
  mimetype: string
): Promise<ExtractedPOData> {
  const prompt = `Analyze this Purchase Order document and extract ALL information in the following JSON format:

{
  "documentType": "PURCHASE_ORDER",
  "poNumber": "PO number/reference",
  "poDate": "PO date in YYYY-MM-DD format",
  "customer": {
    "name": "Customer/client company name",
    "address": "Full address if available",
    "contactPerson": "Contact person name if available",
    "email": "Email if available",
    "phone": "Phone number if available"
  },
  "projectInfo": {
    "projectName": "Project name or title",
    "projectDescription": "Brief description of the work",
    "location": "Project location/site address",
    "workType": "Type of work (e.g., REINSTATEMENT, MEP, ELECTRICAL_ONLY, etc.)"
  },
  "lineItems": [
    {
      "description": "Item description",
      "quantity": 1,
      "unit": "unit (e.g., lot, sqm, item)",
      "unitPrice": 1000.00,
      "amount": 1000.00
    }
  ],
  "totalAmount": 10000.00,
  "currency": "SGD",
  "startDate": "Expected start date in YYYY-MM-DD format if available",
  "endDate": "Expected end date in YYYY-MM-DD format if available",
  "paymentTerms": "Payment terms if specified",
  "specialInstructions": "Any special instructions or notes",
  "confidence": 0.95
}

IMPORTANT:
- Extract ALL line items with their descriptions, quantities, and amounts
- For projectInfo.workType, try to classify as: REINSTATEMENT, MEP, ELECTRICAL_ONLY, PLUMBING, HVAC, CIVIL, STRUCTURAL, or OTHER
- If information is not found, use null
- confidence should be 0.0 to 1.0 based on how clear the document is
- Respond with raw JSON only, no markdown or code blocks`

  const analysis = await callLLMForExtraction(fileBuffer, filename, mimetype, prompt)
  return analysis as ExtractedPOData
}

/**
 * Extract Invoice data from document
 */
export async function extractInvoiceData(
  fileBuffer: Buffer,
  filename: string,
  mimetype: string
): Promise<ExtractedInvoiceData> {
  const prompt = `Analyze this Invoice document and extract ALL information in the following JSON format:

{
  "documentType": "INVOICE",
  "invoiceNumber": "Invoice number",
  "invoiceDate": "Invoice date in YYYY-MM-DD format",
  "dueDate": "Due date in YYYY-MM-DD format if available",
  "vendor": {
    "name": "Vendor/supplier company name",
    "address": "Vendor address if available",
    "phone": "Phone if available",
    "email": "Email if available"
  },
  "billTo": {
    "name": "Bill to company name",
    "address": "Bill to address"
  },
  "projectReference": "Project number or reference if mentioned",
  "lineItems": [
    {
      "description": "Item description",
      "quantity": 1,
      "unit": "unit",
      "unitPrice": 100.00,
      "amount": 100.00
    }
  ],
  "subtotal": 1000.00,
  "tax": 90.00,
  "totalAmount": 1090.00,
  "currency": "SGD",
  "paymentTerms": "Payment terms if specified",
  "confidence": 0.95
}

IMPORTANT:
- Extract ALL line items with descriptions and amounts
- Calculate subtotal, tax, and total if not explicitly stated
- Look for project references in description or notes
- If information is not found, use null
- confidence should be 0.0 to 1.0
- Respond with raw JSON only, no markdown or code blocks`

  const analysis = await callLLMForExtraction(fileBuffer, filename, mimetype, prompt)
  return analysis as ExtractedInvoiceData
}

/**
 * Extract Progress Claim/Certification data from document
 */
export async function extractProgressClaimData(
  fileBuffer: Buffer,
  filename: string,
  mimetype: string
): Promise<ExtractedProgressClaimData> {
  const prompt = `Analyze this Progress Claim or Payment Certification document and extract ALL information in the following JSON format:

{
  "documentType": "PROGRESS_CLAIM",
  "claimNumber": "Claim/certification number",
  "claimDate": "Claim date in YYYY-MM-DD format",
  "projectReference": "Project number or reference",
  "projectName": "Project name if available",
  "customer": {
    "name": "Customer/client company name",
    "address": "Address if available"
  },
  "claimPeriod": {
    "from": "Period start date in YYYY-MM-DD format",
    "to": "Period end date in YYYY-MM-DD format"
  },
  "workItems": [
    {
      "description": "Work item description",
      "previousClaimed": 5000.00,
      "currentClaim": 3000.00,
      "totalToDate": 8000.00,
      "percentComplete": 80
    }
  ],
  "previousClaimedTotal": 50000.00,
  "currentClaimAmount": 30000.00,
  "totalClaimedToDate": 80000.00,
  "retentionPercentage": 10,
  "retentionAmount": 3000.00,
  "gstAmount": 2430.00,
  "netAmount": 29430.00,
  "currency": "SGD",
  "certifiedBy": "Certifier name if available",
  "certificationDate": "Certification date if different from claim date",
  "confidence": 0.95
}

IMPORTANT:
- Extract ALL work items with previous claimed, current claim, and totals
- Calculate totals if not explicitly stated
- Look for retention percentage (usually 5-10%)
- GST is usually 9% in Singapore
- If information is not found, use null
- confidence should be 0.0 to 1.0
- Respond with raw JSON only, no markdown or code blocks`

  const analysis = await callLLMForExtraction(fileBuffer, filename, mimetype, prompt)
  return analysis as ExtractedProgressClaimData
}

/**
 * Call LLM API for document extraction
 */
async function callLLMForExtraction(
  fileBuffer: Buffer,
  filename: string,
  mimetype: string,
  prompt: string
): Promise<any> {
  let messages: any[] = []

  // Process different file types
  if (mimetype === 'application/pdf') {
    // For PDF files, base64-encode and send to LLM
    const base64String = fileBuffer.toString('base64')
    messages = [{
      role: "user",
      content: [{
        type: "file",
        file: {
          filename: filename,
          file_data: `data:application/pdf;base64,${base64String}`
        }
      }, {
        type: "text",
        text: prompt
      }]
    }]
  } else if (mimetype.includes('image/')) {
    // For image files, base64-encode and send to LLM
    const base64String = fileBuffer.toString('base64')
    messages = [{
      role: "user",
      content: [{
        type: "text",
        text: prompt
      }, {
        type: "image_url",
        image_url: {
          url: `data:${mimetype};base64,${base64String}`
        }
      }]
    }]
  } else if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    // For DOCX files, extract text using mammoth
    const result = await mammoth.extractRawText({ buffer: fileBuffer })
    const textContent = result.value
    
    messages = [{
      role: "user",
      content: `Here is the content from the document:

${textContent}

${prompt}`
    }]
  } else if (mimetype === 'text/plain') {
    // For text files, read content directly
    const textContent = fileBuffer.toString('utf-8')
    
    messages = [{
      role: "user",
      content: `Here is the content from the document:

${textContent}

${prompt}`
    }]
  } else {
    throw new Error('File type not supported for AI analysis')
  }

  // Call the LLM API for analysis
  const response = await fetch('https://apps.abacus.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.ABACUSAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      messages: messages,
      response_format: { type: "json_object" },
      max_tokens: 4000,
      temperature: 0.1
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`LLM API error: ${response.status} - ${errorText}`)
  }

  const result = await response.json()
  const analysis = JSON.parse(result.choices[0].message.content)

  return analysis
}

/**
 * Auto-detect document type and extract appropriate data
 */
export async function autoExtractDocumentData(
  fileBuffer: Buffer,
  filename: string,
  mimetype: string
): Promise<ExtractedDocumentData> {
  // First, detect document type
  const detectionPrompt = `Analyze this document and determine its type. Respond with ONLY ONE of these exact values:
- PURCHASE_ORDER (if it's a purchase order, work order, or contract from customer)
- INVOICE (if it's an invoice, bill, or payment request from vendor/supplier)
- PROGRESS_CLAIM (if it's a progress claim, payment certificate, or interim payment application)
- OTHER (if it doesn't match any of the above)

Respond with just the type, no explanation.`

  const detectionResult = await callLLMForExtraction(fileBuffer, filename, mimetype, detectionPrompt)
  const documentType = typeof detectionResult === 'string' ? detectionResult.trim() : detectionResult.documentType

  console.log(`[AI Extraction] Detected document type: ${documentType}`)

  // Extract data based on detected type
  switch (documentType) {
    case 'PURCHASE_ORDER':
      return await extractPurchaseOrderData(fileBuffer, filename, mimetype)
    
    case 'INVOICE':
      return await extractInvoiceData(fileBuffer, filename, mimetype)
    
    case 'PROGRESS_CLAIM':
      return await extractProgressClaimData(fileBuffer, filename, mimetype)
    
    default:
      throw new Error(`Unsupported document type: ${documentType}. Only PO, Invoice, and Progress Claim are supported.`)
  }
}
