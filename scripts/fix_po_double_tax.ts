
/**
 * Fix Purchase Orders with double taxation
 * 
 * This script scans all POs and corrects any that have incorrect tax amounts
 * due to the double taxation bug (tax calculated at both item and PO level).
 * 
 * Usage:
 *   cd /home/ubuntu/ampere_business_management/app
 *   npx tsx --require dotenv/config scripts/fix_po_double_tax.ts
 * 
 * IMPORTANT: This script modifies data in the database. Make sure you have
 * a backup before running it.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixPODoubleTax() {
  try {
    console.log('🔍 Scanning all Purchase Orders for double taxation...\n')

    // Get all POs with their items
    const allPOs = await prisma.purchaseOrder.findMany({
      include: {
        PurchaseOrderItem: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    console.log(`Found ${allPOs.length} purchase orders\n`)

    const problematicPOs = []
    
    for (const po of allPOs) {
      // Calculate what the tax SHOULD be (sum of item taxes)
      const correctTax = po.PurchaseOrderItem.reduce((sum, item) => {
        return sum + Number(item.taxAmount || 0)
      }, 0)

      const currentTax = Number(po.taxAmount)
      const difference = Math.abs(currentTax - correctTax)

      // If difference is more than 1 cent, it's problematic
      if (difference > 0.01) {
        problematicPOs.push({
          id: po.id,
          poNumber: po.poNumber,
          currentTax,
          correctTax,
          difference,
          subtotal: Number(po.subtotal),
          currentTotal: Number(po.totalAmount)
        })
      }
    }

    if (problematicPOs.length === 0) {
      console.log('✅ No POs with double taxation found!')
      await prisma.$disconnect()
      return
    }

    console.log(`⚠️  Found ${problematicPOs.length} POs with incorrect tax:\n`)
    
    problematicPOs.forEach(po => {
      console.log(`PO: ${po.poNumber}`)
      console.log(`  Current tax: $${po.currentTax.toFixed(2)}`)
      console.log(`  Correct tax: $${po.correctTax.toFixed(2)}`)
      console.log(`  Difference: $${po.difference.toFixed(2)}`)
      console.log()
    })

    console.log('🔧 Fixing all problematic POs...\n')

    // Fix each PO
    for (const po of problematicPOs) {
      // Recalculate the total: subtotal + correctTax
      const correctTotal = po.subtotal + po.correctTax

      await prisma.purchaseOrder.update({
        where: { id: po.id },
        data: {
          taxAmount: po.correctTax,
          totalAmount: correctTotal
        }
      })

      console.log(`✅ Fixed ${po.poNumber}:`)
      console.log(`   Tax: $${po.currentTax.toFixed(2)} → $${po.correctTax.toFixed(2)}`)
      console.log(`   Total: $${po.currentTotal.toFixed(2)} → $${correctTotal.toFixed(2)}`)
      console.log()
    }

    console.log(`\n✅ Successfully fixed ${problematicPOs.length} Purchase Orders!`)
    console.log('The PDFs will now show the correct tax amounts.')

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

fixPODoubleTax()
