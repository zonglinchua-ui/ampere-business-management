/**
 * PDF Extraction Utility using pdf-parse
 * Extracts text content from PDF files for AI processing
 */

// @ts-ignore
const pdf = require('pdf-parse');
import { readFile } from 'fs/promises';

export interface PDFExtractionResult {
  text: string;
  numPages: number;
  metadata?: any;
  success: boolean;
  error?: string;
}

/**
 * Extract text content from a PDF file
 * @param filePath - Absolute path to the PDF file
 * @returns Extracted text and metadata
 */
export async function extractTextFromPDF(
  filePath: string
): Promise<PDFExtractionResult> {
  try {
    const dataBuffer = await readFile(filePath);
    const data = await pdf(dataBuffer);

    return {
      text: data.text,
      numPages: data.numpages,
      metadata: data.metadata,
      success: true,
    };
  } catch (error) {
    console.error('PDF extraction error:', error);
    return {
      text: '',
      numPages: 0,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Clean and normalize extracted PDF text
 * Removes excessive whitespace, normalizes line breaks
 */
export function cleanPDFText(text: string): string {
  return text
    .replace(/\r\n/g, '\n') // Normalize line breaks
    .replace(/\n{3,}/g, '\n\n') // Remove excessive line breaks
    .replace(/[ \t]{2,}/g, ' ') // Remove excessive spaces
    .trim();
}

/**
 * Extract structured data from PDF text using patterns
 * Useful for finding common quotation fields
 */
export function extractQuotationPatterns(text: string) {
  const patterns = {
    // Quotation number patterns
    quotationNumber: [
      /(?:quotation|quote|ref|reference)[\s#:]*([A-Z0-9\-\/]+)/i,
      /(?:QT|QN|Q)[\s#:\-]*([0-9\-\/]+)/i,
    ],
    
    // Date patterns
    date: [
      /(?:date|dated)[\s:]*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i,
      /(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/,
    ],
    
    // Amount patterns
    totalAmount: [
      /(?:total|grand total|amount)[\s:$]*([0-9,]+\.?\d{0,2})/i,
      /(?:total|grand total)[\s:]*(?:SGD|USD|MYR)?[\s$]*([0-9,]+\.?\d{0,2})/i,
    ],
    
    // Tax patterns
    tax: [
      /(?:gst|tax|vat)[\s:@]*(\d+)%?/i,
      /(?:gst|tax)[\s:$]*([0-9,]+\.?\d{0,2})/i,
    ],
    
    // Subtotal patterns
    subtotal: [
      /(?:subtotal|sub-total|sub total)[\s:$]*([0-9,]+\.?\d{0,2})/i,
    ],
  };

  const extracted: any = {};

  for (const [key, regexList] of Object.entries(patterns)) {
    for (const regex of regexList) {
      const match = text.match(regex);
      if (match && match[1]) {
        extracted[key] = match[1].replace(/,/g, '');
        break;
      }
    }
  }

  return extracted;
}
