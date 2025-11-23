
/**
 * Client-side geocoding utilities
 * Uses server-side API endpoint to keep API key secure
 */

export interface GeocodeResult {
  latitude: number
  longitude: number
  formattedAddress: string
}

/**
 * Geocode an address using the server-side API endpoint
 * This keeps the API key secure on the server
 */
export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  if (!address || address.trim() === '') {
    return null
  }

  try {
    console.log('[Client Geocoding] Starting geocoding for address:', address)

    const response = await fetch('/api/geocode', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ address: address.trim() }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      console.error('[Client Geocoding] Server returned error:', errorData.error)
      
      if (response.status === 404) {
        console.warn('[Client Geocoding] No results found for address:', address)
        return null
      }
      
      throw new Error(errorData.error || `Server returned ${response.status}`)
    }

    const result: GeocodeResult = await response.json()
    console.log('[Client Geocoding] ✅ Success! Coordinates:', `${result.latitude}, ${result.longitude}`)
    return result
  } catch (error) {
    console.error('[Client Geocoding] Error occurred:', error)
    if (error instanceof Error) {
      console.error('[Client Geocoding] Error message:', error.message)
      throw error
    }
    return null
  }
}

/**
 * Geocode an address with retry logic
 */
export async function geocodeAddressWithRetry(
  address: string,
  maxRetries: number = 2
): Promise<GeocodeResult | null> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await geocodeAddress(address)
      return result
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error')
      
      if (error instanceof Error && error.message.includes('quota exceeded')) {
        // Don't retry on quota errors
        throw error
      }

      if (attempt < maxRetries) {
        // Wait before retrying (exponential backoff)
        const delay = Math.pow(2, attempt) * 1000
        console.log(`[Client Geocoding] Retry ${attempt + 1}/${maxRetries} after ${delay}ms`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  if (lastError) {
    throw lastError
  }

  return null
}

