
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// POST /api/invoice-extract - Extract invoice data from uploaded file using AI
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
    if (!validTypes.includes(file.type)) {
      return NextResponse.json({ 
        error: 'Invalid file type. Please upload PDF, JPG, or PNG files.' 
      }, { status: 400 })
    }

    // Convert file to base64
    const base64Buffer = await file.arrayBuffer()
    const base64String = Buffer.from(base64Buffer).toString('base64')

    // Prepare the message for the LLM API based on file type
    let messages: any[] = []
    
    if (file.type === 'application/pdf') {
      // For PDF files
      messages = [{
        role: "user",
        content: [
          {
            type: "file",
            file: {
              filename: file.name,
              file_data: `data:application/pdf;base64,${base64String}`
            }
          },
          {
            type: "text",
            text: `Extract the following information from this invoice document:

1. Supplier/Vendor name
2. Invoice number
3. Invoice date (format: YYYY-MM-DD)
4. Due date (format: YYYY-MM-DD)
5. Total amount (numeric value only, no currency symbols)
6. Currency code (e.g., SGD, USD, EUR)
7. Line items (if any) with description and amount
8. Tax/GST information (if any)
9. Any additional notes or payment terms

Please respond in JSON format with the following structure:
{
  "supplierName": "Supplier name",
  "invoiceNumber": "Invoice number",
  "invoiceDate": "YYYY-MM-DD",
  "dueDate": "YYYY-MM-DD",
  "totalAmount": 1234.56,
  "currency": "SGD",
  "lineItems": [
    {
      "description": "Item description",
      "amount": 123.45
    }
  ],
  "taxAmount": 123.45,
  "notes": "Any additional notes or payment terms",
  "confidence": "high|medium|low"
}

If any field cannot be determined, use null for that field. Set the confidence level based on how clearly the information is visible in the document.

Respond with raw JSON only. Do not include code blocks, markdown, or any other formatting.`
          }
        ]
      }]
    } else {
      // For image files
      messages = [{
        role: "user",
        content: [
          {
            type: "text",
            text: `Extract the following information from this invoice image:

1. Supplier/Vendor name
2. Invoice number
3. Invoice date (format: YYYY-MM-DD)
4. Due date (format: YYYY-MM-DD)
5. Total amount (numeric value only, no currency symbols)
6. Currency code (e.g., SGD, USD, EUR)
7. Line items (if any) with description and amount
8. Tax/GST information (if any)
9. Any additional notes or payment terms

Please respond in JSON format with the following structure:
{
  "supplierName": "Supplier name",
  "invoiceNumber": "Invoice number",
  "invoiceDate": "YYYY-MM-DD",
  "dueDate": "YYYY-MM-DD",
  "totalAmount": 1234.56,
  "currency": "SGD",
  "lineItems": [
    {
      "description": "Item description",
      "amount": 123.45
    }
  ],
  "taxAmount": 123.45,
  "notes": "Any additional notes or payment terms",
  "confidence": "high|medium|low"
}

If any field cannot be determined, use null for that field. Set the confidence level based on how clearly the information is visible in the document.

Respond with raw JSON only. Do not include code blocks, markdown, or any other formatting.`
          },
          {
            type: "image_url",
            image_url: {
              url: `data:${file.type};base64,${base64String}`
            }
          }
        ]
      }]
    }

    // Call the LLM API
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
        max_tokens: 3000,
        temperature: 0.1 // Low temperature for more consistent extraction
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('LLM API error:', errorText)
      return NextResponse.json({ 
        error: 'Failed to process invoice document' 
      }, { status: 500 })
    }

    const result = await response.json()
    const extractedData = JSON.parse(result.choices[0].message.content)

    return NextResponse.json({
      success: true,
      data: extractedData
    })

  } catch (error) {
    console.error('Error extracting invoice data:', error)
    return NextResponse.json({ 
      error: 'Failed to extract invoice data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
