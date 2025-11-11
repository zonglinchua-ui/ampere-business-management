import { PrismaClient } from '@prisma/client';
import { generateQuotationExcel } from '../lib/excel-generator';
import { uploadFile } from '../lib/s3';
import { v4 as uuidv4 } from 'uuid';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function backfillExcelFiles() {
  try {
    console.log('Starting Excel file backfill for existing quotations...\n');
    
    // Get all quotations
    const quotations = await prisma.quotation.findMany({
      include: {
        Customer: true,
        QuotationItem: true
      }
    });
    
    console.log(`Found ${quotations.length} quotations to process\n`);
    
    let successCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const quotation of quotations) {
      console.log(`Processing quotation: ${quotation.quotationNumber}`);
      
      // Check if Excel already exists
      const existingExcel = await prisma.document.findFirst({
        where: {
          quotationId: quotation.id,
          category: 'PROPOSAL',
          mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          isActive: true
        }
      });
      
      if (existingExcel) {
        console.log(`  ✓ Excel already exists, skipping\n`);
        skippedCount++;
        continue;
      }
      
      // Find the user who created this quotation (for uploadedById)
      const userId = quotation.createdById || quotation.salespersonId;
      
      if (!userId) {
        console.log(`  ✗ No user ID found, skipping\n`);
        errorCount++;
        continue;
      }
      
      // Prepare quotation data
      const quotationData = {
        id: quotation.id,
        quotationNumber: quotation.quotationNumber,
        version: quotation.version,
        title: quotation.title,
        description: quotation.description,
        clientReference: quotation.clientReference,
        subtotal: parseFloat(quotation.subtotal.toString()),
        taxAmount: quotation.taxAmount ? parseFloat(quotation.taxAmount.toString()) : null,
        discountAmount: quotation.discountAmount ? parseFloat(quotation.discountAmount.toString()) : null,
        totalAmount: parseFloat(quotation.totalAmount.toString()),
        currency: quotation.currency || 'SGD',
        validUntil: quotation.validUntil,
        terms: quotation.terms,
        notes: quotation.notes,
        client: quotation.Customer ? {
          name: quotation.Customer.name,
          email: quotation.Customer.email,
          phone: quotation.Customer.phone,
          address: quotation.Customer.address,
          city: quotation.Customer.city,
          state: quotation.Customer.state,
          postalCode: quotation.Customer.postalCode,
          country: quotation.Customer.country
        } : undefined,
        items: quotation.QuotationItem.map(item => ({
          description: item.description,
          category: item.category || 'General',
          quantity: parseFloat(item.quantity.toString()),
          unit: item.unit,
          unitPrice: parseFloat(item.unitPrice.toString()),
          totalPrice: parseFloat(item.totalPrice.toString())
        }))
      };
      
      try {
        // Generate Excel
        const excelBuffer = await generateQuotationExcel(quotationData);
        
        // Create filename
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const excelFilename = `quotation-${quotationData.quotationNumber}-v${quotationData.version}-${timestamp}.xlsx`;
        
        // Upload to S3
        const excelCloudPath = await uploadFile(excelBuffer, excelFilename);
        
        // Store in database
        await prisma.document.create({
          data: {
            id: uuidv4(),
            filename: excelFilename,
            originalName: `${quotationData.quotationNumber} - ${quotationData.title}.xlsx`,
            mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            size: excelBuffer.length,
            cloudStoragePath: excelCloudPath,
            description: `Auto-generated Excel for quotation ${quotationData.quotationNumber} v${quotationData.version}`,
            category: 'PROPOSAL',
            quotationId: quotationData.id,
            uploadedById: userId,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
        
        console.log(`  ✓ Excel file generated and uploaded successfully\n`);
        successCount++;
        
      } catch (error: any) {
        console.error(`  ✗ Error generating Excel:`, error.message);
        console.error(`    Full error:`, error);
        console.log('');
        errorCount++;
      }
    }
    
    // Show final count
    const finalExcelCount = await prisma.document.count({
      where: {
        mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        category: 'PROPOSAL'
      }
    });
    
    console.log(`\n=== Backfill Complete ===`);
    console.log(`Successfully generated: ${successCount}`);
    console.log(`Skipped (already exists): ${skippedCount}`);
    console.log(`Errors: ${errorCount}`);
    console.log(`Total Excel files now: ${finalExcelCount}`);
    console.log(`Total quotations: ${quotations.length}`);
    
  } catch (error) {
    console.error('Fatal error during backfill:', error);
  } finally {
    await prisma.$disconnect();
  }
}

backfillExcelFiles();
