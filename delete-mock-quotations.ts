// Script to delete mock quotations Q25-11-00014 and Q25-11-00009
// Run this with: npx ts-node delete-mock-quotations.ts

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function deleteMockQuotations() {
  console.log('Starting to delete mock quotations...')
  
  const quotationsToDelete = ['Q25-11-00014', 'Q25-11-00009']
  
  for (const quotationNumber of quotationsToDelete) {
    try {
      console.log(`\nSearching for quotation: ${quotationNumber}`)
      
      // Find the quotation
      const quotation = await prisma.quotation.findFirst({
        where: {
          quotationNumber: quotationNumber
        },
        select: {
          id: true,
          quotationNumber: true,
          title: true,
          status: true,
          Customer: {
            select: {
              name: true
            }
          }
        }
      })
      
      if (!quotation) {
        console.log(`  [!] Quotation ${quotationNumber} not found`)
        continue
      }
      
      console.log(`  [*] Found quotation:`)
      console.log(`      ID: ${quotation.id}`)
      console.log(`      Number: ${quotation.quotationNumber}`)
      console.log(`      Title: ${quotation.title}`)
      console.log(`      Client: ${quotation.Customer.name}`)
      console.log(`      Status: ${quotation.status}`)
      
      // Delete related records first (if any)
      console.log(`  [*] Deleting related records...`)
      
      // Delete quotation items
      const deletedItems = await prisma.quotationItem.deleteMany({
        where: { quotationId: quotation.id }
      })
      console.log(`      - Deleted ${deletedItems.count} quotation items`)
      
      // Delete the quotation
      console.log(`  [*] Deleting quotation...`)
      await prisma.quotation.delete({
        where: { id: quotation.id }
      })
      
      console.log(`  [OK] Successfully deleted quotation ${quotationNumber}`)
      
    } catch (error) {
      console.error(`  [X] Error deleting quotation ${quotationNumber}:`, error)
    }
  }
  
  console.log('\n============================================')
  console.log('Deletion complete!')
  console.log('============================================')
  
  // Verify deletion
  console.log('\nVerifying deletion...')
  for (const quotationNumber of quotationsToDelete) {
    const exists = await prisma.quotation.findFirst({
      where: { quotationNumber: quotationNumber }
    })
    
    if (exists) {
      console.log(`  [!] WARNING: ${quotationNumber} still exists in database`)
    } else {
      console.log(`  [OK] ${quotationNumber} successfully removed`)
    }
  }
}

deleteMockQuotations()
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

