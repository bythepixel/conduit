import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const globalForPrisma = global as unknown as { prisma: PrismaClient }

// Create PostgreSQL connection pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10, // Maximum number of clients in the pool
})

// Create Prisma adapter
const adapter = new PrismaPg(pool)

export const prisma =
    globalForPrisma.prisma ||
    new PrismaClient({
        adapter,
        log: process.env.NODE_ENV === 'development' ? ['query'] : [],
    })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// Cleanup on process exit
process.on('beforeExit', async () => {
    await prisma.$disconnect()
    await pool.end()
})
