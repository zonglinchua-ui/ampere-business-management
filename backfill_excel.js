require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
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
        continue;
      }
      
      // Find the user who created this quotation (for uploadedById)
      const userId = quotation.createdById || quotation.salespersonId;
      
      if (!userId) {
        console.log(`  ✗ No user ID found, skipping\n`);
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
        subtotal: quotation.subtotal,
        taxAmount: quotation.taxAmount,
        discountAmount: quotation.discountAmount,
        totalAmount: quotation.totalAmount,
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
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice
        }))
      };
      
      try {
        // Generate Excel only (PDF already exists)
        const { generateQuotationExcel } = require('./lib/excel-generator');
        const { uploadFile } = require('./lib/s3');
        const { v4: uuidv4 } = require('uuid');
        
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
        
      } catch (error) {
        console.error(`  ✗ Error generating Excel:`, error.message);
        console.error(`    Full error:`, error);
        console.log('');
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
    console.log(`Total Excel files now: ${finalExcelCount}`);
    console.log(`Total quotations: ${quotations.length}`);
    
  } catch (error) {
    console.error('Fatal error during backfill:', error);
  } finally {
    await prisma.$disconnect();
  }
}

backfillExcelFiles();
