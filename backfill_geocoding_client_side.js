/**
 * Client-side geocoding backfill script
 * Uses the browser-compatible API endpoint
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function geocodeViaAPI(address) {
  try {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    
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
        formattedAddress: data.results[0].formatted_address,
      };
    } else if (data.status === 'REQUEST_DENIED') {
      console.error(`Geocoding failed: ${data.status} - ${data.error_message}`);
      console.error('This usually means the API key has restrictions that prevent this request.');
      return null;
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
    console.log('Starting client-side geocoding backfill...\n');
    
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
    
    if (projectsNeedingGeocode.length === 0) {
      console.log('All projects with addresses already have coordinates!');
      return;
    }
    
    let successCount = 0;
    let failCount = 0;
    
    for (const project of projectsNeedingGeocode) {
      console.log(`Processing: ${project.name}`);
      console.log(`  Address: ${project.address}`);
      
      const result = await geocodeViaAPI(project.address);
      
      if (result) {
        // Update project with coordinates
        await prisma.project.update({
          where: { id: project.id },
          data: {
            latitude: result.latitude,
            longitude: result.longitude,
          },
        });
        
        console.log(`  ✓ Success: ${result.latitude}, ${result.longitude}`);
        console.log(`  Formatted: ${result.formattedAddress}\n`);
        successCount++;
      } else {
        console.log(`  ✗ Failed to geocode\n`);
        failCount++;
      }
      
      // Add delay to avoid rate limiting (5 requests per second limit)
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    
    console.log('='.repeat(50));
    console.log('Backfill complete!');
    console.log(`✓ Success: ${successCount}`);
    console.log(`✗ Failed: ${failCount}`);
    console.log('='.repeat(50));
    
    // Show summary of projects with location data
    const totalProjects = await prisma.project.count({
      where: { isActive: true }
    });
    
    const projectsWithLocation = await prisma.project.count({
      where: {
        isActive: true,
        latitude: { not: null },
        longitude: { not: null },
      }
    });
    
    console.log('\nFinal Status:');
    console.log(`Total active projects: ${totalProjects}`);
    console.log(`Projects with location data: ${projectsWithLocation}/${totalProjects}`);
    console.log(`Projects missing location data: ${totalProjects - projectsWithLocation}/${totalProjects}`);
    
  } catch (error) {
    console.error('Error during backfill:', error);
  } finally {
    await prisma.$disconnect();
  }
}

backfillGeocodingForProjects();
