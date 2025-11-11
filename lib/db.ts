import { PrismaClient } from '@prisma/client'
import { initializePrismaMiddleware } from './prisma-middleware'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  middlewareInitialized?: boolean
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
})

// Initialize middleware only once
if (!globalForPrisma.middlewareInitialized) {
  initializePrismaMiddleware(prisma)
  globalForPrisma.middlewareInitialized = true
}

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma
