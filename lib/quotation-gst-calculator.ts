
/**
 * Quotation GST Calculator - Ensures proper tax calculations
 * Fixes missing GST calculations in quotation PDFs
 */

export interface QuotationItem {
  description: string
  quantity: number
  unitPrice: number
  totalPrice?: number
}

export interface GSTCalculation {
  subtotal: number
  gstAmount: number
  totalAmount: number
  gstRate: number
}

export interface QuotationSummary {
  subtotal: number
  gstAmount: number
  totalAmount: number
  gstRate: number
  items: QuotationItem[]
}

/**
 * Default GST rate for Singapore
 */
const DEFAULT_GST_RATE = 0.09 // 9%

/**
 * Calculate GST for quotation items
 */
export function calculateQuotationGST(
  items: QuotationItem[],
  gstRate: number = DEFAULT_GST_RATE
): GSTCalculation {
  // Calculate subtotal from items
  const subtotal = items.reduce((total, item) => {
    const itemTotal = item.totalPrice || (item.quantity * item.unitPrice)
    return total + itemTotal
  }, 0)

  // Calculate GST amount
  const gstAmount = subtotal * gstRate

  // Calculate total amount
  const totalAmount = subtotal + gstAmount

  return {
    subtotal: Number(subtotal.toFixed(2)),
    gstAmount: Number(gstAmount.toFixed(2)),
    totalAmount: Number(totalAmount.toFixed(2)),
    gstRate
  }
}

/**
 * Calculate complete quotation summary with proper GST
 */
export function calculateQuotationSummary(
  items: QuotationItem[],
  gstRate: number = DEFAULT_GST_RATE
): QuotationSummary {
  // Ensure all items have totalPrice calculated
  const processedItems = items.map(item => ({
    ...item,
    totalPrice: item.totalPrice || (item.quantity * item.unitPrice)
  }))

  // Calculate GST
  const gstCalculation = calculateQuotationGST(processedItems, gstRate)

  return {
    ...gstCalculation,
    items: processedItems
  }
}

/**
 * Validate quotation data has proper calculations
 */
export function validateQuotationCalculations(quotationData: any): {
  isValid: boolean
  errors: string[]
  correctedData?: any
} {
  const errors: string[] = []

  // Check if items exist
  if (!quotationData.items || !Array.isArray(quotationData.items)) {
    errors.push('Quotation must have items array')
    return { isValid: false, errors }
  }

  // Check if items are valid
  for (const item of quotationData.items) {
    if (!item.quantity || item.quantity <= 0) {
      errors.push(`Item "${item.description}" must have valid quantity`)
    }
    if (!item.unitPrice || item.unitPrice <= 0) {
      errors.push(`Item "${item.description}" must have valid unit price`)
    }
  }

  if (errors.length > 0) {
    return { isValid: false, errors }
  }

  // Calculate proper summary
  const summary = calculateQuotationSummary(quotationData.items)

  // Check if existing calculations match
  const subtotalDiff = Math.abs(quotationData.subtotal - summary.subtotal)
  const gstDiff = Math.abs((quotationData.taxAmount || 0) - summary.gstAmount)
  const totalDiff = Math.abs(quotationData.totalAmount - summary.totalAmount)

  const tolerance = 0.01 // 1 cent tolerance

  if (subtotalDiff > tolerance) {
    errors.push(`Subtotal mismatch: expected ${summary.subtotal}, got ${quotationData.subtotal}`)
  }
  if (gstDiff > tolerance) {
    errors.push(`GST mismatch: expected ${summary.gstAmount}, got ${quotationData.taxAmount || 0}`)
  }
  if (totalDiff > tolerance) {
    errors.push(`Total mismatch: expected ${summary.totalAmount}, got ${quotationData.totalAmount}`)
  }

  // Return corrected data if there are calculation errors
  const correctedData = errors.length > 0 ? {
    ...quotationData,
    subtotal: summary.subtotal,
    taxAmount: summary.gstAmount,
    totalAmount: summary.totalAmount,
    items: summary.items
  } : quotationData

  return {
    isValid: errors.length === 0,
    errors,
    correctedData
  }
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number, currency: string = 'SGD'): string {
  return new Intl.NumberFormat('en-SG', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount)
}
