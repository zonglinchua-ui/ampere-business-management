
/**
 * Utility script to backfill missing customer and supplier numbers
 * for existing Xero-synced contacts
 */

import { prisma } from './db'
import { generateCustomerNumber, generateSupplierNumber } from './number-generation'

export interface BackfillResult {
  success: boolean
  message: string
  customersUpdated: number
  suppliersUpdated: number
  errors: string[]
}

/**
 * Backfill missing customer numbers for all clients without one
 */
export async function backfillCustomerNumbers(): Promise<BackfillResult> {
  const result: BackfillResult = {
    success: true,
    message: '',
    customersUpdated: 0,
    suppliersUpdated: 0,
    errors: []
  }

  try {
    // Find all customers without a customer number
    const customersWithoutNumber = await prisma.customer.findMany({
      where: {
        OR: [
          { customerNumber: null },
          { customerNumber: '' }
        ]
      },
      orderBy: {
        createdAt: 'asc' // Process oldest first
      }
    })

    console.log(`📊 Found ${customersWithoutNumber.length} customers without numbers`)

    for (const customer of customersWithoutNumber) {
      try {
        const customerNumber = await generateCustomerNumber()
        
        await prisma.customer.update({
          where: { id: customer.id },
          data: {
            customerNumber,
            updatedAt: new Date()
          }
        })

        console.log(`✅ Assigned ${customerNumber} to customer: ${customer.name}`)
        result.customersUpdated++
      } catch (error: any) {
        const errorMsg = `Failed to update customer ${customer.name}: ${error.message}`
        console.error(`❌ ${errorMsg}`)
        result.errors.push(errorMsg)
      }
    }

    result.message = `Successfully backfilled ${result.customersUpdated} customer numbers`
    return result

  } catch (error: any) {
    result.success = false
    result.message = `Failed to backfill customer numbers: ${error.message}`
    result.errors.push(error.message)
    return result
  }
}

/**
 * Backfill missing supplier numbers for all suppliers without one
 */
export async function backfillSupplierNumbers(): Promise<BackfillResult> {
  const result: BackfillResult = {
    success: true,
    message: '',
    customersUpdated: 0,
    suppliersUpdated: 0,
    errors: []
  }

  try {
    // Find all suppliers without a supplier number
    const suppliersWithoutNumber = await prisma.supplier.findMany({
      where: {
        OR: [
          { supplierNumber: null },
          { supplierNumber: '' }
        ]
      },
      orderBy: {
        createdAt: 'asc' // Process oldest first
      }
    })

    console.log(`📊 Found ${suppliersWithoutNumber.length} suppliers without numbers`)

    for (const supplier of suppliersWithoutNumber) {
      try {
        const supplierNumber = await generateSupplierNumber()
        
        await prisma.supplier.update({
          where: { id: supplier.id },
          data: {
            supplierNumber,
            updatedAt: new Date()
          }
        })

        console.log(`✅ Assigned ${supplierNumber} to supplier: ${supplier.name}`)
        result.suppliersUpdated++
      } catch (error: any) {
        const errorMsg = `Failed to update supplier ${supplier.name}: ${error.message}`
        console.error(`❌ ${errorMsg}`)
        result.errors.push(errorMsg)
      }
    }

    result.message = `Successfully backfilled ${result.suppliersUpdated} supplier numbers`
    return result

  } catch (error: any) {
    result.success = false
    result.message = `Failed to backfill supplier numbers: ${error.message}`
    result.errors.push(error.message)
    return result
  }
}

/**
 * Backfill all missing contact numbers (both customers and suppliers)
 */
export async function backfillAllContactNumbers(): Promise<BackfillResult> {
  console.log('🔄 Starting contact number backfill...')
  
  const customerResult = await backfillCustomerNumbers()
  const supplierResult = await backfillSupplierNumbers()
  
  const combinedResult: BackfillResult = {
    success: customerResult.success && supplierResult.success,
    message: `Backfilled ${customerResult.customersUpdated} customers and ${supplierResult.suppliersUpdated} suppliers`,
    customersUpdated: customerResult.customersUpdated,
    suppliersUpdated: supplierResult.suppliersUpdated,
    errors: [...customerResult.errors, ...supplierResult.errors]
  }

  if (combinedResult.errors.length > 0) {
    console.error(`❌ Backfill completed with ${combinedResult.errors.length} errors:`)
    combinedResult.errors.forEach(err => console.error(`  - ${err}`))
  } else {
    console.log(`✅ ${combinedResult.message}`)
  }

  return combinedResult
}
