import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../lib/prisma'
import { fetchRecentMessages } from '../../lib/services/slackService'
import { createCompanyNote } from '../../lib/services/hubspotService'
import { generateSummary, generateFallbackSummary } from '../../lib/services/openaiService'
import { getUserMap, formatMessagesForSummary } from '../../lib/services/userMappingService'
import { getCadencesForToday } from '../../lib/services/cadenceService'

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    // Handle Vercel Cron (GET)
    if (req.method === 'GET') {
        const { authorization } = req.headers
        if (process.env.CRON_SECRET && authorization !== `Bearer ${process.env.CRON_SECRET}`) {
            return res.status(401).json({ error: 'Unauthorized' })
        }
    } else if (req.method !== 'POST') {
        res.setHeader('Allow', ['GET', 'POST'])
        return res.status(405).end(`Method ${req.method} Not Allowed`)
    }

    try {
        // Determine if this is a cron call (GET) or manual call (POST)
        const isCronCall = req.method === 'GET'
        const { mappingId, test } = req.body || {}
        
        // Build where clause
        let whereClause: any = mappingId ? { id: Number(mappingId) } : {}
        
        // If this is a cron call, filter by cadence based on current date
        if (isCronCall) {
            const cadenceResult = getCadencesForToday()
            
            if (!cadenceResult.shouldSync) {
                console.log(`[CRON] No mappings should sync today (Day: ${cadenceResult.dayOfWeek}, Date: ${cadenceResult.dayOfMonth}/${cadenceResult.lastDayOfMonth})`)
                return res.status(200).json({ 
                    message: 'No mappings scheduled for sync today', 
                    results: [],
                    cadence: {
                        dayOfWeek: cadenceResult.dayOfWeek,
                        dayOfMonth: cadenceResult.dayOfMonth,
                        lastDayOfMonth: cadenceResult.lastDayOfMonth
                    }
                })
            }
            
            whereClause.cadence = { in: cadenceResult.cadences }
            console.log(`[CRON] Filtering mappings by cadence: ${cadenceResult.cadences.join(', ')} (Day: ${cadenceResult.dayOfWeek}, Date: ${cadenceResult.dayOfMonth}/${cadenceResult.lastDayOfMonth})`)
        }
        
        const mappings = await prisma.mapping.findMany({ 
            where: whereClause,
            include: {
                slackChannels: {
                    include: {
                        slackChannel: true
                    }
                },
                hubspotCompany: true
            }
        })
        
        if (isCronCall) {
            console.log(`[CRON] Found ${mappings.length} mapping(s) to sync`)
        }
        
        const results = []
        const isTestMode = test === true

        // Fetch active prompt once for all mappings
        const activePrompt = await prisma.prompt.findFirst({
            where: { isActive: true }
        })
        const systemPrompt = activePrompt?.content || undefined

        // Fetch user map once for all mappings
        const userMap = await getUserMap()

        for (const mapping of mappings) {
            // Process each channel in the mapping
            for (const mappingChannel of mapping.slackChannels) {
                try {
                    // 1. Fetch Slack Messages (Last 24 hours)
                    const history = await fetchRecentMessages(
                        mappingChannel.slackChannel.channelId,
                        1
                    )

                    if (!history.messages || history.messages.length === 0) {
                        results.push({ 
                            id: mapping.id, 
                            channelId: mappingChannel.slackChannel.channelId,
                            status: isTestMode ? 'No messages to test' : 'No messages to sync' 
                        })
                        continue
                    }

                    // 2. Format messages with user names
                    const messagesText = formatMessagesForSummary(history.messages, userMap)

                    // 3. Generate Summary using ChatGPT
                    let summaryContent: string
                    try {
                        summaryContent = await generateSummary(
                            messagesText,
                            systemPrompt,
                            mappingChannel.slackChannel.name || mappingChannel.slackChannel.channelId
                        )
                    } catch (openaiErr: any) {
                        // Fallback to simple list if OpenAI fails
                        summaryContent = generateFallbackSummary(
                            history.messages,
                            openaiErr.message || 'Unknown error'
                        )
                    }

                    // 4. Create Note in HubSpot (skip if test mode)
                    if (!isTestMode) {
                        await createCompanyNote(
                            mapping.hubspotCompany.companyId,
                            summaryContent
                        )

                        // Update last synced timestamp
                        await prisma.mapping.update({
                            where: { id: mapping.id },
                            data: { lastSyncedAt: new Date() }
                        })
                    }

                    results.push({
                        id: mapping.id,
                        channelId: mappingChannel.slackChannel.channelId,
                        status: isTestMode ? 'Test Complete' : 'Synced',
                        summary: summaryContent,
                        destination: {
                            name: mapping.hubspotCompany.name,
                            id: mapping.hubspotCompany.companyId
                        }
                    })

                } catch (error: any) {
                    const errorMsg = error.message || 'Unknown error'
                    console.error(`[SYNC ERROR] ${isTestMode ? 'Testing' : 'Syncing'} mapping ${mapping.id} channel ${mappingChannel.slackChannel.channelId}:`, errorMsg)
                    console.error(`[SYNC ERROR] Full error details:`, error)
                    results.push({ 
                        id: mapping.id, 
                        channelId: mappingChannel.slackChannel.channelId,
                        status: 'Failed', 
                        error: errorMsg
                    })
                }
            }
        }

        return res.status(200).json({ message: 'Sync process completed', results })

    } catch (error: any) {
        console.error('Sync Error:', error)
        return res.status(500).json({ error: 'Internal Server Error' })
    }
}
