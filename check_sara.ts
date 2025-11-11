import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkSara() {
  try {
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { firstName: { contains: 'sara', mode: 'insensitive' } },
          { lastName: { contains: 'sara', mode: 'insensitive' } },
          { email: { contains: 'sara', mode: 'insensitive' } }
        ]
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true
      }
    })
    
    console.log('Found users:', JSON.stringify(users, null, 2))
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkSara()
