const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    const logs = await prisma.fireHookLog.findMany({
        where: {
            createdAt: {
                gte: new Date('2026-01-05T00:00:00Z'),
                lt: new Date('2026-01-06T00:00:00Z')
            }
        },
        orderBy: {
            createdAt: 'desc'
        }
    })

    console.log(JSON.stringify(logs, null, 2))
}

main()
    .catch(e => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
