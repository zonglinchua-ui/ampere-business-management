const { PrismaClient } = require('@prisma/client')
const path = require('path')
const fs = require('fs')

async function updateTenderNASPaths() {
  const prisma = new PrismaClient()
  
  try {
    // Get all tenders without NAS paths
    const tenders = await prisma.tender.findMany({
      where: {
        OR: [
          { nasDocumentPath: null },
          { nasDocumentPath: '' }
        ]
      },
      include: {
        Customer: true
      }
    })

    console.log(`Found ${tenders.length} tenders without NAS paths`)

    // Load NAS settings
    const settingsFile = path.join(process.cwd(), 'data', 'settings.json')
    let nasPath = 'A:\\AMPERE WEB SERVER'
    
    if (fs.existsSync(settingsFile)) {
      const settingsContent = fs.readFileSync(settingsFile, 'utf-8')
      const settings = JSON.parse(settingsContent)
      if (settings.storage?.nasPath) {
        nasPath = settings.storage.nasPath
      }
    }

    console.log(`Using NAS base path: ${nasPath}`)

    // Update each tender
    for (const tender of tenders) {
      const sanitizeFilename = (name) => {
        return name
          .replace(/[<>:"/\\|?*]/g, '')
          .replace(/\s+/g, ' ')
          .trim()
          .substring(0, 100)
      }

      const sanitizedCustomer = sanitizeFilename(tender.Customer.name)
      const sanitizedTenderName = sanitizeFilename(tender.title)
      
      const tenderFolderPath = path.join(
        nasPath,
        'TENDER',
        sanitizedCustomer,
        sanitizedTenderName
      )
      
      console.log(`Creating folder: ${tenderFolderPath}`)
      
      // Create the directory
      await fs.promises.mkdir(tenderFolderPath, { recursive: true })
      
      console.log(`Updating tender ${tender.id} with path: ${tenderFolderPath}`)
      
      // Update tender
      const updated = await prisma.tender.update({
        where: { id: tender.id },
        data: { nasDocumentPath: tenderFolderPath }
      })
      
      console.log(`✓ Updated tender ${tender.tenderNumber}`)
      console.log(`  New nasDocumentPath: ${updated.nasDocumentPath}`)
    }

    console.log('\nAll tenders updated successfully!')
  } catch (error) {
    console.error('Error updating tenders:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

updateTenderNASPaths()