require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkProjectLocations() {
  try {
    console.log('Checking project location data...\n');
    
    const projects = await prisma.project.findMany({
      select: {
        id: true,
        name: true,
        address: true,
        latitude: true,
        longitude: true,
        status: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 20
    });
    
    console.log(`Total projects found: ${projects.length}\n`);
    
    projects.forEach((project, index) => {
      console.log(`${index + 1}. ${project.name}`);
      console.log(`   Address: ${project.address || 'NULL'}`);
      console.log(`   Latitude: ${project.latitude || 'NULL'}`);
      console.log(`   Longitude: ${project.longitude || 'NULL'}`);
      console.log(`   Status: ${project.status}`);
      console.log('');
    });
    
    const withLocation = projects.filter(p => p.latitude && p.longitude);
    const withAddress = projects.filter(p => p.address);
    
    console.log('Summary:');
    console.log(`- Projects with lat/lng: ${withLocation.length}/${projects.length}`);
    console.log(`- Projects with address: ${withAddress.length}/${projects.length}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkProjectLocations();
