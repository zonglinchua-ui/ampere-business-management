require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkExcelFiles() {
  try {
    const excelCount = await prisma.document.count({
      where: {
        mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        category: 'PROPOSAL'
      }
    });
    
    console.log(`Total Excel files for quotations: ${excelCount}`);
    
    const pdfCount = await prisma.document.count({
      where: {
        mimetype: 'application/pdf',
        category: 'PROPOSAL'
      }
    });
    
    console.log(`Total PDF files for quotations: ${pdfCount}`);
    
    const quotationCount = await prisma.quotation.count();
    console.log(`Total quotations: ${quotationCount}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkExcelFiles();
