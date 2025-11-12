/**
 * Script to retroactively geocode existing projects with addresses but no coordinates
 * 
 * Usage:
 *   npx ts-node scripts/geocode-existing-projects.ts
 * 
 * Or add to package.json scripts:
 *   "geocode-projects": "ts-node scripts/geocode-existing-projects.ts"
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function geocodeAddress(address: string): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY || process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

    if (!apiKey || apiKey === 'YOUR_GOOGLE_MAPS_API_KEY_HERE') {
      console.error('❌ Google Maps API key not configured')
      return null
    }

    const encodedAddress = encodeURIComponent(address.trim())
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${apiKey}`

    const response = await fetch(url)
    const data = await response.json()

    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const location = data.results[0].geometry.location
      return {
        latitude: location.lat,
        longitude: location.lng,
      }
    }

    console.warn(`⚠️  Geocoding failed for address: ${address} (Status: ${data.status})`)
    return null
  } catch (error) {
    console.error(`❌ Error geocoding address: ${address}`, error)
    return null
  }
}

async function main() {
  console.log('🗺️  Starting geocoding of existing projects...\n')

  // Find all projects with addresses but no coordinates
  const projectsNeedingGeocoding = await prisma.project.findMany({
    where: {
      address: {
        not: null,
      },
      OR: [
        { latitude: null },
        { longitude: null },
      ],
      isActive: true,
    },
    select: {
      id: true,
      projectNumber: true,
      name: true,
      address: true,
      city: true,
      postalCode: true,
      country: true,
    },
  })

  console.log(`📊 Found ${projectsNeedingGeocoding.length} projects needing geocoding\n`)

  if (projectsNeedingGeocoding.length === 0) {
    console.log('✅ All projects already have coordinates!')
    return
  }

  let successCount = 0
  let failCount = 0

  for (const project of projectsNeedingGeocoding) {
    console.log(`\n🔍 Processing: ${project.projectNumber} - ${project.name}`)
    console.log(`   Address: ${project.address}`)

    // Build full address for better geocoding accuracy
    const fullAddress = [
      project.address,
      project.city,
      project.postalCode,
      project.country || 'Singapore',
    ]
      .filter(Boolean)
      .join(', ')

    const coordinates = await geocodeAddress(fullAddress)

    if (coordinates) {
      await prisma.project.update({
        where: { id: project.id },
        data: {
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
        },
      })

      console.log(`   ✅ Geocoded: ${coordinates.latitude}, ${coordinates.longitude}`)
      successCount++
    } else {
      console.log(`   ❌ Failed to geocode`)
      failCount++
    }

    // Add a small delay to avoid hitting API rate limits
    await new Promise((resolve) => setTimeout(resolve, 200))
  }

  console.log(`\n\n📈 Summary:`)
  console.log(`   ✅ Successfully geocoded: ${successCount}`)
  console.log(`   ❌ Failed: ${failCount}`)
  console.log(`   📊 Total processed: ${projectsNeedingGeocoding.length}`)
}

main()
  .catch((error) => {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

