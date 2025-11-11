
import { prisma } from './db'

/**
 * Generate next customer number in format C-0001
 * Supports both new format (C-0001) and legacy format (AE-C-001)
 */
export async function generateCustomerNumber(): Promise<string> {
  // Get all customer numbers to find the highest
  const allCustomers = await prisma.customer.findMany({
    where: {
      customerNumber: {
        not: null,
      },
    },
    select: {
      customerNumber: true,
    },
    orderBy: {
      customerNumber: 'desc',
    },
  })

  let highestNumber = 0

  // Parse all customer numbers to find the highest sequential number
  for (const customer of allCustomers) {
    if (!customer.customerNumber) continue

    // Try new format: C-0001
    let match = customer.customerNumber.match(/^C-(\d+)$/)
    if (match) {
      const num = parseInt(match[1], 10)
      if (num > highestNumber) highestNumber = num
      continue
    }

    // Also check legacy format: AE-C-001
    match = customer.customerNumber.match(/AE-C-(\d+)/)
    if (match) {
      const num = parseInt(match[1], 10)
      if (num > highestNumber) highestNumber = num
    }
  }

  // Increment and format with 4-digit zero-padding
  const nextNumber = highestNumber + 1
  return `C-${nextNumber.toString().padStart(4, '0')}`
}

// Legacy function for backward compatibility - redirects to generateCustomerNumber
export async function generateClientNumber(): Promise<string> {
  return generateCustomerNumber()
}

/**
 * Generate next supplier number in format S1001
 * Supports both current format (S1001) and legacy format (AE-S-001)
 */
export async function generateSupplierNumber(): Promise<string> {
  // Get all supplier numbers to find the highest
  const allSuppliers = await prisma.supplier.findMany({
    where: {
      supplierNumber: {
        not: null,
      },
    },
    select: {
      supplierNumber: true,
    },
    orderBy: {
      supplierNumber: 'desc',
    },
  })

  let highestNumber = 0

  // Parse all supplier numbers to find the highest sequential number
  for (const supplier of allSuppliers) {
    if (!supplier.supplierNumber) continue

    // Try current format: S1001 (without dash)
    let match = supplier.supplierNumber.match(/^S(\d+)$/)
    if (match) {
      const num = parseInt(match[1], 10)
      if (num > highestNumber) highestNumber = num
      continue
    }

    // Also check legacy format: AE-S-001
    match = supplier.supplierNumber.match(/AE-S-(\d+)/)
    if (match) {
      const num = parseInt(match[1], 10)
      if (num > highestNumber) highestNumber = num
      continue
    }

    // Also check dash format for backwards compatibility: S-0001
    match = supplier.supplierNumber.match(/^S-(\d+)$/)
    if (match) {
      const num = parseInt(match[1], 10)
      if (num > highestNumber) highestNumber = num
    }
  }

  // Increment and format - use the existing SXXXX format (no dash, no zero-padding)
  const nextNumber = highestNumber + 1
  return `S${nextNumber}`
}

// Legacy function for backward compatibility - redirects to generateSupplierNumber
/**
 * Generate invoice number with format INV-YYYY-####
 * Works for both customer and supplier invoices
 */
export async function generateInvoiceNumber(type: 'CUSTOMER' | 'SUPPLIER' = 'CUSTOMER'): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = type === 'CUSTOMER' ? 'INV' : 'SINV'
  
  // Check both legacy and customer invoices for the highest number
  const lastCustomerInvoice = await prisma.customerInvoice.findFirst({
    where: {
      invoiceNumber: {
        startsWith: `${prefix}-${year}-`,
      },
    },
    orderBy: {
      invoiceNumber: 'desc',
    },
  })

  const lastLegacyInvoice = await prisma.legacyInvoice.findFirst({
    where: {
      invoiceNumber: {
        startsWith: `${prefix}-${year}-`,
      },
    },
    orderBy: {
      invoiceNumber: 'desc',
    },
  })

  let sequence = 1
  const customerSeq = lastCustomerInvoice 
    ? parseInt(lastCustomerInvoice.invoiceNumber.split('-').pop() || '0')
    : 0
  const legacySeq = lastLegacyInvoice
    ? parseInt(lastLegacyInvoice.invoiceNumber.split('-').pop() || '0')
    : 0
  
  sequence = Math.max(customerSeq, legacySeq) + 1

  return `${prefix}-${year}-${sequence.toString().padStart(4, '0')}`
}

export async function generateVendorNumber(): Promise<string> {
  return generateSupplierNumber()
}

/**
 * Generate next job sheet number in format CS-25-10-XXXX
 * XXXX is a global running number across all projects
 */
export async function generateNextJobSheetNumber(): Promise<string> {
  // Get all job sheets with numbers
  const allJobSheets = await prisma.serviceJobSheet.findMany({
    where: {
      jobSheetNumber: {
        not: null,
      },
    },
    select: {
      jobSheetNumber: true,
    },
    orderBy: {
      jobSheetNumber: 'desc',
    },
  })

  let highestNumber = 0

  // Parse all job sheet numbers to find the highest sequential number
  for (const sheet of allJobSheets) {
    if (!sheet.jobSheetNumber) continue

    // Try format: CS-25-10-0001
    const match = sheet.jobSheetNumber.match(/^CS-25-10-(\d{4})$/)
    if (match) {
      const num = parseInt(match[1], 10)
      if (num > highestNumber) highestNumber = num
    }
  }

  // Increment and format with 4-digit zero-padding
  const nextNumber = highestNumber + 1
  return `CS-25-10-${nextNumber.toString().padStart(4, '0')}`
}
