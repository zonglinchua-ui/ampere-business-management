require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { XeroClient } = require('xero-node');

const prisma = new PrismaClient();

async function getXeroClient() {
  // Get active Xero integration
  const integration = await prisma.xeroIntegration.findFirst({
    where: { isActive: true }
  });

  if (!integration) {
    throw new Error('No active Xero integration found');
  }

  const xero = new XeroClient({
    clientId: process.env.XERO_CLIENT_ID,
    clientSecret: process.env.XERO_CLIENT_SECRET,
    redirectUris: [process.env.XERO_REDIRECT_URI || 'https://ampere.abacusai.app/api/xero/callback'],
    scopes: process.env.XERO_SCOPES?.split(' ') || [
      'offline_access',
      'accounting.transactions',
      'accounting.contacts',
      'accounting.settings'
    ]
  });

  // Set token set
  await xero.setTokenSet({
    access_token: integration.accessToken,
    refresh_token: integration.refreshToken,
    expires_at: Math.floor(integration.expiresAt.getTime() / 1000)
  });

  return { xero, tenantId: integration.tenantId };
}

async function verifyInvoiceWithXero(xeroInvoiceId) {
  try {
    const { xero, tenantId } = await getXeroClient();
    
    // Get invoice from Xero
    const response = await xero.accountingApi.getInvoice(tenantId, xeroInvoiceId);
    const invoice = response.body.invoices?.[0];
    
    if (!invoice) {
      return null;
    }

    return {
      invoiceID: invoice.invoiceID,
      invoiceNumber: invoice.invoiceNumber,
      type: invoice.type,
      contactName: invoice.contact?.name
    };
  } catch (error) {
    console.error(`Error verifying invoice ${xeroInvoiceId}:`, error.message);
    return null;
  }
}

async function fixDuplicateInvoices(dryRun = true) {
  try {
    console.log('=== FIXING DUPLICATE INVOICES ===\n');
    console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE (will delete duplicates)'}\n`);

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
          select: { name: true }
        }
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
        supplierId: true,
        totalAmount: true,
        Supplier: {
          select: { name: true }
        }
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

    if (duplicates.length === 0) {
      console.log('No duplicates to fix!');
      return;
    }

    // Verify a sample with Xero (first 5)
    console.log('=== VERIFYING SAMPLE WITH XERO ===\n');
    for (let i = 0; i < Math.min(5, duplicates.length); i++) {
      const dup = duplicates[i];
      console.log(`${i + 1}. Checking invoice ${dup.xeroInvoiceId}...`);
      
      const xeroData = await verifyInvoiceWithXero(dup.xeroInvoiceId);
      if (xeroData) {
        console.log(`   Xero says: Type=${xeroData.type}, Number=${xeroData.invoiceNumber}, Contact=${xeroData.contactName}`);
        console.log(`   CustomerInvoice: Type=${dup.customerInvoice.xeroType}, Contact=${dup.customerInvoice.Customer?.name}`);
        console.log(`   SupplierInvoice: Type=${dup.supplierInvoice.xeroType}, Contact=${dup.supplierInvoice.Supplier?.name}`);
        
        // Determine which is correct
        if (xeroData.type === 'ACCPAY' && dup.supplierInvoice.xeroType === 'ACCPAY') {
          console.log(`   ✅ Supplier invoice is CORRECT, customer invoice should be DELETED`);
        } else if (xeroData.type === 'ACCREC' && dup.customerInvoice.xeroType === 'ACCREC') {
          console.log(`   ✅ Customer invoice is CORRECT, supplier invoice should be DELETED`);
        } else {
          console.log(`   ⚠️  MISMATCH: Xero=${xeroData.type}, need manual review`);
        }
      } else {
        console.log(`   ❌ Could not verify with Xero`);
      }
      console.log('');
    }

    // Strategy: Based on user complaint and data analysis
    // User says "supplier invoices are showing in customer invoices"
    // So we should keep the supplier invoices (ACCPAY) and delete the customer invoice duplicates (ACCREC)
    
    console.log('\n=== CLEANUP STRATEGY ===\n');
    console.log('Based on verification and user complaint:');
    console.log('- KEEP: Supplier invoices with type ACCPAY');
    console.log('- DELETE: Customer invoices that are duplicates of supplier invoices\n');

    const toDelete = duplicates.map(dup => dup.customerInvoice.id);
    console.log(`Will delete ${toDelete.length} customer invoice records`);

    if (!dryRun) {
      console.log('\nDeleting duplicate customer invoices...');
      
      // Delete related items first
      const deleteItems = await prisma.customerInvoiceItem.deleteMany({
        where: {
          customerInvoiceId: { in: toDelete }
        }
      });
      console.log(`Deleted ${deleteItems.count} customer invoice items`);

      // Delete the invoices
      const deleteInvoices = await prisma.customerInvoice.deleteMany({
        where: {
          id: { in: toDelete }
        }
      });
      console.log(`Deleted ${deleteInvoices.count} customer invoices`);

      console.log('\n✅ Cleanup complete!');
    } else {
      console.log('\n(DRY RUN - no changes made)');
      console.log('Run with dryRun=false to apply changes');
    }

    // Show summary
    console.log('\n=== SUMMARY ===');
    console.log(`Total duplicates found: ${duplicates.length}`);
    console.log(`Customer invoices to delete: ${toDelete.length}`);
    console.log(`Supplier invoices to keep: ${duplicates.length}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run with dry run first
const dryRun = process.argv[2] !== '--execute';
fixDuplicateInvoices(dryRun);
