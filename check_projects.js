const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkProjects() {
  try {
    const projects = await prisma.project.findMany({
      where: {
        isActive: true
      },
      select: {
        id: true,
        name: true,
        status: true,
        estimatedBudget: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    console.log('Total active projects:', projects.length);
    console.log('\nProjects by status:');
    const byStatus = {};
    projects.forEach(p => {
      byStatus[p.status] = (byStatus[p.status] || 0) + 1;
    });
    console.log(JSON.stringify(byStatus, null, 2));
    
    console.log('\nAll projects:');
    projects.forEach(p => {
      console.log(`- ${p.name}: ${p.status}, Budget: ${p.estimatedBudget}, Created: ${p.createdAt.toISOString().split('T')[0]}`);
    });
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkProjects();
