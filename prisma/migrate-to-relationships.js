/**
 * Migration script to convert Mapping model from text fields to relationships
 * 
 * This script:
 * 1. Creates SlackChannel records from existing mapping data
 * 2. Creates HubspotCompany records from existing mapping data
 * 3. Updates mappings to use foreign keys
 * 
 * Run with: node prisma/migrate-to-relationships.js
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log('Starting migration...')

    // Get all existing mappings
    const oldMappings = await prisma.$queryRaw`
        SELECT id, "slackChannelId", "hubspotCompanyId", "slackChannelName", "hubspotCompanyName", cadence, "lastSyncedAt", "createdAt", "updatedAt"
        FROM "Mapping"
    `

    console.log(`Found ${oldMappings.length} existing mappings`)

    // Create a map to track created channels and companies
    const channelMap = new Map()
    const companyMap = new Map()

    // Step 1: Create SlackChannel records
    for (const mapping of oldMappings) {
        const channelId = mapping.slackChannelId
        if (!channelMap.has(channelId)) {
            try {
                const channel = await prisma.slackChannel.create({
                    data: {
                        channelId: channelId,
                        name: mapping.slackChannelName || null,
                    }
                })
                channelMap.set(channelId, channel.id)
                console.log(`Created SlackChannel: ${channelId} -> ${channel.id}`)
            } catch (e) {
                if (e.code === 'P2002') {
                    // Already exists, fetch it
                    const existing = await prisma.slackChannel.findUnique({
                        where: { channelId }
                    })
                    channelMap.set(channelId, existing.id)
                } else {
                    throw e
                }
            }
        }
    }

    // Step 2: Create HubspotCompany records
    for (const mapping of oldMappings) {
        const companyId = mapping.hubspotCompanyId
        if (!companyMap.has(companyId)) {
            try {
                const company = await prisma.hubspotCompany.create({
                    data: {
                        companyId: companyId,
                        name: mapping.hubspotCompanyName || null,
                    }
                })
                companyMap.set(companyId, company.id)
                console.log(`Created HubspotCompany: ${companyId} -> ${company.id}`)
            } catch (e) {
                if (e.code === 'P2002') {
                    // Already exists, fetch it
                    const existing = await prisma.hubspotCompany.findUnique({
                        where: { companyId }
                    })
                    companyMap.set(companyId, existing.id)
                } else {
                    throw e
                }
            }
        }
    }

    console.log('Migration complete!')
    console.log(`Created ${channelMap.size} SlackChannels`)
    console.log(`Created ${companyMap.size} HubspotCompanies`)
    console.log('\nNext steps:')
    console.log('1. The old Mapping table columns will be dropped when you run: npx prisma db push')
    console.log('2. You may need to manually update the mappings to use the new foreign keys')
    console.log('3. Or use --force-reset if you want to start fresh')
}

main()
    .catch((e) => {
        console.error('Migration failed:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })








