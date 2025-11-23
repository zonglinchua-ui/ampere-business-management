
/**
 * Geocoding Cache Service
 * Stores geocoding results in localStorage to avoid repeated API calls
 */

interface GeocodeResult {
  address: string
  latitude: number
  longitude: number
  timestamp: number
}

const CACHE_KEY = 'geocode_cache'
const CACHE_EXPIRY = 30 * 24 * 60 * 60 * 1000 // 30 days in milliseconds

class GeocodingCache {
  private cache: Map<string, GeocodeResult>

  constructor() {
    this.cache = new Map()
    this.loadFromLocalStorage()
  }

  private loadFromLocalStorage() {
    if (typeof window === 'undefined') return

    try {
      const stored = localStorage.getItem(CACHE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        this.cache = new Map(Object.entries(parsed))
        
        // Clean expired entries
        this.cleanExpired()
      }
    } catch (error) {
      console.error('Error loading geocoding cache:', error)
    }
  }

  private saveToLocalStorage() {
    if (typeof window === 'undefined') return

    try {
      const obj = Object.fromEntries(this.cache)
      localStorage.setItem(CACHE_KEY, JSON.stringify(obj))
    } catch (error) {
      console.error('Error saving geocoding cache:', error)
    }
  }

  private cleanExpired() {
    const now = Date.now()
    let cleaned = false

    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > CACHE_EXPIRY) {
        this.cache.delete(key)
        cleaned = true
      }
    }

    if (cleaned) {
      this.saveToLocalStorage()
    }
  }

  get(address: string): GeocodeResult | null {
    const key = this.normalizeAddress(address)
    const result = this.cache.get(key)

    if (!result) return null

    // Check if expired
    if (Date.now() - result.timestamp > CACHE_EXPIRY) {
      this.cache.delete(key)
      this.saveToLocalStorage()
      return null
    }

    return result
  }

  set(address: string, latitude: number, longitude: number): void {
    const key = this.normalizeAddress(address)
    const result: GeocodeResult = {
      address,
      latitude,
      longitude,
      timestamp: Date.now(),
    }

    this.cache.set(key, result)
    this.saveToLocalStorage()
  }

  private normalizeAddress(address: string): string {
    // Normalize address for consistent caching
    return address.toLowerCase().trim().replace(/\s+/g, ' ')
  }

  clear(): void {
    this.cache.clear()
    if (typeof window !== 'undefined') {
      localStorage.removeItem(CACHE_KEY)
    }
  }

  getStats(): { size: number; oldestEntry: number | null } {
    if (this.cache.size === 0) {
      return { size: 0, oldestEntry: null }
    }

    let oldest = Date.now()
    for (const entry of this.cache.values()) {
      if (entry.timestamp < oldest) {
        oldest = entry.timestamp
      }
    }

    return {
      size: this.cache.size,
      oldestEntry: oldest,
    }
  }
}

export const geocodingCache = new GeocodingCache()

/**
 * Geocode an address using Google Maps Geocoding API
 * Uses cache to avoid repeated API calls
 */
export async function geocodeAddress(
  address: string,
  apiKey: string
): Promise<{ latitude: number; longitude: number } | null> {
  // Check cache first
  const cached = geocodingCache.get(address)
  if (cached) {
    console.log('Using cached geocoding result for:', address)
    return {
      latitude: cached.latitude,
      longitude: cached.longitude,
    }
  }

  // Call Google Geocoding API
  try {
    const encodedAddress = encodeURIComponent(address)
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${apiKey}`
    )

    if (!response.ok) {
      console.error('Geocoding API error:', response.status)
      return null
    }

    const data = await response.json()

    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const location = data.results[0].geometry.location
      const latitude = location.lat
      const longitude = location.lng

      // Store in cache
      geocodingCache.set(address, latitude, longitude)

      console.log('Geocoded address:', address, '→', { latitude, longitude })
      return { latitude, longitude }
    } else {
      console.error('Geocoding failed:', data.status, data.error_message)
      return null
    }
  } catch (error) {
    console.error('Error geocoding address:', error)
    return null
  }
}
