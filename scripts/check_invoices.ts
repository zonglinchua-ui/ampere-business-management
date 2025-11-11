import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const customerCount = await prisma.customerInvoice.count()
  const supplierCount = await prisma.supplierInvoice.count()
  const xeroSupplierCount = await prisma.supplierInvoice.count({
    where: { isXeroSynced: true }
  })
  
  console.log('\n=== Invoice Counts ===')
  console.log('Customer Invoices:', customerCount)
  console.log('Supplier Invoices:', supplierCount)
  console.log('Xero-synced Supplier Invoices:', xeroSupplierCount)
  
  if (supplierCount > 0) {
    const samples = await prisma.supplierInvoice.findMany({
      take: 5,
      include: { Supplier: { select: { name: true } } },
      orderBy: { createdAt: 'desc' }
    })
    
    console.log('\n=== Sample Supplier Invoices ===')
    samples.forEach(s => console.log(`  - ${s.invoiceNumber} | ${s.Supplier?.name} | $${s.totalAmount} | Xero: ${s.isXeroSynced}`))
  }
}

main().finally(() => prisma.$disconnect())
