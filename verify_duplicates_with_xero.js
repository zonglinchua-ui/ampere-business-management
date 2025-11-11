require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyDuplicatesWithXero() {
  try {
    console.log('=== VERIFYING DUPLICATE INVOICES WITH XERO ===\n');

    // Get all customer invoices with xeroInvoiceId
    const customerInvoices = await prisma.customerInvoice.findMany({
      where: {
        xeroInvoiceId: { not: null }
      },
      select: {
        id: true,
        invoiceNumber: true,
        xeroInvoiceId: true,
        xeroType: true,
        customerId: true
      }
    });

    // Get all supplier invoices with xeroInvoiceId
    const supplierInvoices = await prisma.supplierInvoice.findMany({
      where: {
        xeroInvoiceId: { not: null }
      },
      select: {
        id: true,
        invoiceNumber: true,
        xeroInvoiceId: true,
        xeroType: true,
        supplierId: true
      }
    });

    // Find duplicates
    const duplicates = [];
    for (const custInv of customerInvoices) {
      const suppInv = supplierInvoices.find(s => s.xeroInvoiceId === custInv.xeroInvoiceId);
      if (suppInv) {
        duplicates.push({
          xeroInvoiceId: custInv.xeroInvoiceId,
          customerInvoice: custInv,
          supplierInvoice: suppInv
        });
      }
    }

    console.log(`Found ${duplicates.length} duplicate invoices\n`);

    // Analyze the xeroType values
    let customerACCREC = 0;
    let customerACCPAY = 0;
    let customerNull = 0;
    let supplierACCREC = 0;
    let supplierACCPAY = 0;
    let supplierNull = 0;

    duplicates.forEach(dup => {
      // Customer Invoice types
      if (dup.customerInvoice.xeroType === 'ACCREC') customerACCREC++;
      else if (dup.customerInvoice.xeroType === 'ACCPAY') customerACCPAY++;
      else customerNull++;

      // Supplier Invoice types
      if (dup.supplierInvoice.xeroType === 'ACCREC') supplierACCREC++;
      else if (dup.supplierInvoice.xeroType === 'ACCPAY') supplierACCPAY++;
      else supplierNull++;
    });

    console.log('=== TYPE DISTRIBUTION ===');
    console.log('\nCustomerInvoice table:');
    console.log(`  ACCREC: ${customerACCREC}`);
    console.log(`  ACCPAY: ${customerACCPAY}`);
    console.log(`  NULL: ${customerNull}`);

    console.log('\nSupplierInvoice table:');
    console.log(`  ACCREC: ${supplierACCREC}`);
    console.log(`  ACCPAY: ${supplierACCPAY}`);
    console.log(`  NULL: ${supplierNull}`);

    // Determine cleanup strategy
    console.log('\n=== CLEANUP STRATEGY ===\n');
    
    // Check for mismatched types
    const typeMismatches = duplicates.filter(dup => 
      dup.customerInvoice.xeroType !== dup.supplierInvoice.xeroType
    );

    if (typeMismatches.length === duplicates.length) {
      console.log(`✅ All ${duplicates.length} duplicates have different types in each table`);
      console.log('Strategy: Delete based on type:');
      console.log(`  - Delete ${customerACCPAY} ACCPAY invoices from CustomerInvoice table`);
      console.log(`  - Delete ${supplierACCREC} ACCREC invoices from SupplierInvoice table`);
      console.log(`  - Keep ${customerACCREC} ACCREC invoices in CustomerInvoice table`);
      console.log(`  - Keep ${supplierACCPAY} ACCPAY invoices in SupplierInvoice table`);
    } else {
      console.log(`⚠️  Found ${duplicates.length - typeMismatches.length} duplicates with matching types`);
      console.log('This requires Xero API verification');
    }

    // Check for NULL types
    if (customerNull > 0 || supplierNull > 0) {
      console.log(`\n⚠️  WARNING: ${customerNull + supplierNull} invoices have NULL xeroType`);
      console.log('These will need manual verification with Xero API');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyDuplicatesWithXero();
