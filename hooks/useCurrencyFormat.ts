
'use client'

import { useCallback } from 'react'

/**
 * Currency formatting hook
 * Provides consistent currency formatting across the application
 * 
 * @param currency - Currency code (default: 'USD')
 * @param locale - Locale code (default: 'en-US')
 * @returns Object with formatCurrency function
 */
export function useCurrencyFormat(currency: string = 'USD', locale: string = 'en-US') {
  const formatCurrency = useCallback((value: number | null | undefined): string => {
    // Handle invalid inputs
    if (value === null || value === undefined || isNaN(value)) {
      return '$0.00'
    }

    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value)
    } catch (error) {
      console.error('Currency formatting error:', error)
      // Fallback to simple formatting
      return `$${value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
    }
  }, [currency, locale])

  return { formatCurrency }
}
