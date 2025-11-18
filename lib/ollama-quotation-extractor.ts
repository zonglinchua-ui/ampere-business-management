/**
 * Ollama-based Quotation Extraction
 * Uses local Ollama LLM to extract structured data from quotation text
 */

interface OllamaResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
}

export interface QuotationExtraction {
  supplierName: string;
  quotationReference: string;
  quotationDate: string;
  totalAmount: number;
  amountBeforeTax?: number;
  taxAmount?: number;
  currency: string;
  tradeType?: string;
  lineItems?: Array<{
    description: string;
    quantity?: number;
    unitPrice?: number;
    amount: number;
  }>;
  confidence: number;
  rawText?: string;
}

/**
 * Extract quotation data using Ollama
 */
export async function extractQuotationWithOllama(
  pdfText: string,
  supplierName?: string
): Promise<QuotationExtraction> {
  const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  const ollamaModel = process.env.OLLAMA_MODEL || 'llama3.1:8b';

  // Create structured prompt for Ollama
  const prompt = createExtractionPrompt(pdfText, supplierName);

  try {
    const response = await fetch(`${ollamaBaseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: ollamaModel,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.1, // Low temperature for more consistent extraction
          top_p: 0.9,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const data: OllamaResponse = await response.json();
    
    // Parse the JSON response from Ollama
    const extracted = parseOllamaResponse(data.response);
    
    // Calculate confidence score
    const confidence = calculateConfidence(extracted, pdfText);
    
    return {
      ...extracted,
      confidence,
      rawText: pdfText.substring(0, 500), // Store first 500 chars for reference
    };
  } catch (error) {
    console.error('Ollama extraction error:', error);
    
    // Return fallback extraction with low confidence
    return {
      supplierName: supplierName || 'Unknown',
      quotationReference: '',
      quotationDate: new Date().toISOString(),
      totalAmount: 0,
      currency: 'SGD',
      confidence: 0,
      rawText: pdfText.substring(0, 500),
    };
  }
}

/**
 * Create a structured prompt for Ollama to extract quotation data
 */
function createExtractionPrompt(pdfText: string, supplierName?: string): string {
  return `You are a data extraction expert. Extract quotation information from the following text and return ONLY a valid JSON object with no additional text or explanation.

Required JSON format:
{
  "supplierName": "Company name",
  "quotationReference": "Quotation number or reference",
  "quotationDate": "Date in YYYY-MM-DD format",
  "totalAmount": 0.00,
  "amountBeforeTax": 0.00,
  "taxAmount": 0.00,
  "currency": "SGD",
  "tradeType": "Type of work (e.g., Electrical, Plumbing, Aircon, etc.)",
  "lineItems": [
    {
      "description": "Item description",
      "quantity": 1,
      "unitPrice": 0.00,
      "amount": 0.00
    }
  ]
}

Rules:
1. Extract exact values from the text
2. Convert all amounts to numbers (remove currency symbols and commas)
3. If a field is not found, use null or empty string
4. For dates, convert to YYYY-MM-DD format
5. Return ONLY the JSON object, no other text
${supplierName ? `6. The supplier name should be: ${supplierName}` : ''}

Quotation text:
${pdfText.substring(0, 3000)}

JSON output:`;
}

/**
 * Parse Ollama's response and extract JSON
 */
function parseOllamaResponse(response: string): Partial<QuotationExtraction> {
  try {
    // Try to find JSON in the response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      
      // Normalize the data
      return {
        supplierName: parsed.supplierName || parsed.supplier_name || 'Unknown',
        quotationReference: parsed.quotationReference || parsed.quotation_reference || parsed.quotationNumber || '',
        quotationDate: normalizeDate(parsed.quotationDate || parsed.quotation_date || parsed.date),
        totalAmount: parseFloat(parsed.totalAmount || parsed.total_amount || parsed.total || '0'),
        amountBeforeTax: parsed.amountBeforeTax || parsed.amount_before_tax ? parseFloat(parsed.amountBeforeTax || parsed.amount_before_tax) : undefined,
        taxAmount: parsed.taxAmount || parsed.tax_amount ? parseFloat(parsed.taxAmount || parsed.tax_amount) : undefined,
        currency: parsed.currency || 'SGD',
        tradeType: parsed.tradeType || parsed.trade_type || parsed.category,
        lineItems: parsed.lineItems || parsed.line_items || parsed.items || [],
      };
    }
  } catch (error) {
    console.error('Failed to parse Ollama response:', error);
  }

  // Fallback: return empty extraction
  return {
    supplierName: 'Unknown',
    quotationReference: '',
    quotationDate: new Date().toISOString(),
    totalAmount: 0,
    currency: 'SGD',
  };
}

/**
 * Normalize date to YYYY-MM-DD format
 */
function normalizeDate(dateStr: string | undefined): string {
  if (!dateStr) return new Date().toISOString().split('T')[0];

  try {
    // Try to parse various date formats
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  } catch (error) {
    // Ignore parsing errors
  }

  return new Date().toISOString().split('T')[0];
}

/**
 * Calculate confidence score based on extracted data quality
 */
function calculateConfidence(
  extracted: Partial<QuotationExtraction>,
  originalText: string
): number {
  let score = 0;
  let maxScore = 0;

  // Check required fields
  const checks = [
    { field: extracted.supplierName, weight: 20, required: extracted.supplierName !== 'Unknown' },
    { field: extracted.quotationReference, weight: 15, required: !!extracted.quotationReference },
    { field: extracted.quotationDate, weight: 10, required: !!extracted.quotationDate },
    { field: extracted.totalAmount, weight: 30, required: extracted.totalAmount && extracted.totalAmount > 0 },
    { field: extracted.currency, weight: 5, required: !!extracted.currency },
    { field: extracted.tradeType, weight: 10, required: !!extracted.tradeType },
    { field: extracted.lineItems, weight: 10, required: extracted.lineItems && extracted.lineItems.length > 0 },
  ];

  for (const check of checks) {
    maxScore += check.weight;
    if (check.required) {
      score += check.weight;
    }
  }

  // Verify amounts are reasonable
  if (extracted.totalAmount && extracted.totalAmount > 0) {
    // Check if amount appears in original text
    const amountStr = extracted.totalAmount.toString().replace('.', '');
    if (originalText.includes(amountStr)) {
      score += 10;
    }
    maxScore += 10;
  }

  return Math.min(Math.round((score / maxScore) * 100) / 100, 1.0);
}
