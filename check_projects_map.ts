import { config } from 'dotenv'
import { PrismaClient } from '@prisma/client'

// Load environment variables
config()

const prisma = new PrismaClient()

async function checkProjects() {
  console.log('\n=== Checking Projects for Map Display ===\n')
  
  // Check all projects
  const allProjects = await prisma.project.findMany({
    select: {
      id: true,
      projectNumber: true,
      name: true,
      status: true,
      isActive: true,
      address: true,
      latitude: true,
      longitude: true,
      progress: true,
    },
    take: 10,
  })
  
  console.log(`Total projects found: ${allProjects.length}\n`)
  
  allProjects.forEach(p => {
    console.log(`Project: ${p.projectNumber} - ${p.name}`)
    console.log(`  Status: ${p.status}`)
    console.log(`  IsActive: ${p.isActive}`)
    console.log(`  Address: ${p.address || 'N/A'}`)
    console.log(`  Latitude: ${p.latitude || 'N/A'}`)
    console.log(`  Longitude: ${p.longitude || 'N/A'}`)
    console.log(`  Progress: ${p.progress}%`)
    console.log()
  })
  
  // Check projects matching the map filter
  const mapProjects = await prisma.project.findMany({
    where: {
      isActive: true,
      status: {
        in: ['PLANNING', 'IN_PROGRESS'],
      },
      AND: [
        { latitude: { not: null } },
        { longitude: { not: null } },
      ],
    },
    select: {
      id: true,
      projectNumber: true,
      name: true,
      latitude: true,
      longitude: true,
    },
  })
  
  console.log(`\nProjects matching map filter (IN_PROGRESS/PLANNING with lat/lng): ${mapProjects.length}`)
  if (mapProjects.length > 0) {
    mapProjects.forEach(p => {
      console.log(`  - ${p.projectNumber}: ${p.name} [${p.latitude}, ${p.longitude}]`)
    })
  }
  
  // Count by status
  const statusCounts = await prisma.project.groupBy({
    by: ['status'],
    _count: true,
  })
  
  console.log('\nProjects by status:')
  statusCounts.forEach(s => {
    console.log(`  ${s.status}: ${s._count}`)
  })
  
  // Count projects with location data
  const withLocation = await prisma.project.count({
    where: {
      AND: [
        { latitude: { not: null } },
        { longitude: { not: null } },
      ],
    },
  })
  
  console.log(`\nProjects with location data: ${withLocation}`)
  
  await prisma.$disconnect()
}

checkProjects().catch(console.error)
