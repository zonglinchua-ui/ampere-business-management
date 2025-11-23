const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDualTypeInvoices() {
  try {
    // Find dual-type contacts
    const dualTypeContacts = await prisma.contact.findMany({
      where: {
        isCustomer: true,
        isSupplier: true,
        deletedAt: null
      },
      select: {
        id: true,
        name: true,
        xeroContactId: true,
        isCustomer: true,
        isSupplier: true
      },
      orderBy: { name: 'asc' }
    });

    console.log('=== DUAL-TYPE CONTACTS ===');
    console.log(`Found ${dualTypeContacts.length} contacts that are both customers and suppliers\n`);
    
    if (dualTypeContacts.length > 0) {
      dualTypeContacts.forEach(c => {
        console.log(`- ${c.name} (ID: ${c.id}, Xero: ${c.xeroContactId})`);
      });
      
      // Get invoices for these dual-type contacts
      const dualTypeContactIds = dualTypeContacts.map(c => c.id);
      
      const invoices = await prisma.invoice.findMany({
        where: {
          contactId: { in: dualTypeContactIds },
          deletedAt: null
        },
        select: {
          id: true,
          invoiceNumber: true,
          type: true,
          status: true,
          total: true,
          contactId: true,
          contact: {
            select: {
              id: true,
              name: true,
              isCustomer: true,
              isSupplier: true
            }
          }
        },
        orderBy: [
          { contactId: 'asc' },
          { type: 'asc' },
          { invoiceNumber: 'asc' }
        ]
      });
      
      console.log(`\n=== INVOICES FOR DUAL-TYPE CONTACTS ===`);
      console.log(`Total invoices: ${invoices.length}\n`);
      
      // Group by contact and type
      const byContact = {};
      invoices.forEach(inv => {
        const contactName = inv.contact.name;
        if (!byContact[contactName]) {
          byContact[contactName] = { ACCREC: [], ACCPAY: [] };
        }
        byContact[contactName][inv.type].push(inv);
      });
      
      // Display breakdown
      for (const [contactName, types] of Object.entries(byContact)) {
        console.log(`\n${contactName}:`);
        console.log(`  - Customer Invoices (ACCREC): ${types.ACCREC.length}`);
        console.log(`  - Supplier Invoices (ACCPAY): ${types.ACCPAY.length}`);
        
        if (types.ACCPAY.length > 0) {
          console.log(`  Supplier Invoice Numbers:`);
          types.ACCPAY.slice(0, 5).forEach(inv => {
            console.log(`    - ${inv.invoiceNumber} (${inv.status}, $${inv.total})`);
          });
          if (types.ACCPAY.length > 5) {
            console.log(`    ... and ${types.ACCPAY.length - 5} more`);
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

checkDualTypeInvoices();
