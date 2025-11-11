import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
 
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
}

/**
 * Format a number as currency with proper formatting
 * @param value - The numeric value to format
 * @param currencyCode - The currency code (default: 'USD')
 * @returns Formatted currency string (e.g., "$1,940.25")
 */
export function formatCurrency(value: number | string | null | undefined, currencyCode: 'USD' | 'SGD' = 'USD'): string {
  // Handle null, undefined, or empty values
  if (value === null || value === undefined || value === '') {
    return currencyCode === 'SGD' ? 'S$0.00' : '$0.00'
  }

  // Convert string to number if necessary, removing any non-numeric characters except decimal point
  let numericValue: number
  if (typeof value === 'string') {
    // Remove any existing currency symbols, commas, and leading zeros
    const cleanedValue = value.replace(/[^0-9.-]/g, '')
    numericValue = parseFloat(cleanedValue)
  } else {
    numericValue = value
  }

  // Handle NaN or invalid numbers
  if (isNaN(numericValue)) {
    return currencyCode === 'SGD' ? 'S$0.00' : '$0.00'
  }

  // Format with 2 decimal places and thousands separators
  const formatted = numericValue.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })

  // Add currency symbol
  const currencySymbol = currencyCode === 'SGD' ? 'S$' : '$'
  return `${currencySymbol}${formatted}`
}