const { FirefliesService } = require('./lib/services/firefliesService')
const { prisma } = require('./lib/prisma')

async function testProcess(id) {
    console.log(`Testing process for log ID: ${id}`)
    const result = await FirefliesService.processFireHookLog(id)
    console.log('Result:', JSON.stringify(result, null, 2))

    const updatedLog = await prisma.fireHookLog.findUnique({ where: { id } })
    console.log('Updated Log State:', JSON.stringify(updatedLog, null, 2))
}

const logId = parseInt(process.argv[2], 10)
if (isNaN(logId)) {
    console.error('Please provide a log ID')
    process.exit(1)
}

testProcess(logId)
    .catch(e => {
        console.error('Test failed:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
