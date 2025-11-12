
/**
 * Server-side geocoding API endpoint
 * This allows us to keep the API key secure on the server
 */

import { NextRequest, NextResponse } from 'next/server'

export interface GeocodeResult {
  latitude: number
  longitude: number
  formattedAddress: string
}

async function geocode(address: string) {
  if (!address || typeof address !== 'string' || address.trim() === '') {
    return NextResponse.json(
      { error: 'Address is required' },
      { status: 400 }
    )
  }

  // Use server-side API key (without referer restrictions)
  // GOOGLE_MAPS_SERVER_API_KEY should be configured with IP restrictions, not HTTP referer restrictions
  const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY || process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  if (!apiKey || apiKey === '' || apiKey === 'YOUR_GOOGLE_MAPS_API_KEY_HERE') {
    console.error('[Server Geocoding] Google Maps API key not configured')
    return NextResponse.json(
      { error: 'Google Maps API key is not configured on the server' },
      { status: 500 }
    )
  }
  
  console.log('[Server Geocoding] Using API key:', apiKey.substring(0, 10) + '...')
  console.log('[Server Geocoding] Geocoding address:', address)

  const encodedAddress = encodeURIComponent(address.trim())
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${apiKey}`

  const response = await fetch(url)

  if (!response.ok) {
    console.error('[Server Geocoding] HTTP error:', response.status, response.statusText)
    return NextResponse.json(
      { error: `Geocoding API returned ${response.status}` },
      { status: response.status }
    )
  }

  const data = await response.json()
  console.log('[Server Geocoding] API Response status:', data.status)

  if (data.status === 'OVER_QUERY_LIMIT') {
    console.error('[Server Geocoding] Quota exceeded')
    return NextResponse.json(
      { error: 'Google Maps API quota exceeded. Please try again later.' },
      { status: 429 }
    )
  }

  if (data.status === 'REQUEST_DENIED') {
    console.error('[Server Geocoding] Request denied:', data.error_message)
    console.error('[Server Geocoding] This usually means:')
    console.error('  1. The Geocoding API is not enabled in Google Cloud Console')
    console.error('  2. The API key has incorrect restrictions (IP/HTTP referer)')
    console.error('  3. The API key is invalid or expired')
    console.error('[Server Geocoding] API key (first 20 chars):', apiKey.substring(0, 20) + '...')
    return NextResponse.json(
      { 
        error: `Google Maps API access denied: ${data.error_message || 'Unknown reason'}`,
        troubleshooting: {
          possibleCauses: [
            'Geocoding API not enabled in Google Cloud Console',
            'API key has incorrect restrictions',
            'API key is invalid or expired'
          ],
          instructions: 'Please enable the Geocoding API in Google Cloud Console and check API key restrictions'
        }
      },
      { status: 403 }
    )
  }

  if (data.status === 'OK' && data.results && data.results.length > 0) {
    const location = data.results[0].geometry.location
    const result: GeocodeResult = {
      latitude: location.lat,
      longitude: location.lng,
      formattedAddress: data.results[0].formatted_address,
    }

    console.log('[Server Geocoding] ✅ Success! Coordinates:', `${result.latitude}, ${result.longitude}`)
    return NextResponse.json(result)
  }

  if (data.status === 'ZERO_RESULTS') {
    console.warn('[Server Geocoding] No results found for address:', address)
    return NextResponse.json(
      { error: 'No results found for this address' },
      { status: 404 }
    )
  }

  console.error('[Server Geocoding] Unexpected status:', data.status)
  return NextResponse.json(
    { error: `Unexpected geocoding status: ${data.status}` },
    { status: 500 }
  )
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const address = searchParams.get('address')

    if (!address) {
      return NextResponse.json(
        { error: 'Address parameter is required' },
        { status: 400 }
      )
    }

    return await geocode(address)
  } catch (error) {
    console.error('[Server Geocoding] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { address } = body

    if (!address) {
      return NextResponse.json(
        { error: 'Address is required' },
        { status: 400 }
      )
    }

    return await geocode(address)
  } catch (error) {
    console.error('[Server Geocoding] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}



