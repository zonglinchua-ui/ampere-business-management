require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Geocode using the API endpoint
async function geocodeAddress(address) {
  try {
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const response = await fetch(
      `${baseUrl}/api/geocode?address=${encodeURIComponent(address)}`
    );
    
    if (!response.ok) {
      console.error(`Failed to geocode: ${address} - Status: ${response.status}`);
      return null;
    }

    const data = await response.json();
    
    if (data.latitude && data.longitude) {
      return {
        latitude: data.latitude,
        longitude: data.longitude,
      };
    }

    return null;
  } catch (error) {
    console.error(`Error geocoding ${address}:`, error.message);
    return null;
  }
}

// Geocode using Google Maps API directly
async function geocodeDirectly(address) {
  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    
    if (!apiKey) {
      console.error('No Google Maps API key found');
      return null;
    }

    const encodedAddress = encodeURIComponent(address);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${apiKey}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`Geocoding API error: ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      return {
        latitude: location.lat,
        longitude: location.lng,
      };
    } else {
      console.error(`Geocoding failed for ${address}: ${data.status}`);
      return null;
    }
  } catch (error) {
    console.error(`Error geocoding ${address}:`, error.message);
    return null;
  }
}

async function backfillGeocodingForProjects() {
  try {
    console.log('Starting geocoding backfill...\n');
    
    // Find projects with address but no coordinates
    const projectsNeedingGeocode = await prisma.project.findMany({
      where: {
        address: {
          not: null,
        },
        OR: [
          { latitude: null },
          { longitude: null },
        ],
      },
      select: {
        id: true,
        name: true,
        address: true,
      },
    });
    
    console.log(`Found ${projectsNeedingGeocode.length} projects needing geocoding\n`);
    
    let successCount = 0;
    let failCount = 0;
    
    for (const project of projectsNeedingGeocode) {
      console.log(`Processing: ${project.name}`);
      console.log(`  Address: ${project.address}`);
      
      // Use direct geocoding
      const result = await geocodeDirectly(project.address);
      
      if (result) {
        // Update project with coordinates
        await prisma.project.update({
          where: { id: project.id },
          data: {
            latitude: result.latitude,
            longitude: result.longitude,
          },
        });
        
        console.log(`  ✓ Success: ${result.latitude}, ${result.longitude}\n`);
        successCount++;
      } else {
        console.log(`  ✗ Failed to geocode\n`);
        failCount++;
      }
      
      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    console.log('Backfill complete!');
    console.log(`Success: ${successCount}, Failed: ${failCount}`);
    
  } catch (error) {
    console.error('Error during backfill:', error);
  } finally {
    await prisma.$disconnect();
  }
}

backfillGeocodingForProjects();
