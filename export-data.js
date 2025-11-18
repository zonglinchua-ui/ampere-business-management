const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const path = require('path')

const prisma = new PrismaClient()

async function exportData() {
  try {
    console.log('Exporting Users...')
    const users = await prisma.user.findMany()
    
    console.log('Exporting Tenders...')
    const tenders = await prisma.tender.findMany()
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
    const exportDir = path.join('C:', 'ampere', 'migration-export-' + timestamp)
    
    // Create directory
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true })
    }
    
    // Write JSON files
    fs.writeFileSync(path.join(exportDir, 'users.json'), JSON.stringify(users, null, 2))
    fs.writeFileSync(path.join(exportDir, 'tenders.json'), JSON.stringify(tenders, null, 2))
    
    console.log('\nExport Complete!')
    console.log('Exported ' + users.length + ' users')
    console.log('Exported ' + tenders.length + ' tenders')
    console.log('\nFiles saved to: ' + exportDir)
    
  } catch (error) {
    console.error('Export failed:', error)
  } finally {
    await prisma.$disconnect()
  }
}

exportData()
