import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';  // ✅ CORRECT IMPORT PATH
import { PrismaClient, ProcurementDocumentType } from '@prisma/client';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { extractionQueue } from '@/lib/extraction-queue';

const prisma = new PrismaClient();



// Extraction logic moved to lib/extraction-processor.ts

async function detectDocumentType(fileName: string, mimeType: string): Promise<string> {
  const lowerFileName = fileName.toLowerCase();
  
  // Check for common document number prefixes first (most reliable)
  if (lowerFileName.match(/^quot[\d-]/i) || lowerFileName.includes('quot')) {
    return 'SUPPLIER_QUOTATION';
  } else if (lowerFileName.match(/^inv[\d-]/i)) {
    return 'SUPPLIER_INVOICE';
  } else if (lowerFileName.match(/^po[\d-]/i)) {
    return 'SUPPLIER_PO';
  } else if (lowerFileName.match(/^vo[\d-]/i)) {
    return 'VARIATION_ORDER';
  }
  
  // Fallback to keyword-based detection
  if (lowerFileName.includes('quotation') || lowerFileName.includes('quote')) {
    return 'SUPPLIER_QUOTATION';
  } else if (lowerFileName.includes('invoice')) {
    return 'SUPPLIER_INVOICE';
  } else if (lowerFileName.includes('purchase order')) {
    return 'SUPPLIER_PO';
  } else if (lowerFileName.includes('variation')) {
    return 'VARIATION_ORDER';
  }
  
  // Default to quotation if uncertain (safer than invoice)
  return 'SUPPLIER_QUOTATION';
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
    
    // Create database record with PENDING_EXTRACTION status
    console.log('Creating database record...');
    const document = await prisma.procurementDocument.create({
      data: {
        projectId,
        documentType: finalDocumentType as ProcurementDocumentType,
        fileName: fileName,
        originalFileName: file.name,
        filePath: filePath,
        fileSize: file.size,
        mimeType: file.type,
        status: 'PENDING_EXTRACTION',
        extractedData: {} as any,
        extractionConfidence: null,
        notes: notes,
        uploadedById: (session.user as any).id || null,
      },
    });
    
    console.log(`Document record created: ${document.id}`);
    
    // Queue extraction job for background processing
    console.log('Queueing AI extraction job...');
    const job = extractionQueue.addJob({
      id: `extraction_${document.id}`,
      documentId: document.id,
      projectId: projectId,
      filePath: filePath,
      mimeType: file.type,
      documentType: finalDocumentType,
    });
    
    console.log(`Extraction job queued: ${job.id}`);
    console.log('=== Document Upload Completed Successfully ===');
    
    return NextResponse.json({
      success: true,
      document: document,
      message: 'Document uploaded successfully. AI extraction in progress...',
      jobId: job.id
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
