require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanupDuplicateInvoices(dryRun = true) {
  try {
    console.log('=== CLEANUP DUPLICATE INVOICES ===\n');
    console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE EXECUTION'}\n`);

    // Find all customer invoices with xeroInvoiceId
    const customerInvoices = await prisma.customerInvoice.findMany({
      where: { xeroInvoiceId: { not: null } },
      select: {
        id: true,
        invoiceNumber: true,
        xeroInvoiceId: true,
        xeroType: true,
        totalAmount: true,
        Customer: { select: { name: true, xeroContactId: true } }
      }
    });

    // Find all supplier invoices with xeroInvoiceId
    const supplierInvoices = await prisma.supplierInvoice.findMany({
      where: { xeroInvoiceId: { not: null } },
      select: {
        id: true,
        invoiceNumber: true,
        xeroInvoiceId: true,
        xeroType: true,
        totalAmount: true,
        Supplier: { select: { name: true, xeroContactId: true } }
      }
    });

    console.log(`Customer invoices with Xero ID: ${customerInvoices.length}`);
    console.log(`Supplier invoices with Xero ID: ${supplierInvoices.length}\n`);

    // Find duplicates (same xeroInvoiceId in both tables)
    const duplicates = [];
    for (const custInv of customerInvoices) {
      const suppInv = supplierInvoices.find(s => s.xeroInvoiceId === custInv.xeroInvoiceId);
      if (suppInv) {
        // Check if contact is same
        const sameContact = custInv.Customer?.xeroContactId === suppInv.Supplier?.xeroContactId;
        
        duplicates.push({
          xeroInvoiceId: custInv.xeroInvoiceId,
          invoiceNumber: custInv.invoiceNumber,
          customerInvoiceId: custInv.id,
          supplierInvoiceId: suppInv.id,
          customerType: custInv.xeroType,
          supplierType: suppInv.xeroType,
          amount: custInv.totalAmount,
          contactName: custInv.Customer?.name,
          sameContact
        });
      }
    }

    console.log(`Found ${duplicates.length} duplicate invoices\n`);

    if (duplicates.length === 0) {
      console.log('✅ No duplicates found!');
      return;
    }

    // Analyze duplicates
    console.log('=== ANALYSIS ===\n');
    const sameContactDups = duplicates.filter(d => d.sameContact);
    console.log(`Duplicates with same contact: ${sameContactDups.length}`);
    
    const typeBreakdown = {
      customerACCREC: duplicates.filter(d => d.customerType === 'ACCREC').length,
      customerACCPAY: duplicates.filter(d => d.customerType === 'ACCPAY').length,
      supplierACCREC: duplicates.filter(d => d.supplierType === 'ACCREC').length,
      supplierACCPAY: duplicates.filter(d => d.supplierType === 'ACCPAY').length,
    };
    
    console.log('\nType Distribution:');
    console.log(`  CustomerInvoice → ACCREC: ${typeBreakdown.customerACCREC}, ACCPAY: ${typeBreakdown.customerACCPAY}`);
    console.log(`  SupplierInvoice → ACCREC: ${typeBreakdown.supplierACCREC}, ACCPAY: ${typeBreakdown.supplierACCPAY}`);

    // Show samples
    console.log('\n=== SAMPLE DUPLICATES (first 10) ===\n');
    duplicates.slice(0, 10).forEach((dup, i) => {
      console.log(`${i + 1}. Invoice: ${dup.invoiceNumber} (Xero ID: ${dup.xeroInvoiceId})`);
      console.log(`   Contact: ${dup.contactName}`);
      console.log(`   Amount: $${dup.amount}`);
      console.log(`   CustomerInvoice: ${dup.customerType}`);
      console.log(`   SupplierInvoice: ${dup.supplierType}`);
      console.log(`   Same Contact: ${dup.sameContact ? 'Yes' : 'No'}`);
      console.log('');
    });

    // Decision: Delete customer invoices that are duplicates of supplier invoices
    // Based on user statement: "those invoices are clearly listed as invoices from suppliers, not invoices to customer in xero"
    console.log('=== CLEANUP ACTION ===\n');
    console.log('Strategy: Delete customer invoice entries that duplicate supplier invoices');
    console.log(`This will delete ${duplicates.length} customer invoice records\n`);

    if (!dryRun) {
      console.log('Executing cleanup...\n');

      const customerInvoiceIds = duplicates.map(d => d.customerInvoiceId);

      // Delete invoice items first
      const deletedItems = await prisma.customerInvoiceItem.deleteMany({
        where: { customerInvoiceId: { in: customerInvoiceIds } }
      });
      console.log(`✅ Deleted ${deletedItems.count} customer invoice items`);

      // Delete payments linked to these invoices
      const paymentsUpdate = await prisma.payment.updateMany({
        where: { customerInvoiceId: { in: customerInvoiceIds } },
        data: { customerInvoiceId: null }
      });
      console.log(`✅ Unlinked ${paymentsUpdate.count} payments`);

      // Delete the customer invoices
      const deletedInvoices = await prisma.customerInvoice.deleteMany({
        where: { id: { in: customerInvoiceIds } }
      });
      console.log(`✅ Deleted ${deletedInvoices.count} customer invoices\n`);

      console.log('✅ CLEANUP COMPLETE!\n');
    } else {
      console.log('(DRY RUN - no changes made)');
      console.log('Run with --execute flag to apply changes\n');
    }

    // Final summary
    console.log('=== SUMMARY ===');
    console.log(`Total duplicates: ${duplicates.length}`);
    console.log(`Customer invoices to delete: ${duplicates.length}`);
    console.log(`Supplier invoices to keep: ${duplicates.length}`);
    console.log(`\nResult: ${duplicates.length} supplier invoices will remain (correct)`);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

const dryRun = !process.argv.includes('--execute');
cleanupDuplicateInvoices(dryRun);
