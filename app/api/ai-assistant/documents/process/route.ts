
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getFileBuffer } from '@/lib/s3'
import * as mammoth from 'mammoth'


export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = session?.user?.role
    const canUseAI = ["SUPERADMIN", "FINANCE", "PROJECT_MANAGER"].includes(userRole || "")
    
    if (!canUseAI) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { documentId } = await request.json()
    
    if (!documentId) {
      return NextResponse.json({ error: 'Document ID is required' }, { status: 400 })
    }

    // Get document from database
    const document = await prisma.document.findUnique({
      where: { id: documentId }
    })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Get file content from S3
    const fileBuffer = await getFileBuffer(document.cloudStoragePath)
    
    let messages: any[] = []
    
    // Process different file types
    if (document.mimetype === 'application/pdf') {
      // For PDF files, base64-encode and send to LLM
      const base64String = fileBuffer.toString('base64')
      messages = [{
        role: "user",
        content: [{
          type: "file",
          file: {
            filename: document.filename,
            file_data: `data:application/pdf;base64,${base64String}`
          }
        }, {
          type: "text",
          text: `Please analyze this document and provide the following information in JSON format:

{
  "documentType": "Type of document (e.g., Invoice, Contract, Report, Specification, etc.)",
  "summary": "Brief summary of the document content (max 200 characters)",
  "keyInformation": ["List", "of", "key", "data", "points", "found"],
  "suggestedAssignment": {
    "type": "project|client|vendor|tender|quotation|invoice",
    "confidence": 0.85,
    "reason": "Why this assignment makes sense"
  },
  "detectedEntities": {
    "companies": ["Company names found"],
    "amounts": ["Financial amounts found"],
    "dates": ["Important dates found"],
    "projectNames": ["Project names or references found"]
  }
}

Respond with raw JSON only. Do not include code blocks, markdown, or any other formatting.`
        }]
      }]
    } else if (document.mimetype.includes('image/')) {
      // For image files, base64-encode and send to LLM
      const base64String = fileBuffer.toString('base64')
      const imageType = document.mimetype
      messages = [{
        role: "user",
        content: [{
          type: "text",
          text: `Please analyze this document image and provide the following information in JSON format:

{
  "documentType": "Type of document (e.g., Invoice, Contract, Report, etc.)",
  "summary": "Brief summary of the document content (max 200 characters)",
  "keyInformation": ["List", "of", "key", "data", "points", "found"],
  "suggestedAssignment": {
    "type": "project|client|vendor|tender|quotation|invoice",
    "confidence": 0.85,
    "reason": "Why this assignment makes sense"
  },
  "detectedEntities": {
    "companies": ["Company names found"],
    "amounts": ["Financial amounts found"],
    "dates": ["Important dates found"],
    "projectNames": ["Project names or references found"]
  }
}

Respond with raw JSON only.`
        }, {
          type: "image_url",
          image_url: {
            url: `data:${imageType};base64,${base64String}`
          }
        }]
      }]
    } else if (document.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      // For DOCX files, extract text using mammoth
      try {
        const result = await mammoth.extractRawText({ buffer: fileBuffer })
        const textContent = result.value
        
        messages = [{
          role: "user",
          content: `Here is the content from the DOCX file:

${textContent}

Please analyze this document and provide the following information in JSON format:

{
  "documentType": "Type of document (e.g., Contract, Report, Specification, etc.)",
  "summary": "Brief summary of the document content (max 200 characters)",
  "keyInformation": ["List", "of", "key", "data", "points", "found"],
  "suggestedAssignment": {
    "type": "project|client|vendor|tender|quotation|invoice",
    "confidence": 0.85,
    "reason": "Why this assignment makes sense"
  },
  "detectedEntities": {
    "companies": ["Company names found"],
    "amounts": ["Financial amounts found"],
    "dates": ["Important dates found"],
    "projectNames": ["Project names or references found"]
  }
}

Respond with raw JSON only.`
        }]
      } catch (error) {
        console.error('DOCX processing error:', error)
        throw new Error('Failed to process DOCX file')
      }
    } else if (document.mimetype === 'text/plain') {
      // For text files, read content directly
      const textContent = fileBuffer.toString('utf-8')
      
      messages = [{
        role: "user",
        content: `Here is the content from the text file:

${textContent}

Please analyze this document and provide the following information in JSON format:

{
  "documentType": "Type of document (e.g., Report, Specification, etc.)",
  "summary": "Brief summary of the document content (max 200 characters)",
  "keyInformation": ["List", "of", "key", "data", "points", "found"],
  "suggestedAssignment": {
    "type": "project|client|vendor|tender|quotation|invoice",
    "confidence": 0.85,
    "reason": "Why this assignment makes sense"
  },
  "detectedEntities": {
    "companies": ["Company names found"],
    "amounts": ["Financial amounts found"],
    "dates": ["Important dates found"],
    "projectNames": ["Project names or references found"]
  }
}

Respond with raw JSON only.`
      }]
    } else {
      // For other file types, return error
      return NextResponse.json({ error: 'File type not supported for AI analysis' }, { status: 400 })
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
        max_tokens: 2000,
        temperature: 0.1
      }),
    })

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.status}`)
    }

    const result = await response.json()
    const analysis = JSON.parse(result.choices[0].message.content)

    // Update document with AI analysis results
    await prisma.document.update({
      where: { id: documentId },
      data: {
        description: analysis.summary,
        // Update category based on document type
        category: getCategoryFromType(analysis.documentType) as any
      }
    })

    return NextResponse.json({
      analysis: analysis
    })

  } catch (error) {
    console.error('Document processing error:', error)
    return NextResponse.json(
      { error: 'Failed to process document' },
      { status: 500 }
    )
  }
}

function getCategoryFromType(documentType: string): string {
  const typeMapping: { [key: string]: string } = {
    'invoice': 'INVOICE',
    'contract': 'CONTRACT',
    'proposal': 'PROPOSAL',
    'report': 'REPORT',
    'drawing': 'DRAWING',
    'specification': 'SPECIFICATION',
    'certificate': 'CERTIFICATE'
  }
  
  const lowerType = documentType.toLowerCase()
  for (const [key, value] of Object.entries(typeMapping)) {
    if (lowerType.includes(key)) {
      return value
    }
  }
  
  return 'GENERAL'
}
