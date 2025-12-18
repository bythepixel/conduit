import { prisma } from '../prisma'
import { fetchRecentMessages } from './slackService'
import { createCompanyNote } from './hubspotService'
import { generateSummary, generateFallbackSummary } from './openaiService'
import { formatMessagesForSummary } from './userMappingService'

export interface SyncResult {
    id: number
    channelId: string
    status: string
    summary?: string
    destination?: {
        name?: string
        id: string
    }
    error?: string
}

export interface MappingSyncResult {
    success: boolean
    error?: string
    results: SyncResult[]
}

/**
 * Processes a single mapping, syncing all its channels
 */
export async function processMapping(
    mapping: any,
    systemPrompt: string | undefined,
    userMap: Map<string, string>,
    isTestMode: boolean
): Promise<MappingSyncResult> {
    const results: SyncResult[] = []
    let mappingSuccess = false
    let mappingError: string | undefined = undefined
    
    // Calculate days to fetch based on cadence
    const cadence = mapping.cadence || 'daily'
    let daysToFetch: number
    switch (cadence) {
        case 'daily':
            daysToFetch = 1
            break
        case 'weekly':
            daysToFetch = 7
            break
        case 'monthly':
            daysToFetch = 30
            break
        default:
            daysToFetch = 1
    }
    
    // Process each channel in the mapping
    for (const mappingChannel of mapping.slackChannels) {
        try {
            // 1. Fetch Slack Messages (based on cadence: daily = 1 day, weekly = 7 days, monthly = 30 days)
            const history = await fetchRecentMessages(
                mappingChannel.slackChannel.channelId,
                daysToFetch
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
                const channelName = mappingChannel.slackChannel.name 
                    ? (mappingChannel.slackChannel.name.startsWith('#') ? mappingChannel.slackChannel.name : `#${mappingChannel.slackChannel.name}`)
                    : mappingChannel.slackChannel.channelId
                summaryContent = await generateSummary(
                    messagesText,
                    systemPrompt,
                    channelName
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
                await prisma.slackMapping.update({
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
            
            // Mark mapping as successful if at least one channel succeeded
            mappingSuccess = true

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
            
            // Track error for this mapping
            if (!mappingError) {
                mappingError = errorMsg
            }
        }
    }
    
    return {
        success: mappingSuccess,
        error: mappingError,
        results
    }
}

