
/**
 * Check Purchase Orders for tax calculation issues
 * 
 * This script verifies that the tax amount stored in each PO matches
 * the sum of individual item taxes.
 * 
 * Usage:
 *   cd /home/ubuntu/ampere_business_management/app
 *   npx tsx --require dotenv/config scripts/check_po_tax.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkPOTax() {
  try {
    // You can modify this to check a specific PO
    const poNumberSearch = process.argv[2] || 'PO-007-GEN'

    const po = await prisma.purchaseOrder.findFirst({
      where: {
        poNumber: {
          contains: poNumberSearch
        }
      },
      include: {
        PurchaseOrderItem: true
      }
    })

    if (!po) {
      console.log(`PO matching "${poNumberSearch}" not found`)
      await prisma.$disconnect()
      return
    }

    console.log('\n=== Purchase Order Details ===')
    console.log('PO Number:', po.poNumber)
    console.log('Subtotal: $', Number(po.subtotal).toFixed(2))
    console.log('Tax Amount: $', Number(po.taxAmount).toFixed(2))
    console.log('Total Amount: $', Number(po.totalAmount).toFixed(2))

    console.log('\n=== Line Items ===')
    let itemTaxSum = 0
    po.PurchaseOrderItem.forEach((item, index) => {
      const itemTax = Number(item.taxAmount || 0)
      itemTaxSum += itemTax
      console.log(`\nItem ${index + 1}: ${item.description}`)
      console.log('  Quantity:', Number(item.quantity))
      console.log('  Unit Price: $', Number(item.unitPrice).toFixed(2))
      console.log('  Tax Rate:', Number(item.taxRate || 0), '%')
      console.log('  Tax Amount: $', itemTax.toFixed(2))
      console.log('  Total: $', Number(item.totalPrice).toFixed(2))
    })

    console.log('\n=== Tax Analysis ===')
    console.log('Sum of item taxes: $', itemTaxSum.toFixed(2))
    console.log('PO tax in DB: $', Number(po.taxAmount).toFixed(2))
    console.log('Difference: $', (Number(po.taxAmount) - itemTaxSum).toFixed(2))
    
    if (Math.abs(Number(po.taxAmount) - itemTaxSum) > 0.01) {
      console.log('\n⚠️  TAX MISMATCH DETECTED!')
      console.log('The PO has double taxation')
      console.log('Expected tax: $', itemTaxSum.toFixed(2))
      console.log('Actual tax in DB: $', Number(po.taxAmount).toFixed(2))
      console.log('Extra tax charged: $', (Number(po.taxAmount) - itemTaxSum).toFixed(2))
    } else {
      console.log('\n✅ Tax calculation is correct')
    }

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkPOTax()
