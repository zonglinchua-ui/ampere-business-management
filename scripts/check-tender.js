const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkTender() {
  const tender = await prisma.tender.findFirst({
    where: { tenderNumber: 'TND-2025-001' },
    select: {
      id: true,
      tenderNumber: true,
      title: true,
      nasDocumentPath: true
    }
  })
  
  console.log('Tender data:', JSON.stringify(tender, null, 2))
  await prisma.$disconnect()
}

checkTender()