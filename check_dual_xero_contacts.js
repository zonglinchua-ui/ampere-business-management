require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDualXeroContacts() {
  try {
    console.log('=== CHECKING FOR DUAL-TYPE CONTACTS ===\n');

    // Get all customers with xeroContactId
    const customers = await prisma.customer.findMany({
      where: {
        xeroContactId: { not: null },
        deletedAt: null
      },
      select: {
        id: true,
        name: true,
        customerNumber: true,
        xeroContactId: true
      }
    });

    console.log(`Found ${customers.length} customers with Xero ID\n`);

    // Get all suppliers with xeroContactId
    const suppliers = await prisma.supplier.findMany({
      where: {
        xeroContactId: { not: null },
        deletedAt: null
      },
      select: {
        id: true,
        name: true,
        supplierNumber: true,
        xeroContactId: true
      }
    });

    console.log(`Found ${suppliers.length} suppliers with Xero ID\n`);

    // Find contacts that are both customers and suppliers (same xeroContactId)
    const dualContacts = [];
    for (const customer of customers) {
      const matchingSupplier = suppliers.find(s => s.xeroContactId === customer.xeroContactId);
      if (matchingSupplier) {
        dualContacts.push({
          xeroContactId: customer.xeroContactId,
          customer,
          supplier: matchingSupplier
        });
      }
    }

    console.log(`\n=== FOUND ${dualContacts.length} DUAL-TYPE CONTACTS ===\n`);

    if (dualContacts.length > 0) {
      for (const contact of dualContacts) {
        console.log(`Xero Contact ID: ${contact.xeroContactId}`);
        console.log(`  Customer: ${contact.customer.name} (${contact.customer.customerNumber})`);
        console.log(`  Supplier: ${contact.supplier.name} (${contact.supplier.supplierNumber})`);

        // Check invoices for this contact
        const customerInvoices = await prisma.customerInvoice.findMany({
          where: {
            customerId: contact.customer.id
          },
          select: {
            id: true,
            invoiceNumber: true,
            totalAmount: true,
            status: true,
            xeroInvoiceId: true
          }
        });

        const supplierInvoices = await prisma.supplierInvoice.findMany({
          where: {
            supplierId: contact.supplier.id
          },
          select: {
            id: true,
            invoiceNumber: true,
            totalAmount: true,
            status: true,
            xeroInvoiceId: true
          }
        });

        console.log(`  Customer Invoices: ${customerInvoices.length}`);
        if (customerInvoices.length > 0) {
          customerInvoices.slice(0, 3).forEach(inv => {
            console.log(`    - ${inv.invoiceNumber} ($${inv.totalAmount}, ${inv.status})`);
          });
          if (customerInvoices.length > 3) console.log(`    ... and ${customerInvoices.length - 3} more`);
        }

        console.log(`  Supplier Invoices: ${supplierInvoices.length}`);
        if (supplierInvoices.length > 0) {
          supplierInvoices.slice(0, 3).forEach(inv => {
            console.log(`    - ${inv.invoiceNumber} ($${inv.totalAmount}, ${inv.status})`);
          });
          if (supplierInvoices.length > 3) console.log(`    ... and ${supplierInvoices.length - 3} more`);
        }

        console.log('');
      }

      // Check if any supplier invoices are incorrectly stored as customer invoices
      console.log('\n=== CHECKING FOR MISMATCHED INVOICE TYPES ===\n');
      
      for (const contact of dualContacts) {
        const supplierInvoices = await prisma.supplierInvoice.findMany({
          where: {
            supplierId: contact.supplier.id,
            xeroInvoiceId: { not: null }
          },
          select: {
            xeroInvoiceId: true,
            invoiceNumber: true
          }
        });

        for (const supplierInv of supplierInvoices) {
          // Check if this Xero invoice also exists in customer invoices
          const duplicateInCustomer = await prisma.customerInvoice.findFirst({
            where: {
              xeroInvoiceId: supplierInv.xeroInvoiceId
            }
          });

          if (duplicateInCustomer) {
            console.log(`⚠️  DUPLICATE FOUND!`);
            console.log(`   Xero Invoice ID: ${supplierInv.xeroInvoiceId}`);
            console.log(`   Supplier Invoice: ${supplierInv.invoiceNumber}`);
            console.log(`   Also exists as Customer Invoice: ${duplicateInCustomer.invoiceNumber}`);
            console.log(`   Contact: ${contact.customer.name}\n`);
          }
        }
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDualXeroContacts();
