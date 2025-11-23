require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDuplicateInvoiceTypes() {
  try {
    console.log('=== CHECKING DUPLICATE INVOICE TYPES ===\n');

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
        customerId: true,
        totalAmount: true,
        Customer: {
          select: {
            name: true,
            xeroContactId: true
          }
        }
      }
    });

    console.log(`Found ${customerInvoices.length} customer invoices with Xero ID\n`);

    // Check how many have ACCPAY type (which should be supplier invoices)
    const wrongTypeInCustomer = customerInvoices.filter(inv => inv.xeroType === 'ACCPAY');
    console.log(`❌ Found ${wrongTypeInCustomer.length} invoices in CustomerInvoice table with ACCPAY type (should be in SupplierInvoice)\n`);

    if (wrongTypeInCustomer.length > 0) {
      console.log('Sample of misplaced invoices:');
      wrongTypeInCustomer.slice(0, 10).forEach(inv => {
        console.log(`  - ${inv.invoiceNumber} (Xero ID: ${inv.xeroInvoiceId}, Type: ${inv.xeroType})`);
        console.log(`    Customer: ${inv.Customer?.name}, Total: $${inv.totalAmount}`);
      });
      console.log('');
    }

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
        supplierId: true,
        totalAmount: true,
        Supplier: {
          select: {
            name: true,
            xeroContactId: true
          }
        }
      }
    });

    console.log(`Found ${supplierInvoices.length} supplier invoices with Xero ID\n`);

    // Check how many have ACCREC type (which should be customer invoices)
    const wrongTypeInSupplier = supplierInvoices.filter(inv => inv.xeroType === 'ACCREC');
    console.log(`❌ Found ${wrongTypeInSupplier.length} invoices in SupplierInvoice table with ACCREC type (should be in CustomerInvoice)\n`);

    // Find exact duplicates (same xeroInvoiceId in both tables)
    const duplicateXeroIds = new Set();
    customerInvoices.forEach(custInv => {
      const matchingSupplierInv = supplierInvoices.find(suppInv => suppInv.xeroInvoiceId === custInv.xeroInvoiceId);
      if (matchingSupplierInv) {
        duplicateXeroIds.add(custInv.xeroInvoiceId);
      }
    });

    console.log(`\n=== SUMMARY ===`);
    console.log(`Total duplicate Xero Invoice IDs: ${duplicateXeroIds.size}`);
    console.log(`CustomerInvoice entries with ACCPAY type: ${wrongTypeInCustomer.length}`);
    console.log(`SupplierInvoice entries with ACCREC type: ${wrongTypeInSupplier.length}`);

    // Detailed analysis of duplicates
    console.log(`\n=== ANALYZING DUPLICATES ===\n`);
    let count = 0;
    for (const xeroInvId of Array.from(duplicateXeroIds).slice(0, 10)) {
      const custInv = customerInvoices.find(inv => inv.xeroInvoiceId === xeroInvId);
      const suppInv = supplierInvoices.find(inv => inv.xeroInvoiceId === xeroInvId);

      if (custInv && suppInv) {
        count++;
        console.log(`${count}. Xero Invoice ID: ${xeroInvId}`);
        console.log(`   Customer Invoice: ${custInv.invoiceNumber} (Type: ${custInv.xeroType || 'N/A'})`);
        console.log(`     - Customer: ${custInv.Customer?.name}`);
        console.log(`     - Amount: $${custInv.totalAmount}`);
        console.log(`   Supplier Invoice: ${suppInv.invoiceNumber} (Type: ${suppInv.xeroType || 'N/A'})`);
        console.log(`     - Supplier: ${suppInv.Supplier?.name}`);
        console.log(`     - Amount: $${suppInv.totalAmount}`);
        console.log('');
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDuplicateInvoiceTypes();
