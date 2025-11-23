import 'dotenv/config'
import prisma from './lib/db'

async function checkProjects() {
  console.log('=== Checking All Projects ===\n')
  
  // Check all projects
  const allProjects = await prisma.project.findMany({
    select: {
      id: true,
      name: true,
      projectNumber: true,
      isActive: true,
      progress: true,
      contractValue: true,
      Customer: {
        select: {
          name: true
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    },
    take: 10
  })
  
  console.log(`Total projects (latest 10): ${allProjects.length}\n`)
  
  if (allProjects.length === 0) {
    console.log('❌ No projects found in database!')
    return
  }
  
  for (const project of allProjects) {
    console.log(`Project: ${project.name} (${project.projectNumber})`)
    console.log(`  Customer: ${project.Customer.name}`)
    console.log(`  Is Active: ${project.isActive ? '✅' : '❌'}`)
    console.log(`  Contract Value: $${project.contractValue?.toLocaleString() || '0'}`)
    console.log(`  Progress: ${project.progress}%`)
    console.log()
  }
  
  // Count by status
  const activeCount = await prisma.project.count({ where: { isActive: true } })
  const withContractValue = await prisma.project.count({ 
    where: { 
      isActive: true,
      contractValue: { not: null, gt: 0 }
    } 
  })
  const withProgress = await prisma.project.count({ 
    where: { 
      isActive: true,
      contractValue: { not: null, gt: 0 },
      progress: { gt: 0 }
    } 
  })
  
  console.log('\n=== Summary ===')
  console.log(`Active projects: ${activeCount}`)
  console.log(`Active with contract value > 0: ${withContractValue}`)
  console.log(`Active with contract value > 0 AND progress > 0: ${withProgress}`)
}

checkProjects()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error)
    process.exit(1)
  })
