import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../lib/prisma'
import { WebClient } from '@slack/web-api'
import { Client as HubSpotClient } from '@hubspot/api-client'
import { Configuration, OpenAIApi } from 'openai'

const slack = new WebClient(process.env.SLACK_BOT_TOKEN)
const hubspot = new HubSpotClient({ accessToken: process.env.HUBSPOT_ACCESS_TOKEN })
const configuration = new Configuration({ apiKey: process.env.OPENAI_API_KEY || 'temp-dummy-key' })
const openai = new OpenAIApi(configuration)

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
        const { mappingId, test } = req.body
        const whereClause = mappingId ? { id: Number(mappingId) } : {}
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
        const results = []
        const isTestMode = test === true

        for (const mapping of mappings) {
            // Process each channel in the mapping
            for (const mappingChannel of mapping.slackChannels) {
                try {
                    // 1. Fetch Slack Messages (Last 24 hours)
                    const yesterday = new Date()
                    yesterday.setDate(yesterday.getDate() - 1)

                    let history
                    try {
                        console.log(`[Slack API] Fetching conversation history for channel ${mappingChannel.slackChannel.channelId}`)
                        history = await slack.conversations.history({
                            channel: mappingChannel.slackChannel.channelId,
                            oldest: (yesterday.getTime() / 1000).toString(),
                        })
                        console.log(`[Slack API] Successfully fetched ${history.messages?.length || 0} messages`)
                    } catch (err: any) {
                        const errorCode = err.data?.error || err.code
                        const errorMsg = err.data?.error || err.message || 'Unknown error'
                        
                        if (errorCode === 'rate_limited' || err.status === 429 || errorMsg.includes('rate limit')) {
                            console.error(`[Slack API] Rate limit error: ${errorMsg}`, err)
                            throw new Error(`Slack API Rate Limit Error: ${errorMsg}. Will retry automatically.`)
                        }
                        
                        if (err.data?.error === 'not_in_channel') {
                            try {
                                console.log(`[Slack API] Bot not in channel ${mappingChannel.slackChannel.channelId}, attempting to join...`)
                                await slack.conversations.join({ channel: mappingChannel.slackChannel.channelId })

                                // Retry fetch
                                console.log(`[Slack API] Retrying conversation history fetch after join`)
                                history = await slack.conversations.history({
                                    channel: mappingChannel.slackChannel.channelId,
                                    oldest: (yesterday.getTime() / 1000).toString(),
                                })
                            } catch (joinErr: any) {
                                const joinErrorCode = joinErr.data?.error || joinErr.code
                                const joinErrorMsg = joinErr.data?.error || joinErr.message || 'Unknown error'
                                if (joinErrorCode === 'rate_limited' || joinErr.status === 429 || joinErrorMsg.includes('rate limit')) {
                                    console.error(`[Slack API] Rate limit error during join: ${joinErrorMsg}`, joinErr)
                                    throw new Error(`Slack API Rate Limit Error (Auto-Join): ${joinErrorMsg}. Will retry automatically.`)
                                }
                                console.error(`[Slack API] Auto-Join Failed:`, joinErr)
                                throw new Error(`Slack API Error (Auto-Join Failed): ${joinErrorMsg}`)
                            }
                        } else {
                            console.error(`[Slack API] Error fetching conversation history:`, err)
                            throw new Error(`Slack API Error: ${errorMsg}`)
                        }
                    }

                    if (!history.messages || history.messages.length === 0) {
                        results.push({ 
                            id: mapping.id, 
                            channelId: mappingChannel.slackChannel.channelId,
                            status: isTestMode ? 'No messages to test' : 'No messages to sync' 
                        })
                        continue
                    }

                // 2. Generate "Summary" (Digest of messages)

                // Fetch users from database to map Slack IDs to names
                console.log(`[Database] Fetching users with Slack IDs`)
                const dbUsers = await prisma.user.findMany({
                    where: {
                        slackId: { not: null }
                    },
                    select: {
                        slackId: true,
                        firstName: true,
                        lastName: true
                    }
                })

                // Create a map of Slack IDs to full names from database
                const userMap = new Map<string, string>()
                dbUsers.forEach(user => {
                    if (user.slackId) {
                        const fullName = `${user.firstName} ${user.lastName}`.trim()
                        userMap.set(user.slackId, fullName)
                    }
                })
                console.log(`[Database] Loaded ${userMap.size} users from database`)

                // 2. Generate "Summary" (ChatGPT)
                // Replace Slack user IDs in message text with names from database
                const messagesText = history.messages.slice().reverse().map((m: any) => {
                    const userId = m.user || 'Unknown'
                    let userName = userMap.get(userId) || userId
                    
                    // Replace user IDs in message text with names
                    let text = m.text || ''
                    // Replace <@USER_ID> mentions with names
                    text = text.replace(/<@([A-Z0-9]+)>/g, (match: string, mentionedUserId: string) => {
                        const mentionedName = userMap.get(mentionedUserId) || mentionedUserId
                        return `@${mentionedName}`
                    })
                    
                    return `${userName}: ${text}`
                }).join('\n')

                // Fetch the active prompt from database
                const activePrompt = await prisma.prompt.findFirst({
                    where: { isActive: true }
                })

                // Use active prompt if available, otherwise fallback to default
                const systemPrompt = activePrompt?.content || 'Summarize the following Slack conversation in a short, informative paragraph. The input format is "Name: Message". Use the names in your summary to attribute key points.'

                let summaryContent
                try {
                    console.log(`[OpenAI API] Creating chat completion for ${mappingChannel.slackChannel.channelId}`)
                    const completion = await openai.createChatCompletion({
                        messages: [
                            { role: 'system', content: systemPrompt },
                            { role: 'user', content: messagesText }
                        ],
                        model: 'gpt-3.5-turbo',
                    })
                    console.log(`[OpenAI API] Successfully generated summary`)
                    summaryContent = `Daily Slack Summary for ${mappingChannel.slackChannel.name || mappingChannel.slackChannel.channelId}:\n\n${completion.data.choices[0].message?.content}`
                } catch (openaiErr: any) {
                    const errorCode = openaiErr.response?.status
                    const errorMsg = openaiErr.response?.data?.error?.message || openaiErr.message || 'Unknown error'
                    
                    if (errorCode === 429 || errorMsg.toLowerCase().includes('rate limit')) {
                        console.error(`[OpenAI API] Rate limit error: ${errorMsg}`, openaiErr.response?.data)
                        throw new Error(`OpenAI API Rate Limit Error: ${errorMsg}. Will retry automatically.`)
                    }
                    
                    console.error(`[OpenAI API] Error creating chat completion:`, openaiErr.response?.data || openaiErr)
                    // Fallback to simple list
                    const fallbackLines = history.messages.map((m: any) => `- <${m.user || '?'}>: ${m.text || ''}`)
                    summaryContent = `Daily Slack Summary (Fallback): \n\n${fallbackLines.join('\n')}\n\n(OpenAI API Error: ${errorMsg})`
                }

                // 3. Create Note in HubSpot (skip if test mode)
                if (!isTestMode) {
                    // HubSpot Notes are "Engagements" or CRM Objects.
                    // Using CRM Objects API for Notes

                    const noteInput = {
                        properties: {
                            hs_timestamp: Date.now().toString(),
                            hs_note_body: summaryContent
                        },
                        associations: [
                            {
                                to: { id: mapping.hubspotCompanyId },
                                types: [
                                    { associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 190 } // 190 is Company to Note? Or Note to Company?
                                    // Standard association for Note -> Company is likely needed.
                                    // Actually, creating a note via CRM API v3:
                                ]
                            }
                        ]
                    }

                    // Wait, associating via create is simpler if we know the def.
                    // Note to Company: 'note_to_company'

                    try {
                        console.log(`[HubSpot API] Creating note for company ${mapping.hubspotCompany.companyId}`)
                        await hubspot.crm.objects.notes.basicApi.create({
                            properties: {
                                hs_timestamp: Date.now().toString(),
                                hs_note_body: summaryContent
                            },
                        associations: [
                            {
                                to: { id: mapping.hubspotCompany.companyId },
                                types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 190 }] // 190 is Note to Company
                            }
                        ]
                        })
                        console.log(`[HubSpot API] Successfully created note`)
                    } catch (err: any) {
                        const errorCode = err.code || err.statusCode || err.status
                        const errorMsg = err.message || err.body?.message || 'Unknown error'
                        
                        if (errorCode === 429 || errorMsg.toLowerCase().includes('rate limit') || errorMsg.toLowerCase().includes('too many requests')) {
                            console.error(`[HubSpot API] Rate limit error: ${errorMsg}`, err)
                            throw new Error(`HubSpot API Rate Limit Error: ${errorMsg}. Will retry automatically.`)
                        }
                        
                        console.error(`[HubSpot API] Error creating note:`, err)
                        throw new Error(`HubSpot API Error: ${errorMsg}`)
                    }

                    // Update last synced
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
